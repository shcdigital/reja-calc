/**
 * Exportación e importación de planos DXF ASCII R12 (AutoCAD, LibreCAD, QCAD, etc.).
 *
 * El plano se dibuja en milímetros reales, con Y hacia arriba (convención CAD).
 * Cada reja va en su propio bloque de coordenadas, una al lado de la otra, y las
 * piezas se separan por capas: marco, refuerzo/travesaño, barrotes, cotas y textos.
 *
 * Los DXF exportados llevan metadatos en comentarios `999` para reimportar la obra
 * completa o una reja. Un DXF externo se puede importar como contorno (ancho/alto).
 *
 * R12 se elige a propósito: es el formato DXF más compatible con software de CAD
 * antiguo y moderno, y no requiere librerías externas.
 */
import { fmtNum } from './format';
import { DEFAULT_BUDGET, DEFAULT_CUTTING, parseObra } from './obra';
import type { ObraResult } from './obra';
import type { Design, LayoutRect, Obra, PieceType, Reja } from './types';

const CRLF = '\r\n';
const GAP_MM = 300;
const DIM_OFFSET_MM = 60;

export interface DxfReja {
  name: string;
  widthMm: number;
  heightMm: number;
  design: Design;
  /** Aviso opcional para planos de rejas con errores (se dibujan igual si tienen despiece). */
  note?: string;
}

/**
 * Datos de la calculadora embebidos como comentarios `999` del DXF.
 * Permiten volver a importar el archivo sin perder configuración, perfiles ni mano de obra.
 */
export type DxfPayload =
  | { format: 'reja-calc/dxf'; version: 1; kind: 'obra'; obra: Obra }
  | { format: 'reja-calc/dxf'; version: 1; kind: 'reja'; reja: Reja };

const META_PREFIX = 'RCALC:';
const META_CHUNK = 180;

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

/** Convierte el payload en comentarios DXF cortos, sin caracteres no ASCII. */
function metaComments(payload: DxfPayload): string[] {
  const encoded = encodeURIComponent(JSON.stringify(payload));
  const chunks = encoded.match(new RegExp(`.{1,${META_CHUNK}}`, 'g')) ?? [];
  return chunks.map((chunk) => `${META_PREFIX}${chunk}`);
}

/** Lee el payload embebido en un DXF exportado por la app, si existe. */
export function parseDxfPayload(text: string): DxfPayload | null {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const chunks: string[] = [];
  for (const line of lines) {
    if (line.startsWith(META_PREFIX)) chunks.push(line.slice(META_PREFIX.length));
  }
  if (chunks.length === 0) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(chunks.join(''))) as {
      format?: unknown; version?: unknown; kind?: unknown; obra?: Obra; reja?: Reja;
    };
    if (parsed.format !== 'reja-calc/dxf' || parsed.version !== 1) return null;
    if (parsed.kind === 'obra' && parsed.obra) {
      const obra = parseObra(JSON.stringify(parsed.obra));
      return obra ? { format: 'reja-calc/dxf', version: 1, kind: 'obra', obra } : null;
    }
    if (parsed.kind === 'reja' && parsed.reja) {
      const wrapped = {
        id: 'import',
        name: '',
        rejas: [parsed.reja],
        activeRejaId: parsed.reja.id,
        cutting: DEFAULT_CUTTING,
        budget: DEFAULT_BUDGET,
      };
      const obra = parseObra(JSON.stringify(wrapped));
      return obra?.rejas[0] ? { format: 'reja-calc/dxf', version: 1, kind: 'reja', reja: obra.rejas[0] } : null;
    }
    return null;
  } catch {
    return null;
  }
}

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

  if (design.layout.length === 0) {
    // Reja con errores que impiden generar el despiece: se deja el contorno exterior.
    if (W > 0 && H > 0) {
      addRect(g, 'MARCO', baseX, 0, W, H);
      addText(g, 'TEXTOS', 'SIN DESPIECE - REVISAR ERRORES', baseX + W / 2, H / 2, Math.max(12, nameHeight * 0.7));
    }
    box.maxX = Math.max(box.maxX, baseX + W);
    box.maxY = Math.max(box.maxY, top);
  } else {
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
  }

  const nameY = top + nameHeight * 1.8;
  addText(g, 'TEXTOS', `${part.name} - ${fmtNum(W)} x ${fmtNum(H)} mm`, baseX + W / 2, nameY, nameHeight);
  box.maxY = Math.max(box.maxY, nameY + nameHeight / 2);
  box.maxX = Math.max(box.maxX, baseX + W);

  if (W > 0 && H > 0) {
    addHorizontalDimension(g, baseX, baseX + W, -DIM_OFFSET_MM, `${fmtNum(W)} mm`);
    addVerticalDimension(g, 0, H, baseX + W + DIM_OFFSET_MM, `${fmtNum(H)} mm`);
    box.minY = Math.min(box.minY, -DIM_OFFSET_MM - 20);
    box.maxX = Math.max(box.maxX, baseX + W + DIM_OFFSET_MM + 30);
  }

  if (part.note) {
    addText(g, 'TEXTOS', part.note, baseX + W / 2, -DIM_OFFSET_MM - 26, 12);
    box.minY = Math.min(box.minY, -DIM_OFFSET_MM - 34);
  }

  // Una referencia visual del estilo del plano, útil al abrirlo en CAD.
  addText(g, 'TEXTOS', 'UNIDADES: mm', baseX, -DIM_OFFSET_MM - (part.note ? 44 : 26), 10);
  box.minY = Math.min(box.minY, -DIM_OFFSET_MM - (part.note ? 50 : 32));
}

