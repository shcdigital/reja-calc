# Tasks

## 1. Modelo de datos y migración

- [x] 1.1 Agregar a `src/core/types.ts` los tipos `Reja`, `Obra`, `ObraCuttingConfig`, `RejaLabor` y `BudgetConfig` según el diseño (D1, D2, D4); verificar con `npm run typecheck` que compila sin errores.
- [x] 1.2 Implementar en `src/core/obra.ts` la fábrica `createObra()` y `createReja()` con valores por defecto (nombre «Reja N» no repetido) y un test unitario que compruebe que una reja nueva hereda `DEFAULT_CONFIG` y que la obra nunca queda sin rejas.
- [x] 1.3 Implementar `migrateLegacyState()` que lea `reja:config:v1`, `reja:job:v1`, `reja:unit:v1` y los convierta en una `Obra` con `cutting` desde `fabrication`/`stock` y `budget` desde `costs`; verificar con tests que migra los valores y que no toca nada si ya existe `reja:obra:v1`.
- [x] 1.4 Extender `src/ui/usePersistentState.ts` (o agregar un hook de obra) para persistir `Obra` en `reja:obra:v1` con validación defensiva de forma y tolerancia a `localStorage` no disponible; verificar con un test que un JSON corrupto cae a los valores por defecto sin romper.

## 2. Agregación multi-reja (plan unificado)

- [x] 2.1 Implementar `computeObra(obra, catalog, inventory)` en `src/core/obra.ts`: calcula cada reja con `computeProject` (excluyendo las que tienen error), concatena piezas con `pieceId` prefijado por id de reja y llama una sola vez a `computeCuttingPlan` con `Obra.cutting`; verificar con un test que 2 rejas del mismo caño se empaquetan juntas.
- [x] 2.2 Implementar el filtrado de la vista por reja (bins del plan unificado que contienen piezas de esa reja) y los totales de obra; verificar con un test que la suma de caños nuevos del plan unificado es ≤ a la suma de planes por reja.
- [x] 2.3 Manejar rejas inválidas: excluirlas del plan unificado y exponer sus errores como avisos de obra; verificar con un test que una reja con medidas inválidas no aporta piezas y que el resto calcula igual.
- [x] 2.4 Adaptar `applyPlanToInventory`/inventario para guardar los sobrantes del plan unificado una sola vez; verificar con un test que los sobrantes usados se descuentan y los reutilizables se registran.

## 3. Presupuesto

- [x] 3.1 Crear `src/core/budget.ts` con `computeBudget(obraResult, budget)`: costo de materiales por sección sobre los caños del plan unificado y consumibles de obra; verificar con un test de una sección compartida por dos rejas (precio × caños totales, una sola vez).
- [x] 3.2 Implementar la mano de obra por reja en modo `hours` (horas × valor hora) y `fixed` (monto fijo), y su suma; verificar con tests de ambos modos y de recálculo al cambiar el valor hora.
- [x] 3.3 Implementar el total de obra = materiales + consumibles + mano de obra (sin margen ni impuestos) y el reporte de faltantes (`missingPrices`) para presupuesto parcial; verificar con tests de total completo, sin precios y parcial.

## 4. Interfaz de obra y reja activa

- [x] 4.1 Reestructurar `App.tsx` para consumir `Obra` + reja activa: barra de rejas con «Agregar reja», selección, renombrar, duplicar y eliminar (con confirmación y sin dejar la obra vacía); verificar renderizando y operando sobre el estado.
- [x] 4.2 Mover a la interfaz de obra los parámetros de corte (`largo comercial`, `disco`, `refilado`, `reutilizar sobrantes`, `largo mínimo`) y dejar en el editor de reja solo geometría (`holgura por unión`, `holgura del agujero`); verificar que cambiar un parámetro de corte recalcula el plan unificado.
- [x] 4.3 Agregar la vista de obra con totales consolidados (materiales, cortes, presupuesto) y el desglose por reja seleccionable; verificar que muestra los totales de todas las rejas y el detalle de la activa.
- [x] 4.4 Agregar el bloque de presupuesto en la UI (precios por sección, consumibles, valor hora, y por reja el modo horas/monto fijo) con el total y la lista de faltantes; verificar el flujo completo cargando precios y viendo el total.

## 5. Documentos: PDF, impresión y WhatsApp

- [x] 5.1 Implementar en `src/core/document.ts` `slugify(name)` y `buildShareSummary(obraResult)` (texto con obra, rejas, medidas y totales si hay precios); verificar con tests de acentos/ñ en el nombre y de resumen con y sin presupuesto.
- [x] 5.2 Agregar `jspdf` a `package.json` e implementar la generación del PDF con `await import('jspdf')` al presionar «Descargar PDF», incluyendo todas las rejas, los consolidados, el presupuesto (si está habilitado) y el aviso estructural; verificar descargando un PDF de una obra de 2 rejas.
- [x] 5.3 Implementar el documento de obra imprimible (versión `print-only` que oculta controles y abarca todas las rejas) reutilizando el CSS de impresión existente; verificar con la vista previa de impresión del navegador.
- [x] 5.4 Implementar «Compartir por WhatsApp» con `navigator.share` cuando exista y `https://wa.me/?text=` como respaldo; verificar que el enlace abre WhatsApp con el resumen y que sin precios no muestra un total incorrecto.

## 6. Integración, documentación y verificación

- [x] 6.1 Actualizar `src/ui/App.test.tsx` y agregar los tests nuevos para que toda la suite pase con `npm test`.
- [x] 6.2 Actualizar `README.md` y `docs/FORMULAS.md`/`docs/ALGORITMO.md` con el flujo multi-reja, las fórmulas del presupuesto y el documento/WhatsApp; verificar que describen el comportamiento implementado.
- [x] 6.3 Verificación final: `npm run typecheck`, `npm test` y `npm run build` sin errores, y prueba manual en `localhost:8081` de una obra con 2 rejas (cortes unificados, presupuesto, PDF y WhatsApp).
