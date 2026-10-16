/**
 * Optimización de corte unidimensional (Cutting Stock / Bin Packing con disco de corte).
 *
 * Modelo (detalle en docs/FORMULAS.md y docs/ALGORITMO.md):
 *
 *  - Cada pieza sale de UN tramo continuo. No se suman recortes.
 *  - Aritmética en décimas de milímetro (enteros) para evitar errores de coma flotante.
 *  - Secuencia de corte sobre un tramo de largo utilizable T con piezas p1..pn:
 *      se corta p1, se corta p2, ... Entre piezas hay n−1 cortes; además hay un corte final
 *      que separa la última pieza del resto, salvo que la pieza termine justo al final del tramo.
 *      Cada corte consume `k` (ancho del disco). El corte final consume min(k, resto).
 *
 *        necesario = Σp + (n−1)·k            (debe ser ≤ T)
 *        resto     = T − necesario
 *        corteFin  = min(k, resto)
 *        pérdida   = (n−1)·k + corteFin
 *        sobrante  = resto − corteFin        (≥ 0)
 *
 *    Así, Σp + pérdida + sobrante = T exactamente y ningún corte se cuenta dos veces.
 *
 *  - Equivalencia usada para empaquetar: tamaño de ítem = p + k y capacidad = T + k.
 *    (Σ(p+k) ≤ T+k  ⇔  Σp + (n−1)·k ≤ T.)
 *
 * Objetivos, en orden: (1) menos caños nuevos, (2) menos desperdicio, (3) menos sobrantes
 * chicos inutilizables (se concentran los sobrantes en pocos tramos largos).
 */

import { fmtMm } from './format';
import type {
  BinPlan,
  CutItem,
  CuttingPlan,
  Issue,
  Offcut,
  Piece,
  ProjectConfig,
  SectionPlan,
  StockSource,
} from './types';

const U = 10; // décimas de mm
const toU = (mm: number) => Math.round(mm * U);
const fromU = (u: number) => u / U;

export interface PackOptions {
  stockLengthMm: number;
  kerfMm: number;
  endTrimMm: number;
  minReusableMm: number;
  /** Sobrantes disponibles de la MISMA sección (el filtrado por sección lo hace el llamador). */
  offcuts: { id: string; lengthMm: number; origin: string }[];
  /** Tope de nodos de la búsqueda exacta (determinista, no depende del reloj). */
  nodeLimit?: number;
}

export interface PackResult {
  bins: BinPlan[];
  newBarsCount: number;
  lowerBoundBars: number;
  provenOptimal: boolean;
  method: string;
}

interface LayoutResult {
  feasible: boolean;
  kerf: number;
  leftover: number;
}

/** Reparto de un tramo de largo `cap` con piezas `lengths` (todo en décimas de mm). */
function layoutBin(cap: number, lengths: number[], k: number): LayoutResult {
  const n = lengths.length;
  if (n === 0) return { feasible: true, kerf: 0, leftover: cap };
  let sum = 0;
  for (const l of lengths) sum += l;
  const needed = sum + (n - 1) * k;
  if (needed > cap) return { feasible: false, kerf: 0, leftover: 0 };
  const rest = cap - needed;
  const lastCut = Math.min(k, rest);
  return { feasible: true, kerf: (n - 1) * k + lastCut, leftover: rest - lastCut };
}

// ───────────────────────── Empaquetado ─────────────────────────

interface Item {
  item: CutItem;
  lenU: number;
}

/** Heurística First/Best Fit Decreasing sobre tamaños (largo + k) y capacidad C. */
function heuristic(sizes: number[], C: number, best: boolean): number[][] {
  const bins: number[][] = [];
  const rem: number[] = [];
  sizes.forEach((s, idx) => {
    let target = -1;
    for (let b = 0; b < bins.length; b++) {
      if (rem[b] >= s) {
        if (!best) { target = b; break; }
        if (target === -1 || rem[b] < rem[target]) target = b;
      }
    }
    if (target === -1) {
      bins.push([idx]);
      rem.push(C - s);
    } else {
      bins[target].push(idx);
      rem[target] -= s;
    }
  });
  return bins;
}

