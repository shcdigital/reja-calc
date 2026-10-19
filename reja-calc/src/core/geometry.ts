/**
 * Motor geométrico de la reja.
 *
 * Convenciones (ver docs/FORMULAS.md):
 *  - W, H: ancho y alto EXTERIORES de la reja terminada.
 *  - pf: dimensión del perfil del marco que queda a la vista (en el plano de la reja).
 *  - Wi = W − 2·pf, Hi = H − 2·pf: vano interior libre.
 *  - rw: dimensión del refuerzo central que queda en el plano.
 *  - d: diámetro exterior del caño redondo.
 *  - jg: descuento por extremo en cada unión a tope (holgura de armado).
 *  - Origen de coordenadas: esquina superior izquierda exterior; Y crece hacia abajo.
 */

import { round1, fmtMm } from './format';
import {
  depthDim,
  findRect,
  findRound,
  inPlaneDim,
  isValidRect,
  isValidRound,
  profileLabel,
  sectionKey,
} from './profiles';
import type {
  BarDistribution,
  Catalog,
  Design,
  Issue,
  LayoutRect,
  Piece,
  PieceType,
  ProjectConfig,
  RectProfile,
} from './types';

export const STRUCTURAL_DISCLAIMER =
  'Si la reja lleva refuerzo central, es un componente estructural cuya suficiencia depende de las ' +
  'dimensiones, las fijaciones y las cargas. Esta herramienta calcula medidas y cortes; no verifica ' +
  'que la reja sea estructuralmente segura.';

const EPS = 1e-9;

// ───────────────────────── Distribución de barrotes ─────────────────────────

/**
 * Distribuye n barrotes de diámetro d en un alto interior Hi con separaciones libres
 * uniformes (incluidas las dos que quedan contra el marco):
 *
 *     n·d + (n+1)·g = Hi   →   g = (Hi − n·d) / (n + 1)
 *
 * Modo automático: n mínimo tal que g ≤ separación deseada (máxima):
 *
 *     n = max(1, ceil((Hi − gDes) / (d + gDes)))
 *
 * Si con ese n resulta g < separación mínima, ambos límites no pueden cumplirse a la vez:
 * se mantiene la cuenta que respeta el máximo (la que no deja huecos mayores) y se emite
 * un aviso con las alternativas.
 */
