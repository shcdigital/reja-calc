import { groupPieces, PIECE_TYPE_LABEL, STRUCTURAL_DISCLAIMER } from '../core/geometry';
import { fmtCm, fmtMm, fmtMoney, fmtPct } from '../core/format';
import type { BudgetResult } from '../core/budget';
import type { ObraResult, RejaResult } from '../core/obra';
import type { Obra } from '../core/types';
import { Preview } from './Preview';
import { BinBar, binName, CutLegend } from './CutPlanParts';

function RejaBlock({ r }: { r: RejaResult }) {
  const { design, config, reja } = r;
  if (!design.derived || !design.distribution) return null;
  const dv = design.derived;
  const groups = groupPieces(design.pieces);
  const sideLabel = design.pieces.find((p) => p.type === 'frame-left')?.profileLabel ?? '';
  const horizontalLabel = design.pieces.find((p) => p.type === 'frame-top')?.profileLabel ?? '';
  const reinfLabel = design.pieces.find((p) => p.type === 'reinforcement')?.profileLabel ?? '';
  const barLabel = design.pieces.find((p) => p.type === 'bar')?.profileLabel ?? '';
  const W = config.window.widthMm;
  const H = config.window.heightMm;
  return (
    <section className="ws-reja">
      <h2>{reja.name}</h2>
      <p className="ws-dim">Reja terminada: <b>{fmtMm(W)} × {fmtMm(H)}</b> ({fmtCm(W)} × {fmtCm(H)}) — medidas exteriores</p>
      <table className="ws-table">
        <tbody>
          <tr><th>Marco</th><td>{dv.horizontalRound
            ? `Laterales: ${sideLabel}, ${fmtMm(dv.frameInPlaneMm)} a la vista · MS/MI: ${horizontalLabel}, Ø${fmtMm(dv.frameHorizontalMm)} a la vista, alojados con el borde del agujero a ${fmtMm(dv.horizontalEdgeMm)} mm del extremo`
            : `${sideLabel}, ${fmtMm(dv.frameInPlaneMm)} a la vista`} · {dv.horizontalRound || config.frame.assembly === 'vertical-full' ? 'laterales completos, tramos horizontales entre ellos' : 'tramos horizontales completos, laterales entre ellos'}</td></tr>
          <tr><th>Refuerzo central</th><td>{dv.withReinforcement
            ? `${reinfLabel}, centrado a ${fmtMm(W / 2)} · ${config.bars.crossing === 'split' ? 'barrotes en dos tramos' : 'barrotes pasantes (agujeros en el refuerzo)'}`
            : 'No lleva: barrotes continuos de lateral a lateral'}</td></tr>
          <tr><th>Barrotes</th><td>{barLabel} · {design.distribution.count} barrotes · separación libre {fmtMm(Math.round(design.distribution.gapMm * 10) / 10)}</td></tr>
          <tr><th>Extremos de los barrotes</th><td>{dv.barsInLateral
            ? `Entran ${fmtMm(dv.lateralPenetrationMm)} en un agujero Ø${fmtMm(dv.lateralHoleMm)} de cada lateral y se frenan a ${fmtMm(config.fabrication.socketSetbackMm)} de la cara exterior (agujero oculto; el barrote queda centrado y soldado)`
            : 'A tope contra la cara interior de los laterales'}</td></tr>
          {dv.horizontalRound && (
            <tr><th>Extremos de MS/MI</th><td>Alojados {fmtMm(dv.lateralPenetrationMm)} en un agujero Ø{fmtMm(dv.lateralHoleMm)} de cada lateral, con el borde del agujero a {fmtMm(dv.horizontalEdgeMm)} mm del extremo y la punta frenada a {fmtMm(config.fabrication.socketSetbackMm)} de la cara exterior</td></tr>
          )}
          <tr><th>Vano interior</th><td>{fmtMm(dv.innerWidthMm)} × {fmtMm(dv.innerHeightMm)}</td></tr>
          <tr><th>Disco de corte</th><td>{fmtMm(config.fabrication.kerfMm)} · holgura por unión: {fmtMm(config.fabrication.jointGapMm)}</td></tr>
        </tbody>
      </table>
      <div className="ws-preview"><Preview design={design} width={W} height={H} /></div>
      <h3>Lista de cortes</h3>
      <table className="ws-table grid ws-cut">
        <colgroup>
          <col style={{ width: '8%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '30%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '12%' }} />
        </colgroup>
        <thead><tr><th>Cant.</th><th>Piezas</th><th>Tipo</th><th>Perfil</th><th>Largo (mm)</th><th>Largo (cm)</th></tr></thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.ids.join()}>
              <td>{g.quantity}</td>
              <td>{g.ids.length > 3 ? `${g.ids[0]} … ${g.ids[g.ids.length - 1]}` : g.ids.join(', ')}</td>
              <td>{PIECE_TYPE_LABEL[g.type]}</td>
              <td>{g.profileLabel}</td>
              <td className="num"><b>{Math.round(g.lengthMm * 10) / 10}</b></td>
              <td className="num">{Math.round(g.lengthMm) / 10}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Hoja de taller de la obra completa (solo se ve al imprimir). */
export function ObraWorksheet({ obra, result, budget }: { obra: Obra; result: ObraResult; budget: BudgetResult }) {
  return (
    <div className="worksheet print-only" data-area="worksheet">
      <h1>Hoja de taller{obra.name ? ` — ${obra.name}` : ''}</h1>
      <p className="ws-dim">{result.valid.length} reja(s) · materiales, cortes y presupuesto de toda la obra</p>

      {result.valid.map((r) => <RejaBlock key={r.reja.id} r={r} />)}

      <h2 className="ws-page-break">Qué sale de cada caño (obra)</h2>
      <CutLegend />
      {result.plan?.sections.map((s) => (
        <div className="ws-plan" key={s.sectionKey}>
          <h3>{s.profileLabel} — comprar {s.newBarsCount} {s.newBarsCount === 1 ? 'caño' : 'caños'} de {fmtMm(s.stockLengthMm)}</h3>
          {s.bins.map((b) => (
            <div className="ws-bin" key={`${b.source.kind}${b.index}`}>
              <p className="ws-bin-head">
                <b>{binName(b)}</b> — {fmtPct(b.piecesLengthMm / b.source.lengthMm)} en piezas
                {b.source.kind === 'offcut' && ` · de inventario: ${b.source.origin} · ${fmtMm(b.source.lengthMm)}`}
              </p>
              <BinBar bin={b} />
              <p className="ws-bin-items">
                Piezas: {b.items.map((i) => `${i.localId ?? i.pieceId} (${Math.round(i.lengthMm * 10) / 10})`).join(' · ')}
              </p>
              <p className="ws-bin-loss">
                Pérdidas por disco: <b>{fmtMm(b.kerfLossMm)}</b>
                {b.trimLossMm > 0 && <> · Refilado: <b>{fmtMm(b.trimLossMm)}</b></>}
                {' · '}Sobrante final: <b>{fmtMm(b.leftoverMm)}</b>
                {b.leftoverMm > 0 && <> ({b.leftoverReusable ? 'reutilizable' : 'descarte'})</>}
              </p>
            </div>
          ))}
        </div>
      ))}

      <h2>Materiales a comprar (obra)</h2>
      <ul>
        {result.materials.map((m) => <li key={m.sectionKey}>{m.profileLabel}: <b>{m.newBarsCount} × {fmtMm(m.stockLengthMm)}</b> (aprovechamiento {fmtPct(m.utilization)})</li>)}
      </ul>

      {budget.enabled && (
        <>
          <h2>Presupuesto</h2>
          <table className="ws-table">
            <tbody>
              {budget.materialsLines.map((l) => (
                <tr key={l.sectionKey}><th>{l.profileLabel} ({l.bars})</th><td>{l.subtotal === undefined ? 'sin precio' : fmtMoney(l.subtotal)}</td></tr>
              ))}
              <tr><th>Consumibles</th><td>{fmtMoney(budget.consumables)}</td></tr>
              {budget.laborLines.map((l) => (
                <tr key={l.rejaId}><th>Mano de obra — {l.rejaName}</th><td>{fmtMoney(l.amount)}</td></tr>
              ))}
              <tr><th>Total</th><td><b>{fmtMoney(budget.total)}</b></td></tr>
            </tbody>
          </table>
          {budget.partial && <p>Presupuesto parcial: falta precio de {budget.missingPrices.join('; ')}.</p>}
        </>
      )}

      <p className="ws-note">{STRUCTURAL_DISCLAIMER}</p>
    </div>
  );
}
