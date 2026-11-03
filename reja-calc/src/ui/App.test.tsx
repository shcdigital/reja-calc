import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { makeConfig } from '../core/helpers';
import { createObra, OBRA_KEY } from '../core/obra';
import { App } from './App';

describe('Interfaz (render de humo)', () => {
  it('renderiza la obra y todas las secciones con los valores por defecto', () => {
    const html = renderToString(<App />);
    for (const t of [
      'Rejas de la obra',
      'Agregar reja',
      '1. Ventana',
      '2. Perfiles',
      '3. Barrotes',
      '4. Armado y',
      '5. Parámetros de corte (obra)',
      '6. Vista previa',
      '7. Lista de materiales (obra)',
      '8. Plan de cortes (obra)',
      '9. Presupuesto y exportación (obra)',
      'Descargar PDF',
      'Enviar PDF por WhatsApp',
      'Hoja de taller',
      'Planos DXF (toda la obra)',
      'Plano DXF (reja activa)',
      'Importar obra (JSON/DXF)',
      'Guardar JSON',
    ]) {
      expect(html).toContain(t);
    }
    expect(html).toContain('Reja 1');
    expect(html).toContain('<svg');
  });

  it('renderiza la reja clásica con barra maciza cuadrada y planchuela', () => {
    const obra = createObra();
    const cfg = makeConfig({ style: 'clasica', bar: 'qm-12', frame: 'pl-32x5' });
    cfg.frame.orientation = 'minor';
    obra.rejas[0].config = cfg;

    const store = {
      getItem: (key: string) => (key === OBRA_KEY ? JSON.stringify(obra) : null),
      setItem: () => undefined,
    };
    const hadStorage = 'localStorage' in globalThis;
    Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true });
    try {
      const html = renderToString(<App />);
      expect(html).toContain('Barra maciza cuadrada de los barrotes');
      expect(html).toContain('Planchuela del marco (todos los tramos)');
      expect(html).toContain('Hierro macizo cuadrado');
      expect(html).toContain('Travesaño central');
      expect(html).toContain('Barrotes');
    } finally {
      if (hadStorage) Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true });
      else delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });
});
