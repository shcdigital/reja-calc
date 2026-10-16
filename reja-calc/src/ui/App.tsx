import { useEffect, useMemo, useState } from 'react';
import { computeBudget } from '../core/budget';
import { buildShareSummary, obraFileName } from '../core/document';
import { cutListCsv, download, downloadBlob, materialsCsv } from '../core/exporters';
import { fmtInt, fmtMeters, fmtMm, fmtMoney, fmtPct } from '../core/format';
import { STRUCTURAL_DISCLAIMER } from '../core/geometry';
import { applyPlanToInventory } from '../core/inventory';
import {
  addReja, computeObra, configWithCutting, createObra, duplicateReja, makeId, removeReja, renameReja, selectReja,
  CATALOG_KEY, INVENTORY_KEY, UNIT_KEY,
} from '../core/obra';
import {
  DEFAULT_CATALOG, depthDim, findRect, findRound, inPlaneDim, isValidRect,
  isValidRound, profileLabel, recommendFrameProfile, sectionKey,
} from '../core/profiles';
import type {
  Catalog, Issue, LaborMode, ObraCuttingConfig, Offcut, Orientation, ProjectConfig, RejaLabor, RectProfile,
} from '../core/types';
import { CutPlanView } from './CutPlanView';
import heroReja from '../assets/hero-reja.svg';
import { NumField } from './NumField';
import { downloadObraPdf, obraPdfFile } from './pdf';
import { Preview } from './Preview';
import { useObra } from './useObra';
import { usePersistentState } from './usePersistentState';
import { ObraWorksheet } from './Worksheet';

type Area = 'materials' | 'cuts' | 'worksheet';

function IssueList({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) return null;
  return (
    <ul className="issues">
      {issues.map((i, n) => (
        <li key={n} className={`issue issue-${i.level}`} role={i.level === 'error' ? 'alert' : undefined}>
          <b>{i.level === 'error' ? 'Error' : i.level === 'warning' ? 'Atención' : 'Nota'}:</b> {i.message}
        </li>
      ))}
    </ul>
  );
}

function OrientationSelect({ profile, value, onChange, label }: { profile: RectProfile | undefined; value: Orientation; onChange: (o: Orientation) => void; label: string }) {
  const a = profile ? Math.min(profile.aMm, profile.bMm) : 0;
  const b = profile ? Math.max(profile.aMm, profile.bMm) : 0;
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as Orientation)}>
        <option value="minor">{a} mm a la vista · {b} mm hacia afuera</option>
        <option value="major">{b} mm a la vista · {a} mm hacia afuera</option>
      </select>
    </label>
  );
}

