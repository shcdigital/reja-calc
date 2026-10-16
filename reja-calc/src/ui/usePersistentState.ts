import { useEffect, useState } from 'react';

/** useState persistido en localStorage. `merge` permite completar datos guardados con versiones viejas. */
export function usePersistentState<T>(key: string, initial: T, merge?: (saved: unknown, initial: T) => T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const saved = JSON.parse(raw);
        return merge ? merge(saved, initial) : (saved as T);
      }
    } catch {
      /* almacenamiento no disponible o dato corrupto: se usan los valores iniciales */
    }
    return initial;
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* sin espacio / modo privado: se ignora */
    }
  }, [key, value]);
  return [value, setValue] as const;
}
