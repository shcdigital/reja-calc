# Proposal: Obra multi-reja y presupuesto

## Why

Hoy la app calcula **una sola reja** por vez: cada configuración vive en claves de `localStorage` (`reja:config:v1`) y no hay forma de agrupar varias rejas de un mismo trabajo. Un herrero que presupuesta una obra con tres ventanas tiene que rehacer el cálculo y sumar a mano materiales, cortes y costos, y no existe un documento profesional para entregar al cliente ni una vía simple para compartirlo por WhatsApp. Esta mejora cubre ese flujo completo: cargar varias rejas, consolidar el material y el corte, presupuestar con mano de obra y entregar un PDF o un resumen compartible.

## What Changes

- **Obra con varias rejas**: estado de obra que contiene una lista de rejas (cada una con su `ProjectConfig` y un nombre editable, autogenerado como «Reja 1», «Reja 2»…). Alta, baja, duplicado, renombrado y selección de la reja activa.
- **Persistencia y migración**: la obra se guarda en `localStorage`. Si existen datos de la versión anterior (`reja:config:v1`, etc.), se migran a la reja 1 de una obra por defecto sin pérdida.
- **Plan de cortes y materiales unificados por obra**: las piezas de todas las rejas se agrupan por sección de caño y se optimizan en **una sola lista de compra** (mejor aprovechamiento); se conserva la vista por reja y se agrega el desglose y el total de la obra.
- **Presupuestador**: costo de obra = materiales (caños a comprar) + consumibles (discos, pintura, otros) + mano de obra. La mano de obra de cada reja se calcula **por horas × valor hora** o **por monto fijo**, a elección; valor hora y consumibles son de la obra. Total de obra **solo con costos** (sin margen de ganancia ni impuestos).
- **Documento profesional**: plan de obra consolidado descargable como **PDF generado por la app** (librería `jspdf`) y **compartir por WhatsApp** mediante enlace `wa.me` con un resumen de texto; en dispositivos compatibles se ofrece la Web Share API.
- **BREAKING**: se reemplaza el modelo de estado de una reja por el de obra. No rompe datos guardados (hay migración), pero cambia la estructura interna de persistencia.

## Capabilities

### New Capabilities

- `obra`: gestión de una obra con varias rejas — alta, baja, duplicado, renombrado, reja activa, persistencia en `localStorage` y migración de los datos de una sola reja.
- `plan-de-cortes-obra`: consolidación y optimización del plan de cortes y de la lista de materiales a nivel obra (agrupación por sección, compra única, aprovechamiento y sobrantes de la obra) manteniendo el desglose por reja.
- `presupuesto`: cálculo del presupuesto de la obra (materiales + consumibles + mano de obra), con mano de obra por horas × valor hora o monto fijo por reja, y total de obra sin margen ni impuestos.
- `documentos`: documento profesional imprimible/descargable en PDF generado por la app y compartir el resumen de la obra por WhatsApp (con Web Share API cuando esté disponible).

### Modified Capabilities

<!-- Sin cambios: el proyecto todavía no tiene specs principales (openspec/specs/ está vacío). -->

## Impact

- **Código**:
  - `src/core/`: nuevos módulos de obra y presupuesto (p. ej. `obra.ts`, `budget.ts`); extensión de `types.ts` (`Obra`, `Reja`, config de presupuesto), de `project.ts`/`materials.ts` (agregación multi-reja) y de `exporters.ts`.
  - `src/ui/`: `App.tsx` pasa a manejar obra + reja activa (barra de rejas con «Agregar reja»); nuevas vistas de obra, presupuesto y documento; `usePersistentState.ts`/migración.
  - `src/styles.css`: estilos de la nueva navegación de obra y del documento imprimible.
- **Datos**: nuevas claves de `localStorage` para la obra; migración desde `reja:config:v1`, `reja:catalog:v1`, `reja:inventory:v1`, `reja:job:v1`, `reja:unit:v1`.
- **Dependencias**: se agrega `jspdf` (PDF descargable).
- **Docs**: actualizar `README.md` y `docs/ALGORITMO.md`/`docs/FORMULAS.md` con el flujo multi-reja y las fórmulas del presupuesto.
- **Sin backend**: todo sigue calculándose y guardándose en el navegador.
