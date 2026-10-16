/**
 * Presupuesto de la obra: materiales + consumibles + mano de obra.
 *
 * El total NO incluye margen de ganancia ni impuestos: es la suma de costos.
 *   materiales  = Σ (caños a comprar de la sección × precio por caño de la sección)
 *   consumibles = discos + pintura + otros (una sola vez para toda la obra)
 *   mano de obra = Σ por reja (horas × valor hora  o  monto fijo)
 */
import type { BudgetConfig, LaborMode, MaterialLine } from './types';
import type { ObraResult } from './obra';

export interface BudgetMaterialLine {
  sectionKey: string;
  profileLabel: string;
  bars: number;
  unitPrice: number | undefined;
  subtotal: number | undefined;
}

export interface BudgetLaborLine {
  rejaId: string;
  rejaName: string;
  mode: LaborMode;
  hours: number;
  fixedAmount: number;
  amount: number;
}

export interface BudgetResult {
  enabled: boolean;
  materialsLines: BudgetMaterialLine[];
  materialsSubtotal: number;
  consumables: number;
  laborLines: BudgetLaborLine[];
  laborSubtotal: number;
  /** materiales + consumibles + mano de obra. */
  total: number;
  /** Secciones con caños a comprar a las que les falta precio. */
  missingPrices: string[];
  /** Hay al menos un importe cargado (precio, consumible o mano de obra). */
  hasAnyValue: boolean;
  /** Hay importes cargados pero faltan precios: el total es parcial. */
  partial: boolean;
}

const nonNeg = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

/** Costo de mano de obra de una reja según su modo. */
export function laborAmount(mode: LaborMode, hours: number, fixedAmount: number, laborRatePerHour: number): number {
  return mode === 'fixed' ? nonNeg(fixedAmount) : nonNeg(hours) * nonNeg(laborRatePerHour);
}

export function computeBudget(result: ObraResult, budget: BudgetConfig): BudgetResult {
  const materialsLines: BudgetMaterialLine[] = result.materials.map((m: MaterialLine) => {
    const raw = budget.pricePerBar[m.sectionKey];
    const unitPrice = typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : undefined;
    return {
      sectionKey: m.sectionKey,
      profileLabel: m.profileLabel,
      bars: m.newBarsCount,
      unitPrice,
      subtotal: unitPrice === undefined ? undefined : unitPrice * m.newBarsCount,
    };
  });

  const materialsSubtotal = materialsLines.reduce((a, l) => a + (l.subtotal ?? 0), 0);
  const c = budget.consumables;
  const consumables = nonNeg(c?.discsCost) + nonNeg(c?.paintCost) + nonNeg(c?.otherConsumablesCost);

  const laborLines: BudgetLaborLine[] = result.valid.map((r) => {
    const l = r.reja.labor;
    return {
      rejaId: r.reja.id,
      rejaName: r.reja.name,
      mode: l.mode,
      hours: nonNeg(l.hours),
      fixedAmount: nonNeg(l.fixedAmount),
      amount: laborAmount(l.mode, l.hours, l.fixedAmount, budget.laborRatePerHour),
    };
  });
  const laborSubtotal = laborLines.reduce((a, l) => a + l.amount, 0);

  const missingPrices = materialsLines.filter((l) => l.unitPrice === undefined && l.bars > 0).map((l) => l.profileLabel);
  const total = materialsSubtotal + consumables + laborSubtotal;
  const hasAnyValue = materialsSubtotal > 0 || consumables > 0 || laborSubtotal > 0 || materialsLines.some((l) => l.unitPrice !== undefined);

  return {
    enabled: !!budget.enabled,
    materialsLines,
    materialsSubtotal,
    consumables,
    laborLines,
    laborSubtotal,
    total,
    missingPrices,
    hasAnyValue,
    partial: hasAnyValue && missingPrices.length > 0,
  };
}
