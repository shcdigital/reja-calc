import { DEFAULT_CATALOG, DEFAULT_CONFIG } from './profiles';
import type { ProjectConfig } from './types';

/** Utilidad de pruebas/uso programático: config por defecto con cambios parciales. */
export function makeConfig(over: {
  w?: number; h?: number; round?: string; assembly?: ProjectConfig['frame']['assembly'];
  horizontals?: ProjectConfig['frame']['horizontalProfile'];
  crossing?: ProjectConfig['bars']['crossing']; kerf?: number; frame?: string;
  mode?: 'auto' | 'manual'; manual?: number; gap?: number; minGap?: number; reuse?: boolean; jg?: number;
  reinf?: boolean; ends?: ProjectConfig['bars']['ends']; setback?: number; horizontalEdge?: number;
} = {}): ProjectConfig {
  const c: ProjectConfig = structuredClone(DEFAULT_CONFIG);
  if (over.w !== undefined) c.window.widthMm = over.w;
  if (over.h !== undefined) c.window.heightMm = over.h;
  if (over.round) c.roundProfileId = over.round;
  if (over.assembly) c.frame.assembly = over.assembly;
  if (over.horizontals) c.frame.horizontalProfile = over.horizontals;
  if (over.crossing) c.bars.crossing = over.crossing;
  if (over.kerf !== undefined) c.fabrication.kerfMm = over.kerf;
  if (over.frame) { c.frame.profileId = over.frame; c.reinforcement.profileId = over.frame; }
  if (over.mode) c.bars.mode = over.mode;
  if (over.manual) c.bars.manualCount = over.manual;
  if (over.gap !== undefined) c.bars.desiredGapMm = over.gap;
  if (over.minGap !== undefined) c.bars.minGapMm = over.minGap;
  if (over.reuse) c.stock.reuseOffcuts = true;
  if (over.jg !== undefined) c.fabrication.jointGapMm = over.jg;
  if (over.reinf !== undefined) c.reinforcement.enabled = over.reinf;
  if (over.ends) c.bars.ends = over.ends;
  if (over.setback !== undefined) c.fabrication.socketSetbackMm = over.setback;
  if (over.horizontalEdge !== undefined) c.fabrication.horizontalEdgeMm = over.horizontalEdge;
  return c;
}
export const catalog = DEFAULT_CATALOG;
