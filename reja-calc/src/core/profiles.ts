import type {
  BarShape,
  Catalog,
  Orientation,
  Profile,
  ProjectConfig,
  RejaStyle,
  RectProfile,
  RoundProfile,
} from './types';

/** Ids por defecto de los perfiles de cada estilo. */
export const DEFAULT_MODERN_BAR_ID = 'r-1q';
export const DEFAULT_MODERN_FRAME_ID = 'c-40x20';
export const DEFAULT_CLASSIC_BAR_ID = 'qm-12';
export const DEFAULT_CLASSIC_FRAME_ID = 'pl-32x5';

/**
 * Catálogo inicial. Todos los valores son editables desde la interfaz.
 *
 * Las barras macizas cuadradas usan las medidas comerciales de herrería de
 * Argentina (pulgadas convertidas a mm): 5/16", 3/8", 7/16", 1/2", 9/16",
 * 5/8", 3/4", 7/8" y 1". La reja clásica usa barras macizas cuadradas y
 * planchuelas; la moderna, caños redondos y rectangulares.
 */
export const DEFAULT_CATALOG: Catalog = {
  round: [
    { id: 'r-1', kind: 'round', label: 'Caño redondo 1"', odMm: 25.4, thicknessMm: 2 },
    { id: 'r-1q', kind: 'round', label: 'Caño redondo 1¼"', odMm: 31.75, thicknessMm: 2 },
    { id: 'qm-8', kind: 'round', label: 'Hierro macizo cuadrado 5/16"', odMm: 7.94, thicknessMm: 3.97, solid: true, square: true },
    { id: 'qm-10', kind: 'round', label: 'Hierro macizo cuadrado 3/8"', odMm: 9.53, thicknessMm: 4.76, solid: true, square: true },
    { id: 'qm-11', kind: 'round', label: 'Hierro macizo cuadrado 7/16"', odMm: 11.11, thicknessMm: 5.56, solid: true, square: true },
    { id: 'qm-12', kind: 'round', label: 'Hierro macizo cuadrado 1/2"', odMm: 12.7, thicknessMm: 6.35, solid: true, square: true },
    { id: 'qm-14', kind: 'round', label: 'Hierro macizo cuadrado 9/16"', odMm: 14.29, thicknessMm: 7.14, solid: true, square: true },
    { id: 'qm-16', kind: 'round', label: 'Hierro macizo cuadrado 5/8"', odMm: 15.88, thicknessMm: 7.94, solid: true, square: true },
    { id: 'qm-19', kind: 'round', label: 'Hierro macizo cuadrado 3/4"', odMm: 19.05, thicknessMm: 9.53, solid: true, square: true },
    { id: 'qm-22', kind: 'round', label: 'Hierro macizo cuadrado 7/8"', odMm: 22.22, thicknessMm: 11.11, solid: true, square: true },
    { id: 'qm-25', kind: 'round', label: 'Hierro macizo cuadrado 1"', odMm: 25.4, thicknessMm: 12.7, solid: true, square: true },
  ],
  rect: [
    { id: 'c-30x20', kind: 'rect', label: 'Rectangular 30 × 20 × 2', aMm: 30, bMm: 20, thicknessMm: 2 },
    { id: 'c-40x20', kind: 'rect', label: 'Rectangular 40 × 20 × 2', aMm: 40, bMm: 20, thicknessMm: 2 },
    { id: 'c-40x30', kind: 'rect', label: 'Rectangular 40 × 30 × 2', aMm: 40, bMm: 30, thicknessMm: 2 },
    { id: 'pl-25x3', kind: 'rect', label: 'Planchuela 1" × 1/8"', aMm: 25.4, bMm: 3.175, thicknessMm: 3.175, solid: true },
    { id: 'pl-25x5', kind: 'rect', label: 'Planchuela 1" × 3/16"', aMm: 25.4, bMm: 4.76, thicknessMm: 4.76, solid: true },
    { id: 'pl-25x6', kind: 'rect', label: 'Planchuela 1" × 1/4"', aMm: 25.4, bMm: 6.35, thicknessMm: 6.35, solid: true },
    { id: 'pl-32x5', kind: 'rect', label: 'Planchuela 1 1/4" × 3/16"', aMm: 31.75, bMm: 4.76, thicknessMm: 4.76, solid: true },
    { id: 'pl-32x6', kind: 'rect', label: 'Planchuela 1 1/4" × 1/4"', aMm: 31.75, bMm: 6.35, thicknessMm: 6.35, solid: true },
    { id: 'pl-38x5', kind: 'rect', label: 'Planchuela 1 1/2" × 3/16"', aMm: 38.1, bMm: 4.76, thicknessMm: 4.76, solid: true },
    { id: 'pl-38x6', kind: 'rect', label: 'Planchuela 1 1/2" × 1/4"', aMm: 38.1, bMm: 6.35, thicknessMm: 6.35, solid: true },
    { id: 'pl-50x6', kind: 'rect', label: 'Planchuela 2" × 1/4"', aMm: 50.8, bMm: 6.35, thicknessMm: 6.35, solid: true },
  ],
};

