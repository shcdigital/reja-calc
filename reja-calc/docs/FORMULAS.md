# Fórmulas y convenciones

Todas las longitudes en mm. Origen del plano: esquina superior izquierda exterior; Y hacia abajo.
Los largos de corte se redondean a 0,1 mm.

## Variables

| Símbolo | Significado |
|---|---|
| W, H | Ancho y alto **exteriores** de la reja terminada |
| pf | Dimensión del perfil de los **laterales** del marco que queda **a la vista** (en el plano de la reja) |
| pfH | Dimensión a la vista de los **tramos superior e inferior** (MS/MI): igual a `pf`, o al diámetro `d` si son de caño redondo |
| rw | Dimensión del refuerzo central a la vista (0 si la reja no lleva refuerzo) |
| d | Diámetro exterior del caño redondo o lado de la barra maciza cuadrada |
| pared | Espesor de pared del perfil rectangular hueco (marco y refuerzo) |
| jg | Holgura por unión: se descuenta en **cada extremo** que se suelda a tope (por defecto 0) |
| freno | Cuánto se frena la punta del barrote o de MS/MI antes de la cara opuesta del lateral (por defecto 1) |
| margen | Distancia desde el extremo superior/inferior del lateral hasta el borde del agujero de MS/MI redondos (por defecto 5 = 0,5 cm) |
| k | Ancho del disco de corte (por defecto 3) |

Orientación del perfil rectangular: «lado menor a la vista» (el lado mayor sale hacia afuera) o «lado mayor a la vista».
En la reja moderna se recomienda el perfil de menor sección cuyo lado mayor sea ≥ d (el barrote se suelda contra la cara de ese ancho), con el lado mayor hacia afuera. En la reja clásica se recomienda una planchuela plana con ancho suficiente para alojar el agujero del barrote y dejar material a los lados, también con el lado ancho hacia afuera.

## Vano interior

```
Wi = W − 2·pf
Hi = H − 2·pfH                    (MS/MI rectangulares)
Hi = H − 2·(margen + (Øagujero + d)/2)   (MS/MI de caño redondo)
```

`pfH` es el perfil de los tramos superior e inferior de la reja moderna: el mismo rectangular del marco (`pf`) o, a elección, el caño redondo de los barrotes (su diámetro `d`). Los laterales son siempre el perfil rectangular del marco. En la reja clásica los cuatro tramos son de la misma planchuela, así que `pfH = pf`.

Con MS/MI de caño redondo, los tramos se alojan en agujeros de la cara interior de los laterales. Por eso los laterales van **completos** (armado «laterales completos») y el borde del agujero queda a `margen` del extremo superior/inferior del lateral. El borde del caño arranca en `margen + (Øagujero − d)/2`, y de ahí sale el alto útil.

En la reja moderna, con refuerzo central el ancho libre a cada lado del refuerzo es `sector = (Wi − rw) / 2`; sin refuerzo, `rw = 0` y `sector = Wi / 2`.
En la reja clásica el travesaño es horizontal, así que el tramo libre vertical es `sector = (Hi − rw) / 2`; sin travesaño, `rw = 0` y `sector = Hi / 2`.

## Barrotes

En la reja moderna son caños redondos horizontales; en la clásica, barras macizas cuadradas verticales. En ambos casos la separación libre uniforme `g`, medida entre superficies, incluye las dos que quedan contra el marco:

```
n·d + (n + 1)·g = span   →   g = (span − n·d) / (n + 1)
```

`span` es el alto interior `Hi` en la reja moderna (barrotes horizontales) y el ancho interior `Wi` en la clásica (barrotes verticales).

- **Automático:** `n = max(1, ceil((span − g_máx) / (d + g_máx)))` — el menor n con `g ≤ g_máx`.
- Si ese `g` queda por debajo de la separación mínima, los dos límites son incompatibles: se mantiene la cuenta que respeta el máximo, se avisa y se proponen alternativas (n y n−1).
- **Manual:** se usa el n indicado; se avisa si `g > g_máx` o `g < g_mín`; error si `g ≤ 0`.
- Coordenada inicial del barrote i (i = 0…n−1): `inicio + g + i·(d + g)`. Para barras horizontales se mide en Y desde el borde superior (`inicio = pfH`, o `inicio = margen + (Øagujero + d)/2` si MS/MI son redondos). Para barras verticales se mide en X desde el borde izquierdo (`inicio = pf`). La distribución es simétrica.

## Marco

| Armado | Tramos superior/inferior (MS, MI) | Laterales (LI, LD) |
|---|---|---|
| Tramos horizontales completos (MS/MI rectangulares) | `W` | `Hi − 2·jg` (entre MS y MI) |
| Laterales completos (MS/MI rectangulares) | `Wi − 2·jg` (entre LI y LD) | `H` |
| MS/MI de caño redondo (siempre laterales completos) | `W − 2·(pared + freno)` (alojados) | `H` |