/**
 * Búsqueda exacta por ramificación y poda. Intenta encontrar una solución con MENOS de
 * `upper` tramos. Devuelve la mejor hallada y si la búsqueda se completó (sin cortar por límite).
 */
function exactSearch(
  sizes: number[],
  C: number,
  upper: number,
  lowerBound: number,
  nodeLimit: number,
): { solution: number[][] | null; complete: boolean } {
  const n = sizes.length;
  const suffix = new Array<number>(n + 1).fill(0);
  for (let i = n - 1; i >= 0; i--) suffix[i] = suffix[i + 1] + sizes[i];

  let best = upper;
  let bestSol: number[][] | null = null;
  let nodes = 0;
  let aborted = false;

  const rem: number[] = [];
  const contents: number[][] = [];
  let totalRem = 0;

  const rec = (i: number) => {
    if (aborted || best <= lowerBound) return;
    if (++nodes > nodeLimit) { aborted = true; return; }
    const open = rem.length;
    if (i === n) {
      if (open < best) {
        best = open;
        bestSol = contents.map((c) => [...c]);
      }
      return;
    }
    const need = Math.max(0, suffix[i] - totalRem);
    if (open + Math.ceil(need / C) >= best) return;

    const s = sizes[i];
    const tried = new Set<number>();
    for (let b = 0; b < open; b++) {
      if (rem[b] < s || tried.has(rem[b])) continue;
      tried.add(rem[b]);
      rem[b] -= s; totalRem -= s; contents[b].push(i);
      rec(i + 1);
      contents[b].pop(); totalRem += s; rem[b] += s;
      if (aborted || best <= lowerBound) return;
    }
    if (open + 1 < best) {
      rem.push(C - s); totalRem += C - s; contents.push([i]);
      rec(i + 1);
      contents.pop(); totalRem -= C - s; rem.pop();
    }
  };

  rec(0);
  return { solution: bestSol, complete: !aborted };
}

/** Subconjunto de ítems que mejor llena un sobrante (suma máxima de tamaños ≤ capacidad). */
function bestSubsetForOffcut(sizes: number[], capacity: number): number[] {
  const reach = new Int32Array(capacity + 1).fill(-1);
  reach[0] = -2;
  for (let i = 0; i < sizes.length; i++) {
    const s = sizes[i];
    if (s > capacity) continue;
    for (let t = capacity; t >= s; t--) {
      if (reach[t] === -1 && reach[t - s] !== -1) reach[t] = i;
    }
  }
  let bestSum = 0;
  for (let t = capacity; t > 0; t--) {
    if (reach[t] !== -1) { bestSum = t; break; }
  }
  const chosen: number[] = [];
  let t = bestSum;
  while (t > 0) {
    const i = reach[t];
    chosen.push(i);
    t -= sizes[i];
  }
  return chosen;
}

/**
 * Mejora el tercer objetivo (sobrantes chicos) sin aumentar la cantidad de tramos:
 * mueve/intercambia piezas entre tramos mientras mejore (tramos, sobrantes chicos, concentración).
 */
function improveLeftovers(
  bins: number[][],
  lens: number[],
  cap: number,
  k: number,
  minReusableU: number,
): number[][] {
  const cur = bins.map((b) => [...b]);
  const lay = (b: number[]) => layoutBin(cap, b.map((i) => lens[i]), k);

  const score = (arr: number[][]): [number, number, number] => {
    let small = 0;
    let sq = 0;
    for (const b of arr) {
      const l = lay(b).leftover;
      if (l > 0 && l < minReusableU) small++;
      sq += l * l;
    }
    return [arr.length, small, -sq];
  };
  const better = (a: [number, number, number], b: [number, number, number]) => {
    for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i];
    return false;
  };

  let current = score(cur);
  for (let pass = 0; pass < 200; pass++) {
    let improved = false;
    outer: for (let a = 0; a < cur.length; a++) {
      for (let xi = 0; xi < cur[a].length; xi++) {
        const x = cur[a][xi];
        for (let b = 0; b < cur.length; b++) {
          if (a === b) continue;
          // mover x de a a b
          const newB = [...cur[b], x];
          if (lay(newB).feasible) {
            const newA = cur[a].filter((_, j) => j !== xi);
            const trial = cur.map((c, idx) => (idx === a ? newA : idx === b ? newB : c)).filter((c) => c.length > 0);
            const s = score(trial);
            if (better(s, current)) {
              cur.splice(0, cur.length, ...trial);
              current = s;
              improved = true;
              break outer;
            }
          }
          // intercambiar x con y
          for (let yi = 0; yi < cur[b].length; yi++) {
            const y = cur[b][yi];
            if (lens[y] === lens[x]) continue;
            const newA = cur[a].map((v, j) => (j === xi ? y : v));
            const newB2 = cur[b].map((v, j) => (j === yi ? x : v));
            if (!lay(newA).feasible || !lay(newB2).feasible) continue;
            const trial = cur.map((c, idx) => (idx === a ? newA : idx === b ? newB2 : c));
            const s = score(trial);
            if (better(s, current)) {
              cur.splice(0, cur.length, ...trial);
              current = s;
              improved = true;
              break outer;
            }
          }
        }
      }
    }
    if (!improved) break;
  }
  return cur;
}

