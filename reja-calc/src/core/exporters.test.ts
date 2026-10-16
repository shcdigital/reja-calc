import { describe, expect, it } from 'vitest';
import { materialsCsv } from './exporters';
import type { MaterialLine } from './types';

const material = (profileLabel: string): MaterialLine => ({
  sectionKey: 'rect:40x20x2',
  profileLabel,
  stockLengthMm: 6000,
  piecesCount: 2,
  piecesLengthMm: 1200,
  newBarsCount: 1,
  purchasedMm: 6000,
  offcutsUsedCount: 0,
  offcutsUsedMm: 0,
  inputMm: 6000,
  kerfLossMm: 12.5,
  trimLossMm: 20,
  leftoverMm: 4767.5,
  leftoverReusableMm: 300,
  leftoverScrapMm: 4467.5,
  utilization: 0.2,
});

describe('Exportación CSV', () => {
  it('usa BOM, separador «;» y coma decimal', () => {
    const csv = materialsCsv([material('Rectangular')]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.split('\r\n')[1]).toContain(';12,5;');
  });

  it('escapa separadores y comillas en el texto', () => {
    const csv = materialsCsv([material('Marco; con "comillas"')]);
    expect(csv.split('\r\n')[1]).toContain('"Marco; con ""comillas"""');
  });

  it('neutraliza fórmulas de Excel en las etiquetas editables', () => {
    for (const label of ['=SUM(A1)', '+1|calc', '@SUM(1)', '-1|cmd', '\tTAB']) {
      expect(materialsCsv([material(label)]).split('\r\n')[1]).toContain(`'${label}`);
    }
  });

  it('no toca números ni texto inocente', () => {
    const csv = materialsCsv([material('Rectangular 40 × 20 × 2')]);
    expect(csv.split('\r\n')[1]).toContain(';6000;');
    expect(csv.split('\r\n')[1]).not.toContain("'");
  });
});
