import { buildObraDocument, obraFileName } from '../core/document';
import { downloadBlob } from '../core/exporters';
import type { BudgetResult } from '../core/budget';
import type { ObraResult, RejaResult } from '../core/obra';
import type { Obra } from '../core/types';

/** Relleno por tipo de pieza en el plano del PDF de texto (RGB). */
const PLANO_FILL: Record<string, [number, number, number]> = {
  'frame-top': [90, 100, 110],
  'frame-bottom': [90, 100, 110],
  'frame-left': [90, 100, 110],
  'frame-right': [90, 100, 110],
  reinforcement: [176, 141, 87],
  bar: [196, 202, 208],
};

/** Dibuja el plano de una reja (rectángulos del layout) y avanza el cursor. */
function drawPlano(
  doc: {
    setFillColor: (...c: number[]) => void;
    setDrawColor: (...c: number[]) => void;
    rect: (x: number, y: number, w: number, h: number, style?: string) => void;
  },
  r: RejaResult,
  y: number,
  ensure: (need: number) => void,
  margin: number,
  width: number,
): number {
  const layout = r.design.layout;
  if (layout.length === 0) return y;
  const rejaW = r.config.window.widthMm;
  const rejaH = r.config.window.heightMm;
  const scale = Math.min(width / rejaW, 95 / rejaH);
  const sw = rejaW * scale;
  const sh = rejaH * scale;
  ensure(sh + 6);
  const x0 = margin + (width - sw) / 2;
  // El plano arranca sobre fondo blanco: sin gris de fondo detrás del dibujo.
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(150);
  doc.rect(x0, y, sw, sh, 'FD');
  const horizontalRound = r.design.derived?.horizontalRound ?? false;
  for (const rc of layout) {
    const c = (horizontalRound && (rc.type === 'frame-top' || rc.type === 'frame-bottom'))
      ? PLANO_FILL.bar
      : PLANO_FILL[rc.type] ?? [160, 160, 160];
    doc.setFillColor(c[0], c[1], c[2]);
    doc.setDrawColor(c[0], c[1], c[2]);
    doc.rect(x0 + rc.x * scale, y + rc.y * scale, Math.max(rc.w * scale, 0.2), Math.max(rc.h * scale, 0.2), 'F');
  }
  doc.setDrawColor(0);
  return y + sh + 4;
}

/**
 * Arma el PDF de texto de la obra (respaldo cuando no hay hoja de taller en el DOM)
 * y lo devuelve como `Blob`. `jspdf` se importa solo al usarse.
 */
async function buildTextPdfBlob(obra: Obra, result: ObraResult, budget: BudgetResult): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const M = 15;
  const WIDTH = 180;
  const PAGE_H = 297;
  const FOOTER_Y = PAGE_H - 8;
  let y = M;

  const ensure = (need: number) => {
    if (y + need > PAGE_H - M) {
      doc.addPage();
      y = M;
    }
  };
  const lineHeight = (kind: string) => (kind === 'title' ? 9 : kind === 'h2' ? 7.5 : kind === 'sub' ? 6.5 : 5.5);

  const lines = buildObraDocument(obra, result, budget, new Date().toLocaleDateString('es-AR'));

  for (const l of lines) {
    if (l.kind === 'pagebreak') {
      doc.addPage();
      y = M;
      continue;
    }
    if (l.kind === 'plano') {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(60);
      ensure(5.5);
      doc.text(l.text, M, y);
      y += 6;
      doc.setTextColor(0);
      const r = result.valid.find((x) => x.reja.id === l.rejaId);
      if (r) y = drawPlano(doc, r, y, ensure, M, WIDTH);
      continue;
    }
    const size = l.kind === 'title' ? 16 : l.kind === 'h2' ? 13 : l.kind === 'sub' ? 12 : 10;
    const style = l.kind === 'title' || l.kind === 'h2' || l.kind === 'sub' ? 'bold' : 'normal';
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    const wrapped = doc.splitTextToSize(l.text, WIDTH) as string[];
    const lh = lineHeight(l.kind);
    for (const ln of wrapped) {
      ensure(lh);
      doc.text(ln, M, y);
      y += lh;
    }
    y += l.kind === 'h2' ? 3 : l.kind === 'title' ? 4 : 1;
  }

  // Pie de página: identifica la obra y ordena las hojas.
  const total = doc.getNumberOfPages();
  const footBase = obra.name ? `${obra.name} — ` : '';
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(`${footBase}página ${p} de ${total}`, M, FOOTER_Y);
  }
  doc.setTextColor(0);

  return doc.output('blob');
}

