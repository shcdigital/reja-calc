import { computeDesign } from './geometry';
import { computeCuttingPlan } from './cutting';
import { computeCosts, computeMaterials } from './materials';
import { resolveStyleConfig } from './profiles';
import type { Catalog, CostResult, CuttingPlan, Design, MaterialLine, Offcut, ProjectConfig } from './types';

export interface ProjectResult {
  design: Design;
  plan: CuttingPlan | null;
  materials: MaterialLine[];
  costs: CostResult | null;
}

/** Pipeline completo: geometría → despiece → plan de corte → materiales → costos. */
export function computeProject(config: ProjectConfig, catalog: Catalog, inventory: Offcut[] = []): ProjectResult {
  const resolved = resolveStyleConfig(config, catalog);
  const design = computeDesign(resolved, catalog);
  if (design.issues.some((i) => i.level === 'error') || design.pieces.length === 0) {
    return { design, plan: null, materials: [], costs: null };
  }
  const plan = computeCuttingPlan(design.pieces, resolved, inventory);
  const materials = computeMaterials(plan);
  const costs = resolved.costs.enabled ? computeCosts(materials, resolved.costs) : null;
  return { design, plan, materials, costs };
}
