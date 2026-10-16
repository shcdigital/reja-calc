import { describe, expect, it } from 'vitest';
import { catalog, makeConfig } from './helpers';
import { findRect, sectionKey } from './profiles';
import { computeObra, createObra } from './obra';
import { computeBudget, laborAmount } from './budget';
import { DEFAULT_BUDGET } from './obra';
import type { BudgetConfig, Obra, Reja } from './types';

const rectKey = sectionKey(findRect(catalog, 'c-40x20')!);

function obraWith(overrides: Partial<Parameters<typeof makeConfig>[0]>[], labor: Reja['labor'][] = []): Obra {
  const base = createObra();
  const rejas = overrides.map((o, i) => ({
    id: `R${i + 1}`,
    name: `Reja ${i + 1}`,
    config: makeConfig(o),
    labor: labor[i] ?? { mode: 'hours' as const, hours: 0, fixedAmount: 0 },
  }));
  return { ...base, rejas, activeRejaId: rejas[0].id };
}

const budget = (over: Partial<BudgetConfig> = {}): BudgetConfig => ({
  ...DEFAULT_BUDGET,
  consumables: { ...DEFAULT_BUDGET.consumables },
  ...over,
});

describe('Presupuesto', () => {
  it('cobra la sección compartida una sola vez por los caños de toda la obra', () => {
    const obra = obraWith([{}, {}], [
      { mode: 'hours', hours: 0, fixedAmount: 0 },
      { mode: 'hours', hours: 0, fixedAmount: 0 },
    ]);
    const result = computeObra(obra, catalog);
    const b = computeBudget(result, budget({ enabled: true, pricePerBar: { [rectKey]: 10000 } }));
    const line = b.materialsLines.find((l) => l.sectionKey === rectKey)!;
    // Dos rejas de 1500×600 → 2 caños rectangulares en total.
    expect(line.bars).toBe(2);
    expect(line.subtotal).toBe(20000);
    expect(b.materialsSubtotal).toBe(20000);
  });

  it('suma la mano de obra por horas y recalcula al cambiar el valor hora', () => {
    const obra = obraWith([{}, {}], [
      { mode: 'hours', hours: 3, fixedAmount: 0 },
      { mode: 'fixed', hours: 0, fixedAmount: 5000 },
    ]);
    const result = computeObra(obra, catalog);
    const b1 = computeBudget(result, budget({ laborRatePerHour: 1000 }));
    expect(b1.laborLines[0].amount).toBe(3000);
    expect(b1.laborLines[1].amount).toBe(5000);
    expect(b1.laborSubtotal).toBe(8000);

    const b2 = computeBudget(result, budget({ laborRatePerHour: 2000 }));
    expect(b2.laborLines[0].amount).toBe(6000); // por horas: recalcula
    expect(b2.laborLines[1].amount).toBe(5000); // fijo: no cambia
    expect(b2.laborSubtotal).toBe(11000);
  });

  it('calcula el total como materiales + consumibles + mano de obra', () => {
    const obra = obraWith([{}], [{ mode: 'fixed', hours: 0, fixedAmount: 4000 }]);
    const result = computeObra(obra, catalog);
    const b = computeBudget(
      result,
      budget({ enabled: true, pricePerBar: { [rectKey]: 10000 }, consumables: { discsCost: 500, paintCost: 300, otherConsumablesCost: 200 } }),
    );
    expect(b.materialsSubtotal).toBe(10000);
    expect(b.consumables).toBe(1000);
    expect(b.laborSubtotal).toBe(4000);
    expect(b.total).toBe(15000);
    expect(b.partial).toBe(true); // falta precio de la sección redonda
  });

  it('sin precios no inventa importes y reporta los faltantes', () => {
    const obra = obraWith([{}]);
    const result = computeObra(obra, catalog);
    const b = computeBudget(result, budget({ enabled: true }));
    expect(b.hasAnyValue).toBe(false);
    expect(b.total).toBe(0);
    expect(b.missingPrices.length).toBeGreaterThan(0);
    expect(b.partial).toBe(false);
  });

  it('marca el presupuesto parcial cuando faltan precios', () => {
    const obra = obraWith([{}]);
    const result = computeObra(obra, catalog);
    const b = computeBudget(result, budget({ enabled: true, pricePerBar: { [rectKey]: 10000 } }));
    expect(b.hasAnyValue).toBe(true);
    expect(b.missingPrices.length).toBeGreaterThan(0);
    expect(b.partial).toBe(true);
  });

  it('laborAmount: horas × valor o monto fijo', () => {
    expect(laborAmount('hours', 2, 999, 1500)).toBe(3000);
    expect(laborAmount('fixed', 2, 999, 1500)).toBe(999);
  });
});