export function distributeBars(params: {
  innerHeightMm: number;
  barOdMm: number;
  desiredGapMm: number;
  minGapMm: number;
  mode: 'auto' | 'manual';
  manualCount: number;
  /** Y del borde superior del vano interior respecto del borde exterior de la reja. */
  innerTopMm: number;
}): { distribution: BarDistribution | null; issues: Issue[] } {
  const { innerHeightMm: Hi, barOdMm: d, desiredGapMm: gDes, minGapMm: gMin } = params;
  const issues: Issue[] = [];

  const gapFor = (n: number) => (Hi - n * d) / (n + 1);
  const nForMaxGap = Math.max(1, Math.ceil((Hi - gDes) / (d + gDes) - EPS));
  const nForMinGap = Math.floor((Hi - gMin) / (d + gMin) + EPS); // máximo n con g ≥ gMin

  const alt = (n: number) => ({ count: n, gapMm: round1(gapFor(n)) });
  const alternatives: { count: number; gapMm: number }[] = [];
  const pushAlt = (n: number) => {
    if (n >= 1 && gapFor(n) > EPS && !alternatives.some((a) => a.count === n)) alternatives.push(alt(n));
  };

  if (Hi - d <= EPS) {
    issues.push({
      level: 'error',
      code: 'bars-no-space',
      message: `El alto interior (${fmtMm(Hi)}) no alcanza para colocar ni un barrote de Ø${d} mm. Aumentá el alto de la ventana o elegí un caño de menor diámetro.`,
    });
    return { distribution: null, issues };
  }

  let n: number;
  if (params.mode === 'manual') {
    n = Math.floor(params.manualCount);
    if (!(n >= 1)) {
      issues.push({ level: 'error', code: 'bars-manual-invalid', message: 'La cantidad manual de barrotes debe ser un entero mayor o igual a 1.' });
      return { distribution: null, issues };
    }
  } else {
    n = nForMaxGap;
  }

  const g = gapFor(n);
  if (g <= EPS) {
    pushAlt(Math.max(1, Math.min(n - 1, nForMinGap)));
    issues.push({
      level: 'error',
      code: 'bars-overflow',
      message: `${n} barrotes de Ø${d} mm no entran en ${fmtMm(Hi)} de alto interior (ocupan ${fmtMm(n * d)}). Probá con ${alternatives.map((a) => a.count).join(' o ') || 'menos'} barrotes.`,
    });
    return { distribution: null, issues };
  }

  const tooWide = g > gDes + 1e-6;
  const tooNarrow = g < gMin - 1e-6;

  if (tooWide || tooNarrow) {
    pushAlt(nForMaxGap);
    pushAlt(nForMinGap);
    const altText = alternatives
      .map((a) => `${a.count} barrotes (separación ${fmtMm(a.gapMm)})`)
      .join(' o ');
    if (tooWide) {
      issues.push({
        level: 'warning',
        code: 'gap-above-max',
        message: `Con ${n} barrotes la separación libre es ${fmtMm(round1(g))}, mayor que el máximo de ${fmtMm(gDes)}. Alternativas: ${altText}.`,
      });
    } else {
      issues.push({
        level: 'warning',
        code: 'gap-below-min',
        message:
          params.mode === 'auto'
            ? `No existe una cantidad de barrotes que cumpla a la vez separación ≤ ${fmtMm(gDes)} y ≥ ${fmtMm(gMin)} en ${fmtMm(Hi)} de alto interior. Se usan ${n} barrotes (separación ${fmtMm(round1(g))}, respeta el máximo pero queda bajo el mínimo). Alternativas: ${altText}.`
            : `Con ${n} barrotes la separación libre es ${fmtMm(round1(g))}, menor que el mínimo de ${fmtMm(gMin)}. Alternativas: ${altText}.`,
      });
    }
  }

  const tops = Array.from({ length: n }, (_, i) => params.innerTopMm + g + i * (d + g));

  return {
    distribution: {
      count: n,
      gapMm: g,
      innerHeightMm: Hi,
      topsMm: tops,
      alternatives,
      respectsLimits: !tooWide && !tooNarrow,
    },
    issues,
  };
}

// ───────────────────────── Diseño completo ─────────────────────────

const pad2 = (n: number) => String(n).padStart(2, '0');

