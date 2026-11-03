/** Archivo de obra editable (JSON) para guardar y volver a importar todo el proyecto. */
import { parseObra } from './obra';
import type { Obra } from './types';

export const OBRA_FILE_FORMAT = 'reja-calc/obra';
export const OBRA_FILE_VERSION = 1;

export function exportObraJson(obra: Obra): string {
  return JSON.stringify({ format: OBRA_FILE_FORMAT, version: OBRA_FILE_VERSION, obra }, null, 2);
}

/** Acepta el sobre de la app o un JSON de obra "pelado" de versiones anteriores. */
export function parseObraFile(text: string): Obra | null {
  try {
    const parsed = JSON.parse(text) as { format?: unknown; obra?: unknown } | null;
    if (!parsed || typeof parsed !== 'object') return null;
    const candidate = 'obra' in parsed ? parsed.obra : parsed;
    return parseObra(JSON.stringify(candidate));
  } catch {
    return null;
  }
}
