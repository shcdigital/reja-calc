/**
 * Motor geométrico de la reja.
 *
 * Convenciones (ver docs/FORMULAS.md):
 *  - W, H: ancho y alto EXTERIORES de la reja terminada.
 *  - pf: dimensión del perfil del marco que queda a la vista (en el plano de la reja).
 *  - Wi = W − 2·pf, Hi = H − 2·pf: vano interior libre.
 *  - rw: dimensión del refuerzo central que queda en el plano.
 *  - d: diámetro (caño redondo) o lado (barra maciza cuadrada) del barrote.
 *  - jg: descuento por extremo en cada unión a tope (holgura de armado).
 *  - Origen de coordenadas: esquina superior izquierda exterior; Y crece hacia abajo.
 *
 * La reja moderna usa caños y barrotes horizontales; la clásica usa planchuelas
 * y barras macizas cuadradas verticales. Ambas comparten la distribución uniforme
 * de barrotes y el mismo pipeline de despiece/corte.
 */

import { round1, fmtMm, fmtNum } from './format';
import {
  barShape,
  depthDim,
  findRect,
  findRound,
  inPlaneDim,
  isHollowRound,
  isSolidRect,
  isSolidSquare,
  isValidRect,
  isValidRound,
  profileLabel,
  resolveStyleConfig,
  sectionKey,
} from './profiles';
import type {
  BarDistribution,
  BarShape,
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

/** Texto de la medida del barrote: Ø para redondos, lado × lado para cuadrados. */
export function barSizeLabel(sizeMm: number, shape: BarShape): string {
  return shape === 'square'
    ? `${fmtNum(sizeMm)} × ${fmtNum(sizeMm)} mm`
    : `Ø${fmtNum(sizeMm)} mm`;
}

/** Texto del agujero: Ø para barras redondas, lado × lado para cuadradas. */
export function holeSizeLabel(sizeMm: number, shape: BarShape): string {
  return shape === 'square'
    ? `${fmtNum(sizeMm)} × ${fmtNum(sizeMm)} mm`
    : `Ø${fmtNum(sizeMm)} mm`;
}

// ───────────────────────── Distribución de barrotes ─────────────────────────

/**
 * Distribuye n barrotes de medida d en un vano interior de `spanMm` con
 * separaciones libres uniformes (incluidas las dos que quedan contra el marco):
 *
 *     n·d + (n+1)·g = spanMm   →   g = (spanMm − n·d) / (n + 1)
 *
 * Modo automático: n mínimo tal que g ≤ separación deseada (máxima):
 *
 *     n = max(1, ceil((spanMm − gDes) / (d + gDes)))
 *
 * Si con ese n resulta g < separación mínima, ambos límites no pueden cumplirse a la vez:
 * se mantiene la cuenta que respeta el máximo (la que no deja huecos mayores) y se emite
 * un aviso con las alternativas.
 */
export function distributeBars(params: {
  spanMm: number;
  barSizeMm: number;
  barShape?: BarShape;
  desiredGapMm: number;
  minGapMm: number;
  mode: 'auto' | 'manual';
  manualCount: number;
  /** Coordenada del borde interior del vano sobre el eje de distribución. */
  startMm: number;
  /** Dirección de los barrotes (no del eje de distribución). */
  direction: 'horizontal' | 'vertical';
}): { distribution: BarDistribution | null; issues: Issue[] } {
  const { spanMm: Hi, barSizeMm: d, desiredGapMm: gDes, minGapMm: gMin } = params;
  const shape = params.barShape ?? 'round';
  const issues: Issue[] = [];
  const spanLabel = params.direction === 'horizontal' ? 'alto interior' : 'ancho interior';

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
      message: `El ${spanLabel} (${fmtMm(Hi)}) no alcanza para colocar ni un barrote de ${barSizeLabel(d, shape)}. Aumentá la medida de la ventana o elegí un barrote más fino.`,
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
      message: `${n} barrotes de ${barSizeLabel(d, shape)} no entran en ${fmtMm(Hi)} de ${spanLabel} (ocupan ${fmtMm(n * d)}). Probá con ${alternatives.map((a) => a.count).join(' o ') || 'menos'} barrotes.`,
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
            ? `No existe una cantidad de barrotes que cumpla a la vez separación ≤ ${fmtMm(gDes)} y ≥ ${fmtMm(gMin)} en ${fmtMm(Hi)} de ${spanLabel}. Se usan ${n} barrotes (separación ${fmtMm(round1(g))}, respeta el máximo pero queda bajo el mínimo). Alternativas: ${altText}.`
            : `Con ${n} barrotes la separación libre es ${fmtMm(round1(g))}, menor que el mínimo de ${fmtMm(gMin)}. Alternativas: ${altText}.`,
      });
    }
  }

  const positions = Array.from({ length: n }, (_, i) => params.startMm + g + i * (d + g));

  return {
    distribution: {
      count: n,
      gapMm: g,
      direction: params.direction,
      spanMm: Hi,
      startMm: params.startMm,
      positionsMm: positions,
      alternatives,
      respectsLimits: !tooWide && !tooNarrow,
    },
    issues,
  };
}

