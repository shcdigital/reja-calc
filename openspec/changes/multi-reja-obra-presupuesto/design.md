# Design: Obra multi-reja y presupuesto

## Context

Ver `proposal.md - Why`. Estado actual relevante:

- El estado vive en `localStorage` con claves planas: `reja:config:v1` (`ProjectConfig`), `reja:catalog:v1` (`Catalog`), `reja:inventory:v1` (`Offcut[]`), `reja:job:v1` (nombre), `reja:unit:v1`. `usePersistentState` mezcla datos guardados con los valores por defecto (`deepMerge`).
- El pipeline es puro: `computeProject(config, catalog, inventory)` → `{ design, plan, materials, costs }` (`src/core/project.ts`).
- `computeCuttingPlan(pieces, config, inventory)` (`src/core/cutting.ts`) **ya agrupa por `sectionKey`** y nunca mezcla secciones; usa `config.fabrication` (largo comercial, disco, refilado), `config.stock` (reutilizar sobrantes, largo mínimo) y filtra sobrantes por sección.
- Los `Piece.id` son únicos dentro de una reja; los bin del plan referencian piezas por `pieceId`.
- `computeCosts(materials, costs)` calcula precio por caño y consumibles, con `contingencyPct`.
- La UI (`App.tsx`) es un único componente que maneja una reja; `Worksheet.tsx` arma la hoja imprimible con `window.print()` y `data-area`/clases `print-only`/`no-print`.
- Sin backend: todo en el navegador.

## Goals / Non-Goals

**Goals:**

- Modelo de estado de obra con varias rejas, persistido y migrado, sin pérdida de datos.
- Plan de cortes y materiales **unificados** por sección, manteniendo trazabilidad hacia cada reja.
- Presupuesto de obra (materiales + consumibles + mano de obra) con mano de obra por horas o monto fijo por reja.
- PDF descargable generado por la app y compartir resumen por WhatsApp.

**Non-Goals:**

- Sin backend, sin cuentas, sin sincronización entre dispositivos.
- Sin margen de ganancia, impuestos ni descuentos en el total (decisión del usuario: solo costos).
- Sin catálogo de perfiles ni inventario por reja: siguen siendo recursos del taller, compartidos.
- Sin adjuntar el archivo PDF por WhatsApp: `wa.me` solo transporta texto (ver Open Questions).

## Decisions

### D1. Modelo de estado: `Obra` con `rejas[]`, catálogo e inventario siguen globales

`Obra = { id, name, rejas: Reja[], activeRejaId, cutting, budget }`; `Reja = { id, name, config: ProjectConfig, labor }`. El `Catalog` de perfiles y el `inventory` de sobrantes **no** se parten por reja: un taller tiene un catálogo y un stock físico comunes.

- **Por qué**: evita duplicar catálogo/inventario por reja y mantiene el inventario de sobrantes como una única fuente de verdad, que ya es global hoy.
- **Alternativas**: catálogo por obra (rechazado: fricción sin beneficio); inventario por reja (rechazado: los sobrantes son físicos y compartidos).

### D2. Parámetros de corte a nivel obra; geometría por reja

Se mueven a `Obra.cutting` los parámetros que solo afectan el empaquetado — `stockLengthMm`, `kerfMm`, `endTrimMm`, `minReusableMm`, `reuseOffcuts`. Se quedan en `Reja.config.fabrication` los que cambian la **longitud de las piezas**: `jointGapMm`, `socketSetbackMm` y `throughHoleClearanceMm`.

- **Por qué**: un plan unificado necesita un único largo comercial, un único disco y una única política de sobrantes. Mezclar piezas calculadas con distintos kerf/refilado en el mismo caño no tendría sentido físico.
- **Alternativas**: usar la config de la reja activa para todo el plan unificado (rechazado: resultados cambian al cambiar de reja activa); mantener los parámetros de corte también por reja (rechazado: dos fuentes para el mismo dato y plan unificado ambiguo).
- **Compatibilidad**: los campos dejan de mostrarse en el editor de reja; la migración los copia desde `reja:config:v1` a `obra.cutting`.

### D3. Un solo plan unificado; la vista por reja es un subconjunto

Se concatenan las piezas de todas las rejas válidas y se llama a `computeCuttingPlan` una vez con `Obra.cutting`. Para atribuir piezas a su reja, los `Piece.id` se prefijan con el id de la reja (`<rejaId>:<pieceIdLocal>`). La vista por reja muestra **los bin del plan unificado que contienen al menos una pieza de esa reja**, marcados como compartidos.

- **Por qué**: es la única forma de que «unificado» sea también ≤ suma por reja y de que lo que se corta en el taller coincida con lo que se compra.
- **Alternativas**: recalcular un plan por reja para la vista de taller y unificar solo los totales (rechazado: los cortes mostrados no coincidirían con la compra y el aprovechamiento sería inconsistente); prefijar por índice y mapear con una tabla auxiliar (posible, pero el prefijo es más simple y sobrevive a la serialización).

### D4. Presupuesto: precios por sección y consumibles en la obra; mano de obra por reja

