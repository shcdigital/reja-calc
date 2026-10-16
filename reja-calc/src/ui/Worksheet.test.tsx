import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { computeBudget } from '../core/budget';
import { catalog, makeConfig } from '../core/helpers';
import { computeObra, createObra, DEFAULT_BUDGET } from '../core/obra';
import { ObraWorksheet } from './Worksheet';

function obraWithCutPlan() {
  const base = createObra();
  const rejas = [0, 1].map((i) => ({
    id: `R${i + 1}`,
    name: `Reja ${i + 1}`,
    config: makeConfig(),
    labor: { mode: 'hours' as const, hours: 1, fixedAmount: 0 },
  }));
  const obra = { ...base, rejas, activeRejaId: 'R1' };
  const result = computeObra(obra, catalog);
  return { obra, result, budget: computeBudget(result, DEFAULT_BUDGET) };
}

/** El PDF es una copia fiel de esta hoja: si el color está acá, está en el PDF. */
describe('Hoja de taller (plan de cortes)', () => {
  it('dibuja las barras de color de cada caño, como la vista de la web', () => {
    const { obra, result, budget } = obraWithCutPlan();
    const html = renderToString(<ObraWorksheet obra={obra} result={result} budget={budget} />);

    // Una barra por caño y, dentro, un segmento por pieza con su color de clase.
    expect(html).toContain('class="bin-bar"');
    expect(html).toContain('seg seg-piece');
    expect(html).toContain('seg-kerf');
    // Leyenda de colores y el sobrante final de cada caño.
    expect(html).toContain('sw seg-piece');
    expect(html).toContain('seg-reuse');
    expect(html).toContain('Sobrante final:');
    // Identificación de cada caño y sus piezas.
    expect(html).toContain('Caño comercial 1');
    expect(html).toContain('Piezas:');
  });
});