export function computeDesign(config: ProjectConfig, catalog: Catalog): Design {
  const issues: Issue[] = [];
  const fail = (code: string, message: string) => issues.push({ level: 'error', code, message });
  const empty = (): Design => ({ issues, derived: null, distribution: null, pieces: [], layout: [] });

  const { widthMm: W, heightMm: H } = config.window;
  const fab = config.fabrication;

  // 1) Validación de entradas
  if (!Number.isFinite(W) || W <= 0) fail('width', 'El ancho de la ventana debe ser mayor que cero.');
  if (!Number.isFinite(H) || H <= 0) fail('height', 'El alto de la ventana debe ser mayor que cero.');
  if (!Number.isFinite(fab.stockLengthMm) || fab.stockLengthMm <= 0) fail('stock', 'El largo comercial debe ser mayor que cero.');
  if (!Number.isFinite(fab.kerfMm) || fab.kerfMm < 0) fail('kerf', 'El ancho del disco de corte no puede ser negativo.');
  if (!Number.isFinite(fab.endTrimMm) || fab.endTrimMm < 0 || fab.endTrimMm >= fab.stockLengthMm)
    fail('trim', 'El refilado de punta debe ser ≥ 0 y menor que el largo comercial.');
  if (!Number.isFinite(fab.jointGapMm) || fab.jointGapMm < 0) fail('joint', 'El descuento por unión no puede ser negativo.');
  if (!Number.isFinite(fab.horizontalEdgeMm) || fab.horizontalEdgeMm < 0)
    fail('horizontal-edge', 'El margen del agujero de MS/MI al borde del lateral no puede ser negativo.');
  if (!Number.isFinite(config.bars.desiredGapMm) || config.bars.desiredGapMm <= 0)
    fail('gap-desired', 'La separación libre deseada debe ser mayor que cero.');
  if (!Number.isFinite(config.bars.minGapMm) || config.bars.minGapMm <= 0)
    fail('gap-min', 'La separación libre mínima debe ser mayor que cero.');
  if (config.bars.minGapMm > config.bars.desiredGapMm)
    fail('gap-order', 'La separación mínima no puede ser mayor que la separación deseada (máxima).');

  const round = findRound(catalog, config.roundProfileId);
  const frameP = findRect(catalog, config.frame.profileId);
  const hasReinf = config.reinforcement.enabled;
  const reinfP: RectProfile | undefined = !hasReinf
    ? undefined
    : config.reinforcement.sameAsFrame
      ? frameP
      : findRect(catalog, config.reinforcement.profileId);
  const reinfOrientation = !hasReinf
    ? config.frame.orientation
    : config.reinforcement.sameAsFrame
      ? config.frame.orientation
      : config.reinforcement.orientation;

  if (!isValidRound(round)) fail('round-profile', 'El caño redondo no tiene dimensiones válidas (diámetro y espesor > 0, espesor < radio).');
  if (!isValidRect(frameP)) fail('frame-profile', 'El perfil del marco no tiene dimensiones válidas.');
  if (hasReinf && !isValidRect(reinfP)) fail('reinf-profile', 'El perfil del refuerzo central no tiene dimensiones válidas.');
  if (issues.some((i) => i.level === 'error') || !isValidRound(round) || !isValidRect(frameP) || (hasReinf && !isValidRect(reinfP))) {
    return empty();
  }

  // 2) Magnitudes derivadas
  const pf = inPlaneDim(frameP, config.frame.orientation);
  const frameDepth = depthDim(frameP, config.frame.orientation);
  const rw = hasReinf ? inPlaneDim(reinfP!, reinfOrientation) : 0;
  const reinfDepth = hasReinf ? depthDim(reinfP!, reinfOrientation) : 0;
  const d = round.odMm;
  const horizontalRound = config.frame.horizontalProfile === 'round';
  /** Dimensión a la vista de los tramos horizontales del marco: el perfil rectangular o el caño redondo. */
  const pfH = horizontalRound ? d : pf;
  /** Diámetro de los agujeros de la cara interior de los laterales (barrotes y MS/MI). */
  const holeD = d + fab.throughHoleClearanceMm;
  /** Margen del borde del agujero de MS/MI al extremo del lateral (0 si no son redondos). */
  const horizontalEdge = horizontalRound ? fab.horizontalEdgeMm : 0;
  /** Borde superior del caño redondo de MS: deja el agujero a `horizontalEdge` del extremo. */
  const railTop = horizontalRound ? horizontalEdge + (holeD - d) / 2 : 0;
  /** Borde interior del vano: debajo de MS (o de su reemplazo rectangular). */
  const innerTop = horizontalRound ? railTop + d : pfH;
  const Wi = W - 2 * pf;
  const Hi = H - 2 * innerTop;
  const jg = fab.jointGapMm;
  const sector = hasReinf ? (Wi - rw) / 2 : Wi / 2;

  // Extremos de los barrotes en los laterales (agujero en la cara interior del perfil).
  const inserted = config.bars.ends === 'inserted';
  const frameWall = frameP.thicknessMm;
  const setback = fab.socketSetbackMm;
  /** Los MS/MI redondos siempre se alojan en agujeros de los laterales. */
  const penetratesLateral = inserted || horizontalRound;
  /** Cuánto entra el barrote (o el tramo redondo) en cada lateral, desde su cara interior. */
  const pen = penetratesLateral ? pf - frameWall - setback : 0;

  if (Wi <= 0 || Hi <= 0) {
    fail('frame-too-big', horizontalRound
      ? `El marco (laterales de ${fmtMm(pf)} y tramos superior/inferior de caño redondo Ø${fmtMm(d)} a ${fmtMm(horizontalEdge)} mm del borde) no deja vano interior en una reja de ${fmtMm(W)} × ${fmtMm(H)}.`
      : `El marco (${fmtMm(pf)} a la vista por lado) no deja vano interior en una reja de ${fmtMm(W)} × ${fmtMm(H)}.`);
    return empty();
  }
  if (hasReinf && sector <= 2 * jg + EPS) {
    fail('reinf-too-big', `El refuerzo central (${fmtMm(rw)}) no deja espacio útil a cada lado en un vano interior de ${fmtMm(Wi)}.`);
    return empty();
  }
  if (Hi - 2 * jg <= EPS) {
    fail('joint-too-big', hasReinf
      ? 'Los descuentos por unión dejan el refuerzo central y los laterales con largo cero o negativo.'
      : 'Los descuentos por unión dejan los laterales con largo cero o negativo.');
    return empty();
  }
  if (penetratesLateral && pen <= EPS) {
    fail('lateral-too-thin', `El perfil del marco (${fmtMm(pf)} a la vista, pared de ${fmtMm(frameWall)}) no tiene profundidad útil para alojar los barrotes o los tramos MS/MI en el lateral.`);
    return empty();
  }

  // 3) Barrotes
  const { distribution, issues: distIssues } = distributeBars({
    innerHeightMm: Hi,
    barOdMm: d,
    desiredGapMm: config.bars.desiredGapMm,
    minGapMm: config.bars.minGapMm,
    mode: config.bars.mode,
    manualCount: config.bars.manualCount,
    innerTopMm: innerTop,
  });
  issues.push(...distIssues);

  const barKey = sectionKey(round);
  const frameKey = sectionKey(frameP);
  const reinfKey = hasReinf ? sectionKey(reinfP!) : '';
  const derived = {
    innerWidthMm: Wi,
    innerHeightMm: Hi,
    frameInPlaneMm: pf,
    frameDepthMm: frameDepth,
    frameHorizontalMm: pfH,
    horizontalRound,
    horizontalEdgeMm: horizontalEdge,
    withReinforcement: hasReinf,
    reinfInPlaneMm: rw,
    reinfDepthMm: reinfDepth,
    sectorWidthMm: sector,
    barsInLateral: inserted,
    lateralPenetrationMm: pen,
    lateralHoleMm: penetratesLateral ? holeD : 0,
    barOdMm: d,
    barSectionKey: barKey,
    frameSectionKey: frameKey,
    reinfSectionKey: reinfKey,
  };

  if (!distribution) {
    return { issues, derived, distribution: null, pieces: [], layout: [] };
  }

  // 4) Despiece
  const pieces: Piece[] = [];
  const layout: LayoutRect[] = [];
  const frameLabel = profileLabel(frameP);
  const reinfLabel = reinfP ? profileLabel(reinfP) : '';
  const barLabel = profileLabel(round);

  const add = (
    p: Omit<Piece, 'quantity' | 'lengthMm'> & { lengthMm: number },
    rect: { x: number; y: number; w: number; h: number },
  ) => {
    pieces.push({ ...p, quantity: 1, lengthMm: round1(p.lengthMm) });
    layout.push({ pieceId: p.id, type: p.type, ...rect });
  };

  const fullH = !horizontalRound && config.frame.assembly === 'horizontal-full';
  const framePiece = (id: string, type: PieceType, length: number, location: string, notes: string) => ({
    id, type, profileId: frameP.id, profileLabel: frameLabel, sectionKey: frameKey, lengthMm: length, location, notes,
  });
  const horizontalLabel = horizontalRound ? barLabel : frameLabel;
  /** Tramos superior e inferior: el mismo perfil rectangular del marco o el caño redondo de los barrotes. */
  const horizontalPiece = (id: string, type: PieceType, length: number, location: string, notes: string) => ({
    id, type,
    profileId: horizontalRound ? round.id : frameP.id,
    profileLabel: horizontalLabel,
    sectionKey: horizontalRound ? barKey : frameKey,
    lengthMm: length, location, notes,
  });
  /** Separación del borde exterior al extremo de MS/MI: alojado (redondo) o a tope (rectangular). */
  const horizontalInset = horizontalRound ? frameWall + setback : pf + jg;
  const horizontalLength = horizontalRound ? W - 2 * horizontalInset : Wi - 2 * jg;
  const horizontalNote = horizontalRound
    ? ` Tramo de caño redondo Ø${fmtMm(d)}; va alojado en los agujeros de los laterales, con el borde del agujero a ${fmtMm(horizontalEdge)} mm del extremo.`
    : '';
  const lateralHoleCount = (inserted ? distribution.count : 0) + (horizontalRound ? 2 : 0);
  const lateralHoleDetails = [
    inserted ? 'uno por barrote, con el eje a la altura de cada barrote' : '',
    horizontalRound
      ? `uno para MS y otro para MI, con los ejes a ${fmtMm(railTop + d / 2)} de los bordes superior e inferior`
      : '',
  ].filter(Boolean).join('; ');
  const lateralNote = lateralHoleCount > 0
    ? ` Perforar ${lateralHoleCount} ${lateralHoleCount === 1 ? 'agujero' : 'agujeros'} Ø${holeD} mm (barrote Ø${d} + ${fmtMm(fab.throughHoleClearanceMm)} de holgura) en la cara interior: ${lateralHoleDetails}.` +
      (inserted ? ` El barrote entra ${fmtMm(pen)} y se frena a ${fmtMm(setback)} de la cara exterior.` : '') +
      (horizontalRound ? ` Los tramos MS/MI entran ${fmtMm(pen)} y se frenan a ${fmtMm(setback)} de la cara exterior.` : '')
    : '';
  const horizontalJointNote = horizontalRound
    ? `Va entre LI y LD, alojado en la cara interior de los laterales. Largo = ancho exterior − 2×(${fmtMm(frameWall)} de pared + ${fmtMm(setback)} de freno).`
    : `Va entre LI y LD. Largo = ancho exterior − 2×${fmtMm(pf)}${jg ? ` − 2×${fmtMm(jg)} de holgura` : ''}.`;
  const horizontalLocation = (side: 'superior' | 'inferior') =>
    horizontalRound
      ? `Marco, tramo ${side} (caño redondo alojado entre laterales)`
      : `Marco, tramo ${side} (entre laterales)`;

  if (fullH) {
    add(horizontalPiece('MS', 'frame-top', W, 'Marco, tramo superior (largo exterior completo)', `Tramo completo. Los laterales se sueldan a tope entre MS y MI.${horizontalNote}`),
      { x: 0, y: 0, w: W, h: pfH });
    add(horizontalPiece('MI', 'frame-bottom', W, 'Marco, tramo inferior (largo exterior completo)', `Tramo completo. Los laterales se sueldan a tope entre MS y MI.${horizontalNote}`),
      { x: 0, y: H - pfH, w: W, h: pfH });
    add(framePiece('LI', 'frame-left', Hi - 2 * jg, 'Marco, lateral izquierdo (entre tramos horizontales)', `Va entre MS y MI. Largo = alto exterior − 2×${fmtMm(pfH)}${jg ? ` − 2×${fmtMm(jg)} de holgura` : ''}.${lateralNote}`),
      { x: 0, y: pfH + jg, w: pf, h: Hi - 2 * jg });
    add(framePiece('LD', 'frame-right', Hi - 2 * jg, 'Marco, lateral derecho (entre tramos horizontales)', `Va entre MS y MI. Largo = alto exterior − 2×${fmtMm(pfH)}${jg ? ` − 2×${fmtMm(jg)} de holgura` : ''}.${lateralNote}`),
      { x: W - pf, y: pfH + jg, w: pf, h: Hi - 2 * jg });
  } else {
    const lateralJointNote = horizontalRound
      ? ' Los tramos MS/MI se alojan en agujeros de la cara interior.'
      : ' Los tramos horizontales se sueldan a tope entre LI y LD.';
    add(framePiece('LI', 'frame-left', H, 'Marco, lateral izquierdo (largo exterior completo)', `Tramo completo.${lateralJointNote}${lateralNote}`),
      { x: 0, y: 0, w: pf, h: H });
    add(framePiece('LD', 'frame-right', H, 'Marco, lateral derecho (largo exterior completo)', `Tramo completo.${lateralJointNote}${lateralNote}`),
      { x: W - pf, y: 0, w: pf, h: H });
    add(horizontalPiece('MS', 'frame-top', horizontalLength, horizontalLocation('superior'), `${horizontalJointNote}${horizontalNote}`),
      { x: horizontalInset, y: railTop, w: horizontalLength, h: pfH });
    add(horizontalPiece('MI', 'frame-bottom', horizontalLength, horizontalLocation('inferior'), `${horizontalJointNote}${horizontalNote}`),
      { x: horizontalInset, y: H - railTop - pfH, w: horizontalLength, h: pfH });
  }

  const through = hasReinf && config.bars.crossing === 'through';
  /** Dónde arranca el barrote contando desde el borde exterior (mm). */
  const endInset = inserted ? frameWall + setback : pf + jg;
  const fullLen = W - 2 * endInset;
  const sideLen = (W / 2 - rw / 2 - jg) - endInset;
  const endNote = inserted
    ? ` La punta entra ${fmtMm(pen)} en el agujero del lateral (Ø${holeD} mm) y se frena a ${fmtMm(setback)} de la cara exterior.`
    : '';

  if (hasReinf) {
    add(
      {
        id: 'RC', type: 'reinforcement', profileId: reinfP!.id, profileLabel: reinfLabel, sectionKey: reinfKey,
        lengthMm: Hi - 2 * jg,
        location: `Refuerzo vertical central, eje a ${fmtMm(W / 2)} del borde izquierdo exterior`,
        notes:
          `Va entre MS y MI.${jg ? ` Largo = alto interior ${fmtMm(Hi)} − 2×${fmtMm(jg)} de holgura.` : ` Largo = alto interior ${fmtMm(Hi)}.`}` +
          (through
            ? ` Perforar ${distribution.count} agujeros Ø${holeD} mm (barrote Ø${d} + ${fab.throughHoleClearanceMm} mm de holgura) con los ejes a las alturas indicadas en cada barrote.`
            : ''),
      },
      { x: W / 2 - rw / 2, y: innerTop + jg, w: rw, h: Hi - 2 * jg },
    );
  }

  const rightX = W / 2 + rw / 2 + jg;
  distribution.topsMm.forEach((top, i) => {
    const n = pad2(i + 1);
    const centerFromTop = top + d / 2;
    const where = `Barrote ${i + 1} de ${distribution.count} (desde arriba), eje a ${fmtMm(round1(centerFromTop))} del borde superior exterior`;
    if (!hasReinf) {
      add(
        {
          id: `B${n}`, type: 'bar', profileId: round.id, profileLabel: barLabel, sectionKey: barKey,
          lengthMm: fullLen, location: where,
          notes: (inserted
            ? 'Barrote continuo alojado en los agujeros de los dos laterales (la reja no lleva refuerzo central).'
            : 'Barrote continuo entre laterales (la reja no lleva refuerzo central).') + endNote,
        },
        { x: endInset, y: top, w: fullLen, h: d },
      );
    } else if (through) {
      add(
        {
          id: `B${n}`, type: 'bar', profileId: round.id, profileLabel: barLabel, sectionKey: barKey,
          lengthMm: fullLen,
          location: where,
          notes: `Barrote continuo; atraviesa el refuerzo central por un agujero Ø${holeD} mm.` + endNote,
        },
        { x: endInset, y: top, w: fullLen, h: d },
      );
    } else {
      add(
        {
          id: `B${n}-I`, type: 'bar', profileId: round.id, profileLabel: barLabel, sectionKey: barKey,
          lengthMm: sideLen, location: `${where} — sector izquierdo`,
          notes: (inserted ? 'Va desde el agujero del lateral izquierdo hasta el refuerzo central.' : 'Va entre el lateral izquierdo y el refuerzo central.') + endNote,
        },
        { x: endInset, y: top, w: sideLen, h: d },
      );
      add(
        {
          id: `B${n}-D`, type: 'bar', profileId: round.id, profileLabel: barLabel, sectionKey: barKey,
          lengthMm: sideLen, location: `${where} — sector derecho`,
          notes: (inserted ? 'Va desde el refuerzo central hasta el agujero del lateral derecho.' : 'Va entre el refuerzo central y el lateral derecho.') + endNote,
        },
        { x: rightX, y: top, w: sideLen, h: d },
      );
    }
  });

  // 5) Controles de las piezas generadas
  const usable = fab.stockLengthMm - fab.endTrimMm;
  for (const p of pieces) {
    if (!(p.lengthMm > 0)) {
      fail('piece-zero', `La pieza ${p.id} resulta de largo cero o negativo; revisá las dimensiones y descuentos.`);
    } else if (p.lengthMm > usable + EPS) {
      const hint = p.type === 'frame-top' || p.type === 'frame-bottom' || p.type === 'frame-left' || p.type === 'frame-right'
        ? ' Probá el otro método de armado del marco, si la otra medida entra en el caño comercial.'
        : '';
      fail('piece-too-long', `La pieza ${p.id} mide ${fmtMm(p.lengthMm)} y supera el largo utilizable del caño comercial (${fmtMm(usable)}); no se permite unir recortes.${hint}`);
    }
  }

  // 6) Advertencias de compatibilidad
  if (d > frameDepth + EPS) {
    issues.push({
      level: 'warning',
      code: 'bar-wider-than-frame',
      message: `El caño redondo (Ø${d} mm) es más ancho que la cara de apoyo del marco (${fmtMm(frameDepth)} hacia afuera). El barrote no apoyará completo contra el lateral; considerá otro perfil u orientación.`,
    });
  }
  if (hasReinf && d > reinfDepth + EPS) {
    issues.push({
      level: 'warning',
      code: 'bar-wider-than-reinf',
      message: `El caño redondo (Ø${d} mm) es más ancho que la cara de apoyo del refuerzo central (${fmtMm(reinfDepth)} hacia afuera).`,
    });
  }
  if (through && reinfP && holeD > reinfDepth - 2 * reinfP.thicknessMm + EPS) {
    issues.push({
      level: 'warning',
      code: 'hole-too-big',
      message: `El agujero Ø${holeD} mm no entra en la cara del refuerzo central (${fmtMm(reinfDepth)}).`,
    });
  }
  if (penetratesLateral && holeD > frameDepth - 2 * frameWall + EPS) {
    issues.push({
      level: 'warning',
      code: 'lateral-hole-too-big',
      message: `El agujero Ø${holeD} mm del lateral no entra en el hueco del perfil (${fmtMm(frameDepth)} de profundidad − 2 paredes de ${fmtMm(frameWall)}): tocaría las paredes laterales. Usá un caño redondo más fino o un perfil más hondo.`,
    });
  }

  return { issues, derived, distribution, pieces, layout };
}

