import { describe, expect, it } from 'vitest';
import { buildDesignDxf, buildObraDxf, buildRejasDxf, parseDxfPayload, readDxfGeometry } from './dxf';
import { computeDesign } from './geometry';
import { catalog, makeConfig } from './helpers';
import { computeObra, createObra } from './obra';

const lineCount = (dxf: string) => (dxf.match(/\r\nLINE\r\n/g) ?? []).length;

describe('DXF: exportación e importación', () => {
  it('genera un DXF R12 en milímetros con capas separadas', () => {
    const cfg = makeConfig();
    const design = computeDesign(cfg, catalog);
    const dxf = buildDesignDxf('Reja 1', design, cfg.window.widthMm, cfg.window.heightMm);

    expect(dxf.startsWith('999\r\nPLANO DE REJAS - UNIDADES: MILIMETROS')).toBe(true);
    expect(dxf).toContain('$ACADVER\r\n1\r\nAC1009');
    expect(dxf.endsWith('0\r\nEOF\r\n')).toBe(true);
    for (const layer of ['MARCO', 'REFUERZO', 'BARROTES', 'COTAS', 'TEXTOS']) {
      expect(dxf).toContain(`LAYER\r\n2\r\n${layer}`);
    }
    expect(dxf).toContain('Reja 1 - 1.500 x 600 mm');
    expect(dxf).toContain('B01-I');
  });

  it('convierte Y hacia arriba y dibuja el marco superior en y = H − 20', () => {
    const cfg = makeConfig();
    const design = computeDesign(cfg, catalog);
    const dxf = buildDesignDxf('Reja 1', design, 1500, 600);

    // El primer rectángulo es MS: de (0, 580) a (1500, 600) en coordenadas CAD.
    expect(dxf).toContain(
      ['0', 'LINE', '8', 'MARCO', '10', '0', '20', '580', '30', '0', '11', '1500', '21', '580', '31', '0'].join('\r\n'),
    );
  });

  it('dibuja 4 líneas por pieza más las líneas de cota', () => {
    const cfg = makeConfig();
    const design = computeDesign(cfg, catalog);
    const dxf = buildDesignDxf('Reja 1', design, 1500, 600);

    expect(lineCount(dxf)).toBe(design.pieces.length * 4 + 6);
  });

  it('exporta toda la obra con una reja al lado de la otra', () => {
    const base = createObra();
    const rejas = [0, 1].map((i) => ({
      id: `R${i + 1}`,
      name: `Reja ${i + 1}`,
      config: makeConfig(),
      labor: { mode: 'hours' as const, hours: 0, fixedAmount: 0 },
    }));
    const obra = { ...base, rejas, activeRejaId: 'R1' };
    const result = computeObra(obra, catalog);
    const dxf = buildObraDxf(obra, result);

    expect(dxf).toContain('Reja 1 - 1.500 x 600 mm');
    expect(dxf).toContain('Reja 2 - 1.500 x 600 mm');
    expect(dxf).toContain('$EXTMAX\r\n10\r\n3390');
  });

  it('incluye en el DXF de toda la obra las rejas con errores', () => {
    const base = createObra();
    const good = { ...base.rejas[0], id: 'R1', name: 'Reja buena', config: makeConfig() };
    const long = { ...base.rejas[0], id: 'R2', name: 'Reja larga', config: makeConfig({ w: 6020 }) };
    const empty = { ...base.rejas[0], id: 'R3', name: 'Reja sin espacio', config: makeConfig({ w: 30, h: 30 }) };
    const obra = { ...base, rejas: [good, long, empty], activeRejaId: 'R1' };
    const result = computeObra(obra, catalog);

    expect(result.valid.map((r) => r.reja.name)).toEqual(['Reja buena']);
    const dxf = buildObraDxf(obra, result);
    expect(dxf).toContain('Reja buena - 1.500 x 600 mm');
    expect(dxf).toContain('Reja larga - 6.020 x 600 mm');
    expect(dxf).toContain('Reja sin espacio - 30 x 30 mm');
    expect(dxf).toContain('REVISAR ERRORES EN LA CALCULADORA');
    expect(dxf).toContain('SIN DESPIECE - REVISAR ERRORES');
  });

  it('embebe la obra completa para poder reimportar el DXF', () => {
    const base = createObra();
    const obra = {
      ...base,
      name: 'Obra de prueba',
      rejas: [{
        ...base.rejas[0],
        name: 'Reja importable',
        config: makeConfig({ bar: 'r-1' }),
      }],
      activeRejaId: base.rejas[0].id,
    };
    const result = computeObra(obra, catalog);
    const dxf = buildObraDxf(obra, result);
    const payload = parseDxfPayload(dxf);

    expect(payload?.kind).toBe('obra');
    if (payload?.kind !== 'obra') throw new Error('payload');
    expect(payload.obra.name).toBe('Obra de prueba');
    expect(payload.obra.rejas[0].name).toBe('Reja importable');
    expect(payload.obra.rejas[0].config.barProfileId).toBe('r-1');
  });

  it('embebe una sola reja en el DXF de la reja activa', () => {
    const obra = createObra();
    const reja = { ...obra.rejas[0], name: 'Reja activa' };
    const design = computeDesign(reja.config, catalog);
    const dxf = buildDesignDxf(reja.name, design, 1500, 600, reja);
    const payload = parseDxfPayload(dxf);

    expect(payload?.kind).toBe('reja');
    if (payload?.kind !== 'reja') throw new Error('payload');
    expect(payload.reja.name).toBe('Reja activa');
    expect(payload.reja.config.window.widthMm).toBe(1500);
  });

  it('lee el contorno de un DXF externo sin metadatos', () => {
    const cfg = makeConfig();
    const design = computeDesign(cfg, catalog);
    const dxf = buildRejasDxf([{ name: 'Externo', widthMm: 1500, heightMm: 600, design }]);
    expect(readDxfGeometry(dxf)).toEqual({ widthMm: 1500, heightMm: 600 });
  });

  it('lee polilíneas de un DXF externo', () => {
    const dxf = [
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'LWPOLYLINE', '8', '0', '90', '4',
      '10', '0', '20', '0',
      '10', '100', '20', '0',
      '10', '100', '20', '50',
      '10', '0', '20', '50',
      '0', 'ENDSEC', '0', 'EOF', '',
    ].join('\r\n');
    expect(readDxfGeometry(dxf)).toEqual({ widthMm: 100, heightMm: 50 });
  });

  it('translada acentos y símbolos a ASCII para que no se rompa en CAD', () => {
    const cfg = makeConfig();
    const design = computeDesign(cfg, catalog);
    const dxf = buildDesignDxf('Reja Ñandú Ø 1/2"', design, 1500, 600);

    expect(dxf).toContain('Reja Nandu D 1/2"');
    expect(dxf).not.toContain('Ñ');
    expect(dxf).not.toContain('Ø');
  });

  it('exporta la reja clásica con sus barrotes verticales en la capa BARROTES', () => {
    const cfg = makeConfig({ style: 'clasica', bar: 'qm-12', frame: 'pl-32x5' });
    cfg.frame.orientation = 'minor';
    const design = computeDesign(cfg, catalog);
    const dxf = buildDesignDxf('Reja clásica', design, 1500, 600);

    expect(dxf).toContain('BARROTES');
    expect(dxf).toContain('B01-A');
    expect(dxf).toContain('B01-B');
    expect(lineCount(dxf)).toBe(design.pieces.length * 4 + 6);
  });

  it('sin rejas genera un DXF válido y vacío', () => {
    const dxf = buildRejasDxf([]);
    expect(dxf).toContain('$ACADVER');
    expect(dxf).toContain('0\r\nSECTION\r\n2\r\nENTITIES');
    expect(dxf.endsWith('0\r\nEOF\r\n')).toBe(true);
  });
});
