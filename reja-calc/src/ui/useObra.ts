import { useEffect, useState } from 'react';
import { getStorage, loadObra, saveObra } from '../core/obra';
import type { Obra } from '../core/types';

/**
 * Estado de obra persistido en `localStorage`.
 * Al iniciar: obra guardada → migración de los datos de una sola reja → obra nueva.
 * Si el almacenamiento no está disponible, sigue funcionando en memoria.
 */
export function useObra() {
  const [obra, setObra] = useState<Obra>(() => loadObra(getStorage()));
  useEffect(() => {
    saveObra(getStorage(), obra);
  }, [obra]);
  return [obra, setObra] as const;
}