En la reja moderna, los tramos MS/MI usan el perfil rectangular del marco o, si se elige, el caño redondo de los barrotes. Con caño redondo, los MS/MI **siempre se alojan** en agujeros de los laterales, que van completos: su largo es `W − 2·(pared + freno)` y comparten sección con los barrotes. El armado «tramos horizontales completos» no aplica a MS/MI redondos. La reja clásica no usa MS/MI redondos: los cuatro tramos son planchuela.

Agujeros de los laterales: Ø `d + holgura`, en la cara interior. Si los barrotes van alojados, uno por barrote; si MS/MI son redondos, además uno para MS y otro para MI con el eje a `margen + Øagujero/2` del extremo superior e inferior. En el caño hueco la cara exterior queda lisa; en la planchuela clásica la punta queda embutida. Aviso si el agujero no entra en el hueco del perfil (`Øagujero > profundidad − 2·pared`).

## Refuerzo central (RC) — opcional

Se activa o desactiva por reja con un check. Cuando está activo:

- Centrado en `W/2`. Con MS/MI rectangulares, largo `Hi − 2·jg` (va entre MS y MI).
- Con MS/MI de caño redondo, el refuerzo va **completo como los laterales** (largo `H`, desde el borde superior al inferior) y sobresale por encima/debajo de los tramos redondos. Lleva 2 agujeros Ø `d + holgura` para MS/MI, con los ejes a `margen + Øagujero/2` de cada extremo; los tramos pasan por esos agujeros. Si los barrotes son pasantes, lleva además un agujero por barrote.

## Barrotes y refuerzo central (reja moderna)

El largo de cada barrote depende de **cómo termina en los laterales** (`butt` = a tope, `inserted` = alojado en un agujero) y de **cómo cruza el refuerzo central** (`split` / `through`).

Distancia del extremo del barrote al borde exterior de la reja:

```
endInset = pf + jg            (a tope: el barrote apoya en la cara interior del lateral)
endInset = pared + freno      (alojado: atraviesa la pared interior y se frena antes de la cara exterior)
lateralPenetration = pf − endInset      → cuánto entra en cada lateral
```

Agujero del lateral para los barrotes (solo en modo alojado): Ø `d + holgura`, en la **cara interior**, uno por barrote y a la altura de su eje. La cara exterior queda lisa. Aviso si `d + holgura > profundidad_del_marco − 2·pared` (el agujero tocaría las paredes laterales del perfil). En el barrote **pasante** por el refuerzo central rige la misma regla: aviso si `d + holgura > profundidad_del_refuerzo − 2·pared`.

- **Sin refuerzo (check desactivado):** 1 pieza `B01…Bnn` por barrote, de largo `W − 2·endInset`, continua de lateral a lateral.
- **Dos tramos (split):** por barrote, 2 piezas `B01-I` / `B01-D` de largo `(W/2 − rw/2 − jg) − endInset` (`sector − 2·jg` si van a tope). No hay superposición con el refuerzo.
- **Pasante (through):** 1 pieza de largo `W − 2·endInset` por barrote. El refuerzo lleva un agujero de Ø `d + holgura` por barrote (el hueco evita la superposición de material); se anota en la observación de RC.

Ejemplos con los valores por defecto (W 1500, marco 40 × 20 a la vista 20, pared 2, caño Ø31,75, jg 0, freno 1):

| Extremos | Cruce | Largo del barrote |
|---|---|---|
| a tope | split | 720 × 2 por barrote |
| a tope | through o sin refuerzo | 1.460 |
| alojado | split | 737 × 2 por barrote |
| alojado | through o sin refuerzo | 1.494 |

## Reja clásica (planchuela y barra maciza cuadrada)

La reja clásica usa:

- **Marco:** cuatro tramos de la misma planchuela maciza.
- **Barrotes:** barras macizas cuadradas verticales, insertadas en agujeros de las planchuelas superior e inferior.
- **Travesaño central opcional:** planchuela horizontal al medio. Los barrotes pueden cortarse en dos tramos (`split`) o pasar por agujeros del travesaño (`through`).

Para que el agujero del barrote entre en la planchuela, esta se usa **plana**: el lado angosto queda a la vista (`pf = espesor`) y el lado ancho hacia afuera (`profundidad = ancho`). Por ejemplo, una planchuela de 1 1/4" × 3/16" con barra de 1/2" deja 9 mm de material a cada lado del agujero.

En la reja clásica, `Hi = H − 2·pf`. Los barrotes se distribuyen sobre el ancho interior:

