import { describe, expect, it } from 'vitest';
import { catalog, makeConfig } from './helpers';
import { DEFAULT_CONFIG } from './profiles';
import { findRound, sectionKey } from './profiles';
import { applyPlanToInventory } from './inventory';
import {
  addReja,
  buildRejaPlan,
  computeObra,
  createObra,
  duplicateReja,
  loadObra,
  saveObra,
  migrateLegacyObra,
  parseObra,
  removeReja,
  OBRA_KEY,
  LEGACY_CONFIG_KEY,
  LEGACY_JOB_KEY,
  type StorageLike,
} from './obra';
import type { Obra, ProjectConfig } from './types';

function memStore(init: Record<string, string> = {}): StorageLike {
  const map: Record<string, string> = { ...init };
  return {
    getItem: (k) => (k in map ? map[k] : null),
    setItem: (k, v) => { map[k] = v; },
  };
}

function obraWith(overrides: Partial<Parameters<typeof makeConfig>[0]>[]): Obra {
  const base = createObra();
  const rejas = overrides.map((o, i) => ({
    id: `R${i + 1}`,
    name: `Reja ${i + 1}`,
    config: makeConfig(o),
    labor: { mode: 'hours' as const, hours: 0, fixedAmount: 0 },
  }));
  return { ...base, rejas, activeRejaId: rejas[0].id };
}

function barsSummary(obra: Obra): number {
  const r = computeObra(obra, catalog);
  return r.materials.reduce((a, m) => a + m.newBarsCount, 0);
}

describe('Obra: fábricas y gestión', () => {
  it('createObra arranca con una reja y nombre «Reja 1»', () => {
    const obra = createObra();
    expect(obra.rejas).toHaveLength(1);
    expect(obra.rejas[0].name).toBe('Reja 1');
    expect(obra.activeRejaId).toBe(obra.rejas[0].id);
  });

  it('una reja nueva hereda la config por defecto', () => {
    const obra = createObra();
    expect(obra.rejas[0].config).toEqual(DEFAULT_CONFIG);
  });

  it('los nombres autogenerados no se repiten', () => {
    let obra = createObra();
    obra = addReja(obra);
    obra = addReja(obra);
    expect(obra.rejas.map((r) => r.name)).toEqual(['Reja 1', 'Reja 2', 'Reja 3']);
    expect(new Set(obra.rejas.map((r) => r.name)).size).toBe(3);
  });

  it('la obra nunca queda sin rejas', () => {
    const obra = createObra();
    const after = removeReja(obra, obra.rejas[0].id);
    expect(after.rejas).toHaveLength(1);
    expect(after.rejas[0].id).toBe(obra.rejas[0].id);
  });

  it('eliminar una reja deja otra activa', () => {
    const obra = obraWith([{}, {}]);
    const after = removeReja(obra, 'R1');
    expect(after.rejas.map((r) => r.id)).toEqual(['R2']);
    expect(after.activeRejaId).toBe('R2');
  });

  it('duplicar copia la config con id y nombre distintos', () => {
    const obra = obraWith([{}]);
    const after = duplicateReja(obra, 'R1');
    expect(after.rejas).toHaveLength(2);
    const copy = after.rejas[1];
    expect(copy.id).not.toBe('R1');
    expect(copy.name).not.toBe('Reja 1');
    expect(copy.config).toEqual(obra.rejas[0].config);
  });
});