export const DEFAULT_CONFIG: ProjectConfig = {
  style: 'moderna',
  productKind: 'ventana',
  window: { widthMm: 1500, heightMm: 600 },
  barProfileId: DEFAULT_MODERN_BAR_ID,
  frame: { profileId: DEFAULT_MODERN_FRAME_ID, orientation: 'minor', assembly: 'horizontal-full', horizontalProfile: 'same-as-sides' },
  reinforcement: { enabled: true, sameAsFrame: true, profileId: DEFAULT_MODERN_FRAME_ID, orientation: 'minor' },
  bars: { desiredGapMm: 100, minGapMm: 60, mode: 'auto', manualCount: 5, crossing: 'split', ends: 'butt' },
  fabrication: {
    jointGapMm: 0,
    kerfMm: 3,
    stockLengthMm: 6000,
    endTrimMm: 0,
    throughHoleClearanceMm: 1,
    socketSetbackMm: 1,
    horizontalEdgeMm: 5,
  },
  stock: { reuseOffcuts: false, minReusableMm: 300 },
  costs: {
    enabled: false,
    pricePerBar: {},
    discsCost: 0,
    paintCost: 0,
    otherConsumablesCost: 0,
  },
};

export function findRound(catalog: Catalog, id: string): RoundProfile | undefined {
  return catalog.round.find((p) => p.id === id);
}

export function findRect(catalog: Catalog, id: string): RectProfile | undefined {
  return catalog.rect.find((p) => p.id === id);
}

const fmt = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

/** Forma de la sección de un barrote (redonda o cuadrada). */
export function barShape(p: RoundProfile): BarShape {
  return p.square ? 'square' : 'round';
}

/** true si el perfil es un caño redondo hueco (barrote de la reja moderna). */
export function isHollowRound(p: RoundProfile | undefined): p is RoundProfile {
  return !!p && !p.solid && !p.square;
}

/** true si el perfil es una barra maciza cuadrada (barrote de la reja clásica). */
export function isSolidSquare(p: RoundProfile | undefined): p is RoundProfile {
  return !!p && p.solid === true && p.square === true;
}

/** true si el perfil rectangular es macizo (planchuela). */
export function isSolidRect(p: RectProfile | undefined): p is RectProfile {
  return !!p && p.solid === true;
}

/** Perfiles de barrote válidos para un estilo. */
export function barProfilesForStyle(catalog: Catalog, style: RejaStyle): RoundProfile[] {
  return catalog.round.filter((p) => isValidRound(p) && (style === 'clasica' ? isSolidSquare(p) : isHollowRound(p)));
}

/** Perfiles de marco/refuerzo válidos para un estilo. */
export function frameProfilesForStyle(catalog: Catalog, style: RejaStyle): RectProfile[] {
  return catalog.rect.filter((p) => isValidRect(p) && (style === 'clasica' ? isSolidRect(p) : !p.solid));
}

/** Perfil de barrote recomendado para el estilo, si el catálogo tiene alguno. */
export function defaultBarForStyle(catalog: Catalog, style: RejaStyle): RoundProfile | undefined {
  const valid = barProfilesForStyle(catalog, style);
  const wanted = style === 'clasica' ? DEFAULT_CLASSIC_BAR_ID : DEFAULT_MODERN_BAR_ID;
  return valid.find((p) => p.id === wanted) ?? valid[0];
}

/** Perfil de marco recomendado para el estilo, si el catálogo tiene alguno. */
export function defaultFrameForStyle(catalog: Catalog, style: RejaStyle): RectProfile | undefined {
  const valid = frameProfilesForStyle(catalog, style);
  const wanted = style === 'clasica' ? DEFAULT_CLASSIC_FRAME_ID : DEFAULT_MODERN_FRAME_ID;
  return valid.find((p) => p.id === wanted) ?? valid[0];
}