// ───────────────────────── Diseño completo ─────────────────────────

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Validaciones comunes a todos los estilos. */
function validateBase(config: ProjectConfig, issues: Issue[]): void {
  const { widthMm: W, heightMm: H } = config.window;
  const fab = config.fabrication;
  const fail = (code: string, message: string) => issues.push({ level: 'error', code, message });

  if (!Number.isFinite(W) || W <= 0) fail('width', 'El ancho de la ventana debe ser mayor que cero.');
  if (!Number.isFinite(H) || H <= 0) fail('height', 'El alto de la ventana debe ser mayor que cero.');
  if (!Number.isFinite(fab.stockLengthMm) || fab.stockLengthMm <= 0) fail('stock', 'El largo comercial debe ser mayor que cero.');
  if (!Number.isFinite(fab.kerfMm) || fab.kerfMm < 0) fail('kerf', 'El ancho del disco de corte no puede ser negativo.');
  if (!Number.isFinite(fab.endTrimMm) || fab.endTrimMm < 0 || fab.endTrimMm >= fab.stockLengthMm)
    fail('trim', 'El refilado de punta debe ser ≥ 0 y menor que el largo comercial.');
  if (!Number.isFinite(fab.jointGapMm) || fab.jointGapMm < 0) fail('joint', 'El descuento por unión no puede ser negativo.');
  if (!Number.isFinite(fab.throughHoleClearanceMm) || fab.throughHoleClearanceMm < 0)
    fail('hole-clearance', 'La holgura del agujero no puede ser negativa.');
  if (!Number.isFinite(fab.socketSetbackMm) || fab.socketSetbackMm < 0)
    fail('socket-setback', 'El freno de la punta no puede ser negativo.');
  if (!Number.isFinite(fab.horizontalEdgeMm) || fab.horizontalEdgeMm < 0)
    fail('horizontal-edge', 'El margen del agujero de MS/MI al borde del lateral no puede ser negativo.');
  if (!Number.isFinite(config.bars.desiredGapMm) || config.bars.desiredGapMm <= 0)
    fail('gap-desired', 'La separación libre deseada debe ser mayor que cero.');
  if (!Number.isFinite(config.bars.minGapMm) || config.bars.minGapMm <= 0)
    fail('gap-min', 'La separación libre mínima debe ser mayor que cero.');
  if (config.bars.minGapMm > config.bars.desiredGapMm)
    fail('gap-order', 'La separación mínima no puede ser mayor que la separación deseada (máxima).');
}

/** Chequeos de piezas generadas (largo positivo y dentro del material comercial). */
function checkPieces(pieces: Piece[], config: ProjectConfig, issues: Issue[]): void {
  const fab = config.fabrication;
  const usable = fab.stockLengthMm - fab.endTrimMm;
  for (const p of pieces) {
    if (!(p.lengthMm > 0)) {
      issues.push({ level: 'error', code: 'piece-zero', message: `La pieza ${p.id} resulta de largo cero o negativo; revisá las dimensiones y descuentos.` });
    } else if (p.lengthMm > usable + EPS) {
      const hint = p.type === 'frame-top' || p.type === 'frame-bottom' || p.type === 'frame-left' || p.type === 'frame-right'
        ? ' Probá el otro método de armado del marco, si la otra medida entra en el material comercial.'
        : '';
      issues.push({ level: 'error', code: 'piece-too-long', message: `La pieza ${p.id} mide ${fmtMm(p.lengthMm)} y supera el largo utilizable del material comercial (${fmtMm(usable)}); no se permite unir recortes.${hint}` });
    }
  }
}

