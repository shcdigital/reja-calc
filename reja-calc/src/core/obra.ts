/**
 * Obra multi-reja: modelo de estado, persistencia, migración y el pipeline
 * que consolida todas las rejas en un único plan de cortes y lista de materiales.
 *
 * Un plan de cortes por obra: las piezas de todas las rejas válidas se juntan y se
 * optimizan por sección de caño (ver `cutting.ts`). Para poder atribuir cada pieza a su
 * reja, el `id` global se prefija con el id de la reja y se conserva el `localId` original.
 */
import { computeCuttingPlan } from './cutting';
import { computeMaterials } from './materials';
import { DEFAULT_CONFIG } from './profiles';
import { computeDesign } from './geometry';
import type {
  BudgetConfig,
  Catalog,
  CuttingPlan,
  Design,
  Issue,
  MaterialLine,
  Obra,
  ObraCuttingConfig,
  Offcut,
  Piece,
  ProjectConfig,
  Reja,
  RejaLabor,
  SectionPlan,
} from './types';

// ───────────────────────── Claves de almacenamiento ─────────────────────────

export const OBRA_KEY = 'reja:obra:v1';
export const LEGACY_CONFIG_KEY = 'reja:config:v1';
export const LEGACY_JOB_KEY = 'reja:job:v1';
export const CATALOG_KEY = 'reja:catalog:v1';
export const INVENTORY_KEY = 'reja:inventory:v1';
export const UNIT_KEY = 'reja:unit:v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function getStorage(): StorageLike | null {
  try {
    const ls = (globalThis as { localStorage?: StorageLike }).localStorage;
    return ls ?? null;
  } catch {
    return null;
  }
}