/**
 * Ajusta una configuración para que sea coherente con su estilo y el catálogo.
 * - `resetProfiles`: al cambiar de estilo, elige los perfiles por defecto del estilo.
 * - Siempre reemplaza perfiles incompatibles o inexistentes por uno válido.
 * - La reja clásica usa barras macizas cuadradas, planchuelas y barrotes insertados.
 * - La reja moderna usa caños y, con MS/MI redondos, laterales completos.
 */
export function applyStylePreset(config: ProjectConfig, catalog: Catalog, resetProfiles = false): void {
  const style = config.style;
  const bars = barProfilesForStyle(catalog, style);
  const frames = frameProfilesForStyle(catalog, style);

  if (resetProfiles || !bars.some((p) => p.id === config.barProfileId)) {
    const def = defaultBarForStyle(catalog, style);
    if (def) config.barProfileId = def.id;
  }

  if (resetProfiles || !frames.some((p) => p.id === config.frame.profileId)) {
    const def = defaultFrameForStyle(catalog, style);
    if (def) config.frame.profileId = def.id;
  }

  if (config.reinforcement.sameAsFrame) {
    config.reinforcement.profileId = config.frame.profileId;
  } else if (config.reinforcement.enabled && (resetProfiles || !frames.some((p) => p.id === config.reinforcement.profileId))) {
    config.reinforcement.profileId = config.frame.profileId;
  }

  if (style === 'clasica') {
    config.bars.ends = 'inserted';
    config.frame.horizontalProfile = 'same-as-sides';
    if (resetProfiles) {
      // Planchuela plana: el lado ancho va hacia afuera para que entre el agujero.
      config.frame.orientation = 'minor';
      config.reinforcement.orientation = 'minor';
    }
  } else {
    if (config.frame.horizontalProfile === 'round') config.frame.assembly = 'vertical-full';
    if (resetProfiles) config.frame.orientation = 'minor';
  }
}

/** Copia de la configuración ya resuelta contra el catálogo. */
export function resolveStyleConfig(config: ProjectConfig, catalog: Catalog): ProjectConfig {
  const resolved = structuredClone(config);
  applyStylePreset(resolved, catalog, false);
  return resolved;
}

/** Agrega al catálogo los perfiles por defecto que falten para no dejar un estilo sin opciones. */
export function ensureCatalogDefaults(saved: Catalog): Catalog {
  const catalog: Catalog = {
    round: saved.round.map((p) => ({ ...p })),
    rect: saved.rect.map((p) => ({ ...p })),
  };
  const addRound = (style: RejaStyle) => {
    if (barProfilesForStyle(catalog, style).length > 0) return;
    for (const p of DEFAULT_CATALOG.round) {
      if (style === 'clasica' ? isSolidSquare(p) : isHollowRound(p)) {
        if (!catalog.round.some((x) => x.id === p.id)) catalog.round.push({ ...p });
      }
    }
  };
  const addRect = (style: RejaStyle) => {
    if (frameProfilesForStyle(catalog, style).length > 0) return;
    for (const p of DEFAULT_CATALOG.rect) {
      if (style === 'clasica' ? isSolidRect(p) : !p.solid) {
        if (!catalog.rect.some((x) => x.id === p.id)) catalog.rect.push({ ...p });
      }
    }
  };
  addRound('moderna');
  addRound('clasica');
  addRect('moderna');
  addRect('clasica');
  return catalog;
}

/** Clave de sección: dos perfiles con la misma clave son intercambiables. */
export function sectionKey(p: Profile): string {
  if (p.kind === 'round') {
    if (p.solid && p.square) return `solid-square:${p.odMm}`;
    if (p.solid) return `solid-round:${p.odMm}`;
    return p.square ? `square-tube:${p.odMm}x${p.thicknessMm}` : `round:${p.odMm}x${p.thicknessMm}`;
  }
  const lo = Math.min(p.aMm, p.bMm);
  const hi = Math.max(p.aMm, p.bMm);
  return p.solid ? `flat:${hi}x${lo}` : `rect:${hi}x${lo}x${p.thicknessMm}`;
}

/** Unidad comercial de una sección: caño para perfiles huecos, barra para macizos. */
export function sectionUnit(key: string): 'caño' | 'barra' {
  return key.startsWith('solid-') || key.startsWith('flat:') ? 'barra' : 'caño';
}