export function computeWindowModerna(config: ProjectConfig, catalog: Catalog): Design {
  const issues: Issue[] = [];
  const fail = (code: string, message: string) => issues.push({ level: 'error', code, message });
  const empty = (): Design => ({ issues, derived: null, distribution: null, pieces: [], layout: [] });

  const { widthMm: W, heightMm: H } = config.window;
  const fab = config.fabrication;

  validateBase(config, issues);

  const bar = findRound(catalog, config.barProfileId);
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

  const barP = isValidRound(bar) && isHollowRound(bar) ? bar : undefined;
  const frame = isValidRect(frameP) && !frameP.solid ? frameP : undefined;
  const reinf = hasReinf && isValidRect(reinfP) && !reinfP.solid ? reinfP : undefined;

  if (!barP) fail('bar-profile', 'La reja moderna usa caños redondos huecos como barrotes. Elegí un caño redondo en el catálogo.');
  if (!frame) fail('frame-profile', 'La reja moderna usa caños rectangulares huecos para el marco. Elegí un caño rectangular.');
  if (hasReinf && !reinf) fail('reinf-profile', 'El refuerzo de la reja moderna debe ser un caño rectangular hueco.');
  if (issues.some((i) => i.level === 'error') || !barP || !frame || (hasReinf && !reinf)) return empty();

  const pf = inPlaneDim(frame, config.frame.orientation);
  const frameDepth = depthDim(frame, config.frame.orientation);
  const rw = hasReinf ? inPlaneDim(reinf!, reinfOrientation) : 0;
  const reinfDepth = hasReinf ? depthDim(reinf!, reinfOrientation) : 0;
  const d = barP.odMm;
  const holeD = d + fab.throughHoleClearanceMm;
  const horizontalRound = config.frame.horizontalProfile === 'round';
  /** Dimensión a la vista de los tramos horizontales del marco: el perfil rectangular o el caño redondo. */
  const pfH = horizontalRound ? d : pf;
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
  const frameWall = frame.thicknessMm;
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

  // Barrotes
  const { distribution, issues: distIssues } = distributeBars({
    spanMm: Hi,
    barSizeMm: d,
    barShape: 'round',
    desiredGapMm: config.bars.desiredGapMm,
    minGapMm: config.bars.minGapMm,
    mode: config.bars.mode,
    manualCount: config.bars.manualCount,
    startMm: innerTop,
    direction: 'horizontal',
  });
  issues.push(...distIssues);

  const barKey = sectionKey(barP);
  const frameKey = sectionKey(frame);
  const reinfKey = hasReinf ? sectionKey(reinf!) : '';
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
    sectorMm: sector,
    barsInserted: inserted,
    barPenetrationMm: pen,
    barHoleMm: penetratesLateral ? holeD : 0,
    barDirection: 'horizontal' as const,
    barShape: barShape(barP),
    barSizeMm: d,
    barSectionKey: barKey,
    frameSectionKey: frameKey,
    reinfSectionKey: reinfKey,
  };

  if (!distribution) {
    return { issues, derived, distribution: null, pieces: [], layout: [] };
  }

  // Despiece
  const pieces: Piece[] = [];
  const layout: LayoutRect[] = [];
  const frameLabel = profileLabel(frame);
  const reinfLabel = reinf ? profileLabel(reinf) : '';
  const barLabel = profileLabel(barP);

  const add = (
    p: Omit<Piece, 'quantity' | 'lengthMm'> & { lengthMm: number },
    rect: { x: number; y: number; w: number; h: number },
  ) => {
    pieces.push({ ...p, quantity: 1, lengthMm: round1(p.lengthMm) });
    layout.push({ pieceId: p.id, type: p.type, ...rect });
  };

  const fullH = !horizontalRound && config.frame.assembly === 'horizontal-full';
  const framePiece = (id: string, type: PieceType, length: number, location: string, notes: string) => ({
    id, type, profileId: frame.id, profileLabel: frameLabel, sectionKey: frameKey, lengthMm: length, location, notes,
  });
  const horizontalLabel = horizontalRound ? barLabel : frameLabel;
  const horizontalPiece = (id: string, type: PieceType, length: number, location: string, notes: string) => ({
    id, type,
    profileId: horizontalRound ? barP.id : frame.id,
    profileLabel: horizontalLabel,
    sectionKey: horizontalRound ? barKey : frameKey,
    lengthMm: length, location, notes,
  });
  const horizontalInset = horizontalRound ? frameWall + setback : pf + jg;
  const horizontalLength = horizontalRound ? W - 2 * horizontalInset : Wi - 2 * jg;
  const horizontalNote = horizontalRound
    ? ` Tramo de caño redondo Ø${fmtMm(d)}; va alojado en los agujeros de los laterales, con el borde del agujero a ${fmtMm(horizontalEdge)} mm del extremo.${hasReinf ? ` Atraviesa el refuerzo central por un agujero Ø${fmtNum(holeD)} mm.` : ''}`
    : '';
  const lateralHoleCount = (inserted ? distribution.count : 0) + (horizontalRound ? 2 : 0);
  const lateralHoleDetails = [
    inserted ? 'uno por barrote, con el eje a la altura de cada barrote' : '',
    horizontalRound
      ? `uno para MS y otro para MI, con los ejes a ${fmtMm(railTop + d / 2)} de los bordes superior e inferior`
      : '',
  ].filter(Boolean).join('; ');
  const lateralNote = lateralHoleCount > 0
    ? ` Perforar ${lateralHoleCount} ${lateralHoleCount === 1 ? 'agujero' : 'agujeros'} Ø${fmtNum(holeD)} mm (caño Ø${fmtNum(d)} + ${fmtMm(fab.throughHoleClearanceMm)} de holgura) en la cara interior: ${lateralHoleDetails}.` +
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
  /** Con MS/MI redondos, el refuerzo también va completo y los tramos lo atraviesan. */
  const horizontalThroughReinf = hasReinf && horizontalRound;
  /** Dónde arranca el barrote contando desde el borde exterior (mm). */
  const endInset = inserted ? frameWall + setback : pf + jg;
  const fullLen = W - 2 * endInset;
  const sideLen = (W / 2 - rw / 2 - jg) - endInset;
  const endNote = inserted
    ? ` La punta entra ${fmtMm(pen)} en el agujero del lateral (Ø${fmtNum(holeD)} mm) y se frena a ${fmtMm(setback)} de la cara exterior.`
    : '';

  if (hasReinf) {
    const rcLength = horizontalRound ? H : Hi - 2 * jg;
    const rcNotes = horizontalRound
      ? `Tramo completo, igual que los laterales. Largo = alto exterior ${fmtMm(H)}. Perforar 2 agujeros Ø${fmtNum(holeD)} mm para MS/MI, con los ejes a ${fmtMm(railTop + d / 2)} de los extremos superior e inferior; los tramos pasan por los agujeros.` +
        (through
          ? ` Además, perforar ${distribution.count} agujeros Ø${fmtNum(holeD)} mm (caño Ø${fmtNum(d)} + ${fmtMm(fab.throughHoleClearanceMm)} de holgura) con los ejes a las alturas indicadas en cada barrote.`
          : '')
      : `Va entre MS y MI.${jg ? ` Largo = alto interior ${fmtMm(Hi)} − 2×${fmtMm(jg)} de holgura.` : ` Largo = alto interior ${fmtMm(Hi)}.`}` +
        (through
          ? ` Perforar ${distribution.count} agujeros Ø${fmtNum(holeD)} mm (caño Ø${fmtNum(d)} + ${fmtMm(fab.throughHoleClearanceMm)} mm de holgura) con los ejes a las alturas indicadas en cada barrote.`
          : '');
    add(
      {
        id: 'RC', type: 'reinforcement', profileId: reinf!.id, profileLabel: reinfLabel, sectionKey: reinfKey,
        lengthMm: rcLength,
        location: `Refuerzo vertical central, eje a ${fmtMm(W / 2)} del borde izquierdo exterior`,
        notes: rcNotes,
      },
      { x: W / 2 - rw / 2, y: horizontalRound ? 0 : innerTop + jg, w: rw, h: rcLength },
    );
  }

  const rightX = W / 2 + rw / 2 + jg;
  distribution.positionsMm.forEach((top, i) => {
    const n = pad2(i + 1);
    const centerFromTop = top + d / 2;
    const where = `Barrote ${i + 1} de ${distribution.count} (desde arriba), eje a ${fmtMm(round1(centerFromTop))} del borde superior exterior`;
    if (!hasReinf) {
      add(
        {
          id: `B${n}`, type: 'bar', profileId: barP.id, profileLabel: barLabel, sectionKey: barKey,
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
          id: `B${n}`, type: 'bar', profileId: barP.id, profileLabel: barLabel, sectionKey: barKey,
          lengthMm: fullLen,
          location: where,
          notes: `Barrote continuo; atraviesa el refuerzo central por un agujero Ø${fmtNum(holeD)} mm.` + endNote,
        },
        { x: endInset, y: top, w: fullLen, h: d },
      );
    } else {
      add(
        {
          id: `B${n}-I`, type: 'bar', profileId: barP.id, profileLabel: barLabel, sectionKey: barKey,
          lengthMm: sideLen, location: `${where} — sector izquierdo`,
          notes: (inserted ? 'Va desde el agujero del lateral izquierdo hasta el refuerzo central.' : 'Va entre el lateral izquierdo y el refuerzo central.') + endNote,
        },
        { x: endInset, y: top, w: sideLen, h: d },
      );
      add(
        {
          id: `B${n}-D`, type: 'bar', profileId: barP.id, profileLabel: barLabel, sectionKey: barKey,
          lengthMm: sideLen, location: `${where} — sector derecho`,
          notes: (inserted ? 'Va desde el refuerzo central hasta el agujero del lateral derecho.' : 'Va entre el refuerzo central y el lateral derecho.') + endNote,
        },
        { x: rightX, y: top, w: sideLen, h: d },
      );
    }
  });

  checkPieces(pieces, config, issues);

  // Advertencias de compatibilidad
  if (d > frameDepth + EPS) {
    issues.push({
      level: 'warning',
      code: 'bar-wider-than-frame',
      message: `El caño redondo (Ø${fmtNum(d)} mm) es más ancho que la cara de apoyo del marco (${fmtMm(frameDepth)} hacia afuera). El barrote no apoyará completo contra el lateral; considerá otro perfil u orientación.`,
    });
  }
  if (hasReinf && d > reinfDepth + EPS) {
    issues.push({
      level: 'warning',
      code: 'bar-wider-than-reinf',
      message: `El caño redondo (Ø${fmtNum(d)} mm) es más ancho que la cara de apoyo del refuerzo central (${fmtMm(reinfDepth)} hacia afuera).`,
    });
  }
  if ((through || horizontalThroughReinf) && reinfP && holeD > reinfDepth - 2 * reinfP.thicknessMm + EPS) {
    issues.push({
      level: 'warning',
      code: 'hole-too-big',
      message: `El agujero Ø${fmtNum(holeD)} mm no entra en la cara del refuerzo central (${fmtMm(reinfDepth)}).`,
    });
  }
  if (penetratesLateral && holeD > frameDepth - 2 * frameWall + EPS) {
    issues.push({
      level: 'warning',
      code: 'lateral-hole-too-big',
      message: `El agujero Ø${fmtNum(holeD)} mm del lateral no entra en el hueco del perfil (${fmtMm(frameDepth)} de profundidad − 2 paredes de ${fmtMm(frameWall)}): tocaría las paredes laterales. Usá un caño redondo más fino o un perfil más hondo.`,
    });
  }

  return { issues, derived, distribution, pieces, layout };
}

