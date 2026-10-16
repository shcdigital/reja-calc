import { fmtMm, fmtPct } from '../core/format';
import type { BinPlan, CuttingPlan, SectionPlan } from '../core/types';

const binName = (b: BinPlan) => (b.source.kind === 'new' ? `Caño comercial ${b.index}` : `Sobrante ${b.index}`);

function BinBar({ bin, activeRejaId }: { bin: BinPlan; activeRejaId?: string }) {
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

function SectionView({ s, activeRejaId, scope }: { s: SectionPlan; activeRejaId?: string; scope: 'obra' | 'reja' }) {
  return (
    <section className="cut-section">
      <header>
        <h3>{s.profileLabel}</h3>
        <p className="muted">
          {s.newBarsCount} {s.newBarsCount === 1 ? 'caño' : 'caños'} de {fmtMm(s.stockLengthMm)} a comprar
          {scope === 'obra' ? (
            <>
              {' · '}cota inferior teórica: {s.lowerBoundBars}
              {' · '}
              <span className={s.provenOptimal ? 'ok' : 'warn'}>{s.provenOptimal ? 'cantidad óptima comprobada' : 'óptimo no comprobado'}</span>
              {' · '}{s.method}
            </>
          ) : (
            <> {' · '}subconjunto del plan de obra: los caños pueden compartirse con otras rejas</>
          )}
        </p>
      </header>
      {s.bins.map((b) => {
        const util = b.piecesLengthMm / b.source.lengthMm;
        return (
          <article className="bin" key={`${b.source.kind}${b.index}`}>
            <div className="bin-head">
              <h4>{binName(b)}{b.source.kind === 'offcut' && <span className="tag">de inventario: {b.source.origin} · {fmtMm(b.source.lengthMm)}</span>}</h4>
              <span className="muted">{fmtPct(util)} en piezas</span>
            </div>
            <BinBar bin={b} activeRejaId={activeRejaId} />
            <ul className="bin-items">
              {b.items.map((it) => <li key={it.pieceId}><b>{it.localId ?? it.pieceId}</b> {fmtMm(it.lengthMm)}</li>)}
            </ul>
            <p className="bin-loss">
              Pérdidas por disco: <b>{fmtMm(b.kerfLossMm)}</b>
              {b.trimLossMm > 0 && <> · Refilado: <b>{fmtMm(b.trimLossMm)}</b></>}
              {' · '}Sobrante final: <b>{fmtMm(b.leftoverMm)}</b>
              {b.leftoverMm > 0 && <span className={b.leftoverReusable ? 'ok' : 'muted'}> ({b.leftoverReusable ? 'reutilizable' : 'descarte'})</span>}
            </p>
          </article>
        );
      })}
    </section>
  );
}

export function CutPlanView({ plan, activeRejaId, scope = 'obra' }: { plan: CuttingPlan; activeRejaId?: string; scope?: 'obra' | 'reja' }) {
  return (
    <div>
      <div className="legend" aria-hidden="true">
        <span><i className="sw seg-piece" />Pieza</span>
        {activeRejaId !== undefined && <span><i className="sw seg-other" />Otra reja</span>}
        <span><i className="sw seg-kerf" />Pérdida por disco (agrupada)</span>
        <span><i className="sw seg-reuse" />Sobrante reutilizable</span>
        <span><i className="sw seg-scrap" />Sobrante chico</span>
      </div>
      {plan.sections.map((s) => <SectionView key={s.sectionKey} s={s} activeRejaId={activeRejaId} scope={scope} />)}
    </div>
  );
}
