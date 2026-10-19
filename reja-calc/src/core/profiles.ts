import type {
  Catalog,
  Orientation,
  Profile,
  ProjectConfig,
  RectProfile,
  RoundProfile,
} from './types';

/** Catálogo inicial. Todos los valores son editables desde la interfaz. */
export const DEFAULT_CATALOG: Catalog = {
  round: [
    { id: 'r-1', kind: 'round', label: 'Caño redondo 1"', odMm: 25.4, thicknessMm: 2 },
    { id: 'r-1q', kind: 'round', label: 'Caño redondo 1¼"', odMm: 31.75, thicknessMm: 2 },
  ],
  rect: [
    { id: 'c-30x20', kind: 'rect', label: 'Rectangular 30 × 20 × 2', aMm: 30, bMm: 20, thicknessMm: 2 },
    { id: 'c-40x20', kind: 'rect', label: 'Rectangular 40 × 20 × 2', aMm: 40, bMm: 20, thicknessMm: 2 },
    { id: 'c-40x30', kind: 'rect', label: 'Rectangular 40 × 30 × 2', aMm: 40, bMm: 30, thicknessMm: 2 },
  ],
};

export const DEFAULT_CONFIG: ProjectConfig = {
  window: { widthMm: 1500, heightMm: 600 },
  roundProfileId: 'r-1q',
  frame: { profileId: 'c-40x20', orientation: 'minor', assembly: 'horizontal-full', horizontalProfile: 'same-as-sides' },
  reinforcement: { enabled: true, sameAsFrame: true, profileId: 'c-40x20', orientation: 'minor' },
  bars: { desiredGapMm: 100, minGapMm: 60, mode: 'auto', manualCount: 5, crossing: 'split', ends: 'butt' },
  fabrication: {
    jointGapMm: 0,
    kerfMm: 3,
    stockLengthMm: 6000,
    endTrimMm: 0,
    throughHoleClearanceMm: 1,
    socketSetbackMm: 1,
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

/** Clave de sección: dos perfiles con la misma clave son intercambiables. */
export function sectionKey(p: Profile): string {
  if (p.kind === 'round') return `round:${p.odMm}x${p.thicknessMm}`;
  const lo = Math.min(p.aMm, p.bMm);
  const hi = Math.max(p.aMm, p.bMm);
  return `rect:${hi}x${lo}x${p.thicknessMm}`;
}

export function profileLabel(p: Profile): string {
  if (p.kind === 'round') return `Caño redondo Ø${fmt(p.odMm)} × ${fmt(p.thicknessMm)} mm`;
  const hi = Math.max(p.aMm, p.bMm);
  const lo = Math.min(p.aMm, p.bMm);
  return `Caño rectangular ${fmt(hi)} × ${fmt(lo)} × ${fmt(p.thicknessMm)} mm`;
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
  return !!p && p.odMm > 0 && p.thicknessMm > 0 && p.thicknessMm * 2 < p.odMm;
}

export function isValidRect(p: RectProfile | undefined): p is RectProfile {
  return (
    !!p &&
    p.aMm > 0 &&
    p.bMm > 0 &&
    p.thicknessMm > 0 &&
    p.thicknessMm * 2 < Math.min(p.aMm, p.bMm)
  );
}

/**
 * Recomienda un perfil rectangular para el marco según el diámetro del caño redondo.
 *
 * Criterio: el barrote se suelda a tope contra la cara interior del lateral. Esa cara
 * mide, en profundidad, la "dimensión hacia afuera". Para que el barrote apoye completo,
 * esa profundidad debe ser ≥ diámetro. Se elige el perfil de menor sección que cumpla,
 * orientado con el lado mayor hacia afuera (lado menor a la vista, 'minor').
 * Si ninguno alcanza, devuelve el de mayor lado mayor.
 */
export function recommendFrameProfile(
  catalog: Catalog,
  round: RoundProfile,
): { profile: RectProfile; orientation: Orientation } | undefined {
  const valid = catalog.rect.filter(isValidRect);
  if (valid.length === 0) return undefined;
  const fits = valid
    .filter((p) => rectMajor(p) >= round.odMm)
    .sort(
      (a, b) =>
        rectMajor(a) * rectMinor(a) - rectMajor(b) * rectMinor(b) ||
        rectMajor(a) - rectMajor(b),
    );
  const profile =
    fits[0] ?? [...valid].sort((a, b) => rectMajor(b) - rectMajor(a))[0];
  return { profile, orientation: 'minor' };
}
