import type { CuttingPlan, Offcut } from './types';

/**
 * Aplica un plan al inventario: quita los sobrantes usados y registra los sobrantes
 * resultantes reutilizables (≥ largo mínimo). Función pura.
 */
export function applyPlanToInventory(
  inventory: Offcut[],
  plan: CuttingPlan,
  jobName: string,
  makeId: () => string,
  now: string,
): Offcut[] {
  const used = new Set<string>();
  const added: Offcut[] = [];
  for (const s of plan.sections) {
    for (const b of s.bins) {
      if (b.source.kind === 'offcut' && b.source.offcutId) used.add(b.source.offcutId);
      if (b.leftoverReusable && b.leftoverMm > 0) {
        added.push({
          id: makeId(),
          sectionKey: s.sectionKey,
          profileLabel: s.profileLabel,
          lengthMm: b.leftoverMm,
          origin: `${jobName} — ${b.source.kind === 'new' ? 'Caño' : 'Sobrante'} ${b.index}`,
          createdAt: now,
        });
      }
    }
  }
  return [...inventory.filter((o) => !used.has(o.id)), ...added];
}