/** --- PDF de la hoja de taller (copia fiel) ----------------------------------------- */

/** Medidas A4 (mm): hoja completa, márgenes y área imprimible. */
export const A4 = { widthMm: 210, heightMm: 297, marginMm: 12 } as const;
export const CONTENT = { widthMm: A4.widthMm - 2 * A4.marginMm, heightMm: A4.heightMm - 2 * A4.marginMm } as const;

/** Comedido lateral que tenía `.app` al imprimir (3 px por lado): al igualar el
 * ancho de trabajo, el PDF y la impresión envuelven el texto exactamente igual. */
const PRINT_INSET_PX = 6;

/** Un px CSS equivale a 1/96 in. */
const MM_PER_CSS_PX = 25.4 / 96;

const startsNewPage = (el: HTMLElement, seenReja: boolean): boolean =>
  el.classList.contains('ws-page-break') || (el.classList.contains('ws-reja') && seenReja);

/**
 * Reacomoda los hijos de la hoja de taller en un bloque por hoja, respetando los
 * saltos que usa la impresión: cada reja (menos la primera) y «qué sale de cada
 * caño» arrancan en hoja nueva. Devuelve los bloques, ya dentro de `root`.
 */
export function splitWorksheetIntoPages(root: HTMLElement): HTMLElement[] {
  const pages: HTMLElement[] = [];
  const original = Array.from(root.childNodes);
  const makePage = () => {
    const d = document.createElement('div');
    d.className = 'pdf-page';
    root.appendChild(d);
    pages.push(d);
    return d;
  };
  let current = makePage();
  let seenReja = false;
  for (const node of original) {
    const el = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : null;
    if (el && startsNewPage(el, seenReja) && current.hasChildNodes()) current = makePage();
    if (el?.classList.contains('ws-reja')) seenReja = true;
    current.appendChild(node);
  }
  if (pages.length > 1 && !pages[pages.length - 1].hasChildNodes()) pages.pop();
  return pages;
}

/** Corta un canvas alto en franjas que entran a lo alto en una hoja A4. */
export function planSlices(height: number, maxHeightPx: number, breaks: number[] = []): Array<[number, number]> {
  const step = Math.max(1, Math.floor(maxHeightPx));
  const safe = [...new Set(breaks)].filter((b) => b > 0 && b < height).sort((a, b) => a - b);
  const out: Array<[number, number]> = [];
  let y = 0;
  while (y < height) {
    const limit = Math.min(y + step, height);
    let end = limit;
    if (limit < height) {
      // Último borde de bloque que entra en la franja, si deja al menos media hoja útil.
      const inside = safe.filter((b) => b <= limit && b >= y + step * 0.5);
      if (inside.length > 0) end = inside[inside.length - 1];
    }
    out.push([y, end]);
    y = end;
  }
  return out;
}

/**
 * Corta un canvas alto en franjas que entran a lo alto en una hoja A4. `breaks`
 * (posiciones en px del canvas) son los bordes de bloque: cortando ahí no queda
 * una barra del plan de cortes ni una fila de tabla partida al medio.
 */
export function sliceCanvas(source: HTMLCanvasElement, maxHeightPx: number, breaks: number[] = []): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = [];
  for (const [y, end] of planSlices(source.height, maxHeightPx, breaks)) {
    const h = end - y;
    const slice = document.createElement('canvas');
    slice.width = source.width;
    slice.height = h;
    const ctx = slice.getContext('2d');
    if (!ctx) return out;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(source, 0, y, source.width, h, 0, 0, source.width, h);
    out.push(slice);
  }
  return out;
}

/**
 * Bordes inferiores de las piezas de la hoja (filas, barras del plan y planos), en
 * px CSS relativos a la hoja: son los puntos donde el corte de página no rompe nada.
 */
