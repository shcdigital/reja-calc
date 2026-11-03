import { describe, expect, it } from 'vitest';
import { catalog, makeConfig } from './helpers';
import { computeObra, createObra } from './obra';
import { exportObraJson, parseObraFile } from './obraFile';

describe('Archivo de obra JSON', () => {
  it('exporta y reimporta la obra completa', () => {
    const obra = createObra();
    obra.name = 'Cocina García';
    obra.rejas[0].name = 'Ventana';
    obra.rejas[0].config = makeConfig({ w: 1800, h: 900, bar: 'r-1' });
    const text = exportObraJson(obra);
    const imported = parseObraFile(text);

    expect(imported).not.toBeNull();
    expect(imported!.name).toBe('Cocina García');
    expect(imported!.rejas[0].name).toBe('Ventana');
    expect(imported!.rejas[0].config.window).toEqual({ widthMm: 1800, heightMm: 900 });
    expect(imported!.rejas[0].config.barProfileId).toBe('r-1');
  });

  it('acepta un JSON de obra sin sobre, como los guardados anteriores', () => {
    const obra = createObra();
    const imported = parseObraFile(JSON.stringify(obra));
    expect(imported).not.toBeNull();
    expect(imported!.rejas).toHaveLength(1);
  });

  it('rechaza un JSON inválido', () => {
    expect(parseObraFile('{no es json')).toBeNull();
    expect(parseObraFile(JSON.stringify({ hola: 'mundo' }))).toBeNull();
  });

  it('la obra importada se puede calcular', () => {
    const obra = createObra();
    const imported = parseObraFile(exportObraJson(obra))!;
    const result = computeObra(imported, catalog);
    expect(result.hasAnyValid).toBe(true);
  });
});
