/**
 * Exportación de planos a DXF ASCII R12 (AutoCAD, LibreCAD, QCAD, etc.).
 *
 * El plano se dibuja en milímetros reales, con Y hacia arriba (convención CAD).
 * Cada reja va en su propio bloque de coordenadas, una al lado de la otra, y las
 * piezas se separan por capas: marco, refuerzo/travesaño, barrotes, cotas y textos.
 *
 * R12 se elige a propósito: es el formato DXF más compatible con software de CAD
 * antiguo y moderno, y no requiere librerías externas.
 */
import { fmtNum } from './format';
import type { ObraResult } from './obra';
import type { Design, LayoutRect, PieceType } from './types';

const CRLF = '\r\n';
const GAP_MM = 300;
const DIM_OFFSET_MM = 60;

export interface DxfReja {
  name: string;
  widthMm: number;
  heightMm: number;
  design: Design;
}

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const LAYERS: { name: string; color: number }[] = [
  { name: '0', color: 7 },
  { name: 'MARCO', color: 7 },
  { name: 'REFUERZO', color: 8 },
  { name: 'BARROTES', color: 3 },
  { name: 'COTAS', color: 2 },
  { name: 'TEXTOS', color: 4 },
];

/** DXF R12 es ASCII: se transliteran acentos y símbolos para evitar mojibake. */
function dxfText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[Øø]/g, 'D')
    .replace(/×/g, 'x')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const num = (n: number): string => {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
};

function layerFor(type: PieceType): string {
  if (type === 'reinforcement') return 'REFUERZO';
  if (type === 'bar') return 'BARROTES';
  return 'MARCO';
}

function textHeight(w: number, h: number, min = 4, max = 14): number {
  return Math.max(min, Math.min(max, Math.min(w, h) * 0.55));
}

function addLine(g: (code: number, value: string | number) => void, layer: string, x1: number, y1: number, x2: number, y2: number): void {
  g(0, 'LINE');
  g(8, layer);
  g(10, num(x1)); g(20, num(y1)); g(30, 0);
  g(11, num(x2)); g(21, num(y2)); g(31, 0);
}

function addRect(g: (code: number, value: string | number) => void, layer: string, x: number, y: number, w: number, h: number): void {
  addLine(g, layer, x, y, x + w, y);
  addLine(g, layer, x + w, y, x + w, y + h);
  addLine(g, layer, x + w, y + h, x, y + h);
  addLine(g, layer, x, y + h, x, y);
}

function addText(
  g: (code: number, value: string | number) => void,
  layer: string,
  value: string,
  x: number,
  y: number,
  height: number,
  rotation = 0,
): void {
  const clean = dxfText(value);
  if (!clean || height <= 0) return;
  g(0, 'TEXT');
  g(8, layer);
  g(10, num(x)); g(20, num(y)); g(30, 0);
  g(40, num(height));
  g(1, clean);
  g(50, num(rotation));
  g(41, 1);
  g(7, 'STANDARD');
  g(72, 1); // centrado horizontal
  g(73, 2); // centrado vertical
  g(11, num(x)); g(21, num(y)); g(31, 0);
}

function addHorizontalDimension(
  g: (code: number, value: string | number) => void,
  x1: number,
  x2: number,
  y: number,
  text: string,
): void {
  addLine(g, 'COTAS', x1, y, x2, y);
  addLine(g, 'COTAS', x1, y - 8, x1, y + 8);
  addLine(g, 'COTAS', x2, y - 8, x2, y + 8);
  addText(g, 'COTAS', text, (x1 + x2) / 2, y + 18, 12);
}

function addVerticalDimension(
  g: (code: number, value: string | number) => void,
  y1: number,
  y2: number,
  x: number,
  text: string,
): void {
  addLine(g, 'COTAS', x, y1, x, y2);
  addLine(g, 'COTAS', x - 8, y1, x + 8, y1);
  addLine(g, 'COTAS', x - 8, y2, x + 8, y2);
  addText(g, 'COTAS', text, x + 18, (y1 + y2) / 2, 12, 90);
}

function header(box: Box): string[] {
  const out: string[] = [];
  const g = (code: number, value: string | number) => { out.push(String(code)); out.push(String(value)); };
  g(999, 'PLANO DE REJAS - UNIDADES: MILIMETROS');
  g(0, 'SECTION'); g(2, 'HEADER');
  g(9, '$ACADVER'); g(1, 'AC1009');
  g(9, '$INSBASE'); g(10, 0); g(20, 0); g(30, 0);
  g(9, '$EXTMIN'); g(10, num(box.minX)); g(20, num(box.minY)); g(30, 0);
  g(9, '$EXTMAX'); g(10, num(box.maxX)); g(20, num(box.maxY)); g(30, 0);
  g(9, '$LIMMIN'); g(10, num(box.minX)); g(20, num(box.minY));
  g(9, '$LIMMAX'); g(10, num(box.maxX)); g(20, num(box.maxY));
  g(0, 'ENDSEC');
  return out;
}

