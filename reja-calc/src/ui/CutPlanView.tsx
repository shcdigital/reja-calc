import { fmtMm, fmtPct } from '../core/format';
import type { CuttingPlan, SectionPlan } from '../core/types';
import { BinBar, binName, CutLegend } from './CutPlanParts';

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
      <CutLegend showOther={activeRejaId !== undefined} />
      {plan.sections.map((s) => <SectionView key={s.sectionKey} s={s} activeRejaId={activeRejaId} scope={scope} />)}
    </div>
  );
}