describe('Obra: persistencia y migración', () => {
  it('parseObra devuelve null con JSON corrupto o forma inválida', () => {
    expect(parseObra('{no json')).toBeNull();
    expect(parseObra(JSON.stringify({ rejas: [] }))).toBeNull();
  });

  it('parseObra acepta una obra válida y completa los valores faltantes', () => {
    const obra = createObra();
    const parsed = parseObra(JSON.stringify({ ...obra, cutting: {} }));
    expect(parsed).not.toBeNull();
    expect(parsed!.cutting.stockLengthMm).toBe(6000);
  });

  it('una obra guardada sin las opciones nuevas toma los valores por defecto', () => {
    const obra = createObra();
    const cfg = structuredClone(obra.rejas[0].config) as unknown as {
      frame: Record<string, unknown>; bars: Record<string, unknown>; fabrication: Record<string, unknown>;
    };
    delete cfg.frame.horizontalProfile;
    delete cfg.bars.ends;
    delete cfg.fabrication.socketSetbackMm;
    delete cfg.fabrication.horizontalEdgeMm;
    const parsed = parseObra(JSON.stringify({ ...obra, rejas: [{ ...obra.rejas[0], config: cfg }] }));
    expect(parsed).not.toBeNull();
    expect(parsed!.rejas[0].config.frame.horizontalProfile).toBe('same-as-sides');
    expect(parsed!.rejas[0].config.bars.ends).toBe('butt');
    expect(parsed!.rejas[0].config.fabrication.socketSetbackMm).toBe(1);
    expect(parsed!.rejas[0].config.fabrication.horizontalEdgeMm).toBe(5);
  });

  it('una obra con MS/MI redondos y armado horizontal se normaliza a laterales completos', () => {
    const obra = createObra();
    obra.rejas[0].config.frame.horizontalProfile = 'round';
    obra.rejas[0].config.frame.assembly = 'horizontal-full';
    const parsed = parseObra(JSON.stringify(obra));
    expect(parsed).not.toBeNull();
    expect(parsed!.rejas[0].config.frame.assembly).toBe('vertical-full');
  });

  it('conserva los precios por sección al recargar (claves dinámicas)', () => {
    const obra = createObra();
    obra.budget.enabled = true;
    obra.budget.pricePerBar = { 'rect:40x20x2': 12345 };
    const parsed = parseObra(JSON.stringify(obra));
    expect(parsed).not.toBeNull();
    expect(parsed!.budget.pricePerBar['rect:40x20x2']).toBe(12345);
  });

  it('descarta claves peligrosas de los datos guardados (prototype pollution)', () => {
    const obra = createObra();
    obra.budget.enabled = true;
    obra.budget.pricePerBar = { 'rect:40x20x2': 1 };

    // Igual que lo que escribiría un script malicioso en el localStorage: `__proto__`
    // como clave del mapa de precios. `JSON.parse` la define como propiedad propia.
    const crafted = JSON.stringify(obra).replace('"rect:40x20x2":1', '"rect:40x20x2":1,"__proto__":{"injected":true}');
    const parsed = parseObra(crafted);

    expect(parsed).not.toBeNull();
    const prices = parsed!.budget.pricePerBar as Record<string, unknown>;
    expect(prices['rect:40x20x2']).toBe(1);
    // `__proto__` no se copia: el objeto cargado conserva su prototipo original.
    expect(Object.getPrototypeOf(prices)).toBe(Object.prototype);
    expect((Object.prototype as unknown as Record<string, unknown>).injected).toBeUndefined();
  });

  it('loadObra con JSON corrupto cae a una obra nueva sin romper', () => {
    const store = memStore({ [OBRA_KEY]: '{corrupto' });
    const obra = loadObra(store);
    expect(obra.rejas).toHaveLength(1);
  });

  it('migra los datos de la versión de una sola reja', () => {
    const legacy: ProjectConfig = makeConfig({ w: 2000, h: 900 });
    legacy.fabrication.stockLengthMm = 7000;
    legacy.stock.minReusableMm = 250;
    legacy.costs.enabled = true;
    legacy.costs.pricePerBar = { 'round:31.75x2': 12345 };
    const store = memStore({
      [LEGACY_CONFIG_KEY]: JSON.stringify(legacy),
      [LEGACY_JOB_KEY]: 'Cocina García',
    });
    const obra = migrateLegacyObra(store)!;
    expect(obra).not.toBeNull();
    expect(obra.name).toBe('Cocina García');
    expect(obra.rejas).toHaveLength(1);
    expect(obra.rejas[0].name).toBe('Reja 1');
    expect(obra.rejas[0].config.window).toEqual({ widthMm: 2000, heightMm: 900 });
    expect(obra.cutting.stockLengthMm).toBe(7000);
    expect(obra.cutting.minReusableMm).toBe(250);
    expect(obra.budget.enabled).toBe(true);
    expect(obra.budget.pricePerBar['round:31.75x2']).toBe(12345);
  });

  it('no migra ni pisa nada si ya existe una obra', () => {
    const store = memStore({
      [OBRA_KEY]: JSON.stringify(createObra()),
      [LEGACY_CONFIG_KEY]: JSON.stringify(makeConfig()),
    });
    expect(migrateLegacyObra(store)).toBeNull();
    expect(loadObra(store).rejas).toHaveLength(1);
  });
});

