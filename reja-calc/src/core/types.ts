/**
 * Tipos del dominio. Todas las longitudes están en milímetros, salvo que
 * el nombre indique otra cosa.
 */

// ───────────────────────── Perfiles ─────────────────────────

export interface RoundProfile {
  id: string;
  kind: 'round';
  label: string;
  /** Diámetro exterior (mm) o lado (mm) si es cuadrado. Configurable: el real comercial puede variar. */
  odMm: number;
  thicknessMm: number;
  /** true si el perfil es macizo (hierro macizo): no es un caño hueco. */
  solid?: boolean;
  /** true si el perfil macizo es cuadrado (lado = odMm). */
  square?: boolean;
}

export interface RectProfile {
  id: string;
  kind: 'rect';
  label: string;
  /** Lados exteriores (mm). El orden no importa: se normaliza internamente. */
  aMm: number;
  bMm: number;
  thicknessMm: number;
  /** true si el perfil es macizo (planchuela): no es un caño hueco. */
  solid?: boolean;
}

export type Profile = RoundProfile | RectProfile;

export interface Catalog {
  round: RoundProfile[];
  rect: RectProfile[];
}

/**
 * Qué lado del perfil rectangular se ve de frente (queda en el plano de la reja).
 * - 'minor': el lado menor queda en el plano; el lado mayor sale hacia afuera (profundidad).
 * - 'major': el lado mayor queda en el plano; el lado menor es la profundidad.
 */
export type Orientation = 'minor' | 'major';

// ───────────────────────── Estilo y producto ─────────────────────────

/** Estilo constructivo de la reja. */
export type RejaStyle = 'moderna' | 'clasica';

/** Tipo de producto al que se aplica la reja. Solo `ventana` está implementado por ahora. */
export type ProductKind =
  | 'ventana'
  | 'puerta-abrir'
  | 'puerta-corrediza'
  | 'porton-dos-hojas'
  | 'porton-corredizo'
  | 'frente';

// ───────────────────────── Configuración ─────────────────────────

/**
 * Perfil de los tramos superior e inferior del marco (MS y MI).
 * - 'same-as-sides': el mismo perfil rectangular y la misma orientación que los laterales.
 * - 'round': caño redondo, el mismo de los barrotes (el vano interior lo mide su diámetro).
 */
export type FrameHorizontals = 'same-as-sides' | 'round';

/** Cómo se construye el marco. */
export type FrameAssembly =
  /** Tramos superior e inferior completos (largo = ancho exterior); los laterales van entre ellos. */
  | 'horizontal-full'
  /** Laterales completos (largo = alto exterior); los tramos superior e inferior van entre ellos. */
  | 'vertical-full';

/** Cómo se resuelve el cruce de los barrotes con el refuerzo central. */
export type BarCrossing =
  /** Dos tramos independientes por barrote, que terminan contra el refuerzo central. */
  | 'split'
  /** Un barrote continuo que pasa por agujeros practicados en el refuerzo central. */
  | 'through';

/** Cómo terminan los barrotes en los laterales del marco. */
export type BarEnds =
  /** A tope contra la cara interior del lateral. */
  | 'butt'
  /**
   * Entran en un agujero practicado en la cara interior del lateral: lo atraviesan,
   * quedan alojados y centrados por el agujero y se sueldan. La punta se frena a
   * `socketSetbackMm` de la cara opuesta del caño, así que el lateral queda liso por fuera.
   */
  | 'inserted';

export interface ProjectConfig {
  style: RejaStyle;
  productKind: ProductKind;
  window: { widthMm: number; heightMm: number };
  roundProfileId: string;
  frame: {
    profileId: string;
    orientation: Orientation;
    assembly: FrameAssembly;
    /** Perfil de los tramos superior e inferior (MS/MI). */
    horizontalProfile: FrameHorizontals;
  };
  reinforcement: {
    /** Si la reja lleva el parante vertical al medio. Si es false, los barrotes van continuos. */
    enabled: boolean;
    sameAsFrame: boolean;
    profileId: string;
    orientation: Orientation;
  };
  bars: {
    /** Separación libre máxima deseada entre superficies de caños consecutivos. */
    desiredGapMm: number;
    /** Separación libre mínima admitida. */
    minGapMm: number;
    mode: 'auto' | 'manual';
    manualCount: number;
    crossing: BarCrossing;
    ends: BarEnds;
  };
  fabrication: {
    /** Descuento por extremo en cada unión a tope (holgura de armado). */
    jointGapMm: number;
    /** Espesor del disco de corte. */
    kerfMm: number;
    /** Largo comercial de los caños. */
    stockLengthMm: number;
    /** Largo que se refila (se pierde) en la punta de cada caño comercial nuevo. */
    endTrimMm: number;
    /** Holgura diametral de los agujeros pasantes (refuerzo central y laterales). */
    throughHoleClearanceMm: number;
    /** Distancia a la que se frena la punta del barrote antes de la pared opuesta del lateral. */
    socketSetbackMm: number;
    /**
     * Margen desde el extremo superior/inferior del lateral hasta el borde del agujero
     * de los tramos MS/MI cuando son de caño redondo (0,5 cm por defecto).
     */
    horizontalEdgeMm: number;
  };
  stock: {
    /** Usar sobrantes guardados del inventario. */
    reuseOffcuts: boolean;
    /** Largo mínimo para considerar un sobrante "reutilizable". */
    minReusableMm: number;
  };
  costs: CostsConfig;
}

