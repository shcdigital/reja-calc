import { fmtMm } from '../core/format';
import type { BinPlan } from '../core/types';

/** Nombre legible de un caño del plan (comercial o sobrante de inventario). */
export const binName = (b: BinPlan) => (b.source.kind === 'new' ? `Caño comercial ${b.index}` : `Sobrante ${b.index}`);

/**
 * Barra proporcional de un caño: refilado, piezas, pérdidas de disco y sobrante.
 * La usan la vista de la web y la hoja de taller (que es la que se imprime y la
 * que se rasteriza para el PDF), así el plan de cortes se ve igual en los tres lados.
 */
export function BinBar({ bin, activeRejaId }: { bin: BinPlan; activeRejaId?: string }) {
  const total = bin.source.lengthMm;
  const pct = (mm: number) => `${(mm / total) * 100}%`;
  const segs: JSX.Element[] = [];
  if (bin.trimLossMm > 0) segs.push(<div key="trim" className="seg seg-trim" style={{ flex: `0 0 ${pct(bin.trimLossMm)}` }} title={`Refilado ${fmtMm(bin.trimLossMm)}`} />);
  bin.items.forEach((it) => {
    const wide = (it.lengthMm / total) > 0.07;
    const other = activeRejaId !== undefined && it.rejaId !== undefined && it.rejaId !== activeRejaId;
    const label = it.localId ?? it.pieceId;
    segs.push(
      <div key={it.pieceId} className={`seg seg-piece${other ? ' seg-other' : ''}`} style={{ flex: `0 0 ${pct(it.lengthMm)}` }} title={`${label}: ${fmtMm(it.lengthMm)}`}>
        <b>{label}</b>{wide && <small>{Math.round(it.lengthMm * 10) / 10}</small>}
      </div>,
    );
  });
  // Pérdidas de disco: se dibujan agrupadas tras las piezas para que la barra sea proporcional y legible.
  if (bin.kerfLossMm > 0) segs.push(<div key="kerf" className="seg seg-kerf" style={{ flex: `0 0 ${pct(bin.kerfLossMm)}`, minWidth: 2 }} title={`Pérdidas por disco ${fmtMm(bin.kerfLossMm)}`} />);
  if (bin.leftoverMm > 0) segs.push(
    <div key="left" className={`seg ${bin.leftoverReusable ? 'seg-reuse' : 'seg-scrap'}`} style={{ flex: `1 1 ${pct(bin.leftoverMm)}` }} title={`Sobrante ${fmtMm(bin.leftoverMm)}`}>
      {bin.leftoverMm / total > 0.08 && <small>{Math.round(bin.leftoverMm)}</small>}
    </div>,
  );
  return <div className="bin-bar" role="img" aria-label={`${binName(bin)}: ${bin.items.map((i) => i.localId ?? i.pieceId).join(', ')}`}>{segs}</div>;
}

/** Referencia de los colores de las barras. */
export function CutLegend({ showOther = false }: { showOther?: boolean }) {
  return (
    <div className="legend" aria-hidden="true">
      <span><i className="sw seg-piece" />Pieza</span>
      {showOther && <span><i className="sw seg-other" />Otra reja</span>}
      <span><i className="sw seg-kerf" />Pérdida por disco (agrupada)</span>
      <span><i className="sw seg-reuse" />Sobrante reutilizable</span>
      <span><i className="sw seg-scrap" />Sobrante chico</span>
    </div>
  );
}