describe('Obra: plan unificado', () => {
  it('junta las rejas en un solo plan por sección', () => {
    const obra = obraWith([{}, {}]);
    const r = computeObra(obra, catalog);
    expect(r.valid).toHaveLength(2);
    const keys = r.plan!.sections.map((s) => s.sectionKey);
    expect(new Set(keys).size).toBe(keys.length); // una sección por clave, no por reja
    expect(keys.length).toBe(2); // round + rect
  });

  it('la compra unificada no supera la suma de las rejas por separado', () => {
    const obra = obraWith([{}, {}, { w: 900, h: 400 }]);
    const unified = barsSummary(obra);
    const separate = obra.rejas.reduce((a, r) => a + barsSummary({ ...obra, rejas: [r], activeRejaId: r.id }), 0);
    expect(unified).toBeLessThanOrEqual(separate);
  });

  it('excluye del plan a las rejas con errores y avisa', () => {
    const obra = obraWith([{}, {}]);
    obra.rejas[1].config.window.widthMm = 0;
    const r = computeObra(obra, catalog);
    expect(r.valid).toHaveLength(1);
    expect(r.rejas[1].error).toBe(true);
    expect(r.rejas[1].plan).toBeNull();
    expect(r.pieces.every((p) => p.rejaId === 'R1')).toBe(true);
  });

  it('el plan por reja solo trae los caños que la contienen', () => {
    const obra = obraWith([{}, {}]);
    const r = computeObra(obra, catalog);
    const rejaPlan = buildRejaPlan(r.plan, 'R1')!;
    expect(rejaPlan).not.toBeNull();
    for (const s of rejaPlan.sections) {
      for (const b of s.bins) {
        expect(b.items.some((it) => it.rejaId === 'R1')).toBe(true);
      }
    }
  });

  it('aplica el plan unificado al inventario una sola vez', () => {
    const obra = obraWith([{}, {}]);
    obra.cutting = { ...obra.cutting, reuseOffcuts: true };
    const roundKey = sectionKey(findRound(catalog, DEFAULT_CONFIG.roundProfileId)!);
    const used = { id: 'o1', sectionKey: roundKey, profileLabel: 'x', lengthMm: 1500, origin: 'prueba', createdAt: '2026-01-01' };
    const r = computeObra(obra, catalog, [used]);
    let n = 0;
    const next = applyPlanToInventory([used], r.plan!, 'Obra', () => `s${++n}`, '2026-10-16');
    expect(next.some((o) => o.id === 'o1')).toBe(false); // el sobrante usado salió del inventario
    expect(next.length).toBeGreaterThanOrEqual(1); // se registraron sobrantes reutilizables
    expect(next.every((o) => o.origin.startsWith('Obra'))).toBe(true);
  });
});

describe('Persistencia: estilo clásico round-trip', () => {
  it('guarda y restaura una reja clásica', () => {
    const store = memStore();
    const obra = createObra();
    const cfg = makeConfig({ round: 'rm-12', frame: 'pl-25x5' });
    cfg.style = 'clasica';
    cfg.productKind = 'ventana';
    cfg.frame.orientation = 'major';
    obra.rejas[0].config = cfg;
    saveObra(store, obra);
    const loaded = loadObra(store);
    expect(loaded.rejas[0].config.style).toBe('clasica');
    expect(loaded.rejas[0].config.roundProfileId).toBe('rm-12');
    expect(loaded.rejas[0].config.frame.profileId).toBe('pl-25x5');
  });
});

describe('Migración: config antigua sin style/productKind', () => {
  it('normaliza a moderna/ventana', () => {
    const legacy = { ...DEFAULT_CONFIG } as Record<string, unknown>;
    delete (legacy as any).style;
    delete (legacy as any).productKind;
    const store = memStore({ [LEGACY_CONFIG_KEY]: JSON.stringify(legacy) });
    const obra = migrateLegacyObra(store);
    expect(obra).not.toBeNull();
    expect(obra!.rejas[0].config.style).toBe('moderna');
    expect(obra!.rejas[0].config.productKind).toBe('ventana');
  });
});