export function App() {
  const [obra, setObra] = useObra();
  const [catalog, setCatalog] = usePersistentState<Catalog>(CATALOG_KEY, DEFAULT_CATALOG, (s, i) => (s && typeof s === 'object' && Array.isArray((s as Catalog).round) && Array.isArray((s as Catalog).rect) ? (s as Catalog) : i));
  const [inventory, setInventory] = usePersistentState<Offcut[]>(INVENTORY_KEY, [], (s) => (Array.isArray(s) ? (s as Offcut[]) : []));
  const [unit, setUnit] = usePersistentState<'mm' | 'cm'>(UNIT_KEY, 'mm');
  const [newOff, setNewOff] = useState<{ key: string; len: number }>({ key: '', len: 500 });
  const [planScope, setPlanScope] = useState<'obra' | 'reja'>('obra');
  const [flash, setFlash] = useState('');

  const setConfig = (fn: (c: ProjectConfig) => void) => setObra((p) => ({
    ...p,
    rejas: p.rejas.map((r) => {
      if (r.id !== p.activeRejaId) return r;
      const n = structuredClone(r.config);
      fn(n);
      return { ...r, config: n };
    }),
  }));
  const setCutting = (fn: (c: ObraCuttingConfig) => void) => setObra((p) => {
    const n = structuredClone(p.cutting);
    fn(n);
    return { ...p, cutting: n };
  });
  const setBudget = (fn: (b: typeof obra.budget) => void) => setObra((p) => {
    const n = structuredClone(p.budget);
    fn(n);
    return { ...p, budget: n };
  });
  const setLabor = (id: string, fn: (l: RejaLabor) => void) => setObra((p) => ({
    ...p,
    rejas: p.rejas.map((r) => {
      if (r.id !== id) return r;
      const n = structuredClone(r.labor);
      fn(n);
      return { ...r, labor: n };
    }),
  }));
  const setCat = (fn: (c: Catalog) => void) => setCatalog((p) => { const n = structuredClone(p); fn(n); return n; });

  const result = useMemo(() => computeObra(obra, catalog, inventory), [obra, catalog, inventory]);
  const budget = useMemo(() => computeBudget(result, obra.budget), [result, obra.budget]);

  const active = obra.rejas.find((r) => r.id === obra.activeRejaId) ?? obra.rejas[0];
  const activeResult = result.rejas.find((r) => r.reja.id === active.id)!;
  const config = activeResult?.config ?? configWithCutting(active.config, obra.cutting);
  const design = activeResult.design;
  const scale = unit === 'cm' ? 10 : 1;

  useEffect(() => {
    const clear = () => { delete document.body.dataset.printing; };
    window.addEventListener('afterprint', clear);
    return () => window.removeEventListener('afterprint', clear);
  }, []);
  useEffect(() => { if (flash) { const t = setTimeout(() => setFlash(''), 3500); return () => clearTimeout(t); } }, [flash]);

  const print = (area: Area) => { document.body.dataset.printing = area; window.print(); };

  const round = findRound(catalog, config.roundProfileId);
  const frameP = findRect(catalog, config.frame.profileId);
  const reinfP = config.reinforcement.sameAsFrame ? frameP : findRect(catalog, config.reinforcement.profileId);
  const recommended = isValidRound(round) ? recommendFrameProfile(catalog, round) : undefined;
  const allKeys = useMemo(() => [...catalog.round.filter(isValidRound), ...catalog.rect.filter(isValidRect)].map((p) => ({ key: sectionKey(p), label: profileLabel(p) })), [catalog]);

  const errors = design.issues.filter((i) => i.level === 'error');
  const dist = design.distribution;
  const W = config.window.widthMm, H = config.window.heightMm;
  const activePlan = planScope === 'reja' ? activeResult.plan : result.plan;

  /**
   * WhatsApp no permite adjuntar archivos por enlace (`wa.me` no soporta archivos).
   * Por eso el PDF se manda por la Web Share API: en el celular se abre la hoja de
   * compartir del sistema, se elige WhatsApp y el PDF viaja adjunto. Si el navegador
   * no sabe compartir archivos, se descarga el PDF y se abre WhatsApp con el resumen
   * para adjuntarlo con el clip.
   */
  const shareWhatsApp = async () => {
    const title = obra.name || 'Presupuesto de rejas';
    const text = buildShareSummary(obra, result, budget);
    const nav = (typeof navigator !== 'undefined' ? navigator : undefined) as
      | (Navigator & {
          canShare?: (data: { files?: File[] }) => boolean;
          share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
        })
      | undefined;
    try {
      const file = await obraPdfFile(obra, result, budget);
      if (nav?.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title, text });
        return;
      }
      downloadBlob(obraFileName(obra), file);
      setFlash('Se descargó el PDF. En WhatsApp adjuntalo con el clip 📎: el navegador no lo puede adjuntar solo.');
      if (typeof window !== 'undefined') window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return;
      setFlash(`No se pudo compartir el PDF: ${(e as Error).message}`);
    }
  };

  const exportPdf = async () => {
    try {
      await downloadObraPdf(obra, result, budget);
    } catch (e) {
      setFlash(`No se pudo generar el PDF: ${(e as Error).message}`);
    }
  };

  return (
    <div className="app">
      <header className="top" data-area="screen">
        <div className="brand">
          <h1>Rejas de caño estructural</h1>
          <p className="muted">Varias rejas por obra, con despiece, plan de cortes en caños de {fmtMm(obra.cutting.stockLengthMm)}, materiales y presupuesto. Todo se calcula en el navegador.</p>
          <label className="field job">
            <span className="field-label">Nombre de la obra</span>
            <input value={obra.name} onChange={(e) => setObra((p) => ({ ...p, name: e.target.value }))} placeholder="Ej.: Ventana cocina — García" />
          </label>
        </div>
        <img className="hero-art" src={heroReja} alt="Reja de hierro forjado" />
      </header>

      {flash && <div className="flash" role="status" data-area="screen">{flash}</div>}

      <section className="card obra" data-area="screen">
        <div className="card-head">
          <h2>Rejas de la obra ({obra.rejas.length})</h2>
          <button type="button" className="primary" onClick={() => setObra((p) => addReja(p))}>+ Agregar reja</button>
        </div>
        <p className="muted small">Cada reja tiene su propia configuración. Los materiales, los cortes y el presupuesto se suman para toda la obra.</p>
        <ul className="reja-list">
          {obra.rejas.map((r) => {
            const rr = result.rejas.find((x) => x.reja.id === r.id);
            return (
              <li key={r.id} className={`reja-item${r.id === active.id ? ' on' : ''}`}>
                <button type="button" className="reja-pick" aria-pressed={r.id === active.id} onClick={() => setObra((p) => selectReja(p, r.id))}>
                  {rr?.error ? '⚠ ' : ''}{r.name}
                </button>
                <input className="reja-name" aria-label={`Renombrar ${r.name}`} value={r.name} onChange={(e) => setObra((p) => renameReja(p, r.id, e.target.value))} />
                <span className="muted small">{fmtMm(r.config.window.widthMm)} × {fmtMm(r.config.window.heightMm)}</span>
                <button type="button" className="ghost" onClick={() => setObra((p) => duplicateReja(p, r.id))}>Duplicar</button>
                <button type="button" className="ghost" disabled={obra.rejas.length <= 1} onClick={() => { if (confirm(`¿Eliminar «${r.name}»?`)) setObra((p) => removeReja(p, r.id)); }}>Eliminar</button>
              </li>
            );
          })}
        </ul>
      </section>

      <main className="layout">
        <div className="col-inputs" data-area="screen">
          {/* 1 */}
          <section className="card">
            <h2>1. Ventana <span className="muted small">— {active.name}</span></h2>
            <p className="muted small">Medidas exteriores de la reja terminada.</p>
            <div className="seg-toggle" role="group" aria-label="Unidad de ingreso">
              {(['mm', 'cm'] as const).map((u) => (
                <button key={u} type="button" className={unit === u ? 'on' : ''} aria-pressed={unit === u} onClick={() => setUnit(u)}>{u}</button>
              ))}
            </div>
            <div className="row">
              <NumField label="Ancho" suffix={unit} scale={scale} value={W} min={0.0001} onChange={(v) => setConfig((c) => { c.window.widthMm = v; })} />
              <NumField label="Alto" suffix={unit} scale={scale} value={H} min={0.0001} onChange={(v) => setConfig((c) => { c.window.heightMm = v; })} />
            </div>
            <p className="muted small">Se guardan en milímetros: {fmtMm(W)} × {fmtMm(H)}.</p>
          </section>

          {/* 2 */}
          <section className="card">
            <h2>2. Perfiles</h2>
            <label className="field">
              <span className="field-label">Caño redondo de los barrotes</span>
              <select value={config.roundProfileId} onChange={(e) => setConfig((c) => { c.roundProfileId = e.target.value; })}>
                {catalog.round.map((p) => <option key={p.id} value={p.id}>{p.label} (Ø{p.odMm} × {p.thicknessMm})</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Perfil rectangular del marco</span>
              <select value={config.frame.profileId} onChange={(e) => setConfig((c) => { c.frame.profileId = e.target.value; })}>
                {catalog.rect.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </label>
            <OrientationSelect label="Orientación del perfil del marco" profile={frameP} value={config.frame.orientation} onChange={(o) => setConfig((c) => { c.frame.orientation = o; })} />
            {recommended && (
              <p className="hint">
                Recomendado para Ø{round!.odMm} mm: <b>{recommended.profile.label}</b>, con el lado de {Math.max(recommended.profile.aMm, recommended.profile.bMm)} mm hacia afuera (el barrote apoya completo).{' '}
                {(config.frame.profileId !== recommended.profile.id || config.frame.orientation !== recommended.orientation) && (
                  <button type="button" className="link" onClick={() => setConfig((c) => { c.frame.profileId = recommended.profile.id; c.frame.orientation = recommended.orientation; })}>Usar recomendado</button>
                )}
              </p>
            )}
            <label className="check">
              <input type="checkbox" checked={config.reinforcement.enabled} onChange={(e) => setConfig((c) => { c.reinforcement.enabled = e.target.checked; })} />
              Lleva refuerzo central (parante vertical al medio)
            </label>
            {config.reinforcement.enabled && (
              <>
                <label className="check">
                  <input type="checkbox" checked={config.reinforcement.sameAsFrame} onChange={(e) => setConfig((c) => { c.reinforcement.sameAsFrame = e.target.checked; })} />
                  Con el mismo perfil que el marco
                </label>
                {!config.reinforcement.sameAsFrame && (
                  <>
                    <label className="field">
                      <span className="field-label">Perfil del refuerzo central</span>
                      <select value={config.reinforcement.profileId} onChange={(e) => setConfig((c) => { c.reinforcement.profileId = e.target.value; })}>
                        {catalog.rect.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                      </select>
                    </label>
                    <OrientationSelect label="Orientación del refuerzo" profile={reinfP} value={config.reinforcement.orientation} onChange={(o) => setConfig((c) => { c.reinforcement.orientation = o; })} />
                  </>
                )}
              </>
            )}
            <details>
              <summary>Editar medidas comerciales de los perfiles</summary>
              <p className="muted small">Los diámetros y secciones reales pueden variar según el proveedor. Los cambios se guardan en este navegador.</p>
              {catalog.round.map((p, i) => (
                <div className="row" key={p.id}>
                  <label className="field"><span className="field-label">Nombre</span><input value={p.label} onChange={(e) => setCat((c) => { c.round[i].label = e.target.value; })} /></label>
                  <NumField label="Ø exterior" suffix="mm" value={p.odMm} min={0.01} onChange={(v) => setCat((c) => { c.round[i].odMm = v; })} />
                  <NumField label="Espesor" suffix="mm" value={p.thicknessMm} min={0.01} onChange={(v) => setCat((c) => { c.round[i].thicknessMm = v; })} />
                </div>
              ))}
              {catalog.rect.map((p, i) => (
                <div className="row" key={p.id}>
                  <label className="field"><span className="field-label">Nombre</span><input value={p.label} onChange={(e) => setCat((c) => { c.rect[i].label = e.target.value; })} /></label>
                  <NumField label="Lado A" suffix="mm" value={p.aMm} min={0.01} onChange={(v) => setCat((c) => { c.rect[i].aMm = v; })} />
                  <NumField label="Lado B" suffix="mm" value={p.bMm} min={0.01} onChange={(v) => setCat((c) => { c.rect[i].bMm = v; })} />
                  <NumField label="Espesor" suffix="mm" value={p.thicknessMm} min={0.01} onChange={(v) => setCat((c) => { c.rect[i].thicknessMm = v; })} />
                  <button type="button" className="ghost" disabled={catalog.rect.length <= 1 || p.id === config.frame.profileId || (config.reinforcement.enabled && !config.reinforcement.sameAsFrame && p.id === config.reinforcement.profileId)} onClick={() => setCat((c) => { c.rect.splice(i, 1); })}>Quitar</button>
                </div>
              ))}
              <button type="button" className="ghost" onClick={() => setCat((c) => { c.rect.push({ id: `c-${Date.now()}`, kind: 'rect', label: 'Rectangular nuevo', aMm: 50, bMm: 30, thicknessMm: 2 }); })}>Agregar perfil rectangular</button>
              <button type="button" className="ghost" onClick={() => { setCatalog(DEFAULT_CATALOG); }}>Restaurar medidas iniciales</button>
            </details>
          </section>

          {/* 3 */}
          <section className="card">
            <h2>3. Barrotes horizontales</h2>
            <p className="muted small">La separación libre se mide entre superficies de caños consecutivos, incluida la que queda contra el marco.</p>
            <div className="row">
              <NumField label="Separación libre máxima deseada" suffix="mm" value={config.bars.desiredGapMm} min={0.1} onChange={(v) => setConfig((c) => { c.bars.desiredGapMm = v; })} />
              <NumField label="Separación libre mínima" suffix="mm" value={config.bars.minGapMm} min={0.1} onChange={(v) => setConfig((c) => { c.bars.minGapMm = v; })} />
            </div>
            <div className="seg-toggle" role="group" aria-label="Cantidad de barrotes">
              <button type="button" className={config.bars.mode === 'auto' ? 'on' : ''} aria-pressed={config.bars.mode === 'auto'} onClick={() => setConfig((c) => { c.bars.mode = 'auto'; })}>Cantidad automática</button>
              <button type="button" className={config.bars.mode === 'manual' ? 'on' : ''} aria-pressed={config.bars.mode === 'manual'} onClick={() => setConfig((c) => { c.bars.mode = 'manual'; if (dist) c.bars.manualCount = dist.count; })}>Fijar cantidad</button>
            </div>
            {config.bars.mode === 'manual' && (
              <NumField label="Cantidad de barrotes" integer min={1} value={config.bars.manualCount} onChange={(v) => setConfig((c) => { c.bars.manualCount = v; })} />
            )}
            {dist && (
              <div className="result-box">
                <div><b>{dist.count}</b> barrotes</div>
                <div>Separación libre resultante: <b>{fmtMm(Math.round(dist.gapMm * 10) / 10)}</b></div>
                <div className="muted small">Alto interior {fmtMm(dist.innerHeightMm)} = {dist.count} × {fmtMm(design.derived!.barOdMm)} + {dist.count + 1} × separación</div>
                {dist.alternatives.length > 0 && (
                  <div className="alts">Alternativas: {dist.alternatives.map((a) => (
                    <button key={a.count} type="button" className="chip" onClick={() => setConfig((c) => { c.bars.mode = 'manual'; c.bars.manualCount = a.count; })}>{a.count} barrotes · {fmtMm(a.gapMm)}</button>
                  ))}</div>
                )}
              </div>
            )}
          </section>

          {/* 4 */}
          <section className="card">
            <h2>4. Armado y refuerzo</h2>
            <fieldset>
              <legend>Armado del marco</legend>
              <label className="radio"><input type="radio" name="asm" checked={config.frame.assembly === 'horizontal-full'} onChange={() => setConfig((c) => { c.frame.assembly = 'horizontal-full'; })} /> Tramos horizontales completos; los laterales van entre ellos</label>
              <label className="radio"><input type="radio" name="asm" checked={config.frame.assembly === 'vertical-full'} onChange={() => setConfig((c) => { c.frame.assembly = 'vertical-full'; })} /> Laterales completos; los tramos horizontales van entre ellos</label>
            </fieldset>
            {config.reinforcement.enabled ? (
              <fieldset>
                <legend>Barrotes y refuerzo central</legend>
                <label className="radio"><input type="radio" name="crs" checked={config.bars.crossing === 'split'} onChange={() => setConfig((c) => { c.bars.crossing = 'split'; })} /> Dos tramos por barrote, que terminan contra el refuerzo</label>
                <label className="radio"><input type="radio" name="crs" checked={config.bars.crossing === 'through'} onChange={() => setConfig((c) => { c.bars.crossing = 'through'; })} /> Barrote continuo que atraviesa el refuerzo (agujeros)</label>
              </fieldset>
            ) : (
              <p className="hint">Sin refuerzo central: los barrotes van continuos de lateral a lateral, sin agujeros ni cortes al medio.</p>
            )}
            <fieldset>
              <legend>Extremos de los barrotes (laterales)</legend>
              <label className="radio"><input type="radio" name="end" checked={config.bars.ends === 'butt'} onChange={() => setConfig((c) => { c.bars.ends = 'butt'; })} /> A tope contra la cara interior del lateral</label>
              <label className="radio"><input type="radio" name="end" checked={config.bars.ends === 'inserted'} onChange={() => setConfig((c) => { c.bars.ends = 'inserted'; })} /> Entran en un agujero del lateral, centrados y soldados</label>
            </fieldset>
            <div className="row">
              <NumField label="Holgura por unión (por extremo)" suffix="mm" value={config.fabrication.jointGapMm} min={0} hint="Se descuenta en cada extremo que se suelda a tope." onChange={(v) => setConfig((c) => { c.fabrication.jointGapMm = v; })} />
              {((config.reinforcement.enabled && config.bars.crossing === 'through') || config.bars.ends === 'inserted') && (
                <NumField label="Holgura del agujero" suffix="mm" value={config.fabrication.throughHoleClearanceMm} min={0} hint="Diámetro del agujero = caño + esta holgura." onChange={(v) => setConfig((c) => { c.fabrication.throughHoleClearanceMm = v; })} />
              )}
              {config.bars.ends === 'inserted' && (
                <NumField label="Freno de la punta" suffix="mm" value={config.fabrication.socketSetbackMm} min={0} hint="Cuánto se frena la punta antes de la cara opuesta del lateral." onChange={(v) => setConfig((c) => { c.fabrication.socketSetbackMm = v; })} />
              )}
            </div>
            {config.bars.ends === 'inserted' && design.derived && (
              <p className="hint">El barrote entra {fmtMm(design.derived.lateralPenetrationMm)} en cada lateral por un agujero Ø{fmtMm(design.derived.lateralHoleMm)} y se frena a {fmtMm(config.fabrication.socketSetbackMm)} de la cara exterior, que queda lisa. Largo del barrote continuo: {fmtMm(W - 2 * (design.derived.frameInPlaneMm - design.derived.lateralPenetrationMm))}.</p>
            )}
            <p className="hint">{STRUCTURAL_DISCLAIMER}</p>
          </section>

          {/* 5 */}
          <section className="card">
            <h2>5. Parámetros de corte (obra)</h2>
            <p className="muted small">Valen para todas las rejas: se compran los mismos caños y se cortan con el mismo disco.</p>
            <div className="row">
              <NumField label="Disco de corte" suffix="mm" value={obra.cutting.kerfMm} min={0} onChange={(v) => setCutting((c) => { c.kerfMm = v; })} />
              <NumField label="Largo comercial" suffix="mm" value={obra.cutting.stockLengthMm} min={1} onChange={(v) => setCutting((c) => { c.stockLengthMm = v; })} />
            </div>
            <div className="row">
              <NumField label="Refilado de punta" suffix="mm" value={obra.cutting.endTrimMm} min={0} hint="Se pierde en una punta de cada caño nuevo." onChange={(v) => setCutting((c) => { c.endTrimMm = v; })} />
              <NumField label="Largo mínimo para guardar un sobrante" suffix="mm" value={obra.cutting.minReusableMm} min={0} onChange={(v) => setCutting((c) => { c.minReusableMm = v; })} />
            </div>
            <label className="check">
              <input type="checkbox" checked={obra.cutting.reuseOffcuts} onChange={(e) => setCutting((c) => { c.reuseOffcuts = e.target.checked; })} />
              Reutilizar sobrantes del inventario (solo de la misma sección; cada pieza sale de un único sobrante)
            </label>
          </section>
        </div>

        <div className="col-preview" data-area="screen">
          <section className="card sticky">
            <h2>6. Vista previa <span className="muted small">— {active.name}</span></h2>
            <IssueList issues={design.issues} />
            {errors.length === 0 && <Preview design={design} width={W} height={H} />}
            {errors.length === 0 && design.derived && (
              <dl className="facts">
                <div><dt>Vano interior</dt><dd>{fmtMm(design.derived.innerWidthMm)} × {fmtMm(design.derived.innerHeightMm)}</dd></div>
                <div><dt>Marco a la vista</dt><dd>{fmtMm(design.derived.frameInPlaneMm)} ({fmtMm(design.derived.frameDepthMm)} de profundidad)</dd></div>
                {design.derived.withReinforcement
                  ? <div><dt>Refuerzo central</dt><dd>{fmtMm(design.derived.reinfInPlaneMm)} a la vista · sector {fmtMm(design.derived.sectorWidthMm)}</dd></div>
                  : <div><dt>Refuerzo central</dt><dd>No lleva</dd></div>}
                <div><dt>Extremos de los barrotes</dt><dd>{design.derived.barsInLateral
                  ? `Entran ${fmtMm(design.derived.lateralPenetrationMm)} en cada lateral (agujero Ø${fmtMm(design.derived.lateralHoleMm)})`
                  : 'A tope contra la cara interior del lateral'}</dd></div>
              </dl>
            )}
          </section>
        </div>
      </main>

      {result.hasAnyValid && (
        <>
          {/* 7 */}
          <section className="card wide" data-area="materials">
            <div className="card-head">
              <h2>7. Lista de materiales (obra)</h2>
              <button type="button" className="ghost no-print" onClick={() => print('materials')}>Imprimir lista</button>
            </div>
            <p className="muted small">Consolidado de {result.valid.length} reja(s). Los caños se compran una vez para toda la obra.</p>
            <div className="table-wrap">
              <table className="grid">
                <thead>
                  <tr>
                    <th>Material</th><th>Largo comercial</th><th>Caños a comprar</th><th>Piezas</th><th>Suma de piezas</th>
                    <th>Total comprado</th><th>Pérdida por disco</th><th>Refilado</th><th>Sobrante</th><th>Aprovechamiento</th>
                  </tr>
                </thead>
                <tbody>
                  {result.materials.map((m) => (
                    <tr key={m.sectionKey}>
                      <td>{m.profileLabel}</td>
                      <td className="num">{fmtInt(m.stockLengthMm)} mm</td>
                      <td className="num"><b>{m.newBarsCount}</b>{m.offcutsUsedCount > 0 && <small> + {m.offcutsUsedCount} sobrante{m.offcutsUsedCount > 1 ? 's' : ''}</small>}</td>
                      <td className="num">{m.piecesCount}</td>
                      <td className="num">{fmtMeters(m.piecesLengthMm)}</td>
                      <td className="num">{fmtMeters(m.purchasedMm)}</td>
                      <td className="num">{fmtMm(Math.round(m.kerfLossMm * 10) / 10)}</td>
                      <td className="num">{fmtMm(m.trimLossMm)}</td>
                      <td className="num">{fmtMeters(m.leftoverMm)}</td>
                      <td className="num"><b>{fmtPct(m.utilization)}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted small">Aprovechamiento = suma de piezas ÷ material empleado (caños nuevos + sobrantes usados). El material empleado se reparte exactamente en piezas, pérdidas por disco, refilado y sobrante final.</p>
          </section>

          {/* 8 */}
          <section className="card wide" data-area="cuts">
            <div className="card-head">
              <h2>8. Plan de cortes (obra)</h2>
              <button type="button" className="ghost no-print" onClick={() => print('cuts')}>Imprimir plan</button>
            </div>
            <div className="seg-toggle no-print" role="group" aria-label="Alcance del plan">
              <button type="button" className={planScope === 'obra' ? 'on' : ''} aria-pressed={planScope === 'obra'} onClick={() => setPlanScope('obra')}>Toda la obra</button>
              <button type="button" className={planScope === 'reja' ? 'on' : ''} aria-pressed={planScope === 'reja'} onClick={() => setPlanScope('reja')}>Solo {active.name}</button>
            </div>
            <IssueList issues={result.issues} />
            {activePlan ? <CutPlanView plan={activePlan} activeRejaId={active.id} scope={planScope} /> : <p className="empty">No hay caños que cortar todavía.</p>}
            <p className="muted small">Un mismo caño puede contener piezas de varias rejas (se marcan en otro tono). La compra y el corte del taller usan el plan de toda la obra.</p>
            <details className="no-print" open={obra.cutting.reuseOffcuts || inventory.length > 0}>
              <summary>Sobrantes para futuros trabajos ({inventory.length})</summary>
              {inventory.length === 0 ? <p className="empty">Todavía no guardaste sobrantes.</p> : (
                <ul className="inv">
                  {inventory.map((o) => (
                    <li key={o.id}><span><b>{fmtMm(o.lengthMm)}</b> · {o.profileLabel}<br /><small className="muted">{o.origin}</small></span>
                      <button type="button" className="ghost" onClick={() => setInventory((inv) => inv.filter((x) => x.id !== o.id))}>Quitar</button></li>
                  ))}
                </ul>
              )}
              <div className="row">
                <label className="field"><span className="field-label">Agregar a mano: perfil</span>
                  <select value={newOff.key || allKeys[0]?.key} onChange={(e) => setNewOff((n) => ({ ...n, key: e.target.value }))}>
                    {allKeys.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
                  </select></label>
                <NumField label="Largo" suffix="mm" value={newOff.len} min={1} onChange={(v) => setNewOff((n) => ({ ...n, len: v }))} />
                <button type="button" className="ghost" onClick={() => {
                  const key = newOff.key || allKeys[0]?.key; const k = allKeys.find((x) => x.key === key);
                  if (!k || !(newOff.len > 0)) return;
                  setInventory((inv) => [...inv, { id: makeId(), sectionKey: k.key, profileLabel: k.label, lengthMm: newOff.len, origin: 'Cargado a mano', createdAt: new Date().toISOString() }]);
                }}>Agregar</button>
              </div>
              <button type="button" className="primary" disabled={!result.plan} onClick={() => {
                if (!result.plan) return;
                const next = applyPlanToInventory(inventory, result.plan, obra.name || 'Sin nombre', () => makeId(), new Date().toISOString());
                setInventory(next);
                setFlash('Sobrantes de la obra guardados. Los sobrantes que se usaron salieron del inventario.');
              }}>Guardar sobrantes de la obra</button>
              <p className="muted small">Al guardar, se descuentan del inventario los sobrantes usados y se registran los que quedan con largo ≥ {fmtMm(obra.cutting.minReusableMm)}. No guardes el mismo plan dos veces.</p>
            </details>
          </section>

          {/* 9 */}
          <section className="card wide" data-area="screen">
            <h2>9. Presupuesto y exportación (obra)</h2>
            <label className="check">
              <input type="checkbox" checked={obra.budget.enabled} onChange={(e) => setBudget((b) => { b.enabled = e.target.checked; })} />
              Calcular presupuesto de la obra (con precios que cargues vos)
            </label>
            {obra.budget.enabled && (
              <>
                <div className="row">
                  {result.materials.map((m) => (
                    <NumField key={m.sectionKey} label={`Precio por caño: ${m.profileLabel}`} suffix="$" value={obra.budget.pricePerBar[m.sectionKey] ?? 0} min={0} onChange={(v) => setBudget((b) => { b.pricePerBar[m.sectionKey] = v; })} />
                  ))}
                </div>
                <div className="row">
                  <NumField label="Discos de corte" suffix="$" value={obra.budget.consumables.discsCost} min={0} onChange={(v) => setBudget((b) => { b.consumables.discsCost = v; })} />
                  <NumField label="Pintura" suffix="$" value={obra.budget.consumables.paintCost} min={0} onChange={(v) => setBudget((b) => { b.consumables.paintCost = v; })} />
                  <NumField label="Otros consumibles" suffix="$" value={obra.budget.consumables.otherConsumablesCost} min={0} onChange={(v) => setBudget((b) => { b.consumables.otherConsumablesCost = v; })} />
                  <NumField label="Valor hora de mano de obra" suffix="$" value={obra.budget.laborRatePerHour} min={0} onChange={(v) => setBudget((b) => { b.laborRatePerHour = v; })} />
                </div>
                <fieldset>
                  <legend>Mano de obra por reja</legend>
                  {obra.rejas.map((r) => (
                    <div className="row" key={r.id}>
                      <label className="field"><span className="field-label">{r.name}: modo</span>
                        <select value={r.labor.mode} onChange={(e) => setLabor(r.id, (l) => { l.mode = e.target.value as LaborMode; })}>
                          <option value="hours">Por horas</option>
                          <option value="fixed">Monto fijo</option>
                        </select>
                      </label>
                      {r.labor.mode === 'hours'
                        ? <NumField label="Horas estimadas" suffix="h" value={r.labor.hours} min={0} onChange={(v) => setLabor(r.id, (l) => { l.hours = v; })} />
                        : <NumField label="Mano de obra" suffix="$" value={r.labor.fixedAmount} min={0} onChange={(v) => setLabor(r.id, (l) => { l.fixedAmount = v; })} />}
                      <span className="muted small">{fmtMoney(budget.laborLines.find((l) => l.rejaId === r.id)?.amount ?? 0)}</span>
                    </div>
                  ))}
                </fieldset>
                {budget.hasAnyValue ? (
                  <div className="result-box">
                    {budget.materialsLines.map((l) => <div key={l.sectionKey}>{l.profileLabel}: {l.bars} × {l.unitPrice === undefined ? 'sin precio' : fmtMoney(l.unitPrice)}{l.subtotal !== undefined && <> = <b>{fmtMoney(l.subtotal)}</b></>}</div>)}
                    <div>Consumibles: {fmtMoney(budget.consumables)} · Mano de obra: {fmtMoney(budget.laborSubtotal)}</div>
                    <div className="total">Total de la obra: <b>{fmtMoney(budget.total)}</b></div>
                    {budget.partial && <div className="warn small">Presupuesto parcial: falta precio de {budget.missingPrices.join('; ')}. El total no los incluye.</div>}
                    {!budget.partial && budget.missingPrices.length > 0 && <div className="warn small">Sin caños a comprar de: {budget.missingPrices.join('; ')}.</div>}
                  </div>
                ) : <p className="empty">Cargá precios para ver el presupuesto. Mientras tanto se muestran solo cantidades y longitudes.</p>}
              </>
            )}
            <div className="actions">
              <button type="button" className="primary" onClick={() => print('worksheet')}>Hoja de taller (imprimir)</button>
              <button type="button" className="primary" onClick={exportPdf}>Descargar PDF</button>
              <button type="button" className="ghost" onClick={shareWhatsApp}>Enviar PDF por WhatsApp</button>
              <button type="button" className="ghost" disabled={!result.plan} onClick={() => result.plan && download('cortes.csv', cutListCsv(result.pieces, result.plan))}>Cortes (CSV)</button>
              <button type="button" className="ghost" onClick={() => download('materiales.csv', materialsCsv(result.materials))}>Materiales (CSV)</button>
            </div>
            <p className="muted small">El PDF es la <b>misma hoja de taller</b>: se genera desde ese HTML, así que sale idéntico a la impresión (datos de armado y plano por reja, lista de cortes, plan de cortes, materiales y presupuesto). «Enviar PDF por WhatsApp» manda ese mismo archivo; si el navegador no lo permite, lo descarga para que lo adjuntes con el clip. Los CSV usan «;» y coma decimal, para abrirlos directo en Excel en español.</p>
          </section>

          <ObraWorksheet obra={obra} result={result} budget={budget} />
        </>
      )}

      {!result.hasAnyValid && (
        <section className="card wide" data-area="screen">
          <h2>No se puede calcular todavía</h2>
          <IssueList issues={design.issues} />
          <p className="muted small">Revisá las medidas de la reja activa («{active.name}»).</p>
        </section>
      )}

      <footer className="foot" data-area="screen">
        <button type="button" className="link" onClick={() => { if (confirm('¿Restaurar todos los valores iniciales? Se conservan los sobrantes guardados.')) { setObra(createObra()); setCatalog(DEFAULT_CATALOG); } }}>Restaurar valores iniciales</button>
        <span className="muted small">Marco a la vista {frameP ? fmtMm(inPlaneDim(frameP, config.frame.orientation)) : '—'}{frameP ? `, ${fmtMm(depthDim(frameP, config.frame.orientation))} de profundidad` : ''}.</span>
      </footer>
    </div>
  );
}