function tables(): string[] {
  const out: string[] = [];
  const g = (code: number, value: string | number) => { out.push(String(code)); out.push(String(value)); };

  g(0, 'SECTION'); g(2, 'TABLES');

  // Estilos de línea
  g(0, 'TABLE'); g(2, 'LTYPE'); g(70, 1);
  g(0, 'LTYPE'); g(2, 'CONTINUOUS'); g(70, 0); g(3, 'Solid line'); g(72, 65); g(73, 0); g(40, 0);
  g(0, 'ENDTAB');

  // Capas
  g(0, 'TABLE'); g(2, 'LAYER'); g(70, LAYERS.length);
  for (const layer of LAYERS) {
    g(0, 'LAYER');
    g(2, layer.name);
    g(70, 0);
    g(62, layer.color);
    g(6, 'CONTINUOUS');
  }
  g(0, 'ENDTAB');

  // Estilo de texto
  g(0, 'TABLE'); g(2, 'STYLE'); g(70, 1);
  g(0, 'STYLE'); g(2, 'STANDARD'); g(70, 0); g(40, 0); g(41, 1); g(50, 0); g(71, 0); g(42, 2.5); g(3, 'txt');
  g(0, 'ENDTAB');

  g(0, 'ENDSEC');
  return out;
}

/** Convierte la geometría de una reja en entidades DXF y actualiza la caja envolvente. */
function addReja(
  g: (code: number, value: string | number) => void,
  part: DxfReja,
  baseX: number,
  box: Box,
): void {
  const { widthMm: W, heightMm: H, design } = part;
  const nameHeight = Math.max(14, Math.min(30, Math.min(W, H) * 0.035));
  const top = H;

  const toCadY = (r: LayoutRect) => top - r.y - r.h;

  for (const r of design.layout) {
    const x = baseX + r.x;
    const y = toCadY(r);
    addRect(g, layerFor(r.type), x, y, r.w, r.h);
    addText(g, 'TEXTOS', r.pieceId, x + r.w / 2, y + r.h / 2, textHeight(r.w, r.h), r.h > r.w ? 90 : 0);
    box.minX = Math.min(box.minX, x);
    box.maxX = Math.max(box.maxX, x + r.w);
    box.minY = Math.min(box.minY, y);
    box.maxY = Math.max(box.maxY, y + r.h);
  }

  const nameY = top + nameHeight * 1.8;
  addText(g, 'TEXTOS', `${part.name} - ${fmtNum(W)} x ${fmtNum(H)} mm`, baseX + W / 2, nameY, nameHeight);
  box.maxY = Math.max(box.maxY, nameY + nameHeight / 2);
  box.maxX = Math.max(box.maxX, baseX + W);

  addHorizontalDimension(g, baseX, baseX + W, -DIM_OFFSET_MM, `${fmtNum(W)} mm`);
  addVerticalDimension(g, 0, H, baseX + W + DIM_OFFSET_MM, `${fmtNum(H)} mm`);
  box.minY = Math.min(box.minY, -DIM_OFFSET_MM - 20);
  box.maxX = Math.max(box.maxX, baseX + W + DIM_OFFSET_MM + 30);

  // Una referencia visual del estilo del plano, útil al abrirlo en CAD.
  addText(g, 'TEXTOS', 'UNIDADES: mm', baseX, -DIM_OFFSET_MM - 26, 10);
  box.minY = Math.min(box.minY, -DIM_OFFSET_MM - 32);
}

/** Arma un único DXF con todas las rejas indicadas, ubicadas una al lado de otra. */
export function buildRejasDxf(rejas: DxfReja[]): string {
  const body: string[] = [];
  const g = (code: number, value: string | number) => { body.push(String(code)); body.push(String(value)); };
  const box: Box = { minX: 0, minY: 0, maxX: 0, maxY: 0 };

  let cursorX = 0;
  for (const reja of rejas) {
    if (!reja.design.derived || !reja.design.distribution) continue;
    g(999, `REJA: ${dxfText(reja.name)}`);
    addReja(g, reja, cursorX, box);
    cursorX += reja.widthMm + GAP_MM;
  }
  if (cursorX > 0) cursorX -= GAP_MM;
  box.maxX = Math.max(box.maxX, cursorX);

  const out: string[] = [
    ...header(box),
    ...tables(),
    '0', 'SECTION', '2', 'BLOCKS', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES',
    ...body,
    '0', 'ENDSEC',
    '0', 'EOF',
    '',
  ];
  return out.join(CRLF);
}

/** DXF de la obra completa: todas las rejas válidas, lado a lado. */
export function buildObraDxf(result: ObraResult): string {
  return buildRejasDxf(
    result.valid.map((r) => ({
      name: r.reja.name,
      widthMm: r.config.window.widthMm,
      heightMm: r.config.window.heightMm,
      design: r.design,
    })),
  );
}

/** DXF de una sola reja (por ejemplo, la reja activa). */
export function buildDesignDxf(name: string, design: Design, widthMm: number, heightMm: number): string {
  return buildRejasDxf([{ name, widthMm, heightMm, design }]);
}
