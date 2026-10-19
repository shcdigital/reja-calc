import { fmtMm, fmtNum } from '../core/format';
import type { Design } from '../core/types';

/**
 * Colores concretos (no variables CSS): el SVG también se serializa para el PDF de
 * la hoja de taller, y ahí no llegan los estilos externos. Con atributos de
 * presentación y colores fijos el plano se dibuja igual en pantalla y en el PDF.
 */
const FILL: Record<string, string> = {
  'frame-top': '#8d9cab', 'frame-bottom': '#8d9cab', 'frame-left': '#8d9cab', 'frame-right': '#8d9cab',
  reinforcement: '#5f7387', bar: '#aab4c0',
};
const INK = '#242b32';
const DIM = '#35566f';
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Plano técnico de la reja en SVG. Todo se dibuja en milímetros reales. */
export function Preview({ design, width, height }: { design: Design; width: number; height: number }) {
  const { derived: dv, distribution: dist, layout } = design;
  if (!dv || !dist) return <p className="empty">Corregí los datos marcados en rojo para ver el plano.</p>;

  const W = width, H = height;
  const k = Math.max(W, H) / 60; // unidad de dibujo (texto, flechas)
  const m = { l: k * 6, r: k * 9, t: k * 4, b: k * 8 };
  const vb = `${-m.l} ${-m.t} ${W + m.l + m.r} ${H + m.t + m.b}`;
  const pf = dv.frameInPlaneMm;
  /** Dimensión a la vista de los tramos horizontales: pf o el Ø del caño redondo. */
  const pfH = dv.frameHorizontalMm;
  /** Borde superior del caño redondo de MS (0 si MS/MI son rectangulares). */
  const railTop = dv.horizontalRound
    ? dv.horizontalEdgeMm + (dv.lateralHoleMm - pfH) / 2
    : 0;
  /** Borde interior del vano, donde arrancan los barrotes. */
  const innerTop = dv.horizontalRound ? railTop + pfH : pfH;
  const horizontalFill = dv.horizontalRound ? FILL.bar : FILL['frame-top'];
  const rcx = W / 2;
  const tick = k * 0.5;

  const line = (x1: number, y1: number, x2: number, y2: number) => (
    <line x1={x1} x2={x2} y1={y1} y2={y2} stroke={DIM} strokeWidth={1} vectorEffect="non-scaling-stroke" />
  );
  const hDim = (x1: number, x2: number, y: number, text: string, key: string) => (
    <g key={key} className="dim" fill={INK}>
      {line(x1, y, x2, y)}
      {line(x1, y - tick, x1, y + tick)}
      {line(x2, y - tick, x2, y + tick)}
      <text x={(x1 + x2) / 2} y={y - k * 0.6} textAnchor="middle" fontSize={k * 1.5}>{text}</text>
    </g>
  );
  const vDim = (y1: number, y2: number, x: number, text: string, key: string, small = false) => (
    <g key={key} className="dim" fill={INK}>
      {line(x, y1, x, y2)}
      {line(x - tick, y1, x + tick, y1)}
      {line(x - tick, y2, x + tick, y2)}
      <text transform={`translate(${x + k * 0.6} ${(y1 + y2) / 2}) ${small ? '' : 'rotate(90)'}`} textAnchor="middle" dominantBaseline={small ? 'middle' : 'auto'} fontSize={small ? k * 1.1 : k * 1.5}>{text}</text>
    </g>
  );

  const labelGaps = dist.count <= 14;
  const gapX = pf + dv.sectorWidthMm / 2;

  return (
    <svg
      className="preview"
      viewBox={vb}
      width={W + m.l + m.r}
      height={H + m.t + m.b}
      fontFamily={FONT}
      role="img"
      aria-label={`Plano de la reja de ${fmtMm(W)} por ${fmtMm(H)}`}
    >
      {layout.map((r) => {
        const fill = r.type === 'frame-top' || r.type === 'frame-bottom' ? horizontalFill : FILL[r.type];
        return (
          <rect key={r.pieceId} x={r.x} y={r.y} width={r.w} height={r.h} fill={fill} stroke={INK} strokeWidth={1} vectorEffect="non-scaling-stroke" className={`piece piece-${r.type}`} />
        );
      })}
      {/* etiquetas de piezas del marco y refuerzo */}
      <text x={W / 2} y={railTop + pfH * 0.5 + k * 0.5} textAnchor="middle" fontSize={Math.min(k * 1.2, pfH * 0.7)} fill={INK} fontWeight={700} className="plabel">MS</text>
      <text x={W / 2} y={H - railTop - pfH * 0.5 + k * 0.5} textAnchor="middle" fontSize={Math.min(k * 1.2, pfH * 0.7)} fill={INK} fontWeight={700} className="plabel">MI</text>
      {dv.withReinforcement && (
        <text x={rcx} y={H / 2} textAnchor="middle" fontSize={Math.min(k * 1.2, dv.reinfInPlaneMm * 0.7)} fill={INK} fontWeight={700} className="plabel" transform={`rotate(-90 ${rcx} ${H / 2})`}>RC</text>
      )}

      {labelGaps && dist.topsMm.map((top, i) => {
        const y0 = i === 0 ? innerTop : dist.topsMm[i - 1] + dv.barOdMm;
        return vDim(y0, top, gapX, fmtNum(Math.round(dist.gapMm * 10) / 10), `g${i}`, true);
      })}
      {labelGaps && vDim(dist.topsMm[dist.count - 1] + dv.barOdMm, H - innerTop, gapX, fmtNum(Math.round(dist.gapMm * 10) / 10), 'glast', true)}

      {hDim(0, W, H + k * 3, `Ancho exterior ${fmtMm(W)}`, 'w')}
      {hDim(pf, W - pf, H + k * 6, `Ancho útil interior ${fmtMm(dv.innerWidthMm)}`, 'wi')}
      {vDim(0, H, W + k * 3, `Alto exterior ${fmtMm(H)}`, 'h')}
      {vDim(innerTop, H - innerTop, W + k * 6.5, `Alto útil ${fmtMm(dv.innerHeightMm)}`, 'hi')}
      {dv.withReinforcement && hDim(0, rcx, -k * 1.8, `Refuerzo al centro: ${fmtMm(W / 2)}`, 'rc')}
    </svg>
  );
}