/**
 * Lee un DXF ajeno (sin metadatos de la calculadora) y devuelve el ancho y alto
 * del contorno geométrico, en mm. Es una importación de referencia: no intenta
 * adivinar perfiles ni cantidad de barrotes.
 */
export function readDxfGeometry(text: string): { widthMm: number; heightMm: number } | null {
  try {
    const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = clean.split('\n');
    const pairs: { code: number; value: string }[] = [];
    for (let i = 0; i + 1 < lines.length; i += 2) {
      const code = Number(lines[i].trim());
      if (Number.isFinite(code)) pairs.push({ code, value: lines[i + 1] });
    }
    if (pairs.length === 0) return null;

    // Unidades del header: 1=pulg, 2=pie, 4=mm, 5=cm, 6=m. Por defecto mm.
    let unit = 4;
    for (let i = 0; i < pairs.length - 1; i++) {
      if (pairs[i].value.trim() === '$INSUNITS' && pairs[i + 1].code === 70) {
        const parsed = Number(pairs[i + 1].value);
        if (parsed > 0) unit = parsed;
        break;
      }
    }
    const scale = unit === 1 ? 25.4 : unit === 2 ? 304.8 : unit === 5 ? 10 : unit === 6 ? 1000 : 1;

    type Entity = { type: string; groups: { code: number; value: string }[] };
    const entities: Entity[] = [];
    let current: Entity | null = null;
    let inEntities = false;
    let expectSectionName = false;
    for (const pair of pairs) {
      if (pair.code === 0) {
        const type = pair.value.trim().toUpperCase();
        if (type === 'SECTION') {
          if (current && inEntities) entities.push(current);
          expectSectionName = true;
          inEntities = false;
          current = null;
          continue;
        }
        if (type === 'ENDSEC') {
          if (current && inEntities) entities.push(current);
          expectSectionName = false;
          inEntities = false;
          current = null;
          continue;
        }
        if (!inEntities) continue;
        if (current) entities.push(current);
        current = { type, groups: [] };
      } else if (pair.code === 2 && expectSectionName) {
        expectSectionName = false;
        inEntities = pair.value.trim().toUpperCase() === 'ENTITIES';
      } else if (inEntities && current) {
        current.groups.push(pair);
      }
    }
    if (current && inEntities) entities.push(current);

    const ignoredLayer = /^(COTAS?|COTA|DIM|DIMENSION|TEXTOS?|TEXT|NOTAS?)/;
    const points: { x: number; y: number }[] = [];
    const first = (groups: { code: number; value: string }[], code: number) =>
      groups.find((g) => g.code === code)?.value;
    const all = (groups: { code: number; value: string }[], code: number) =>
      groups.filter((g) => g.code === code).map((g) => Number(g.value));
    const push = (x: number, y: number) => {
      if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
    };

    for (const entity of entities) {
      if (!['LINE', 'LWPOLYLINE', 'VERTEX', 'CIRCLE', 'POINT'].includes(entity.type)) continue;
      const layer = (first(entity.groups, 8) ?? '').toUpperCase();
      if (ignoredLayer.test(layer)) continue;
      if (entity.type === 'LINE') {
        push(Number(first(entity.groups, 10)), Number(first(entity.groups, 20)));
        push(Number(first(entity.groups, 11)), Number(first(entity.groups, 21)));
      } else if (entity.type === 'LWPOLYLINE') {
        const xs = all(entity.groups, 10);
        const ys = all(entity.groups, 20);
        for (let i = 0; i < Math.min(xs.length, ys.length); i++) push(xs[i], ys[i]);
      } else if (entity.type === 'VERTEX' || entity.type === 'POINT') {
        push(Number(first(entity.groups, 10)), Number(first(entity.groups, 20)));
      } else if (entity.type === 'CIRCLE') {
        const x = Number(first(entity.groups, 10));
        const y = Number(first(entity.groups, 20));
        const r = Number(first(entity.groups, 40));
        push(x - r, y - r);
        push(x + r, y + r);
      }
    }

    if (points.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const width = (maxX - minX) * scale;
    const height = (maxY - minY) * scale;
    if (!(width > 0) || !(height > 0)) return null;
    return { widthMm: Math.round(width * 10) / 10, heightMm: Math.round(height * 10) / 10 };
  } catch {
    return null;
  }
}

/** Arma un único DXF con todas las rejas indicadas, ubicadas una al lado de otra. */
export function buildRejasDxf(rejas: DxfReja[], payload?: DxfPayload): string {
  const body: string[] = [];
  const g = (code: number, value: string | number) => { body.push(String(code)); body.push(String(value)); };
  const box: Box = { minX: 0, minY: 0, maxX: 0, maxY: 0 };

  let cursorX = 0;
  for (const reja of rejas) {
    g(999, `REJA: ${dxfText(reja.name)}`);
    addReja(g, reja, cursorX, box);
    cursorX += Math.max(reja.widthMm, 1) + GAP_MM;
  }
  if (cursorX > 0) cursorX -= GAP_MM;
  box.maxX = Math.max(box.maxX, cursorX);

  const meta = payload ? metaComments(payload).flatMap((value) => ['999', value]) : [];
  const out: string[] = [
    ...header(box),
    ...tables(),
    '0', 'SECTION', '2', 'BLOCKS', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES',
    ...meta,
    ...body,
    '0', 'ENDSEC',
    '0', 'EOF',
    '',
  ];
  return out.join(CRLF);
}

/**
 * DXF de la obra completa: todas las rejas, lado a lado, con metadatos de la obra.
 * Las rejas con errores también se incluyen: si tienen despiece se dibujan, y si no
 * se deja su contorno exterior con la leyenda «SIN DESPIECE - REVISAR ERRORES».
 */
export function buildObraDxf(obra: Obra, result: ObraResult): string {
  return buildRejasDxf(
    result.rejas.map((r) => ({
      name: r.reja.name,
      widthMm: r.config.window.widthMm,
      heightMm: r.config.window.heightMm,
      design: r.design,
      note: r.error ? 'REVISAR ERRORES EN LA CALCULADORA' : undefined,
    })),
    { format: 'reja-calc/dxf', version: 1, kind: 'obra', obra },
  );
}

/** DXF de una sola reja (por ejemplo, la reja activa), con metadatos de esa reja. */
export function buildDesignDxf(name: string, design: Design, widthMm: number, heightMm: number, reja?: Reja): string {
  return buildRejasDxf(
    [{ name, widthMm, heightMm, design }],
    reja ? { format: 'reja-calc/dxf', version: 1, kind: 'reja', reja } : undefined,
  );
}