```
Wi = W − 2·pf
n·d + (n + 1)·g = Wi
```

El largo del barrote se mide en vertical. La planchuela es maciza, así que la punta entra en su espesor visible y se frena antes de la cara exterior:

```
endInset = freno
penetración = pf − freno
barrote continuo = H − 2·freno
tramo con travesaño = H/2 − rw/2 − jg − freno
```

Agujeros: uno por barrote en cada planchuela horizontal, de sección cuadrada `d + holgura`. Se avisa si el agujero no entra en el ancho de la planchuela (`d + holgura > profundidad`).

Barras macizas cuadradas estándar de herrería en Argentina (pulgadas convertidas a mm): 5/16" = 7,94; 3/8" = 9,53; 7/16" = 11,11; 1/2" = 12,70; 9/16" = 14,29; 5/8" = 15,88; 3/4" = 19,05; 7/8" = 22,22; 1" = 25,40. La reja clásica solo ofrece barras cuadradas; la moderna, solo caños redondos.

## Plan de corte y pérdidas por disco

Para un tramo de largo utilizable `T` con `n` piezas de largo `p_i`:

```
necesario = Σp + (n−1)·k          debe ser ≤ T
resto     = T − necesario
corte_fin = min(k, resto)         separa la última pieza del resto; 0 si la pieza termina justo al final
pérdida   = (n−1)·k + corte_fin
sobrante  = resto − corte_fin
```

Se cumple siempre `Σp + pérdida + refilado + sobrante = largo del tramo`. Cada corte se cuenta una sola vez.
`T = largo comercial − refilado de punta` para barras nuevas; `T = largo del sobrante` para sobrantes del inventario.

## Aprovechamiento

```
material_empleado = barras_nuevas × largo_comercial + Σ largo de sobrantes usados
aprovechamiento   = Σ largo de piezas / material_empleado
```

## Obra multi-reja

Una **obra** agrupa una o más **rejas**. Del conjunto solo el empaquetado es común:

- **Parámetros de corte (obra):** largo comercial, disco, refilado de punta, reutilizar sobrantes y largo mínimo de sobrante. Son los mismos para todas las rejas (se compran los mismos perfiles y se corta con el mismo disco).
- **Geometría (por reja):** W, H, perfiles, orientación, barrotes, armado del marco, holgura por unión, extremos de los barrotes (a tope o alojados en el marco), freno y holgura del agujero.
- **Plan unificado:** las piezas de todas las rejas se juntan y se optimizan por sección (ver `ALGORITMO.md`). La cantidad de barras de la obra es ≤ la suma de las rejas por separado.
- **Corte por reja:** un tramo del plan unificado puede contener piezas de varias rejas; la vista por reja muestra esos tramos marcando las piezas de las demás.

## Costos y presupuesto

```
materiales   = Σ (barras_nuevas_de_la_sección × precio_por_barra_de_la_sección)   [sobre el plan unificado]
consumibles  = discos + pintura + otros                                          [una vez por obra]
mano_de_obra = Σ por reja (horas × valor_hora   o   monto_fijo)                  [según el modo de cada reja]
total        = materiales + consumibles + mano_de_obra
```

El total **no** incluye margen de ganancia ni impuestos. Si falta el precio de una sección con barras a comprar, se informa y ese subtotal no entra en el total.

## Decisiones configurables

Largo comercial, disco, holgura por unión, refilado de punta, perfil de los tramos superior e inferior (mismo rectangular del marco o caño redondo de los barrotes), extremos de los barrotes (a tope o alojados en un agujero del lateral), freno de la punta, margen del agujero de MS/MI al borde del lateral, holgura de agujero, medidas reales de cada perfil, largo mínimo de sobrante reutilizable, precio por barra/perfil, consumibles y valor hora de mano de obra.
Sin cortes a inglete: todas las uniones del marco son a tope a 90°.

## Estilos de reja

- **Moderna** (por defecto): marco de caño estructural (rectangular y, opcionalmente, MS/MI de caño redondo) y barrotes de caño redondo. Comportamiento descrito en las secciones anteriores.
- **Clásica**: marco de planchuela y barrotes verticales de hierro macizo cuadrado, insertados en las planchuelas superior e inferior. Los cuatro tramos del marco son de la misma planchuela; el refuerzo central, si se habilita, es un travesaño horizontal. La planchuela se orienta con el lado angosto a la vista y el ancho hacia afuera para que entre el agujero del barrote.
- **Tipos de producto**: por ahora solo `ventana`. Los valores `puerta-abrir`, `puerta-corrediza`, `porton-dos-hojas`, `porton-corredizo` y `frente` están reservados en el dominio; su geometría no está implementada y produce el error `product-not-implemented`.
