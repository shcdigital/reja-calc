import { describe, expect, it } from 'vitest';
import { computeDesign, distributeBars, groupPieces } from './geometry';
import { packSection } from './cutting';
import { computeProject } from './project';
import { catalog, makeConfig } from './helpers';
import type { ProjectConfig } from './types';
import { sectionKey, findRound, findRect } from './profiles';
import { applyPlanToInventory } from './inventory';
import { cutListCsv } from './exporters';
import type { Offcut } from './types';

const near = (a: number, b: number, e = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(e);
const lens = (d: ReturnType<typeof computeDesign>, prefix: string) => d.pieces.filter((p) => p.id.startsWith(prefix)).map((p) => p.lengthMm);

describe('Despiece 1500 × 600, caño 1¼" (marco 40×20, lado menor a la vista)', () => {
  const d = computeDesign(makeConfig(), catalog);
  it('derivadas y barrotes', () => {
    expect(d.issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(d.derived!.innerWidthMm).toBe(1460);
    expect(d.derived!.innerHeightMm).toBe(560);
    expect(d.derived!.sectorWidthMm).toBe(720);
    expect(d.distribution!.count).toBe(4);
    near(d.distribution!.gapMm, (560 - 4 * 31.75) / 5); // 86,6
  });
  it('piezas', () => {
    expect(lens(d, 'MS')).toEqual([1500]);
    expect(lens(d, 'MI')).toEqual([1500]);
    expect(lens(d, 'LI')).toEqual([560]);
    expect(lens(d, 'LD')).toEqual([560]);
    expect(lens(d, 'RC')).toEqual([560]);
    expect(d.pieces.filter((p) => p.type === 'bar').map((p) => p.lengthMm)).toEqual(Array(8).fill(720));
    expect(d.pieces).toHaveLength(13);
  });
  it('plan: 1 caño redondo y 1 rectangular, con pérdidas por disco exactas', () => {
    const r = computeProject(makeConfig(), catalog);
    const round = r.materials.find((m) => m.sectionKey.startsWith('round'))!;
    const rect = r.materials.find((m) => m.sectionKey.startsWith('rect'))!;
    expect(round.newBarsCount).toBe(1);
    expect(rect.newBarsCount).toBe(1);
    expect(round.piecesLengthMm).toBe(5760);
    expect(round.kerfLossMm).toBe(24); // 7 cortes entre piezas + 1 de separación del sobrante
    expect(round.leftoverMm).toBe(216);
    expect(rect.piecesLengthMm).toBe(4680);
    expect(rect.kerfLossMm).toBe(15); // 5 piezas → 5 cortes
    expect(rect.leftoverMm).toBe(1305);
  });
});

describe('Despiece 1800 × 1500, caño 1¼"', () => {
  const r = computeProject(makeConfig({ w: 1800, h: 1500 }), catalog);
  it('11 barrotes, separación 92,56 mm', () => {
    expect(r.design.distribution!.count).toBe(11);
    near(r.design.distribution!.gapMm, (1460 - 11 * 31.75) / 12);
  });
  it('22 tramos de 870 mm → 4 caños redondos; rectangular → 2 caños', () => {
    expect(r.design.pieces.filter((p) => p.type === 'bar').map((p) => p.lengthMm)).toEqual(Array(22).fill(870));
    const round = r.materials.find((m) => m.sectionKey.startsWith('round'))!;
    const rect = r.materials.find((m) => m.sectionKey.startsWith('rect'))!;
    expect(round.newBarsCount).toBe(4);
    expect(rect.newBarsCount).toBe(2);
    expect(r.plan!.sections.every((s) => s.provenOptimal)).toBe(true);
  });
});

describe('Despiece 1500 × 600, caño 1"', () => {
  const d = computeDesign(makeConfig({ round: 'r-1' }), catalog);
  it('4 barrotes, separación 91,68 mm', () => {
    expect(d.distribution!.count).toBe(4);
    near(d.distribution!.gapMm, (560 - 4 * 25.4) / 5);
    expect(d.issues.filter((i) => i.level === 'warning')).toEqual([]);
  });
});

describe('Dimensiones pequeñas', () => {
  it('300 × 200: 1 barrote centrado', () => {
    const d = computeDesign(makeConfig({ w: 300, h: 200 }), catalog);
    expect(d.distribution!.count).toBe(1);
    near(d.distribution!.gapMm, (160 - 31.75) / 2);
    expect(d.pieces.every((p) => p.lengthMm > 0)).toBe(true);
    expect(lens(d, 'B01')).toEqual([120, 120]);
  });
  it('ventana más chica que el marco → error, sin piezas', () => {
    const d = computeDesign(makeConfig({ w: 30, h: 30 }), catalog);
    expect(d.issues.some((i) => i.level === 'error')).toBe(true);
    expect(d.pieces).toHaveLength(0);
  });
  it('rechaza valores negativos o cero', () => {
    expect(computeDesign(makeConfig({ w: -5 }), catalog).issues.some((i) => i.code === 'width')).toBe(true);
    const c = makeConfig(); c.window.heightMm = 0;
    expect(computeDesign(c, catalog).issues.some((i) => i.code === 'height')).toBe(true);
  });
});

describe('Separación que no se puede respetar', () => {
  it('máximo 40 y mínimo 38 en 300 mm: avisa y propone 3 barrotes', () => {
    const d = computeDesign(makeConfig({ w: 1000, h: 340, gap: 40, minGap: 38 }), catalog);
    expect(d.distribution!.respectsLimits).toBe(false);
    expect(d.issues.some((i) => i.code === 'gap-below-min')).toBe(true);
    expect(d.distribution!.count).toBe(4); // respeta el máximo
    expect(d.distribution!.alternatives.map((a) => a.count)).toEqual([4, 3]);
  });
  it('cantidad manual insuficiente: gap > máximo y alternativa de 4', () => {
    const d = computeDesign(makeConfig({ mode: 'manual', manual: 2 }), catalog);
    expect(d.issues.some((i) => i.code === 'gap-above-max')).toBe(true);
    expect(d.distribution!.alternatives.some((a) => a.count === 4)).toBe(true);
  });
  it('barrotes que no entran → error', () => {
    const d = computeDesign(makeConfig({ mode: 'manual', manual: 30 }), catalog);
    expect(d.issues.some((i) => i.code === 'bars-overflow')).toBe(true);
    expect(d.pieces).toHaveLength(0);
  });
});

describe('Distribución simétrica y uniforme', () => {
  for (const [w, h] of [[1500, 600], [1800, 1500], [900, 1200], [1234, 987]]) {
    it(`${w} × ${h}`, () => {
      const d = computeDesign(makeConfig({ w, h }), catalog);
      const { topsMm, gapMm, count } = d.distribution!;
      const dd = d.derived!.barOdMm;
      const pf = d.derived!.frameInPlaneMm;
      near(topsMm[0] - pf, gapMm);
      for (let i = 1; i < count; i++) near(topsMm[i] - (topsMm[i - 1] + dd), gapMm);
      near(h - pf - (topsMm[count - 1] + dd), gapMm);
      for (let i = 0; i < count; i++) near(topsMm[i] - pf, h - 2 * pf - (topsMm[count - 1 - i] - pf) - dd);
      expect(gapMm).toBeLessThanOrEqual(100 + 1e-9);
    });
  }
  it('distributeBars directo', () => {
    const { distribution } = distributeBars({ innerHeightMm: 560, barOdMm: 31.75, desiredGapMm: 100, minGapMm: 60, mode: 'auto', manualCount: 0, innerTopMm: 0 });
    expect(distribution!.count).toBe(4);
  });
});

describe('Armado del marco y refuerzo', () => {
  it('laterales completos: LI/LD = 600, MS/MI = 1460', () => {
    const d = computeDesign(makeConfig({ assembly: 'vertical-full' }), catalog);
    expect(lens(d, 'LI')).toEqual([600]);
    expect(lens(d, 'MS')).toEqual([1460]);
    expect(lens(d, 'MI')).toEqual([1460]);
  });
  it('geometría: envolvente = dimensiones exteriores, sin superposiciones (ambos armados, cruces y extremos)', () => {
    for (const assembly of ['horizontal-full', 'vertical-full'] as const)
      for (const horizontals of ['same-as-sides', 'round'] as const)
        for (const crossing of ['split', 'through'] as const)
        for (const ends of ['butt', 'inserted'] as const) {
        const d = computeDesign(makeConfig({ assembly, horizontals, crossing, ends, jg: 1.5 }), catalog);
        const L = d.layout;
        near(Math.min(...L.map((r) => r.x)), 0); near(Math.min(...L.map((r) => r.y)), 0);
        near(Math.max(...L.map((r) => r.x + r.w)), 1500); near(Math.max(...L.map((r) => r.y + r.h)), 600);
        for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
          const a = L[i], b = L[j];
          const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
          const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
          const overlap = ox > 1e-6 && oy > 1e-6;
          // cruces admitidos: barrote continuo que atraviesa el refuerzo por un agujero,
          // barrote alojado en el agujero del lateral y MS/MI redondos alojados en el lateral.
          const isBar = (r: { type: string }) => r.type === 'bar';
          const isHorizontal = (r: { type: string }) => r.type === 'frame-top' || r.type === 'frame-bottom';
          const lateral = (r: { type: string }) => r.type === 'frame-left' || r.type === 'frame-right';
          const throughReinf = crossing === 'through' && ((isBar(a) && b.type === 'reinforcement') || (isBar(b) && a.type === 'reinforcement'));
          const barIntoLateral = ends === 'inserted' && ((isBar(a) && lateral(b)) || (isBar(b) && lateral(a)));
          const horizontalIntoLateral = horizontals === 'round' && ((isHorizontal(a) && lateral(b)) || (isHorizontal(b) && lateral(a)));
          const horizontalThroughReinf = horizontals === 'round' && ((isHorizontal(a) && b.type === 'reinforcement') || (isHorizontal(b) && a.type === 'reinforcement'));
          if (!throughReinf && !barIntoLateral && !horizontalIntoLateral && !horizontalThroughReinf) expect(overlap, `${a.pieceId} × ${b.pieceId}`).toBe(false);
        }
        // coincidencia layout ↔ piezas
        for (const p of d.pieces) {
          const r = L.find((x) => x.pieceId === p.id)!;
          const long = Math.max(r.w, r.h);
          near(long, p.lengthMm, 0.05);
        }
      }
  });
  it('el marco y el refuerzo están en el despiece y en el plan de corte', () => {
    const r = computeProject(makeConfig(), catalog);
    const ids = new Set(r.plan!.sections.flatMap((s) => s.bins.flatMap((b) => b.items.map((i) => i.pieceId))));
    for (const id of ['MS', 'MI', 'LI', 'LD', 'RC']) expect(ids.has(id)).toBe(true);
    expect(ids.size).toBe(r.design.pieces.length);
  });
  it('barrotes pasantes: 1 pieza por barrote de 1460 y agujeros anotados en RC', () => {
    const d = computeDesign(makeConfig({ crossing: 'through' }), catalog);
    expect(d.pieces.filter((p) => p.type === 'bar').map((p) => p.lengthMm)).toEqual(Array(4).fill(1460));
    expect(d.pieces.find((p) => p.id === 'RC')!.notes).toMatch(/4 agujeros/);
  });
  it('descuento por unión se aplica por extremo', () => {
    const d = computeDesign(makeConfig({ jg: 2 }), catalog);
    expect(lens(d, 'LI')).toEqual([556]);
    expect(lens(d, 'RC')).toEqual([556]);
    expect(lens(d, 'B01-I')).toEqual([716]);
    expect(lens(d, 'MS')).toEqual([1500]);
  });
  it('agrupa piezas iguales', () => {
    const g = groupPieces(computeDesign(makeConfig(), catalog).pieces);
    expect(g.find((x) => x.ids[0] === 'B01-I')!.quantity).toBe(8);
  });
});

describe('Marco con tramos superior e inferior (MS/MI) de caño redondo', () => {
  const d = computeDesign(makeConfig({ horizontals: 'round' }), catalog);

  it('por defecto los cuatro tramos son del mismo perfil rectangular', () => {
    const base = computeDesign(makeConfig(), catalog);
    expect(base.derived!.horizontalRound).toBe(false);
    expect(base.derived!.frameHorizontalMm).toBe(20);
  });

  it('el alto útil se mide con el diámetro del caño redondo y el margen al borde', () => {
    expect(d.issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(d.derived!.horizontalRound).toBe(true);
    expect(d.derived!.frameInPlaneMm).toBe(20); // laterales: rectangular 20 a la vista
    expect(d.derived!.frameHorizontalMm).toBe(31.75); // MS/MI: caño Ø31,75
    expect(d.derived!.horizontalEdgeMm).toBe(5); // borde del agujero a 0,5 cm del extremo
    expect(d.derived!.barsInLateral).toBe(false); // los barrotes van a tope...
    expect(d.derived!.lateralHoleMm).toBe(32.75); // ...pero MS/MI igual se alojan
    expect(d.derived!.innerWidthMm).toBe(1460);
    // 600 − 2 × (5,5 del borde al caño + 31,75 del caño) = 525,5
    expect(d.derived!.innerHeightMm).toBe(525.5);
  });

  it('MS y MI salen del caño redondo, alojados en los laterales', () => {
    const roundKey = sectionKey(findRound(catalog, 'r-1q')!);
    const ms = d.pieces.find((p) => p.id === 'MS')!;
    const mi = d.pieces.find((p) => p.id === 'MI')!;
    expect(ms.profileLabel).toMatch(/Caño redondo/);
    expect(mi.profileLabel).toMatch(/Caño redondo/);
    expect(ms.sectionKey).toBe(roundKey);
    expect(mi.sectionKey).toBe(roundKey);
    // W − 2 × (pared de 2 + freno de 1) = 1494
    expect(lens(d, 'MS')).toEqual([1494]);
    expect(lens(d, 'MI')).toEqual([1494]);
    expect(lens(d, 'LI')).toEqual([600]);
    expect(lens(d, 'LD')).toEqual([600]);
    // El refuerzo central va completo, igual que los laterales, y sobresale por encima/debajo de MS/MI.
    expect(lens(d, 'RC')).toEqual([600]);
    const msBox = d.layout.find((r) => r.pieceId === 'MS')!;
    const miBox = d.layout.find((r) => r.pieceId === 'MI')!;
    const rcBox = d.layout.find((r) => r.pieceId === 'RC')!;
    expect(msBox).toMatchObject({ x: 3, y: 5.5, w: 1494, h: 31.75 });
    expect(miBox).toMatchObject({ x: 3, y: 562.75, w: 1494, h: 31.75 });
    expect(rcBox).toMatchObject({ x: 740, y: 0, w: 20, h: 600 });
  });

  it('los barrotes arrancan debajo del caño redondo y la separación sigue siendo uniforme', () => {
    const { topsMm, gapMm, count } = d.distribution!;
    const innerTop = d.derived!.horizontalEdgeMm + (d.derived!.lateralHoleMm - 31.75) / 2 + 31.75;
    expect(count).toBe(4);
    near(topsMm[0] - innerTop, gapMm);
    near(600 - innerTop - (topsMm[count - 1] + 31.75), gapMm);
  });

  it('los laterales llevan agujeros para MS/MI y, si los barrotes entran, también para ellos', () => {
    for (const id of ['LI', 'LD']) {
      const p = d.pieces.find((x) => x.id === id)!;
      expect(p.notes).toMatch(/Perforar 2 agujeros Ø32.75 mm/);
      expect(p.notes).toMatch(/uno para MS y otro para MI/);
      expect(p.notes).toMatch(/21,4 mm de los bordes superior e inferior/);
    }
    const withBars = computeDesign(makeConfig({ horizontals: 'round', ends: 'inserted' }), catalog);
    for (const id of ['LI', 'LD']) {
      const p = withBars.pieces.find((x) => x.id === id)!;
      expect(p.notes).toMatch(/Perforar 6 agujeros Ø32.75 mm/);
      expect(p.notes).toMatch(/uno por barrote/);
    }
  });

  it('el armado horizontal-full se convierte en laterales completos', () => {
    const full = computeDesign(makeConfig({ horizontals: 'round', assembly: 'horizontal-full' }), catalog);
    expect(lens(full, 'LI')).toEqual([600]);
    expect(lens(full, 'MS')).toEqual([1494]);
    expect(full.layout.find((r) => r.pieceId === 'MS')).toMatchObject({ x: 3, y: 5.5 });
  });

  it('el refuerzo central va completo y los tramos pasan por sus agujeros', () => {
    const rc = d.pieces.find((p) => p.id === 'RC')!;
    expect(rc.lengthMm).toBe(600);
    expect(rc.notes).toMatch(/Tramo completo, igual que los laterales/);
    expect(rc.notes).toMatch(/Perforar 2 agujeros Ø32.75 mm para MS\/MI/);
    expect(rc.notes).not.toMatch(/barrotes pasantes/);

    const through = computeDesign(makeConfig({ horizontals: 'round', crossing: 'through' }), catalog);
    const rcThrough = through.pieces.find((p) => p.id === 'RC')!;
    expect(rcThrough.notes).toMatch(/Perforar 2 agujeros Ø32.75 mm para MS\/MI/);
    expect(rcThrough.notes).toMatch(/Además, perforar 4 agujeros/);
  });

  it('avisa si el agujero de MS/MI no entra en la cara del refuerzo', () => {
    const cfg = makeConfig({ horizontals: 'round' });
    cfg.frame.orientation = 'major'; // refuerzo de 20 mm de profundidad, hueco 16 < Ø32,75
    expect(computeDesign(cfg, catalog).issues.some((i) => i.code === 'hole-too-big')).toBe(true);
  });

  it('el margen del agujero al borde es configurable', () => {
    const e = computeDesign(makeConfig({ horizontals: 'round', horizontalEdge: 10 }), catalog);
    // 600 − 2 × (10 de margen + 0,5 de holgura/2 + 31,75 del caño) = 515,5
    expect(e.derived!.innerHeightMm).toBe(515.5);
    expect(e.layout.find((r) => r.pieceId === 'MS')).toMatchObject({ y: 10.5 });
    expect(e.layout.find((r) => r.pieceId === 'MI')).toMatchObject({ y: 600 - 10.5 - 31.75 });
  });

  it('el plan de cortes suma MS/MI al caño redondo', () => {
    const r = computeProject(makeConfig({ horizontals: 'round' }), catalog);
    const round = r.materials.find((m) => m.sectionKey.startsWith('round'))!;
    const rect = r.materials.find((m) => m.sectionKey.startsWith('rect'))!;
    expect(round.piecesLengthMm).toBe(8748); // 8 barrotes de 720 + MS/MI de 1494
    expect(round.newBarsCount).toBe(2);
    expect(rect.newBarsCount).toBe(1); // LI + LD + RC
  });
});

describe('Reja sin refuerzo central', () => {
  const d = computeDesign(makeConfig({ reinf: false }), catalog);
  it('no genera el refuerzo ni avisa por él', () => {
    expect(d.issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(d.derived!.withReinforcement).toBe(false);
    expect(d.derived!.reinfInPlaneMm).toBe(0);
    expect(d.pieces.some((p) => p.type === 'reinforcement')).toBe(false);
    expect(d.layout.some((r) => r.type === 'reinforcement')).toBe(false);
  });
  it('los barrotes van continuos de lateral a lateral', () => {
    const bars = d.pieces.filter((p) => p.type === 'bar');
    expect(bars.length).toBe(d.distribution!.count);
    expect(bars.every((p) => p.lengthMm === 1460)).toBe(true); // Wi = 1500 − 2×20
    expect(bars.every((p) => /^B\d{2}$/.test(p.id))).toBe(true); // sin sufijo -I / -D
    const boxes = d.layout.filter((r) => r.type === 'bar');
    expect(boxes.every((r) => r.x === 20 && r.w === 1460)).toBe(true);
  });
  it('el modo de cruce no cambia el despiece si no hay refuerzo', () => {
    const split = computeDesign(makeConfig({ reinf: false, crossing: 'split' }), catalog);
    const through = computeDesign(makeConfig({ reinf: false, crossing: 'through' }), catalog);
    expect(split.pieces.map((p) => p.id)).toEqual(through.pieces.map((p) => p.id));
  });
  it('no valida el perfil del refuerzo si no se usa', () => {
    const cfg = makeConfig({ reinf: false });
    cfg.reinforcement.profileId = 'no-existe';
    expect(computeDesign(cfg, catalog).issues.filter((i) => i.level === 'error')).toEqual([]);
  });
  it('el plan de cortes no trae piezas de refuerzo', () => {
    const r = computeProject(makeConfig({ reinf: false }), catalog);
    const ids = r.plan!.sections.flatMap((s) => s.bins.flatMap((b) => b.items.map((i) => i.pieceId)));
    expect(ids).not.toContain('RC');
  });
});

describe('Barrotes alojados en los laterales', () => {
  it('entran en el lateral y se frenan antes de la cara exterior', () => {
    const d = computeDesign(makeConfig({ ends: 'inserted' }), catalog);
    expect(d.issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(d.derived!.barsInLateral).toBe(true);
    // pf = 20, pared del marco = 2, freno = 1  →  entra 20 − 2 − 1 = 17 por lado
    expect(d.derived!.lateralPenetrationMm).toBe(17);
    expect(d.derived!.lateralHoleMm).toBe(32.75); // caño Ø31,75 + 1 de holgura
    const bars = d.pieces.filter((p) => p.type === 'bar');
    // dos tramos: (W/2 − rw/2 − jg) − (pared + freno) = 740 − 3 = 737
    expect(bars.map((p) => p.lengthMm)).toEqual(Array(8).fill(737));
    const rects = d.layout.filter((r) => r.type === 'bar');
    expect(rects.every((r) => r.x === 3 || r.x === 760)).toBe(true);
    expect(Math.max(...rects.map((r) => r.x + r.w))).toBe(1497); // 1500 − 3
  });

  it('cada lateral lleva un agujero por barrote, en la cara interior', () => {
    const d = computeDesign(makeConfig({ ends: 'inserted' }), catalog);
    for (const id of ['LI', 'LD']) {
      const p = d.pieces.find((x) => x.id === id)!;
      expect(p.notes).toMatch(/Perforar 4 agujeros Ø32.75 mm/);
      expect(p.notes).toMatch(/cara interior/);
    }
    expect(d.pieces.find((p) => p.id === 'B01-I')!.notes).toMatch(/agujero del lateral izquierdo/);
  });

  it('a tope (por defecto) sigue arrancando en la cara interior del lateral', () => {
    const d = computeDesign(makeConfig({ ends: 'butt' }), catalog);
    expect(d.derived!.barsInLateral).toBe(false);
    expect(d.derived!.lateralHoleMm).toBe(0);
    expect(d.layout.filter((r) => r.type === 'bar').every((r) => r.x !== 3)).toBe(true);
    expect(d.pieces.find((p) => p.id === 'LI')!.notes).not.toMatch(/Perforar/);
  });

  it('barrote continuo = ancho exterior − 2×(pared del marco + freno)', () => {
    const d = computeDesign(makeConfig({ ends: 'inserted', reinf: false }), catalog);
    expect(d.pieces.filter((p) => p.type === 'bar').map((p) => p.lengthMm)).toEqual(Array(4).fill(1494));
  });

  it('pasante por el refuerzo y alojado en los laterales: 1 pieza por barrote', () => {
    const d = computeDesign(makeConfig({ ends: 'inserted', crossing: 'through' }), catalog);
    const bars = d.pieces.filter((p) => p.type === 'bar');
    expect(bars.map((p) => p.lengthMm)).toEqual(Array(4).fill(1494));
    expect(bars[0].notes).toMatch(/atraviesa el refuerzo central/);
    expect(bars[0].notes).toMatch(/entra 17 mm en el agujero del lateral/);
  });

  it('el plan de cortes usa el largo alojado en el lateral', () => {
    const r = computeProject(makeConfig({ ends: 'inserted', reinf: false }), catalog);
    const round = r.plan!.sections.find((s) => s.profileLabel.startsWith('Caño redondo'))!;
    expect(round.bins.flatMap((b) => b.items.map((i) => i.lengthMm))).toEqual(Array(4).fill(1494));
  });

  it('avisa si el agujero no entra en el hueco del perfil del marco', () => {
    const cfg = makeConfig({ ends: 'inserted' });
    cfg.frame.orientation = 'major'; // profundidad 20, hueco 16 < Ø32,75
    const d = computeDesign(cfg, catalog);
    expect(d.issues.some((i) => i.code === 'lateral-hole-too-big')).toBe(true);
  });

  it('error si el freno no deja profundidad útil en el lateral', () => {
    const d = computeDesign(makeConfig({ ends: 'inserted', setback: 25 }), catalog);
    expect(d.issues.some((i) => i.code === 'lateral-too-thin')).toBe(true);
    expect(d.pieces).toEqual([]);
  });
});

describe('Agujero del refuerzo central', () => {
  it('avisa si el agujero pasante no entra en la cara del refuerzo', () => {
    const cfg = makeConfig({ crossing: 'through' });
    cfg.frame.orientation = 'major'; // refuerzo (mismo perfil que el marco) de 20 mm de profundidad
    const d = computeDesign(cfg, catalog);
    // Ø32,75 con paredes de 2 mm: 32,75 > 20 − 2×2
    expect(d.issues.some((i) => i.code === 'hole-too-big')).toBe(true);
  });

  it('no avisa cuando el agujero entra en la cara del refuerzo', () => {
    const d = computeDesign(makeConfig({ crossing: 'through' }), catalog);
    expect(d.issues.some((i) => i.code === 'hole-too-big')).toBe(false);
  });
});

describe('Límite de 6.000 mm', () => {
  it('ninguna pieza supera el largo comercial en los casos base', () => {
    for (const [w, h] of [[1500, 600], [1800, 1500], [2500, 1200]]) {
      const r = computeProject(makeConfig({ w, h }), catalog);
      expect(r.design.pieces.every((p) => p.lengthMm <= 6000)).toBe(true);
    }
  });
  it('pieza de más de 6.000 mm → error, sin plan', () => {
    const r = computeProject(makeConfig({ w: 6020 }), catalog);
    expect(r.design.issues.some((i) => i.code === 'piece-too-long')).toBe(true);
    expect(r.plan).toBeNull();
  });
  it('el otro armado puede resolver el caso límite', () => {
    const r = computeProject(makeConfig({ w: 6020, assembly: 'vertical-full' }), catalog);
    expect(r.design.issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(r.plan).not.toBeNull();
  });
  it('packSection rechaza una pieza más larga que el caño', () => {
    expect(() => packSection([{ pieceId: 'X', lengthMm: 6001 }], { stockLengthMm: 6000, kerfMm: 3, endTrimMm: 0, minReusableMm: 300, offcuts: [] })).toThrow();
  });
});

describe('Plan de corte: consistencia', () => {
  const sets = [[1500, 600], [1800, 1500], [2400, 1900], [999, 777]];
  for (const [w, h] of sets) {
    it(`${w} × ${h}: cada pieza una sola vez, de un tramo continuo, y piezas + pérdidas + sobrante = largo`, () => {
      const cfg = makeConfig({ w, h });
      cfg.fabrication.endTrimMm = 5;
      const r = computeProject(cfg, catalog);
      const seen: string[] = [];
      for (const s of r.plan!.sections) for (const b of s.bins) {
        expect(b.piecesLengthMm + b.kerfLossMm + b.trimLossMm + b.leftoverMm).toBeCloseTo(b.source.lengthMm, 6);
        expect(b.leftoverMm).toBeGreaterThanOrEqual(0);
        for (const it of b.items) {
          seen.push(it.pieceId);
          expect(it.lengthMm).toBeLessThanOrEqual(b.source.lengthMm);
        }
        // cortes: n−1 entre piezas (+ el de separación del sobrante, máx. un disco)
        expect(b.kerfLossMm).toBeLessThanOrEqual(b.items.length * 3 + 1e-9);
        expect(b.kerfLossMm).toBeGreaterThanOrEqual((b.items.length - 1) * 3 - 1e-9);
      }
      expect(seen.sort()).toEqual(r.design.pieces.map((p) => p.id).sort());
      for (const m of r.materials) {
        near(m.inputMm, m.piecesLengthMm + m.kerfLossMm + m.trimLossMm + m.leftoverMm, 1e-6);
        near(m.utilization, m.piecesLengthMm / m.inputMm, 1e-12);
      }
    });
  }
  it('pieza que termina justo al final del caño: sin corte de separación', () => {
    const r = packSection([{ pieceId: 'A', lengthMm: 2998.5 }, { pieceId: 'B', lengthMm: 3000 }], { stockLengthMm: 6001.5, kerfMm: 3, endTrimMm: 0, minReusableMm: 300, offcuts: [] });
    expect(r.newBarsCount).toBe(1);
    expect(r.bins[0].kerfLossMm).toBe(3);
    expect(r.bins[0].leftoverMm).toBe(0);
  });
  it('resto menor que el disco: el corte final consume el resto', () => {
    const r = packSection([{ pieceId: 'A', lengthMm: 5999 }], { stockLengthMm: 6000, kerfMm: 3, endTrimMm: 0, minReusableMm: 300, offcuts: [] });
    expect(r.bins[0].kerfLossMm).toBe(1);
    expect(r.bins[0].leftoverMm).toBe(0);
  });
});

describe('Optimización', () => {
  const o = { stockLengthMm: 1000, kerfMm: 0, endTrimMm: 0, minReusableMm: 100, offcuts: [] };
  it('encuentra 2 caños donde FFD usa 3 (400,400,300×4)', () => {
    const items = [400, 400, 300, 300, 300, 300].map((l, i) => ({ pieceId: `P${i}`, lengthMm: l }));
    const r = packSection(items, o);
    expect(r.newBarsCount).toBe(2);
    expect(r.provenOptimal).toBe(true);
  });
  it('con disco de 3 mm, 2 × 3.000 no entran juntos en 6.000 (cada uno va solo)', () => {
    const r = packSection([3000, 3000, 3000, 3000].map((l, i) => ({ pieceId: `P${i}`, lengthMm: l })), { ...o, stockLengthMm: 6000, kerfMm: 3 });
    expect(r.newBarsCount).toBe(4);
  });
  it('concentra sobrantes: evita dejar sobrantes chicos si se puede', () => {
    const items = [600, 400, 500, 500, 300, 300, 200, 200].map((l, i) => ({ pieceId: `P${i}`, lengthMm: l }));
    const r = packSection(items, { ...o, minReusableMm: 200 });
    expect(r.newBarsCount).toBe(3);
    const small = r.bins.filter((b) => b.leftoverMm > 0 && b.leftoverMm < 200);
    expect(small).toHaveLength(0);
  });
  it('determinista', () => {
    const items = Array.from({ length: 25 }, (_, i) => ({ pieceId: `P${i}`, lengthMm: 300 + ((i * 137) % 900) }));
    const a = packSection(items, { ...o, stockLengthMm: 6000, kerfMm: 3 });
    const b = packSection(items, { ...o, stockLengthMm: 6000, kerfMm: 3 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.newBarsCount).toBeGreaterThanOrEqual(a.lowerBoundBars);
  });
});

describe('Sobrantes e inventario', () => {
  const roundKey = sectionKey(findRound(catalog, 'r-1q')!);
  const rectKey = sectionKey(findRect(catalog, 'c-40x20')!);
  const mk = (id: string, sectionKey: string, lengthMm: number): Offcut => ({ id, sectionKey, profileLabel: 'x', lengthMm, origin: 'Obra previa', createdAt: '2026-01-01' });

  it('reutiliza un sobrante de la misma sección, indicando procedencia', () => {
    const r = computeProject(makeConfig({ reuse: true }), catalog, [mk('o1', roundKey, 1500)]);
    const sec = r.plan!.sections.find((s) => s.sectionKey === roundKey)!;
    const off = sec.bins.find((b) => b.source.kind === 'offcut')!;
    expect(off.source.origin).toBe('Obra previa');
    expect(off.items.length).toBe(2); // 720 + 720 + 3 = 1443 ≤ 1500
    expect(sec.newBarsCount).toBe(1);
    expect(off.piecesLengthMm + off.kerfLossMm + off.leftoverMm).toBeCloseTo(1500, 6);
  });
  it('nunca usa un sobrante de sección incompatible', () => {
    const cfg = makeConfig({ reuse: true });
    const r = computeProject(cfg, catalog, [mk('o2', rectKey, 5000), mk('o3', 'round:25.4x2', 5000)]);
    const roundSec = r.plan!.sections.find((s) => s.sectionKey === roundKey)!;
    expect(roundSec.bins.some((b) => b.source.kind === 'offcut')).toBe(false);
    const rectSec = r.plan!.sections.find((s) => s.sectionKey === rectKey)!;
    for (const b of rectSec.bins) if (b.source.kind === 'offcut') expect(b.source.offcutId).toBe('o2');
  });
  it('sin la opción activada no se usan sobrantes', () => {
    const r = computeProject(makeConfig(), catalog, [mk('o1', roundKey, 5000)]);
    expect(r.plan!.sections.every((s) => s.bins.every((b) => b.source.kind === 'new'))).toBe(true);
  });
  it('un sobrante nunca aloja más piezas de las que caben (sin soldar recortes)', () => {
    const r = computeProject(makeConfig({ reuse: true }), catalog, [mk('o1', roundKey, 700)]);
    const sec = r.plan!.sections.find((s) => s.sectionKey === roundKey)!;
    expect(sec.bins.find((b) => b.source.kind === 'offcut')).toBeUndefined(); // 700 < 720
  });
  it('actualiza inventario: quita usados y agrega sobrantes reutilizables', () => {
    const r = computeProject(makeConfig({ reuse: true }), catalog, [mk('o1', roundKey, 1500)]);
    let n = 0;
    const inv = applyPlanToInventory([mk('o1', roundKey, 1500)], r.plan!, 'Obra', () => `n${++n}`, '2026-10-14');
    expect(inv.some((o) => o.id === 'o1')).toBe(false);
    expect(inv.every((o) => o.lengthMm >= 300)).toBe(true);
    expect(inv.length).toBeGreaterThan(0);
  });
});

describe('Exportación', () => {
  it('CSV de cortes: una fila por pieza + encabezado', () => {
    const r = computeProject(makeConfig(), catalog);
    const csv = cutListCsv(r.design.pieces, r.plan!);
    expect(csv.split('\r\n')).toHaveLength(r.design.pieces.length + 1);
    expect(csv).toContain('720');
  });
});

describe('Estilo clásico (ventana)', () => {
  function classicCfg(): ProjectConfig {
    const c = makeConfig({ round: 'rm-12', frame: 'pl-25x5' });
    c.style = 'clasica';
    c.productKind = 'ventana';
    c.frame.orientation = 'major';
    c.bars.ends = 'inserted';
    return c;
  }
  const d = computeDesign(classicCfg(), catalog);
  it('no tiene errores y no emite bar-wider-than-frame', () => {
    expect(d.issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(d.issues.some((i) => i.code === 'bar-wider-than-frame')).toBe(false);
  });
  it('despiece con planchuela y hierro macizo', () => {
    const planch = d.pieces.filter((p) => p.profileLabel.startsWith('Planchuela'));
    const macizo = d.pieces.filter((p) => p.profileLabel.startsWith('Hierro macizo'));
    expect(planch.length).toBeGreaterThan(0);
    expect(macizo.length).toBeGreaterThan(0);
    expect(d.pieces.some((p) => p.type === 'bar')).toBe(true);
  });
  it('producto no implementado no genera piezas', () => {
    const c = classicCfg();
    c.productKind = 'puerta-abrir';
    const dd = computeDesign(c, catalog);
    expect(dd.pieces).toEqual([]);
    expect(dd.issues.some((i) => i.code === 'product-not-implemented')).toBe(true);
  });
});
