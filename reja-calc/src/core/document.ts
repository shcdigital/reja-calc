/**
 * Documento de obra: nombre de archivo, resumen para compartir y contenido del PDF.
 * Funciones puras (sin DOM ni librerías) para poder probarlas.
 */
import { groupPieces, PIECE_TYPE_LABEL, STRUCTURAL_DISCLAIMER } from './geometry';
import { fmtInt, fmtMeters, fmtMm, fmtMoney, fmtPct } from './format';
import type { BudgetResult } from './budget';
import type { ObraResult } from './obra';
import type { Obra } from './types';

/** Convertible a nombre de archivo: sin acentos, minúsculas y con guiones. */
export function slugify(name: string): string {
  const s = (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s.slice(0, 60) || 'obra';
}

export function obraFileName(obra: Obra, ext = 'pdf'): string {
  return `${slugify(obra.name || 'obra')}.${ext}`;
}

export interface DocLine {
  kind: 'title' | 'h2' | 'sub' | 'text' | 'pagebreak' | 'plano';
  text: string;
  /** Solo en las líneas `plano`: reja a la que corresponde el dibujo. */
  rejaId?: string;
}

/** Marca de salto de página para el PDF. */
const BREAK: DocLine = { kind: 'pagebreak', text: '' };

const dims = (result: ObraResult) =>
  result.valid.length === 0
    ? 'sin rejas válidas'
    : result.valid.map((r) => `${r.reja.name} (${fmtMm(r.config.window.widthMm)} × ${fmtMm(r.config.window.heightMm)})`).join(' · ');

/** Resumen de texto de la obra para WhatsApp / compartir. */
export function buildShareSummary(obra: Obra, result: ObraResult, budget?: BudgetResult): string {
  const lines: string[] = [];
  lines.push(`Obra: ${obra.name || 'Sin nombre'}`);
  for (const r of result.rejas) {
    const w = r.config.window.widthMm;
    const h = r.config.window.heightMm;
    lines.push(`- ${r.reja.name}: ${fmtMm(w)} × ${fmtMm(h)}${r.error ? ' (con errores, no incluida)' : ''}`);
  }

  if (result.materials.length > 0) {
    lines.push('');
    lines.push('Materiales:');
    for (const m of result.materials) {
      lines.push(`- ${m.profileLabel}: ${m.newBarsCount} × ${fmtMm(m.stockLengthMm)}`);
    }
  }

  lines.push('');
  if (!budget || !budget.enabled || !budget.hasAnyValue) {
    lines.push('Presupuesto: no cargado.');
  } else {
    lines.push('Presupuesto:');
    lines.push(`- Materiales: ${fmtMoney(budget.materialsSubtotal)}`);
    lines.push(`- Consumibles: ${fmtMoney(budget.consumables)}`);
    lines.push(`- Mano de obra: ${fmtMoney(budget.laborSubtotal)}`);
    lines.push(`Total: ${fmtMoney(budget.total)}`);
    if (budget.partial) {
      lines.push(`Presupuesto parcial: falta precio de ${budget.missingPrices.join('; ')}.`);
    } else if (budget.missingPrices.length > 0) {
      lines.push(`Falta precio de ${budget.missingPrices.join('; ')}.`);
    }
  }
  return lines.join('\n');
}

/** Contenido del documento de obra, como líneas tipadas (para el PDF). */
export function buildObraDocument(obra: Obra, result: ObraResult, budget: BudgetResult | undefined, dateStr: string): DocLine[] {
  const lines: DocLine[] = [];
  lines.push({ kind: 'title', text: obra.name || 'Obra sin nombre' });
  lines.push({ kind: 'text', text: `Fecha: ${dateStr} · ${result.valid.length} reja(s)` });

  lines.push({ kind: 'h2', text: 'Rejas' });
  if (result.valid.length === 0) {
    lines.push({ kind: 'text', text: 'No hay rejas válidas para calcular.' });
  }
  result.valid.forEach((r, i) => {
    // Cada reja arranca en su propia hoja para que no se mezclen los despieces.
    if (i > 0) lines.push(BREAK);
    const d = r.design;
    const w = r.config.window.widthMm;
    const h = r.config.window.heightMm;
    lines.push({ kind: 'sub', text: `${r.reja.name} — ${fmtMm(w)} × ${fmtMm(h)}` });
    if (d.derived && d.distribution) {
      lines.push({
        kind: 'text',
        text: `Marco a la vista ${fmtMm(d.derived.frameInPlaneMm)}${d.derived.horizontalRound ? ` (MS/MI de caño redondo Ø${fmtMm(d.derived.frameHorizontalMm)}, agujeros a ${fmtMm(d.derived.horizontalEdgeMm)} mm del borde)` : ''} · vano ${fmtMm(d.derived.innerWidthMm)} × ${fmtMm(d.derived.innerHeightMm)} · ${d.distribution.count} barrotes (separación ${fmtMm(Math.round(d.distribution.gapMm * 10) / 10)})`,
      });
    }
    lines.push({ kind: 'plano', text: `Plano de ${r.reja.name}`, rejaId: r.reja.id });
  });

  // Lista de cortes: fuente de la hoja de taller; arranca en su propia hoja.
  if (result.valid.length > 0) {
    lines.push(BREAK);
    lines.push({ kind: 'h2', text: 'Lista de cortes' });
    for (const r of result.valid) {
      lines.push({ kind: 'sub', text: r.reja.name });
      for (const g of groupPieces(r.design.pieces)) {
        lines.push({
          kind: 'text',
          text: `  ${g.quantity} × ${PIECE_TYPE_LABEL[g.type]} — ${g.profileLabel} — ${fmtMm(g.lengthMm)}`,
        });
      }
    }
  }

  // Plan de cortes de la obra (qué sale de cada caño); arranca en su propia hoja.
  if (result.plan && result.plan.sections.length > 0) {
    lines.push(BREAK);
    lines.push({ kind: 'h2', text: 'Plan de cortes' });
    for (const s of result.plan.sections) {
      lines.push({
        kind: 'sub',
        text: `${s.profileLabel} — comprar ${s.newBarsCount} caño(s) de ${fmtMm(s.stockLengthMm)}`,
      });
      for (const b of s.bins) {
        const name = b.source.kind === 'new' ? `Caño ${b.index}` : `Sobrante ${b.index}`;
        const items = b.items
          .map((it) => `${it.localId ?? it.pieceId} (${Math.round(it.lengthMm * 10) / 10})`)
          .join(' · ');
        lines.push({
          kind: 'text',
          text: `${name}: ${items} — sobra ${fmtMm(b.leftoverMm)}${b.leftoverReusable ? ' (reutilizable)' : ''}`,
        });
      }
    }
  }

  // El resumen de la obra (materiales y presupuesto) va en su propia hoja.
  if (result.valid.length > 0) lines.push(BREAK);
  lines.push({ kind: 'h2', text: 'Materiales de la obra' });
  if (result.materials.length === 0) {
    lines.push({ kind: 'text', text: 'Sin materiales.' });
  }
  for (const m of result.materials) {
    lines.push({
      kind: 'text',
      text: `${m.profileLabel}: ${m.newBarsCount} caño(s) de ${fmtMm(m.stockLengthMm)} · piezas ${fmtMeters(m.piecesLengthMm)} · aprovechamiento ${fmtPct(m.utilization)}`,
    });
  }

  if (budget && budget.enabled) {
    lines.push({ kind: 'h2', text: 'Presupuesto' });
    if (budget.hasAnyValue) {
      for (const l of budget.materialsLines) {
        lines.push({
          kind: 'text',
          text: `${l.profileLabel}: ${l.bars} × ${l.unitPrice === undefined ? 'sin precio' : fmtMoney(l.unitPrice)}${l.subtotal !== undefined ? ` = ${fmtMoney(l.subtotal)}` : ''}`,
        });
      }
      lines.push({ kind: 'text', text: `Consumibles: ${fmtMoney(budget.consumables)}` });
      for (const l of budget.laborLines) {
        lines.push({ kind: 'text', text: `Mano de obra — ${l.rejaName}: ${fmtMoney(l.amount)}` });
      }
      lines.push({ kind: 'text', text: `Total: ${fmtMoney(budget.total)}` });
      if (budget.partial) {
        lines.push({ kind: 'text', text: `Presupuesto parcial: falta precio de ${budget.missingPrices.join('; ')}.` });
      }
    } else {
      lines.push({ kind: 'text', text: 'Sin precios cargados.' });
    }
  }

  lines.push({ kind: 'h2', text: 'Aviso' });
  lines.push({ kind: 'text', text: STRUCTURAL_DISCLAIMER });
  lines.push({ kind: 'text', text: `Rejas: ${dims(result)}` });
  lines.push({ kind: 'text', text: `Total de caños a comprar: ${fmtInt(result.materials.reduce((a, m) => a + m.newBarsCount, 0))}` });
  return lines;
}