export interface CostsConfig {
  enabled: boolean;
  /** Precio por caño comercial, por sección (clave de sección → precio). */
  pricePerBar: Record<string, number | undefined>;
  discsCost: number;
  paintCost: number;
  otherConsumablesCost: number;
}

// ───────────────────────── Avisos ─────────────────────────

export type IssueLevel = 'error' | 'warning' | 'info';

export interface Issue {
  level: IssueLevel;
  code: string;
  message: string;
}

// ───────────────────────── Piezas ─────────────────────────

export type PieceType =
  | 'frame-top'
  | 'frame-bottom'
  | 'frame-left'
  | 'frame-right'
  | 'reinforcement'
  | 'bar';

export interface Piece {
  id: string;
  type: PieceType;
  profileId: string;
  profileLabel: string;
  /** Clave de sección: piezas con la misma clave pueden salir del mismo caño. */
  sectionKey: string;
  /** Cada pieza física es una línea; la cantidad es 1. `groupPieces` agrupa iguales. */
  quantity: 1;
  lengthMm: number;
  location: string;
  notes: string;
  /** Id dentro de su reja (para mostrar). En el plan de obra `id` va prefijado y esto guarda el original. */
  localId?: string;
  /** Reja de origen dentro de la obra (solo en el plan unificado). */
  rejaId?: string;
}

export interface LayoutRect {
  pieceId: string;
  type: PieceType;
  /** Origen en la esquina superior izquierda exterior de la reja; eje Y hacia abajo. */
  x: number;
  y: number;
  w: number;
  h: number;
}

// ───────────────────────── Barrotes ─────────────────────────

export interface BarDistribution {
  count: number;
  /** Separación libre resultante (entre superficies). Es uniforme, incluidos los bordes con el marco. */
  gapMm: number;
  /** Alto interior disponible. */
  innerHeightMm: number;
  /** Y (desde el borde superior exterior de la reja) del borde superior de cada barrote. */
  topsMm: number[];
  /** Alternativas sugeridas si no se pudo cumplir lo pedido. */
  alternatives: { count: number; gapMm: number }[];
  /** true si se cumplen ambas condiciones: gap ≤ máximo deseado y gap ≥ mínimo. */
  respectsLimits: boolean;
}

// ───────────────────────── Diseño completo ─────────────────────────

export interface DesignDerived {
  innerWidthMm: number;
  innerHeightMm: number;
  frameInPlaneMm: number;
  frameDepthMm: number;
  /** Dimensión a la vista de los tramos superior e inferior (MS/MI): pf o el Ø del caño redondo. */
  frameHorizontalMm: number;
  /** true si los tramos superior e inferior (MS/MI) son de caño redondo. */
  horizontalRound: boolean;
  /** Margen del borde del agujero de MS/MI al extremo del lateral (0 si no son redondos). */
  horizontalEdgeMm: number;
  /** Si la reja lleva refuerzo central. */
  withReinforcement: boolean;
  reinfInPlaneMm: number;
  reinfDepthMm: number;
  sectorWidthMm: number;
  /** Si los barrotes entran en un agujero del lateral (false = a tope contra la cara interior). */
  barsInLateral: boolean;
  /** Cuánto entran en cada lateral los barrotes alojados o los MS/MI redondos, desde su cara interior (0 si nada entra). */
  lateralPenetrationMm: number;
  /** Diámetro de los agujeros de los laterales (barrotes alojados y/o MS/MI redondos); 0 si no hay agujeros. */
  lateralHoleMm: number;
  barOdMm: number;
  barSectionKey: string;
  frameSectionKey: string;
  reinfSectionKey: string;
}

export interface Design {
  issues: Issue[];
  derived: DesignDerived | null;
  distribution: BarDistribution | null;
  pieces: Piece[];
  layout: LayoutRect[];
}

