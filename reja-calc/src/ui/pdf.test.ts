import { describe, expect, it, vi } from 'vitest';
import { catalog, makeConfig } from '../core/helpers';
import { computeObra, createObra, DEFAULT_BUDGET } from '../core/obra';
import { computeBudget } from '../core/budget';
import { obraFileName } from '../core/document';
import { buildObraPdfBlob, obraPdfFile, planSlices } from './pdf';
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

describe('Corte de la hoja en hojas A4', () => {
  it('corta cada 1000 px cuando no hay bordes de bloque', () => {
    expect(planSlices(2500, 1000)).toEqual([[0, 1000], [1000, 2000], [2000, 2500]]);
  });

  it('corta en el borde de bloque que entra, para no partir una barra al medio', () => {
    // Una barra termina en 940: la hoja corta ahí en vez de a 1000 (que caería dentro de la siguiente).
    expect(planSlices(2500, 1000, [940, 1940])).toEqual([[0, 940], [940, 1940], [1940, 2500]]);
  });

  it('ignora los bordes que dejan una franja demasiado corta', () => {
    // Un borde a 200 dejaría sólo un 20 % de hoja: se prefiere el corte lleno.
    expect(planSlices(3000, 1000, [200, 900])).toEqual([[0, 900], [900, 1900], [1900, 2900], [2900, 3000]]);
  });

  it('nunca deja una franja vacía si hay un borde justo en el corte', () => {
    expect(planSlices(2000, 1000, [1000, 2000, 0, -5])).toEqual([[0, 1000], [1000, 2000]]);
  });
});
