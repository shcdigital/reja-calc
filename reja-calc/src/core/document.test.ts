import { describe, expect, it } from 'vitest';
import { catalog, makeConfig } from './helpers';
import { computeObra, createObra, DEFAULT_BUDGET } from './obra';
import { computeBudget } from './budget';
import { buildObraDocument, buildShareSummary, obraFileName, slugify } from './document';
import { findRect, sectionKey } from './profiles';
import type { Obra } from './types';

const rectKey = sectionKey(findRect(catalog, 'c-40x20')!);

function obraTwo(): Obra {
  const base = createObra();
  const rejas = [0, 1].map((i) => ({
    id: `R${i + 1}`,
    name: `Reja ${i + 1}`,
    config: makeConfig(),
    labor: { mode: 'hours' as const, hours: 1, fixedAmount: 0 },
  }));
  return { ...base, name: 'Cocina García', rejas, activeRejaId: 'R1' };
}

describe('Nombre de archivo', () => {
  it('quita acentos, eñes y símbolos', () => {
    expect(slugify('Reja cocina — García')).toBe('reja-cocina-garcia');
    expect(slugify('Ñandú 3/4"')).toBe('nandu-3-4');
    expect(slugify('')).toBe('obra');
  });

  it('arma el nombre del PDF desde el nombre de la obra', () => {
    const obra = obraTwo();
    expect(obraFileName(obra)).toBe('cocina-garcia.pdf');
  });
});

describe('Resumen para compartir', () => {
  it('incluye obra, rejas, medidas y total cuando hay precios', () => {
    const obra = obraTwo();
    const result = computeObra(obra, catalog);
    const b = computeBudget(result, { ...DEFAULT_BUDGET, consumables: { ...DEFAULT_BUDGET.consumables }, enabled: true, pricePerBar: { [rectKey]: 10000 }, laborRatePerHour: 1000 });
    const text = buildShareSummary(obra, result, b);
    expect(text).toContain('Obra: Cocina García');
    expect(text).toContain('Reja 1');
    expect(text).toContain('Total:');
  });

  it('sin presupuesto no muestra un total incorrecto', () => {
    const obra = obraTwo();
    const result = computeObra(obra, catalog);
    const text = buildShareSummary(obra, result);
    expect(text).toContain('Presupuesto: no cargado.');
    expect(text).not.toContain('Total:');
  });
});

describe('Documento de obra', () => {
  it('arma las líneas con todas las rejas, la lista y el plan de cortes, y el aviso', () => {
    const obra = obraTwo();
    const result = computeObra(obra, catalog);
    const lines = buildObraDocument(obra, result, undefined, '2026-10-16');
    const all = lines.map((l) => l.text).join('\n');
    expect(lines[0]).toEqual({ kind: 'title', text: 'Cocina García' });
    expect(all).toContain('Reja 1');
    expect(all).toContain('Reja 2');
    expect(all).toContain('Lista de cortes');
    expect(all).toContain('Plan de cortes');
    expect(all).toContain('Caño 1');
    expect(all).toContain('Materiales de la obra');
    expect(all.toLowerCase()).toContain('no verifica');
  });

  it('cada reja arranca en su propia hoja e incluye su plano', () => {
    const obra = obraTwo();
    const result = computeObra(obra, catalog);
    const lines = buildObraDocument(obra, result, undefined, '2026-10-16');
    const iReja2 = lines.findIndex((l) => l.text.startsWith('Reja 2 —'));
    expect(lines[iReja2 - 1].kind).toBe('pagebreak');
    const planos = lines.filter((l) => l.kind === 'plano');
    expect(planos.map((l) => l.rejaId)).toEqual(['R1', 'R2']);
  });

  it('la lista de cortes, el plan de cortes y los materiales arrancan en hoja nueva', () => {
    const obra = obraTwo();
    const result = computeObra(obra, catalog);
    const lines = buildObraDocument(obra, result, undefined, '2026-10-16');
    for (const title of ['Lista de cortes', 'Plan de cortes', 'Materiales de la obra']) {
      const i = lines.findIndex((l) => l.text === title);
      expect(i, title).toBeGreaterThan(0);
      expect(lines[i - 1].kind, title).toBe('pagebreak');
    }
  });

  it('con una sola reja no corta antes de la primera', () => {
    const base = obraTwo();
    const obra = { ...base, rejas: [base.rejas[0]], activeRejaId: 'R1' };
    const result = computeObra(obra, catalog);
    const lines = buildObraDocument(obra, result, undefined, '2026-10-16');
    const iReja1 = lines.findIndex((l) => l.text.startsWith('Reja 1 —'));
    const iMateriales = lines.findIndex((l) => l.text === 'Materiales de la obra');
    expect(lines[0].kind).toBe('title');
    expect(lines[iReja1 - 1].text).toBe('Rejas'); // sin salto antes de la primera reja
    expect(lines[iMateriales - 1].kind).toBe('pagebreak');
  });
});
