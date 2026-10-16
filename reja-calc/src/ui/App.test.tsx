import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { App } from './App';

describe('Interfaz (render de humo)', () => {
  it('renderiza la obra y todas las secciones con los valores por defecto', () => {
    const html = renderToString(<App />);
    for (const t of [
      'Rejas de la obra',
      'Agregar reja',
      '1. Ventana',
      '2. Perfiles',
      '3. Barrotes horizontales',
      '4. Armado y refuerzo',
      '5. Parámetros de corte (obra)',
      '6. Vista previa',
      '7. Lista de materiales (obra)',
      '8. Plan de cortes (obra)',
      '9. Presupuesto y exportación (obra)',
      'Descargar PDF',
      'Enviar PDF por WhatsApp',
      'Hoja de taller',
    ]) {
      expect(html).toContain(t);
    }
    expect(html).toContain('Reja 1');
    expect(html).toContain('<svg');
  });
});