const byLengthDescThenId = (a: Item, b: Item) =>
  b.lenU - a.lenU || a.item.pieceId.localeCompare(b.item.pieceId, 'es', { numeric: true });

/**
 * Empaqueta las piezas de UNA sección. Lanza Error si alguna pieza no cabe en un caño nuevo.
 */
export function packSection(cutItems: CutItem[], opts: PackOptions): PackResult {
  const k = toU(opts.kerfMm);
  const usableNew = toU(opts.stockLengthMm - opts.endTrimMm);
  const trimMm = opts.endTrimMm;
  const minReusableU = toU(opts.minReusableMm);
  const nodeLimit = opts.nodeLimit ?? 400_000;

  const items: Item[] = cutItems
    .map((item) => ({ item, lenU: toU(item.lengthMm) }))
    .sort(byLengthDescThenId);

  for (const it of items) {
    if (it.lenU <= 0) throw new Error(`La pieza ${it.item.pieceId} tiene largo cero o negativo.`);
    if (it.lenU > usableNew) {
      throw new Error(
        `La pieza ${it.item.pieceId} (${fmtMm(it.item.lengthMm)}) supera el largo utilizable del caño comercial (${fmtMm(fromU(usableNew))}).`,
      );
    }
  }

  const bins: BinPlan[] = [];
  let remaining = items.slice();

  // 1) Sobrantes del inventario (sin costo): se llena cada uno con el mejor subconjunto.
  const offcuts = [...opts.offcuts].sort((a, b) => b.lengthMm - a.lengthMm || a.id.localeCompare(b.id));
  for (const oc of offcuts) {
    if (remaining.length === 0) break;
    const capU = toU(oc.lengthMm);
    const chosen = bestSubsetForOffcut(remaining.map((r) => r.lenU + k), capU + k);
    if (chosen.length === 0) continue;
    const chosenSet = new Set(chosen);
    const picked = remaining.filter((_, i) => chosenSet.has(i)).sort(byLengthDescThenId);
    remaining = remaining.filter((_, i) => !chosenSet.has(i));
    const lay = layoutBin(capU, picked.map((p) => p.lenU), k);
    bins.push({
      index: 0,
      source: { kind: 'offcut', offcutId: oc.id, lengthMm: oc.lengthMm, origin: oc.origin } as StockSource,
      items: picked.map((p) => p.item),
      trimLossMm: 0,
      piecesLengthMm: fromU(picked.reduce((s, p) => s + p.lenU, 0)),
      kerfLossMm: fromU(lay.kerf),
      leftoverMm: fromU(lay.leftover),
      leftoverReusable: lay.leftover >= minReusableU && lay.leftover > 0,
    });
  }

  // 2) Caños comerciales nuevos
  let lowerBound = 0;
  let proven = true;
  let method = 'Sin piezas para cortar de caños nuevos';

  if (remaining.length > 0) {
    const lens = remaining.map((r) => r.lenU);
    const sizes = lens.map((l) => l + k);
    const C = usableNew + k;
    const total = sizes.reduce((a, b) => a + b, 0);
    lowerBound = Math.ceil(total / C);

    const ffd = heuristic(sizes, C, false);
    const bfd = heuristic(sizes, C, true);
    let best = bfd.length <= ffd.length ? bfd : ffd;
    method = 'Heurística FFD/BFD';

    if (best.length > lowerBound) {
      const res = exactSearch(sizes, C, best.length, lowerBound, nodeLimit);
      if (res.solution) {
        best = res.solution;
        method = 'Ramificación y poda (exacta)';
      }
      proven = res.complete || best.length === lowerBound;
      if (!res.complete && best.length > lowerBound) {
        method = 'Heurística + búsqueda acotada (óptimo no demostrado)';
      } else if (res.complete && !res.solution) {
        method = 'Heurística FFD/BFD (óptimo demostrado por búsqueda exhaustiva)';
      }
    } else {
      method = 'Cota inferior alcanzada (óptimo)';
    }

    best = improveLeftovers(best, lens, usableNew, k, minReusableU);

    for (const b of best) {
      const picked = b.map((i) => remaining[i]).sort(byLengthDescThenId);
      const lay = layoutBin(usableNew, picked.map((p) => p.lenU), k);
      bins.push({
        index: 0,
        source: { kind: 'new', lengthMm: opts.stockLengthMm },
        items: picked.map((p) => p.item),
        trimLossMm: trimMm,
        piecesLengthMm: fromU(picked.reduce((s, p) => s + p.lenU, 0)),
        kerfLossMm: fromU(lay.kerf),
        leftoverMm: fromU(lay.leftover),
        leftoverReusable: lay.leftover >= minReusableU && lay.leftover > 0,
      });
    }
  }

  // Orden de presentación: sobrantes primero, luego caños nuevos; numeración por tipo.
  const ordered = [
    ...bins.filter((b) => b.source.kind === 'offcut'),
    ...bins.filter((b) => b.source.kind === 'new').sort(
      (a, b) => b.piecesLengthMm - a.piecesLengthMm || a.items[0].pieceId.localeCompare(b.items[0].pieceId, 'es', { numeric: true }),
    ),
  ];
  let nOff = 0;
  let nNew = 0;
  for (const b of ordered) b.index = b.source.kind === 'offcut' ? ++nOff : ++nNew;

  return {
    bins: ordered,
    newBarsCount: nNew,
    lowerBoundBars: lowerBound,
    provenOptimal: proven,
    method,
  };
}

