# Calculadora de rejas de caño estructural

Aplicación web para herrería (React + TypeScript + Vite). A partir de las medidas exteriores de cada ventana arma una **obra con varias rejas** y calcula todo lo que hace falta para el taller y para el cliente:

- **Despiece** de cada reja (marco, refuerzo y barrotes) con largos de corte, ubicación y observaciones.
- **Plan de cortes unificado** para caños comerciales de 6.000 mm, con disco de corte, refilado, sobrantes y aprovechamiento.
- **Lista de materiales** de la obra (caños a comprar).
- **Plano** de cada reja con cotas en milímetros.
- **Presupuesto** de la obra: materiales + consumibles + mano de obra.
- **PDF**, **WhatsApp**, **CSV** y **hoja de taller** imprimible.

Todo corre en el navegador: sin backend, sin cuentas y sin servicios externos. Los datos quedan guardados en `localStorage`, así que funciona sin conexión y se puede publicar como sitio estático (por ejemplo, GitHub Pages).

## Características

### Obra multi-reja
- Una **obra** agrupa una o más **rejas**. «Agregar reja» crea la siguiente con nombre automático (`Reja 1`, `Reja 2`, …).
- Cada reja se puede **renombrar, duplicar y eliminar**, y tiene su **propia configuración**.
- Lo que es común (largo comercial, disco, refilado, sobrantes) se define **una vez por obra**; los materiales, los cortes y el presupuesto se **suman para toda la obra**.

### Geometría y despiece
- Medidas exteriores en **mm o cm**.
- **Separación libre** entre barrotes: cantidad automática (a partir de la separación máxima deseada y una mínima) o fija, con distribución simétrica y avisos cuando los límites son incompatibles.
- **Armado del marco**: tramos horizontales completos con laterales entre ellos, o laterales completos.
- **Tramos superior e inferior (MS/MI)**: con el **mismo perfil rectangular que los laterales** o de **caño redondo** (el mismo de los barrotes). Con caño redondo, los tramos se alojan en agujeros de los laterales (que van completos), con el borde del agujero a **0,5 cm** del extremo; el vano interior descuenta ese margen y el diámetro, y esas piezas se cortan y cuentan junto con los barrotes. El refuerzo central también va completo como los laterales y los tramos pasan por sus agujeros.
- **Refuerzo central opcional** (check): con el mismo perfil del marco o uno propio, y con dos formas de cruce:
  - **dos tramos** por barrote, que terminan contra el refuerzo, o
  - **pasante**: un barrote continuo que atraviesa el refuerzo por agujeros.
- **Extremos de los barrotes en los laterales**:
  - **a tope** contra la cara interior del lateral, o
  - **alojados**: el barrote entra por un **agujero en la cara interior** del lateral, lo atraviesa y se frena 1 mm antes de la cara exterior (`freno` configurable). Queda **centrado por el agujero**, soldado y **liso por fuera**.
- **Perfiles editables**: diámetros, lados y espesores reales del proveedor, y recomendación del perfil de marco según el caño redondo elegido.
- **Vista previa en plano** (SVG) de la reja activa, con cotas reales.

### Corte y materiales
- Optimizador 1D por sección con **ancho de disco (kerf)**, **refilado de punta**, largo comercial y **reutilización de sobrantes** del inventario.
- Informa caños a comprar, piezas, suma de piezas, pérdidas por disco, sobrante final y **aprovechamiento**.
- **Plan unificado**: un caño puede contener piezas de varias rejas; se marca qué pieza es de qué reja.
- **Inventario de sobrantes** para futuros trabajos (guardar los de la obra, agregar a mano).

### Presupuesto (solo costos)
- **Materiales**: precio por caño según la sección.
- **Consumibles**: discos, pintura y otros (una vez por obra).
- **Mano de obra por reja**: por **horas × valor hora** o **monto fijo**.
- Total de la obra. **No** incluye margen de ganancia ni impuestos; si falta un precio, se avisa y ese subtotal no entra en el total.

