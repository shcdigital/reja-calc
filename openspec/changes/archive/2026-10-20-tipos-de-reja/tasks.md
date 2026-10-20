# Tasks

## 1. Dominio: tipos y defaults

- [x] 1.1 Agregar los tipos `RejaStyle` (`'moderna' | 'clasica'`) y `ProductKind` (`'ventana' | 'puerta-abrir' | 'puerta-corrediza' | 'porton-dos-hojas' | 'porton-corredizo' | 'frente'`) en `src/core/types.ts` y los campos `style` y `productKind` a `ProjectConfig`, y verificar que `tsc --noEmit` pasa.
- [x] 1.2 Agregar `style: 'moderna'` y `productKind: 'ventana'` a `DEFAULT_CONFIG` en `src/core/profiles.ts` y a `makeConfig` en `src/core/helpers.ts`, y verificar que las pruebas existentes siguen pasando (`npm test`).
- [x] 1.3 Agregar entradas estándar argentinas al `DEFAULT_CATALOG` (planchuelas 1" × 3/16", 1 1/4" × 3/16", 1 1/4" × 1/4", 1 1/2" × 1/4" y barrotes macizos Ø12,7 / Ø14,3 / Ø15,9 / Ø19,1 mm) y verificar que `sectionKey` y `profileLabel` las representan correctamente.

## 2. Geometría

- [x] 2.1 Refactorizar `computeDesign` en `src/core/geometry.ts` en un despachador `computeDesign` + `computeWindowModerna` (cuerpo actual) + `computeWindowClasica`, manteniendo idéntico el resultado para `moderna`/`ventana`, y verificar que `npm test` sigue pasando.
- [x] 2.2 Implementar `computeWindowClasica` reutilizando la geometría de barrotes alojados con marco de planchuela, y verificar con un caso de prueba que genera marco de planchuela + barrotes macizos.
- [x] 2.3 Hacer la advertencia `bar-wider-than-frame` dependiente del estilo (no dispararla en `clasica`), y verificar que una reja clásica válida no emite esa advertencia.
- [x] 2.4 Implementar el caso `productKind !== 'ventana'` devolviendo un error `product-not-implemented` sin piezas, y verificar que no genera plan de cortes.

## 3. Persistencia y migración

- [x] 3.1 Actualizar `normalizeConfig` en `src/core/obra.ts` para forzar `style`/`productKind` por defecto cuando falten, y verificar con una prueba de migración de config antigua.
- [x] 3.2 Verificar round-trip de persistencia de una reja clásica (guardar y recargar) mediante prueba automatizada.

## 4. Interfaz

- [x] 4.1 Agregar selector de estilo en la sección 2 (Perfiles) de `src/ui/App.tsx` que actualice `config.style`, y verificar que el cálculo se recalcula al cambiar.
- [x] 4.2 Ajustar etiquetas de la vista previa y la hoja de taller para reflejar el estilo (sin cambios de cálculo), y verificar visualmente en `npm run dev`.

## 5. Pruebas y documentación

- [x] 5.1 Agregar pruebas en `src/core/rejas.test.ts` (o nuevo archivo) para el estilo clásico: geometría, despiece y plan de cortes, y verificar que pasan.
- [x] 5.2 Actualizar `README.md` y `docs/FORMULAS.md` con el estilo clásico y los tipos de producto reservados, y verificar que el build de docs no rompe (`npm run build`).

## 6. Validación final

- [x] 6.1 Ejecutar `npm test` y `npm run typecheck` y confirmar que todo pasa sin errores.