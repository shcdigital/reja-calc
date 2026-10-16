import { describe, expect, it, vi } from 'vitest';
import { catalog, makeConfig } from '../core/helpers';
import { computeObra, createObra, DEFAULT_BUDGET } from '../core/obra';
import { computeBudget } from '../core/budget';
import { obraFileName } from '../core/document';
import { buildObraPdfBlob, obraPdfFile } from './pdf';
import type { Obra, Reja } from '../core/types';

/** jsPDF falso: registra hojas y textos, sin tocar el navegador. */
const fake = vi.hoisted(() => ({ pages: 1, texts: [] as string[], forged: 0 }));

vi.mock('jspdf', () => {
  class FakeJsPDF {
    private count = 1;
    private current = 1;
    constructor(_opts?: unknown) { fake.pages = 1; fake.texts = []; this.count = 1; this.current = 1; }
    setFont(): void {}
    setFontSize(): void {}
    setTextColor(): void {}
    setFillColor(): void {}
    setDrawColor(): void {}
    rect(): void {}
    splitTextToSize(text: string): string[] { return [text]; }
    text(t: string): void { fake.texts.push(`${this.current}|${t}`); }
    addPage(): void { this.count += 1; this.current = this.count; fake.pages = this.count; }
    getNumberOfPages(): number { return this.count; }
    setPage(p: number): void { this.current = p; }
    output(_type: string): Blob { fake.forged += 1; return new Blob(['%PDF-1.3'], { type: 'application/pdf' }); }
  }
  return { jsPDF: FakeJsPDF };
});

function obraWith(overrides: Partial<Parameters<typeof makeConfig>[0]>[]): Obra {
  const base = createObra();
  const rejas: Reja[] = overrides.map((o, i) => ({
    id: `R${i + 1}`,
    name: `Reja ${i + 1}`,
    config: makeConfig(o),
    labor: { mode: 'hours', hours: 0, fixedAmount: 0 },
  }));
  return { ...base, name: 'Obra prueba', rejas, activeRejaId: 'R1' };
}

const budgetOf = (obra: Obra) =>
  computeBudget(computeObra(obra, catalog), { ...DEFAULT_BUDGET, consumables: { ...DEFAULT_BUDGET.consumables } });

describe('PDF de la obra', () => {
  it('con varias rejas: una hoja por reja y hojas propias para lista y plan de cortes', async () => {
    const obra = obraWith([{}, {}]);
    await buildObraPdfBlob(obra, computeObra(obra, catalog), budgetOf(obra));

    // 1: Reja 1 (+ plano), 2: Reja 2 (+ plano), 3: lista de cortes, 4: plan de cortes, 5: materiales
    expect(fake.pages).toBe(5);
    expect(fake.texts.some((t) => t.startsWith('1|Reja 1 —'))).toBe(true);
    expect(fake.texts.some((t) => t.startsWith('2|Reja 2 —'))).toBe(true);
    expect(fake.texts).toContain('1|Plano de Reja 1');
    expect(fake.texts).toContain('3|Lista de cortes');
    expect(fake.texts).toContain('4|Plan de cortes');
    expect(fake.texts).toContain('5|Materiales de la obra');
  });

  it('escribe el pie con la obra y el número de página en todas las hojas', async () => {
    const obra = obraWith([{}, {}]);
    await buildObraPdfBlob(obra, computeObra(obra, catalog), budgetOf(obra));
    const total = fake.pages;
    for (let p = 1; p <= total; p++) expect(fake.texts).toContain(`${p}|Obra prueba — página ${p} de ${total}`);
  });

  it('con una sola reja no agrega una hoja de más', async () => {
    const obra = obraWith([{}]);
    await buildObraPdfBlob(obra, computeObra(obra, catalog), budgetOf(obra));
    // 1: Reja 1 (+ plano), 2: lista de cortes, 3: plan de cortes, 4: materiales
    expect(fake.pages).toBe(4);
  });

  it('el PDF para compartir es un archivo con el nombre de la obra', async () => {
    const obra = obraWith([{}, {}]);
    const file = await obraPdfFile(obra, computeObra(obra, catalog), budgetOf(obra));
    expect(file.type).toBe('application/pdf');
    expect(file.name).toBe(obraFileName(obra));
    expect(file.size).toBeGreaterThan(0);
  });
});