function safeBreaks(page: HTMLElement): number[] {
  const top = page.getBoundingClientRect().top;
  const ys = new Set<number>();
  const sel = '.ws-bin, .ws-table tr, .ws-preview, .ws-plan h3, .worksheet h2, .worksheet h3, .ws-note, p';
  for (const el of page.querySelectorAll(sel)) {
    ys.add(Math.round(el.getBoundingClientRect().bottom - top));
  }
  return [...ys];
}

/**
 * Genera el PDF a partir del DOM de la hoja de taller: renderiza cada hoja con
 * `html2canvas` y la mete en una página A4. Así «Descargar PDF» y «Enviar por
 * WhatsApp» producen exactamente la misma hoja de taller que la impresión.
 */
export async function buildWorksheetPdfBlob(source: HTMLElement): Promise<Blob> {
  const [{ jsPDF }, html2canvasModule] = await Promise.all([import('jspdf'), import('html2canvas')]);
  const html2canvas = html2canvasModule.default;

  const clone = source.cloneNode(true) as HTMLElement;
  clone.classList.remove('print-only');
  clone.removeAttribute('data-area');
  clone.style.display = 'block';
  clone.style.width = '100%';

  const host = document.createElement('div');
  host.style.cssText = `position:fixed;overflow:hidden;z-index:-1000;left:-10000px;top:0;width:calc(${CONTENT.widthMm}mm - ${PRINT_INSET_PX}px);background:#fff;`;
  host.appendChild(clone);
  document.body.appendChild(host);

  try {
    try { await document.fonts?.ready; } catch { /* si no hay fuentes listas seguimos igual */ }

    const pages = splitWorksheetIntoPages(clone);
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const scale = 2;
    const maxSlicePx = Math.floor((CONTENT.heightMm / MM_PER_CSS_PX) * scale);
    let first = true;

    for (const page of pages) {
      // Los puntos de corte se miden antes de renderizar, sobre la hoja tal cual sale.
      const breaksCss = safeBreaks(page);
      // Fondo 100 % blanco: la hoja no pinta fondos (los grises de pantalla se
      // neutralizan en styles.css) y html2canvas rellena el resto en blanco.
      const canvas = await html2canvas(page, {
        scale,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        width: page.offsetWidth,
        height: page.offsetHeight,
      });
      if (canvas.width === 0 || canvas.height === 0) continue;
      const k = canvas.width / Math.max(1, page.offsetWidth);
      for (const slice of sliceCanvas(canvas, maxSlicePx, breaksCss.map((b) => b * k))) {
        if (!first) doc.addPage();
        first = false;
        const heightMm = (slice.height / slice.width) * CONTENT.widthMm;
        doc.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', A4.marginMm, A4.marginMm, CONTENT.widthMm, heightMm);
      }
    }
    return doc.output('blob');
  } finally {
    host.remove();
  }
}

/** Hoja de taller tal como está en el DOM, si existe. */
function worksheetElement(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('[data-area="worksheet"]');
}

/**
 * Arma el PDF de la obra y lo devuelve como `Blob`. Usa la hoja de taller como
 * copia fiel; si no está en el DOM (p. ej. en pruebas) cae al PDF de texto.
 */
export async function buildObraPdfBlob(obra: Obra, result: ObraResult, budget: BudgetResult): Promise<Blob> {
  const source = worksheetElement();
  if (source) {
    try {
      return await buildWorksheetPdfBlob(source);
    } catch (e) {
      console.warn('No se pudo generar el PDF desde la hoja de taller; se usa el PDF de texto.', e);
    }
  }
  return buildTextPdfBlob(obra, result, budget);
}

/** Genera y descarga el PDF de la obra. */
export async function downloadObraPdf(obra: Obra, result: ObraResult, budget: BudgetResult): Promise<void> {
  downloadBlob(obraFileName(obra), await buildObraPdfBlob(obra, result, budget));
}

/** Arma el PDF de la obra como archivo, listo para compartir con la Web Share API. */
export async function obraPdfFile(obra: Obra, result: ObraResult, budget: BudgetResult): Promise<File> {
  const blob = await buildObraPdfBlob(obra, result, budget);
  return new File([blob], obraFileName(obra), { type: 'application/pdf' });
}