// ───────────────────────── Plan de corte ─────────────────────────

export interface CutItem {
  pieceId: string;
  lengthMm: number;
  /** Id local de la pieza dentro de su reja (para mostrar). */
  localId?: string;
  /** Reja de origen dentro de la obra (solo en el plan unificado). */
  rejaId?: string;
}

export interface StockSource {
  kind: 'new' | 'offcut';
  /** Id del sobrante del inventario (solo si kind === 'offcut'). */
  offcutId?: string;
  /** Largo del tramo disponible antes de cortar (mm). */
  lengthMm: number;
  /** Procedencia (solo sobrantes). */
  origin?: string;
}

export interface BinPlan {
  /** Numeración visible: "Caño 1", "Sobrante 1"… la arma la UI con `index`. */
  index: number;
  source: StockSource;
  items: CutItem[];
  /** Largo refilado en la punta (solo caños nuevos). */
  trimLossMm: number;
  piecesLengthMm: number;
  kerfLossMm: number;
  /** Tramo restante utilizable (≥ 0). */
  leftoverMm: number;
  /** leftover ≥ minReusableMm */
  leftoverReusable: boolean;
}

export interface SectionPlan {
  sectionKey: string;
  profileLabel: string;
  stockLengthMm: number;
  bins: BinPlan[];
  /** Cantidad de caños comerciales nuevos a comprar. */
  newBarsCount: number;
  /** Cota inferior teórica de caños nuevos (informativa). */
  lowerBoundBars: number;
  /** true si se demostró que no existe una solución con menos caños. */
  provenOptimal: boolean;
  /** Mensaje corto del método usado. */
  method: string;
  pieces: Piece[];
}

export interface CuttingPlan {
  sections: SectionPlan[];
  issues: Issue[];
}

// ───────────────────────── Inventario ─────────────────────────

export interface Offcut {
  id: string;
  sectionKey: string;
  profileLabel: string;
  lengthMm: number;
  origin: string;
  createdAt: string;
}

// ───────────────────────── Materiales / costos ─────────────────────────

export interface MaterialLine {
  sectionKey: string;
  profileLabel: string;
  stockLengthMm: number;
  piecesCount: number;
  piecesLengthMm: number;
  newBarsCount: number;
  /** newBarsCount × largo comercial. */
  purchasedMm: number;
  offcutsUsedCount: number;
  offcutsUsedMm: number;
  /** purchasedMm + offcutsUsedMm. */
  inputMm: number;
  kerfLossMm: number;
  trimLossMm: number;
  leftoverMm: number;
  leftoverReusableMm: number;
  leftoverScrapMm: number;
  /** piezas / inputMm (0–1). */
  utilization: number;
}

export interface CostLine {
  sectionKey: string;
  profileLabel: string;
  bars: number;
  unitPrice: number | undefined;
  subtotal: number | undefined;
}

export interface CostResult {
  hasAnyPrice: boolean;
  lines: CostLine[];
  materialsSubtotal: number;
  consumables: number;
  total: number;
  missingPrices: string[];
}

// ───────────────────────── Obra multi-reja ─────────────────────────

/** Cómo se presupuesta la mano de obra de una reja. */
export type LaborMode = 'hours' | 'fixed';

export interface RejaLabor {
  mode: LaborMode;
  /** Horas estimadas (modo 'hours'). */
  hours: number;
  /** Monto fijo de mano de obra (modo 'fixed'). */
  fixedAmount: number;
}

/** Una reja dentro de una obra: su configuración y su mano de obra. */
export interface Reja {
  id: string;
  name: string;
  config: ProjectConfig;
  labor: RejaLabor;
}

/** Parámetros de corte/empaquetado que son comunes a toda la obra. */
export interface ObraCuttingConfig {
  stockLengthMm: number;
  kerfMm: number;
  endTrimMm: number;
  minReusableMm: number;
  reuseOffcuts: boolean;
}

export interface BudgetConsumables {
  discsCost: number;
  paintCost: number;
  otherConsumablesCost: number;
}

/** Presupuesto de la obra: precios por sección, consumibles y valor hora. */
export interface BudgetConfig {
  enabled: boolean;
  pricePerBar: Record<string, number | undefined>;
  consumables: BudgetConsumables;
  laborRatePerHour: number;
}

/** Obra: un conjunto de rejas que se calculan y presupuestan juntas. */
export interface Obra {
  id: string;
  name: string;
  rejas: Reja[];
  activeRejaId: string;
  cutting: ObraCuttingConfig;
  budget: BudgetConfig;
}