// ───────────────────────── Plan por sección ─────────────────────────

/**
 * Arma el plan de corte de todas las piezas. Las secciones nunca se mezclan: un sobrante solo
 * se ofrece a las piezas de su misma clave de sección.
 */
export function computeCuttingPlan(
  pieces: Piece[],
  config: ProjectConfig,
  inventory: Offcut[] = [],
): CuttingPlan {
  const issues: Issue[] = [];
  const order: string[] = [];
  const bySection = new Map<string, Piece[]>();
  for (const p of pieces) {
    if (!bySection.has(p.sectionKey)) { bySection.set(p.sectionKey, []); order.push(p.sectionKey); }
    bySection.get(p.sectionKey)!.push(p);
  }

  const sections: SectionPlan[] = [];
  for (const key of order) {
    const secPieces = bySection.get(key)!;
    const offcuts = config.stock.reuseOffcuts
      ? inventory.filter((o) => o.sectionKey === key && o.lengthMm > 0).map((o) => ({ id: o.id, lengthMm: o.lengthMm, origin: o.origin }))
      : [];
    try {
      const r = packSection(
        secPieces.map((p) => ({ pieceId: p.id, lengthMm: p.lengthMm, localId: p.localId, rejaId: p.rejaId })),
        {
          stockLengthMm: config.fabrication.stockLengthMm,
          kerfMm: config.fabrication.kerfMm,
          endTrimMm: config.fabrication.endTrimMm,
          minReusableMm: config.stock.minReusableMm,
          offcuts,
        },
      );
      sections.push({
        sectionKey: key,
        profileLabel: secPieces[0].profileLabel,
        stockLengthMm: config.fabrication.stockLengthMm,
        bins: r.bins,
        newBarsCount: r.newBarsCount,
        lowerBoundBars: r.lowerBoundBars,
        provenOptimal: r.provenOptimal,
        method: r.method,
        pieces: secPieces,
      });
    } catch (e) {
      issues.push({ level: 'error', code: 'pack-failed', message: (e as Error).message });
    }
  }
  return { sections, issues };
}

