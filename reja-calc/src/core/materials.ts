/**
 * Lista de materiales y costos a partir del plan de corte.
 *
 * Aprovechamiento (fórmula explícita):
 *   material_empleado = caños_nuevos × largo_comercial + Σ largo de sobrantes usados
 *   aprovechamiento   = Σ largo de piezas / material_empleado
 * Identidad (verificada en pruebas):
 *   material_empleado = piezas + pérdidas_de_disco + refilado + sobrante_final
 */
import type { CostResult, CostsConfig, CuttingPlan, MaterialLine } from './types';

export function computeMaterials(plan: CuttingPlan): MaterialLine[] {
  return plan.sections.map((s) => {
    const newBins = s.bins.filter((b) => b.source.kind === 'new');
    const offBins = s.bins.filter((b) => b.source.kind === 'offcut');
    const sum = (f: (b: (typeof s.bins)[number]) => number, arr = s.bins) => arr.reduce((a, b) => a + f(b), 0);
    const purchased = newBins.length * s.stockLengthMm;
    const offUsed = sum((b) => b.source.lengthMm, offBins);
    const input = purchased + offUsed;
    const piecesLen = sum((b) => b.piecesLengthMm);
    const reusable = sum((b) => (b.leftoverReusable ? b.leftoverMm : 0));
    const leftover = sum((b) => b.leftoverMm);
    return {
      sectionKey: s.sectionKey,
      profileLabel: s.profileLabel,
      stockLengthMm: s.stockLengthMm,
      piecesCount: s.pieces.length,
      piecesLengthMm: piecesLen,
      newBarsCount: newBins.length,
      purchasedMm: purchased,
      offcutsUsedCount: offBins.length,
      offcutsUsedMm: offUsed,
      inputMm: input,
      kerfLossMm: sum((b) => b.kerfLossMm),
      trimLossMm: sum((b) => b.trimLossMm),
      leftoverMm: leftover,
      leftoverReusableMm: reusable,
      leftoverScrapMm: leftover - reusable,
      utilization: input > 0 ? piecesLen / input : 0,
    };
  });
}

/** Costo: Σ(caños nuevos × precio) + consumibles. Sin precios no se inventa nada. */
export function computeCosts(materials: MaterialLine[], c: CostsConfig): CostResult {
  const lines = materials.map((m) => {
    const price = c.pricePerBar[m.sectionKey];
    const unitPrice = typeof price === 'number' && Number.isFinite(price) && price > 0 ? price : undefined;
    return {
      sectionKey: m.sectionKey,
      profileLabel: m.profileLabel,
      bars: m.newBarsCount,
      unitPrice,
      subtotal: unitPrice === undefined ? undefined : unitPrice * m.newBarsCount,
    };
  });
  const materialsSubtotal = lines.reduce((a, l) => a + (l.subtotal ?? 0), 0);
  const consumables = Math.max(0, c.discsCost || 0) + Math.max(0, c.paintCost || 0) + Math.max(0, c.otherConsumablesCost || 0);
  return {
    hasAnyPrice: lines.some((l) => l.unitPrice !== undefined) || consumables > 0,
    lines,
    materialsSubtotal,
    consumables,
    total: materialsSubtotal + consumables,
    missingPrices: lines.filter((l) => l.unitPrice === undefined && l.bars > 0).map((l) => l.profileLabel),
  };
}