// ───────────────────────── Estilo clásico (barras verticales) ─────────────────────────

/**
 * Reja clásica: marco de planchuela, barras macizas cuadradas verticales
 * insertadas en las planchuelas superior e inferior, y un travesaño horizontal
 * opcional al medio. La planchuela plana se orienta con el lado angosto a la
 * vista y el ancho hacia afuera, que es donde entra el agujero del barrote.
 */
export function computeWindowClasica(config: ProjectConfig, catalog: Catalog): Design {
  const issues: Issue[] = [];
  const fail = (code: string, message: string) => issues.push({ level: 'error', code, message });
  const empty = (): Design => ({ issues, derived: null, distribution: null, pieces: [], layout: [] });

  const { widthMm: W, heightMm: H } = config.window;
  const fab = config.fabrication;

  validateBase(config, issues);

  const bar = findRound(catalog, config.barProfileId);
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

  const barP = isValidRound(bar) && isSolidSquare(bar) ? bar : undefined;
  const frame = isValidRect(frameP) && isSolidRect(frameP) ? frameP : undefined;
  const reinf = hasReinf && isValidRect(reinfP) && isSolidRect(reinfP) ? reinfP : undefined;

  if (!barP) fail('bar-profile', 'La reja clásica usa barras macizas cuadradas como barrotes. Elegí un hierro macizo cuadrado en el catálogo.');
  if (!frame) fail('frame-profile', 'La reja clásica usa planchuelas macizas para el marco. Elegí una planchuela en el catálogo.');
  if (hasReinf && !reinf) fail('reinf-profile', 'El refuerzo de la reja clásica debe ser una planchuela maciza.');
  if (issues.some((i) => i.level === 'error') || !barP || !frame || (hasReinf && !reinf)) return empty();

  const pf = inPlaneDim(frame, config.frame.orientation);
  const frameDepth = depthDim(frame, config.frame.orientation);
  const rw = hasReinf ? inPlaneDim(reinf!, reinfOrientation) : 0;
  const reinfDepth = hasReinf ? depthDim(reinf!, reinfOrientation) : 0;
  const d = barP.odMm;
  const shape: BarShape = 'square';
  const holeD = d + fab.throughHoleClearanceMm;
  const jg = fab.jointGapMm;
  const Wi = W - 2 * pf;
  const Hi = H - 2 * pf;
  const sector = (Hi - rw) / 2;
  /** La planchuela es maciza: el barrote entra en su espesor visible y se frena antes de la cara exterior. */
  const endInset = (frame.solid ? 0 : frame.thicknessMm) + fab.socketSetbackMm;
  const pen = pf - endInset;

  if (Wi <= 0 || Hi <= 0) {
    fail('frame-too-big', `El marco (${fmtMm(pf)} a la vista por lado) no deja vano interior en una reja de ${fmtMm(W)} × ${fmtMm(H)}.`);
    return empty();
  }
  if (hasReinf && sector <= 2 * jg + EPS) {
    fail('reinf-too-big', `El travesaño central (${fmtMm(rw)}) no deja espacio útil arriba y abajo en un vano interior de ${fmtMm(Hi)}.`);
    return empty();
  }
  if (Hi - 2 * endInset <= EPS) {
    fail('joint-too-big', 'Los descuentos de las puntas dejan los barrotes con largo cero o negativo.');
    return empty();
  }
  if (pen <= EPS) {
    fail('lateral-too-thin', `La planchuela (${fmtMm(pf)} a la vista) no tiene espesor útil para alojar los barrotes. Reducí el freno de la punta o elegí una planchuela más gruesa.`);
    return empty();
  }

  const { distribution, issues: distIssues } = distributeBars({
    spanMm: Wi,
    barSizeMm: d,
    barShape: shape,
    desiredGapMm: config.bars.desiredGapMm,
    minGapMm: config.bars.minGapMm,
    mode: config.bars.mode,
    manualCount: config.bars.manualCount,
    startMm: pf,
    direction: 'vertical',
  });
  issues.push(...distIssues);

  const barKey = sectionKey(barP);
  const frameKey = sectionKey(frame);
  const reinfKey = hasReinf ? sectionKey(reinf!) : '';
  const derived = {
    innerWidthMm: Wi,
    innerHeightMm: Hi,
    frameInPlaneMm: pf,
    frameDepthMm: frameDepth,
    frameHorizontalMm: pf,
    horizontalRound: false,
    horizontalEdgeMm: 0,
    withReinforcement: hasReinf,
    reinfInPlaneMm: rw,
    reinfDepthMm: reinfDepth,
    sectorMm: sector,
    barsInserted: true,
    barPenetrationMm: pen,
    barHoleMm: holeD,
    barDirection: 'vertical' as const,
    barShape: shape,
    barSizeMm: d,
    barSectionKey: barKey,
    frameSectionKey: frameKey,
    reinfSectionKey: reinfKey,
  };

  if (!distribution) {
    return { issues, derived, distribution: null, pieces: [], layout: [] };
  }

  const pieces: Piece[] = [];
  const layout: LayoutRect[] = [];
  const frameLabel = profileLabel(frame);
  const reinfLabel = reinf ? profileLabel(reinf) : '';
  const barLabel = profileLabel(barP);

  const add = (
    p: Omit<Piece, 'quantity' | 'lengthMm'> & { lengthMm: number },
    rect: { x: number; y: number; w: number; h: number },
  ) => {
    pieces.push({ ...p, quantity: 1, lengthMm: round1(p.lengthMm) });
    layout.push({ pieceId: p.id, type: p.type, ...rect });
  };
  const framePiece = (id: string, type: PieceType, length: number, location: string, notes: string) => ({
    id, type, profileId: frame.id, profileLabel: frameLabel, sectionKey: frameKey, lengthMm: length, location, notes,
  });

  const horizontalFull = config.frame.assembly === 'horizontal-full';
  const topBottomLength = horizontalFull ? W : Wi - 2 * jg;
  const sideLength = horizontalFull ? H - 2 * pf - 2 * jg : H;
  const holeText = holeSizeLabel(holeD, shape);
  const holeNote = ` Perforar ${distribution.count} ${distribution.count === 1 ? 'agujero' : 'agujeros'} de ${holeText} (barra de ${barSizeLabel(d, shape)} + ${fmtMm(fab.throughHoleClearanceMm)} de holgura) en la cara interior, uno por barrote, con el eje en la posición de cada barrote.`;
  const sideAssembly = horizontalFull
    ? `Va entre MS y MI. Largo = alto exterior − 2×${fmtMm(pf)}${jg ? ` − 2×${fmtMm(jg)} de holgura` : ''}.`
    : 'Tramo completo, de borde a borde.';
  const topBottomAssembly = horizontalFull
    ? 'Tramo completo, de borde a borde.'
    : `Va entre LI y LD. Largo = ancho exterior − 2×${fmtMm(pf)}${jg ? ` − 2×${fmtMm(jg)} de holgura` : ''}.`;

  add(framePiece('MS', 'frame-top', topBottomLength, `Marco, tramo superior (${horizontalFull ? 'largo exterior completo' : 'entre laterales'})`, `${topBottomAssembly}${holeNote}`),
    { x: horizontalFull ? 0 : pf + jg, y: 0, w: topBottomLength, h: pf });
  add(framePiece('MI', 'frame-bottom', topBottomLength, `Marco, tramo inferior (${horizontalFull ? 'largo exterior completo' : 'entre laterales'})`, `${topBottomAssembly}${holeNote}`),
    { x: horizontalFull ? 0 : pf + jg, y: H - pf, w: topBottomLength, h: pf });
  add(framePiece('LI', 'frame-left', sideLength, `Marco, lateral izquierdo (${horizontalFull ? 'entre tramos horizontales' : 'largo exterior completo'})`, sideAssembly),
    { x: 0, y: horizontalFull ? pf + jg : 0, w: pf, h: sideLength });
  add(framePiece('LD', 'frame-right', sideLength, `Marco, lateral derecho (${horizontalFull ? 'entre tramos horizontales' : 'largo exterior completo'})`, sideAssembly),
    { x: W - pf, y: horizontalFull ? pf + jg : 0, w: pf, h: sideLength });

  const through = hasReinf && config.bars.crossing === 'through';
  if (hasReinf) {
    const rcLength = Wi - 2 * jg;
    const rcNotes = `Va entre LI y LD.${jg ? ` Largo = ancho interior ${fmtMm(Wi)} − 2×${fmtMm(jg)} de holgura.` : ` Largo = ancho interior ${fmtMm(Wi)}.`}` +
      (through
        ? ` Perforar ${distribution.count} agujeros de ${holeText} (barra de ${barSizeLabel(d, shape)} + ${fmtMm(fab.throughHoleClearanceMm)} de holgura) con los ejes en la posición de cada barrote.`
        : '');
    add(
      {
        id: 'RC', type: 'reinforcement', profileId: reinf!.id, profileLabel: reinfLabel, sectionKey: reinfKey,
        lengthMm: rcLength,
        location: `Travesaño horizontal central, eje a ${fmtMm(H / 2)} del borde superior exterior`,
        notes: rcNotes,
      },
      { x: pf + jg, y: H / 2 - rw / 2, w: rcLength, h: rw },
    );
  }

  const endNote = ` La punta entra ${fmtMm(pen)} en la planchuela (agujero de ${holeText}) y se frena a ${fmtMm(fab.socketSetbackMm)} de la cara exterior.`;
  distribution.positionsMm.forEach((x, i) => {
    const n = pad2(i + 1);
    const center = x + d / 2;
    const where = `Barrote ${i + 1} de ${distribution.count} (desde la izquierda), eje a ${fmtMm(round1(center))} del borde izquierdo exterior`;
    if (!hasReinf) {
      add(
        {
          id: `B${n}`, type: 'bar', profileId: barP.id, profileLabel: barLabel, sectionKey: barKey,
          lengthMm: H - 2 * endInset, location: where,
          notes: 'Barrote vertical continuo, alojado en las planchuelas superior e inferior (la reja no lleva travesaño central).' + endNote,
        },
        { x, y: endInset, w: d, h: H - 2 * endInset },
      );
    } else if (through) {
      add(
        {
          id: `B${n}`, type: 'bar', profileId: barP.id, profileLabel: barLabel, sectionKey: barKey,
          lengthMm: H - 2 * endInset,
          location: where,
          notes: `Barrote vertical continuo; atraviesa el travesaño central por un agujero de ${holeText}.` + endNote,
        },
        { x, y: endInset, w: d, h: H - 2 * endInset },
      );
    } else {
      const segLen = H / 2 - rw / 2 - jg - endInset;
      add(
        {
          id: `B${n}-A`, type: 'bar', profileId: barP.id, profileLabel: barLabel, sectionKey: barKey,
          lengthMm: segLen, location: `${where} — sector superior`,
          notes: 'Va desde el agujero de la planchuela superior hasta el travesaño central.' + endNote,
        },
        { x, y: endInset, w: d, h: segLen },
      );
      add(
        {
          id: `B${n}-B`, type: 'bar', profileId: barP.id, profileLabel: barLabel, sectionKey: barKey,
          lengthMm: segLen, location: `${where} — sector inferior`,
          notes: 'Va desde el travesaño central hasta el agujero de la planchuela inferior.' + endNote,
        },
        { x, y: H / 2 + rw / 2 + jg, w: d, h: segLen },
      );
    }
  });

  checkPieces(pieces, config, issues);

  // El agujero debe entrar en el ancho (profundidad) de la planchuela.
  const railHoleFits = frame.solid ? frameDepth : frameDepth - 2 * frame.thicknessMm;
  if (holeD > railHoleFits + EPS) {
    issues.push({
      level: 'warning',
      code: 'hole-too-big',
      message: `El agujero de ${holeText} no entra en la planchuela (${fmtMm(frameDepth)} mm de ancho hacia afuera). Girá la planchuela para que el lado ancho quede hacia afuera o elegí una más ancha.`,
    });
  }
  if (hasReinf && through) {
    const reinfHoleFits = reinf!.solid ? reinfDepth : reinfDepth - 2 * reinf!.thicknessMm;
    if (holeD > reinfHoleFits + EPS) {
      issues.push({
        level: 'warning',
        code: 'reinf-hole-too-big',
        message: `El agujero de ${holeText} no entra en el ancho del travesaño central (${fmtMm(reinfDepth)} mm hacia afuera).`,
      });
    }
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

// ───────────────────────── Despachador por producto y estilo ─────────────────────────

/**
 * Punto único de resolución de la geometría según `(productKind, style)`.
 * Agregar un nuevo producto solo requiere un nuevo caso aquí y su función propia;
 * el resto del pipeline (corte, materiales, presupuesto) consume las piezas generadas.
 */
export function computeDesign(config: ProjectConfig, catalog: Catalog): Design {
  const resolved = resolveStyleConfig(config, catalog);
  if (resolved.productKind !== 'ventana') {
    return {
      issues: [
        {
          level: 'error',
          code: 'product-not-implemented',
          message: `El tipo de producto «${resolved.productKind}» aún no está implementado. Por ahora solo están disponibles las rejas para ventana.`,
        },
      ],
      derived: null,
      distribution: null,
      pieces: [],
      layout: [],
    };
  }
  return resolved.style === 'clasica'
    ? computeWindowClasica(resolved, catalog)
    : computeWindowModerna(resolved, catalog);
}