`Obra.budget = { pricePerBar: Record<sectionKey, number>, consumables: { discsCost, paintCost, otherConsumablesCost }, laborRatePerHour }`. `Reja.labor = { mode: 'hours' | 'fixed', hours, fixedAmount }`. Total = materiales + consumibles + mano de obra, **sin** margen ni impuestos. Se elimina `contingencyPct` del cálculo.

- **Por qué**: el precio de un caño es el mismo se compre para una reja o para tres, y los consumibles se compran una vez para la obra. La mano de obra sí depende de cada reja.
- **Alternativas**: precios por reja (rechazado: mismo insumo con precios distintos); consumibles por reja (rechazado: se compran por obra); mantener `contingencyPct` (rechazado por la decisión «solo costos»).

### D5. `computeObra` puro y testeable

Nueva función pura `computeObra(obra, catalog, inventory): ObraResult` en `src/core/obra.ts` (o `project.ts`) que devuelve `{ rejas: Map<rejaId, ProjectResult | error>, plan, materials, budget }`. La UI consume ese objeto memoizado. Toda la lógica nueva (agregación, presupuesto, resumen de texto, nombre de archivo) son funciones puras separadas para poder probarlas con Vitest como el motor actual.

- **Por qué**: mantiene el patrón actual (core sin React, 100 % probado) y permite testear el presupuesto y el resumen sin DOM.
- **Alternativas**: calcular todo dentro de `App.tsx` (rechazado: intestable y mezcla UI con dominio).

### D6. PDF con `jspdf` importado dinámicamente

Se agrega `jspdf` y se importa con `await import('jspdf')` **solo al presionar «Descargar PDF»**, para no cargarlo en el arranque. La generación se apoya en el mismo snapshot de `ObraResult` que usa la UI. La versión imprimible sigue con `window.print()` y el CSS de impresión existente.

- **Por qué**: evita penalizar el bundle inicial y reutiliza los datos ya calculados.
- **Alternativas**: PDF armado 100 % con `window.print()` (rechazado por el usuario, que pidió PDF descargable); generación en backend (rechazado: no hay backend).

### D7. Compartir por WhatsApp con resumen de texto y Web Share API

`buildShareSummary(obraResult)` (puro) arma un texto con obra, rejas, medidas y totales disponibles. Se usa `navigator.share({ text })` si existe y, si no, `window.open('https://wa.me/?text=' + encodeURIComponent(text))`.

- **Por qué**: `wa.me` es la vía universal sin backend; Web Share API mejora la experiencia en celular.
- **Alternativas**: WhatsApp Business API / link a archivo (requiere backend o hosting del PDF).

## Risks / Trade-offs

- **Optimización exacta con muchas piezas**: más piezas por sección al unificar → la búsqueda por ramificación y poda puede toparse con el límite de nodos. → Ya existe `nodeLimit` (400 000) y la heurística FFD/BFD como respaldo; el plan sigue siendo válido y se informa el método. Aceptable.
- **Migración de datos**: si la migración falla, el usuario pierde su configuración. → Migración defensiva (try/catch, validación de forma), no se borran las claves viejas, y al faltar datos se cae a `DEFAULT_CONFIG`. Idempotente: solo migra si no existe `reja:obra:v1`.
- **Cambio de modelo percibido como pérdida de función**: los parámetros de corte dejan de estar en la reja. → El editor de obra los expone con los mismos nombres y ayudas; la migración los trae con los valores del usuario.
- **Vista por reja compartida puede confundir** (un caño contiene piezas de otra reja). → Etiquetar los bin compartidos y aclararlo en la UI; el plan de obra es la fuente de verdad para comprar y cortar.
- **`jspdf` suma dependencia y su bundle**: → import dinámico; el PDF es opcional (solo al descargar). Alternativa de rollback: quitar el botón y usar impresión.
- **Nombres de archivo / texto de WhatsApp** con caracteres raros: → saneado determinista (`slug`) y pruebas con acentos y ñ.

## Migration Plan

1. Al iniciar, si **no** existe `reja:obra:v1` y existen claves viejas (`reja:config:v1`, `reja:job:v1`, `reja:unit:v1`), construir `Obra` con una única reja (`config` = config vieja; `cutting` = sus `fabrication`/`stock`; `budget.pricePerBar`/consumibles = sus `costs`; `name` = `reja:job:v1` o por defecto) y escribir `reja:obra:v1`.
2. No borrar las claves viejas (rollback possible: una versión anterior seguiría funcionando con sus claves).
3. `reja:catalog:v1`, `reja:inventory:v1` y `reja:unit:v1` se siguen leyendo igual.
4. Si `reja:obra:v1` ya existe, se ignora la migración y no se pisan datos.
5. Rollback: al desplegar la versión anterior, esta lee sus claves viejas intactas; los cambios hechos en la obra nueva no se reflejan (aceptado).

## Open Questions

- ¿Conviene además ofrecer «compartir el PDF como archivo» usando `navigator.share({ files })` en dispositivos que lo soporten? Se puede agregar después sin cambiar specs ni el enfoque; el resumen de texto ya cubre el caso universal.