### Salidas
- **Hoja de taller imprimible**: datos de armado, plano, lista de cortes, **plan de cortes con las barras de color de cada caño** (piezas, pérdidas de disco y sobrantes, igual que en la web) y presupuesto. **Cada reja arranca en su propia hoja**, y «qué sale de cada caño» también empieza en hoja nueva.
- **PDF** = **copia fiel de la hoja de taller**: se renderiza ese mismo HTML (html2canvas + jsPDF, se cargan solo al usarlo) y el archivo sale idéntico a la impresión, **con el plan de cortes en color**. El **fondo es 100 % blanco** (sin grises ni tramas): el color queda en el texto, el plano y las barras. Los cortes de hoja se hacen en el borde de cada bloque, así que ninguna barra ni fila queda partida al medio. «Descargar PDF» y «Enviar por WhatsApp» usan ese mismo PDF. Si por algún motivo no se pudiera usar el DOM, cae a un PDF de texto equivalente.
- **Enviar por WhatsApp**: arma el PDF y lo comparte **como archivo adjunto** con la compartición nativa del sistema (Web Share API). Si el navegador no sabe compartir archivos (varios de escritorio), descarga el PDF y abre WhatsApp con el resumen para adjuntarlo con el clip.
- **CSV** de cortes y de materiales, con «;» y coma decimal para abrirlos directo en Excel en español.

## Requisitos y ejecución

Requiere **Node.js 18 o superior**.

```bash
npm install
npm run dev        # desarrollo: http://localhost:5173
npm test           # pruebas automatizadas
npm run test:watch # pruebas en modo watch
npm run typecheck  # chequeo de tipos
npm run build      # typecheck + compila a dist/
npm run preview    # sirve dist/ para probar la compilación
```

El proyecto usa rutas relativas (`base: './'`), así que `dist/` se puede servir desde cualquier subcarpeta.

### Publicación en GitHub Pages

La versión publicada vive en <https://shcdigital.github.io/reja-calc/>: cada push a `master` dispara
`.github/workflows/deploy.yml`, que instala dependencias, corre las pruebas, compila y publica `reja-calc/dist`
como artefacto de Pages. No hay que mantener ninguna rama `gh-pages` ni commitear `dist/`.

Para publicar el mismo repositorio en otra cuenta hay que crear el proyecto en GitHub, habilitar Pages con
origen **GitHub Actions** (`gh api -X PUT repos/<usuario>/<repo>/pages -f build_type=workflow`) y hacer push.

## Cómo se usa

1. Poné el **nombre de la obra** y cargá la primera **reja** (ancho y alto exteriores).
2. Usá **«Agregar reja»** para sumar más rejas; renombrá, duplicá o eliminá según haga falta.
3. Por reja:
   - **1. Ventana**: medidas exteriores.
   - **2. Perfiles**: caño redondo, perfil rectangular de los laterales y su orientación, perfil de los tramos superior e inferior (mismo rectangular o caño redondo); refuerzo central sí/no y, si lleva, con qué perfil.
   - **3. Barrotes**: separación libre máxima/mínima o cantidad fija.
   - **4. Armado y refuerzo**: armado del marco, cruce del refuerzo, extremos de los barrotes, holgura por unión, holgura del agujero, freno de la punta y margen del agujero de MS/MI al borde del lateral.
4. **5. Parámetros de corte (obra)**: disco, largo comercial, refilado, largo mínimo de sobrante y reutilización.
5. Revisá **6. Vista previa**, **7. Lista de materiales** y **8. Plan de cortes** (podés ver toda la obra o solo los caños de la reja activa) e imprimí la hoja de taller.
6. En **9. Presupuesto y exportación**, activá el presupuesto, cargá precios por caño, consumibles y la mano de obra de cada reja.
7. **Descargar PDF** o **Enviar PDF por WhatsApp**, y exportá los CSV si los necesitás.

Las medidas que dependen de decisiones técnicas (disco, holgura por unión, refilado, agujeros, largo comercial, medidas reales de los caños, precios) son **parámetros editables**, no valores ocultos. El detalle de fórmulas está en `docs/FORMULAS.md`.

## Estructura