function safeGet(store: StorageLike, key: string): string | null {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

export function makeId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `r-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

// ───────────────────────── Valores por defecto ─────────────────────────

export const DEFAULT_CUTTING: ObraCuttingConfig = {
  stockLengthMm: DEFAULT_CONFIG.fabrication.stockLengthMm,
  kerfMm: DEFAULT_CONFIG.fabrication.kerfMm,
  endTrimMm: DEFAULT_CONFIG.fabrication.endTrimMm,
  minReusableMm: DEFAULT_CONFIG.stock.minReusableMm,
  reuseOffcuts: DEFAULT_CONFIG.stock.reuseOffcuts,
};

export const DEFAULT_LABOR: RejaLabor = { mode: 'hours', hours: 0, fixedAmount: 0 };

export const DEFAULT_BUDGET: BudgetConfig = {
  enabled: false,
  pricePerBar: {},
  consumables: { discsCost: 0, paintCost: 0, otherConsumablesCost: 0 },
  laborRatePerHour: 0,
};

// ───────────────────────── Fábricas ─────────────────────────

/** Nombre libre «<base> N», sin repetir dentro de la obra. */
export function nextRejaName(obra: Obra, base = 'Reja'): string {
  const used = new Set(obra.rejas.map((r) => r.name));
  let n = obra.rejas.length + 1;
  while (used.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

/** Nombre libre a partir de una base arbitraria (p. ej. al duplicar). */
export function uniqueName(obra: Obra, base: string): string {
  const used = new Set(obra.rejas.map((r) => r.name));
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

export function createReja(obra: Obra, base = 'Reja'): Reja {
  return {
    id: makeId(),
    name: nextRejaName(obra, base),
    config: structuredClone(DEFAULT_CONFIG),
    labor: { ...DEFAULT_LABOR },
  };
}

/** Obra nueva con una reja vacía (una obra nunca queda sin rejas). */
export function createObra(): Obra {
  const obra: Obra = {
    id: makeId(),
    name: '',
    rejas: [],
    activeRejaId: '',
    cutting: { ...DEFAULT_CUTTING },
    budget: { ...DEFAULT_BUDGET, consumables: { ...DEFAULT_BUDGET.consumables } },
  };
  const reja = createReja(obra);
  obra.rejas = [reja];
  obra.activeRejaId = reja.id;
  return obra;
}

export function addReja(obra: Obra): Obra {
  const reja = createReja(obra);
  return { ...obra, rejas: [...obra.rejas, reja], activeRejaId: reja.id };
}

/** Duplica una reja (config y mano de obra) con un id y un nombre nuevos. */
export function duplicateReja(obra: Obra, id: string): Obra {
  const src = obra.rejas.find((r) => r.id === id);
  if (!src) return obra;
  const copy: Reja = {
    ...structuredClone(src),
    id: makeId(),
    name: uniqueName(obra, `${src.name} (copia)`),
  };
  const rejas = [...obra.rejas];
  rejas.splice(rejas.indexOf(src) + 1, 0, copy);
  return { ...obra, rejas, activeRejaId: copy.id };
}

/** Quita una reja. Si es la única, no hace nada: la obra nunca queda vacía. */
export function removeReja(obra: Obra, id: string): Obra {
  if (obra.rejas.length <= 1) return obra;
  const rejas = obra.rejas.filter((r) => r.id !== id);
  if (rejas.length === obra.rejas.length) return obra;
  const activeRejaId = obra.activeRejaId === id ? rejas[0].id : obra.activeRejaId;
  return { ...obra, rejas, activeRejaId };
}

export function renameReja(obra: Obra, id: string, name: string): Obra {
  return { ...obra, rejas: obra.rejas.map((r) => (r.id === id ? { ...r, name } : r)) };
}

export function selectReja(obra: Obra, id: string): Obra {
  return obra.rejas.some((r) => r.id === id) ? { ...obra, activeRejaId: id } : obra;
}

// ───────────────────────── Persistencia ─────────────────────────

/** Claves que no se copian desde datos guardados (evita contaminar el prototipo). */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Mezcla defensiva: toma la forma de `base` y los valores válidos de `saved`. */
function deepFill(base: unknown, saved: unknown): unknown {
  if (base === null || typeof base !== 'object' || Array.isArray(base)) {
    return saved !== undefined && typeof saved === typeof base ? saved : base;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  if (saved && typeof saved === 'object') {
    const s = saved as Record<string, unknown>;
    for (const k of Object.keys(out)) {
      if (k in s && !UNSAFE_KEYS.has(k)) out[k] = deepFill(out[k], s[k]);
    }
    // Objetos que son mapas de claves dinámicas (p. ej. `pricePerBar`): la base
    // vacía no aporta claves propias, así que se conservan las guardadas.
    if (Object.keys(base as object).length === 0) {
      for (const k of Object.keys(s)) {
        // `JSON.parse` define `__proto__` como clave propia del objeto: asignarla
        // cambiaría el prototipo de `out`. Se descartan esas claves siempre.
        if (!UNSAFE_KEYS.has(k)) out[k] = s[k];
      }
    }
  }
  return out;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Valida la forma mínima de una obra guardada. */
function isValidObra(v: unknown): v is Obra {
  if (!isObject(v)) return false;
  if (!Array.isArray(v.rejas) || v.rejas.length === 0) return false;
  if (typeof v.activeRejaId !== 'string') return false;
  if (!isObject(v.cutting) || !isObject(v.budget)) return false;
  return v.rejas.every(
    (r) => isObject(r) && typeof r.id === 'string' && typeof r.name === 'string' && isObject(r.config) && isObject(r.labor),
  );
}

/** Completa campos faltantes de una obra guardada con los valores por defecto. */
function normalizeConfig(saved: unknown): ProjectConfig {
  const config = deepFill(DEFAULT_CONFIG, saved) as ProjectConfig;
  // Los MS/MI redondos se alojan en los laterales, que deben ser completos.
  if (config.frame.horizontalProfile === 'round') config.frame.assembly = 'vertical-full';
  return config;
}

function normalizeObra(v: Obra): Obra {
  return {
    id: typeof v.id === 'string' ? v.id : makeId(),
    name: typeof v.name === 'string' ? v.name : '',
    activeRejaId: v.rejas.some((r) => r.id === v.activeRejaId) ? v.activeRejaId : v.rejas[0].id,
    cutting: deepFill(DEFAULT_CUTTING, v.cutting) as ObraCuttingConfig,
    budget: deepFill(DEFAULT_BUDGET, v.budget) as BudgetConfig,
    rejas: v.rejas.map((r) => ({
      id: r.id,
      name: r.name,
      config: normalizeConfig(r.config),
      labor: deepFill(DEFAULT_LABOR, r.labor) as RejaLabor,
    })),
  };
}

export function parseObra(raw: string): Obra | null {
  try {
    const v = JSON.parse(raw);
    return isValidObra(v) ? normalizeObra(v) : null;
  } catch {
    return null;
  }
}

/**
 * Migra los datos de la versión de una sola reja a una obra con una reja.
 * Solo lee: no escribe. Devuelve `null` si ya existe una obra (no la pisa) o si no hay datos.
 */
export function migrateLegacyObra(store: StorageLike | null): Obra | null {
  if (!store) return null;
  if (safeGet(store, OBRA_KEY)) return null;
  const rawConfig = safeGet(store, LEGACY_CONFIG_KEY);
  if (!rawConfig) return null;
  let legacy: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawConfig);
    if (!isObject(parsed)) return null;
    legacy = parsed;
  } catch {
    return null;
  }
  const obra = createObra();
  obra.name = safeGet(store, LEGACY_JOB_KEY) ?? '';
  const reja = obra.rejas[0];
  reja.name = 'Reja 1';
  reja.config = normalizeConfig(legacy);
  const fab = reja.config.fabrication;
  const stock = reja.config.stock;
  obra.cutting = {
    stockLengthMm: num(fab.stockLengthMm),
    kerfMm: num(fab.kerfMm),
    endTrimMm: num(fab.endTrimMm),
    minReusableMm: num(stock.minReusableMm),
    reuseOffcuts: !!stock.reuseOffcuts,
  };
  const costs = legacy.costs;
  if (isObject(costs)) {
    obra.budget = {
      enabled: !!costs.enabled,
      pricePerBar: isObject(costs.pricePerBar) ? (costs.pricePerBar as Record<string, number>) : {},
      consumables: {
        discsCost: num(costs.discsCost),
        paintCost: num(costs.paintCost),
        otherConsumablesCost: num(costs.otherConsumablesCost),
      },
      laborRatePerHour: 0,
    };
  }
  return obra;
}

/** Carga la obra: guardada → migrada → nueva. Nunca lanza. */
export function loadObra(store: StorageLike | null = getStorage()): Obra {
  if (store) {
    const raw = safeGet(store, OBRA_KEY);
    if (raw) {
      const parsed = parseObra(raw);
      if (parsed) return parsed;
    }
    const migrated = migrateLegacyObra(store);
    if (migrated) return migrated;
  }
  return createObra();
}

export function saveObra(store: StorageLike | null, obra: Obra): void {
  if (!store) return;
  try {
    store.setItem(OBRA_KEY, JSON.stringify(obra));
  } catch {
    /* sin espacio / modo privado: se ignora */
  }
}

// ───────────────────────── Cálculo de la obra ─────────────────────────

export interface RejaResult {
  reja: Reja;
  /** Config efectiva (con los parámetros de corte de la obra ya aplicados). */
  config: ProjectConfig;
  design: Design;
  /** Subconjunto del plan unificado que toca a esta reja. */
  plan: CuttingPlan | null;
  error: boolean;
}

export interface ObraResult {
  rejas: RejaResult[];
  /** Rejas sin errores, que aportan piezas al plan unificado. */
  valid: RejaResult[];
  /** Todas las piezas de todas las rejas válidas, con id global prefijado. */
  pieces: Piece[];
  plan: CuttingPlan | null;
  materials: MaterialLine[];
  /** Problemas del empaquetado unificado. */
  issues: Issue[];
  hasAnyValid: boolean;
}

/** Aplica los parámetros de corte de la obra a la config de una reja. */
export function configWithCutting(config: ProjectConfig, c: ObraCuttingConfig): ProjectConfig {
  return {
    ...config,
    fabrication: {
      ...config.fabrication,
      stockLengthMm: c.stockLengthMm,
      kerfMm: c.kerfMm,
      endTrimMm: c.endTrimMm,
    },
    stock: { reuseOffcuts: c.reuseOffcuts, minReusableMm: c.minReusableMm },
  };
}

/** Id global de una pieza: prefijo con el id de su reja. */
export const globalPieceId = (rejaId: string, localId: string): string => `${rejaId}:${localId}`;

/** Identifica si un id global pertenece a una reja. */
export const pieceBelongsTo = (pieceId: string, rejaId: string): boolean => pieceId.startsWith(`${rejaId}:`);

/** Filtra el plan unificado a los caños que contienen al menos una pieza de la reja. */
export function buildRejaPlan(plan: CuttingPlan | null, rejaId: string): CuttingPlan | null {
  if (!plan) return null;
  const sections: SectionPlan[] = [];
  for (const s of plan.sections) {
    const bins = s.bins.filter((b) => b.items.some((it) => it.rejaId === rejaId || pieceBelongsTo(it.pieceId, rejaId)));
    if (bins.length === 0) continue;
    sections.push({ ...s, bins, newBarsCount: bins.filter((b) => b.source.kind === 'new').length });
  }
  return sections.length > 0 ? { sections, issues: [] } : null;
}

/**
 * Calcula la obra completa: cada reja por separado y, luego, un único plan de cortes
 * con las piezas de todas las rejas válidas (agrupadas por sección).
 */
export function computeObra(obra: Obra, catalog: Catalog, inventory: Offcut[] = []): ObraResult {
  const drafts = obra.rejas.map((reja) => {
    const config = configWithCutting(reja.config, obra.cutting);
    const design = computeDesign(config, catalog);
    const error = design.issues.some((i) => i.level === 'error') || design.pieces.length === 0;
    return { reja, config, design, error };
  });

  const validDrafts = drafts.filter((d) => !d.error);

  const pieces: Piece[] = [];
  for (const d of validDrafts) {
    for (const p of d.design.pieces) {
      pieces.push({ ...p, localId: p.id, rejaId: d.reja.id, id: globalPieceId(d.reja.id, p.id) });
    }
  }

  let plan: CuttingPlan | null = null;
  let materials: MaterialLine[] = [];
  let issues: Issue[] = [];
  if (pieces.length > 0 && validDrafts.length > 0) {
    const baseConfig = validDrafts[0].config;
    plan = computeCuttingPlan(pieces, baseConfig, inventory);
    materials = computeMaterials(plan);
    issues = plan.issues;
  }

  const rejas: RejaResult[] = drafts.map((d) => ({
    reja: d.reja,
    config: d.config,
    design: d.design,
    plan: d.error ? null : buildRejaPlan(plan, d.reja.id),
    error: d.error,
  }));

  return { rejas, valid: rejas.filter((r) => !r.error), pieces, plan, materials, issues, hasAnyValid: pieces.length > 0 };
}