export function profileLabel(p: Profile): string {
  if (p.kind === 'round') {
    if (p.solid && p.square) return `Hierro macizo cuadrado ${fmt(p.odMm)} × ${fmt(p.odMm)} mm`;
    if (p.solid) return `Hierro macizo redondo Ø${fmt(p.odMm)} mm`;
    if (p.square) return `Caño cuadrado ${fmt(p.odMm)} × ${fmt(p.odMm)} × ${fmt(p.thicknessMm)} mm`;
    return `Caño redondo Ø${fmt(p.odMm)} × ${fmt(p.thicknessMm)} mm`;
  }
  const hi = Math.max(p.aMm, p.bMm);
  const lo = Math.min(p.aMm, p.bMm);
  if (p.solid) return `Planchuela ${fmt(hi)} × ${fmt(lo)} mm`;
  return `Caño rectangular ${fmt(hi)} × ${fmt(lo)} × ${fmt(p.thicknessMm)} mm`;
}

/** Texto de una opción de barrote, sin mostrar un "espesor" que no existe en barras macizas. */
export function barOptionLabel(p: RoundProfile): string {
  if (p.solid && p.square) return `${p.label} (${fmt(p.odMm)} × ${fmt(p.odMm)} mm)`;
  if (p.solid) return `${p.label} (Ø${fmt(p.odMm)} mm)`;
  return `${p.label} (Ø${fmt(p.odMm)} × ${fmt(p.thicknessMm)} mm)`;
}

export function rectMinor(p: RectProfile): number {
  return Math.min(p.aMm, p.bMm);
}
export function rectMajor(p: RectProfile): number {
  return Math.max(p.aMm, p.bMm);
}

/** Dimensión que queda a la vista (en el plano de la reja). */
export function inPlaneDim(p: RectProfile, o: Orientation): number {
  return o === 'minor' ? rectMinor(p) : rectMajor(p);
}
/** Dimensión que queda hacia afuera (profundidad). */
export function depthDim(p: RectProfile, o: Orientation): number {
  return o === 'minor' ? rectMajor(p) : rectMinor(p);
}

export function isValidRound(p: RoundProfile | undefined): p is RoundProfile {
  if (!p || !Number.isFinite(p.odMm) || p.odMm <= 0) return false;
  if (p.solid) {
    // En una barra maciza el "espesor" no define la sección: solo importa el lado/diámetro.
    if (p.square) return true;
    return Number.isFinite(p.thicknessMm) && p.thicknessMm > 0 && p.thicknessMm <= p.odMm / 2;
  }
  return Number.isFinite(p.thicknessMm) && p.thicknessMm > 0 && p.thicknessMm * 2 < p.odMm;
}

export function isValidRect(p: RectProfile | undefined): p is RectProfile {
  if (!p || !Number.isFinite(p.aMm) || !Number.isFinite(p.bMm) || p.aMm <= 0 || p.bMm <= 0) return false;
  if (p.solid) return Number.isFinite(p.thicknessMm) && p.thicknessMm > 0 && p.thicknessMm <= Math.min(p.aMm, p.bMm);
  return Number.isFinite(p.thicknessMm) && p.thicknessMm > 0 && p.thicknessMm * 2 < Math.min(p.aMm, p.bMm);
}

/**
 * Recomienda un perfil de marco según el barrote y el estilo.
 *
 * Moderna: el barrote se suelda a tope contra la cara interior del lateral; la
 * profundidad del perfil debe ser ≥ el diámetro del caño. Clásica: la planchuela
 * se usa plana, con el lado ancho hacia afuera, y debe tener ancho suficiente
 * para alojar el agujero cuadrado del barrote con margen.
 */
export function recommendFrameProfile(
  catalog: Catalog,
  bar: RoundProfile,
  style: RejaStyle = 'moderna',
): { profile: RectProfile; orientation: Orientation } | undefined {
  const valid = frameProfilesForStyle(catalog, style);
  if (valid.length === 0) return undefined;

  if (style === 'clasica') {
    const neededDepth = bar.odMm + Math.max(12.7, bar.odMm / 2);
    const fits = valid
      .filter((p) => rectMajor(p) >= neededDepth)
      .sort(
        (a, b) =>
          rectMajor(a) * rectMinor(a) - rectMajor(b) * rectMinor(b) ||
          rectMajor(a) - rectMajor(b),
      );
    const profile = fits[0] ?? [...valid].sort((a, b) => rectMajor(b) - rectMajor(a))[0];
    return { profile, orientation: 'minor' };
  }

  const fits = valid
    .filter((p) => rectMajor(p) >= bar.odMm)
    .sort(
      (a, b) =>
        rectMajor(a) * rectMinor(a) - rectMajor(b) * rectMinor(b) ||
        rectMajor(a) - rectMajor(b),
    );
  const profile = fits[0] ?? [...valid].sort((a, b) => rectMajor(b) - rectMajor(a))[0];
  return { profile, orientation: 'minor' };
}