// ───────────────────────── Agrupación para la lista de cortes ─────────────────────────

export interface PieceGroup {
  ids: string[];
  type: PieceType;
  profileLabel: string;
  sectionKey: string;
  lengthMm: number;
  quantity: number;
  notes: string;
}

/** Agrupa piezas idénticas (mismo tipo, perfil y largo) para la hoja de taller. */
export function groupPieces(pieces: Piece[]): PieceGroup[] {
  const groups = new Map<string, PieceGroup>();
  for (const p of pieces) {
    const key = `${p.type}|${p.sectionKey}|${p.lengthMm}`;
    const g = groups.get(key);
    if (g) {
      g.ids.push(p.id);
      g.quantity += 1;
    } else {
      groups.set(key, {
        ids: [p.id], type: p.type, profileLabel: p.profileLabel, sectionKey: p.sectionKey,
        lengthMm: p.lengthMm, quantity: 1, notes: p.notes,
      });
    }
  }
  return [...groups.values()];
}

export const PIECE_TYPE_LABEL: Record<PieceType, string> = {
  'frame-top': 'Marco superior',
  'frame-bottom': 'Marco inferior',
  'frame-left': 'Lateral izquierdo',
  'frame-right': 'Lateral derecho',
  reinforcement: 'Refuerzo central',
  bar: 'Barrote',
};
