# Proposal: Tipos de reja (moderna y clásica)

## Why

Hoy la calculadora modela un único tipo de reja: marco de caño estructural (redondo o rectangular) con barrotes de caño redondo. Muchos herreros trabajan también la **reja clásica** (marco de planchuela con agujeros y barrotes de hierro macizo), que hoy no se puede calcular ni presupuestar con la herramienta. Además, el modelo asume que toda reja es para una ventana, lo que impide extender la app a puertas, portones y frentes sin reestructurar el dominio. Esta mejora agrega el estilo clásico con medidas estándar argentinas y deja preparado el dominio para otros productos.

## What Changes

- **Selector de estilo de reja**: cada reja pasa a tener un estilo, `moderna` (el actual: caño redondo/rectangular para el marco y barrotes de caño redondo) o `clasica` (marco de planchuela con agujeros y barrotes de hierro macizo). El estilo por defecto es `moderna`, sin cambios de comportamiento para las rejas ya guardadas.
- **Estilo clásico (ventanas)**: marco de planchuela perforada con barrotes de hierro macizo insertados en agujeros de los laterales (caño masizo redondo, medidas estándar argentinas). Se reutiliza la geometría de barrotes alojados, con el marco de planchuela como perfil lateral.
- **Catálogo estándar argentino**: se agregan planchuelas perforadas (1" × 3/16", 1 1/4" × 3/16", 1 1/4" × 1/4", 1 1/2" × 1/4") y barrotes macizos redondos (1/2" = 12,7 mm, 9/16" = 14,3 mm, 5/8" = 15,9 mm, 3/4" = 19,1 mm) con sus etiquetas comerciales.
- **Preparación para otros productos**: se introduce el concepto de tipo de producto (`ventana` por ahora; reservados `puerta-abrir`, `puerta-corrediza`, `porton-dos-hojas`, `porton-corredizo`, `frente`) sin implementar su geometría aún. Las rejas existentes quedan como `ventana`.
- **Persistencia y migración**: las rejas guardadas sin estilo ni tipo de producto se normalizan a `moderna` / `ventana` sin pérdida.
- **BREAKING (interno)**: `ProjectConfig` suma los campos `style` y `productKind`. No rompe datos guardados (hay normalización), pero cambia la estructura de configuración.

## Capabilities

### New Capabilities

- `tipos-de-reja`: selección del estilo de reja (moderna/clásica) y del tipo de producto (ventana por ahora, con extensión reservada), con catálogo estándar argentino para el estilo clásico y preparación del dominio para puertas, portones y frentes.

### Modified Capabilities

<!-- Sin cambios a capabilities existentes: las specs principales del proyecto están vacías (openspec/specs/ solo tiene .gitkeep). -->

## Impact

- **Código**:
  - `src/core/types.ts`: nuevos campos `style` y `productKind` en `ProjectConfig`; nuevos tipos `RejaStyle` y `ProductKind`.
  - `src/core/profiles.ts`: entradas de catálogo estándar (planchuelas y barrotes macizos); helpers de estilo/producto.
  - `src/core/geometry.ts`: ramificación por estilo para el marco y los barrotes; el estilo clásico reutiliza la geometría de barrotes alojados con marco de planchuela.
  - `src/core/obra.ts`: normalización de configs guardadas (`moderna`/`ventana`).
  - `src/ui/App.tsx`: selector de estilo (y, si aplica, de tipo de producto) en la sección de perfiles.
  - `src/ui/Preview.tsx`, `Worksheet.tsx`, `pdf.ts`: etiquetas y leyendas según estilo (sin cambios de cálculo).
- **Datos**: `ProjectConfig` en `localStorage` gana `style` y `productKind`; migración defensiva en `normalizeConfig`.
- **Pruebas**: nuevos casos para el estilo clásico (geometría, despiece, plan de corte) y para la migración de configs.
- **Docs**: `README.md` y `docs/FORMULAS.md` documentan el estilo clásico y los tipos de producto reservados.