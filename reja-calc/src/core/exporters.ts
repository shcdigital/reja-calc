/** Exportación CSV (separador ';', decimal ',', UTF-8 con BOM: abre bien en Excel es-AR). */
import { PIECE_TYPE_LABEL } from './geometry';
import type { CuttingPlan, MaterialLine, Piece } from './types';

const num = (n: number, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toString().replace('.', ',');
/** Neutraliza fórmulas de Excel en texto que el usuario puede escribir (CWE-1236). */
const safeText = (t: string) => (/^[=+\-@\t\r]/.test(t) ? `'${t}` : t);
const cell = (v: string | number) => {
  const s = typeof v === 'number' ? String(v) : safeText(String(v));
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows: (string | number)[][]) => '\uFEFF' + rows.map((r) => r.map(cell).join(';')).join('\r\n');

export function cutListCsv(pieces: Piece[], plan: CuttingPlan): string {
  const where = new Map<string, string>();
  for (const s of plan.sections)
    for (const b of s.bins)
      for (const it of b.items) where.set(it.pieceId, `${b.source.kind === 'new' ? 'Caño' : 'Sobrante'} ${b.index}`);
  return toCsv([
    ['Id', 'Tipo', 'Perfil', 'Cantidad', 'Largo (mm)', 'Largo (cm)', 'Sale de', 'Ubicación', 'Observaciones'],
    ...pieces.map((p) => [p.localId ?? p.id, PIECE_TYPE_LABEL[p.type], p.profileLabel, p.quantity, num(p.lengthMm), num(p.lengthMm / 10), where.get(p.id) ?? '', p.location, p.notes]),
  ]);
}

export function materialsCsv(m: MaterialLine[]): string {
  return toCsv([
    ['Material', 'Largo comercial (mm)', 'Piezas', 'Suma de piezas (mm)', 'Caños a comprar', 'Total comprado (m)', 'Sobrantes usados', 'Pérdida por disco (mm)', 'Refilado (mm)', 'Sobrante final (mm)', 'Aprovechamiento (%)'],
    ...m.map((x) => [x.profileLabel, x.stockLengthMm, x.piecesCount, num(x.piecesLengthMm), x.newBarsCount, num(x.purchasedMm / 1000, 2), x.offcutsUsedCount, num(x.kerfLossMm), num(x.trimLossMm), num(x.leftoverMm), num(x.utilization * 100)]),
  ]);
}

/** Dispara la descarga de un archivo ya armado (por ejemplo, un PDF). */
export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function download(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  downloadBlob(filename, new Blob([content], { type: mime }));
}