```
src/core/            Motor de cálculo (sin React, probado)
  types.ts             tipos del dominio (rejas, obra, perfiles, despiece, costos)
  profiles.ts          catálogo de perfiles y recomendación del marco
  geometry.ts          distribución de barrotes, despiece, cotas y plano (layout)
  cutting.ts           optimizador de corte 1D (disco, sobrantes, búsqueda exacta)
  materials.ts         lista de materiales, aprovechamiento y costos
  inventory.ts         sobrantes para futuros trabajos
  project.ts           pipeline: geometría → corte → materiales → costos
  obra.ts              obra multi-reja: modelo, persistencia, migración y plan unificado
  budget.ts            presupuesto de obra (materiales + consumibles + mano de obra)
  document.ts          nombre de archivo, resumen para compartir y contenido del PDF
  exporters.ts         CSV y descarga de archivos
  exporters.test.ts    pruebas de exportación (formato y seguridad del CSV)
  format.ts            formato de números y medidas (es-AR)
  helpers.ts           utilidades de pruebas/uso programático (makeConfig, catalog)
  *.test.ts            pruebas del motor (rejas, obra, budget, document)
src/ui/              Interfaz (React)
  App.tsx              pantalla principal (obra, reja activa, secciones 1–9)
  Preview.tsx          plano técnico de la reja en SVG
  CutPlanView.tsx      vista del plan de cortes por caño
  CutPlanParts.tsx     barras de color del plan y su leyenda (web y hoja de taller)
  Worksheet.tsx        hoja de taller imprimible (una hoja por reja)
  NumField.tsx         campo numérico
  pdf.ts               PDF = copia fiel de la hoja de taller (html2canvas + jsPDF)
  useObra.ts           estado de la obra y persistencia
  usePersistentState.ts  hook de estado persistido en localStorage
  *.test.ts(x)         pruebas de interfaz y del PDF
src/assets/          ilustración de portada (SVG propio)
src/styles.css       tema visual (paleta industrial de herrería)
docs/FORMULAS.md     fórmulas, convenciones de montaje y decisiones configurables
docs/ALGORITMO.md    algoritmo de optimización de corte
```

En la raíz del repositorio: `openspec/` (specs y cambios) y `.github/workflows/deploy.yml` (publicación en Pages).

## Cómo calcula (resumen)

Todas las longitudes se manejan en milímetros y los largos de corte se redondean a 0,1 mm.

- **Vano interior:** `Wi = W − 2·pf`, `Hi = H − 2·pfH`, donde `pf` es lo que queda a la vista del perfil de los laterales y `pfH` el de los tramos superior e inferior (igual a `pf`, o el diámetro `d` si son de caño redondo; en ese caso se suma el margen de 5 mm del borde del agujero al extremo del lateral).
- **Barrotes:** separación libre uniforme `g = (Hi − n·d) / (n + 1)`, con `n` automático (`n = max(1, ceil((Hi − g_máx) / (d + g_máx)))`) o fijo.
- **Extremos:** `endInset = pf + jg` si van a tope; `endInset = pared + freno` si entran en el agujero del lateral, así que el largo del barrote es `W − 2·endInset` (continuo) o `(W/2 − rw/2 − jg) − endInset` (en dos tramos).
- **Marco:** según el armado, los tramos completos miden `W` (u `H`) y los que van entre ellos descuentan el borde que los recibe (`pf` en los laterales, `pfH` en MS/MI) y la holgura por unión. Con MS/MI de caño redondo los laterales y el refuerzo central van siempre completos y MS/MI entran en sus agujeros: largo `W − 2·(pared + freno)`, con el borde del agujero a 5 mm del extremo.
- **Corte:** por cada caño, `Σ piezas + (n−1)·disco ≤ largo utilizable`, repartiendo disco, refilado y sobrante final de forma exacta.
- **Presupuesto:** `total = materiales + consumibles + mano de obra`.

`docs/FORMULAS.md` tiene las fórmulas completas y una tabla con los largos resultantes para los valores por defecto; `docs/ALGORITMO.md` explica el optimizador.

## Persistencia y compatibilidad

- La obra completa se guarda en `localStorage` bajo `reja:obra:v1`; el catálogo de perfiles editado en `reja:catalog:v1`; los sobrantes en `reja:inventory:v1`; y la unidad (mm/cm) en `reja:unit:v1`.
- Los datos de la versión de **una sola reja** (`reja:config:v1`, `reja:job:v1`) se migran automáticamente la primera vez y **no se borran**.
- Al leer datos guardados, los campos que falten toman el valor por defecto (por ejemplo, una obra vieja sin los extremos de barrotes queda **a tope**, con freno 1 mm y margen de MS/MI 5 mm). Una obra con MS/MI redondos y armado «tramos horizontales completos» se normaliza a «laterales completos». Nada se rompe al actualizar.
- «Restaurar valores iniciales» devuelve todo a los valores por defecto.

## Pruebas

El motor de cálculo es puro (no depende de React) y está cubierto por pruebas con **Vitest**: geometría y despiece, optimizador de corte, materiales, obra multi-reja, migración, presupuesto y contenido del documento. La interfaz tiene una prueba de humo (render en servidor) y el PDF de texto de respaldo una prueba con jsPDF simulado. El render HTML→PDF necesita un navegador, por eso no tiene prueba unitaria.

```bash
npm test
```

## Aviso

El refuerzo central, si la reja lo lleva, es un componente estructural cuya suficiencia depende de las dimensiones, las fijaciones y las cargas.
Esta herramienta calcula medidas y cortes; **no verifica que la reja sea estructuralmente segura**.
