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
| d | Diámetro exterior del caño redondo |
| pared | Espesor de pared del perfil rectangular (marco y refuerzo) |
| jg | Holgura por unión: se descuenta en **cada extremo** que se suelda a tope (por defecto 0) |
| freno | Cuánto se frena la punta del barrote antes de la cara opuesta del lateral (por defecto 1) |
| k | Ancho del disco de corte (por defecto 3) |

Orientación del perfil rectangular: «lado menor a la vista» (el lado mayor sale hacia afuera) o «lado mayor a la vista».
Recomendación inicial: el perfil de menor sección cuyo lado mayor sea ≥ d (el barrote se suelda contra la cara de ese ancho), con el lado mayor hacia afuera.

## Vano interior

```
Wi = W − 2·pf        Hi = H − 2·pfH
```

`pfH` es el perfil de los tramos superior e inferior: el mismo rectangular del marco (`pf`) o, a elección, el caño redondo de los barrotes (su diámetro `d`). Los laterales son siempre el perfil rectangular del marco.

Con refuerzo central, el ancho libre a cada lado del refuerzo es `sector = (Wi − rw) / 2`.
Sin refuerzo central, `rw = 0`, `sector = Wi / 2` y los barrotes ocupan todo el vano.

## Barrotes (horizontales)

Separación libre uniforme `g`, medida entre superficies, incluyendo las dos que quedan contra el marco:

```
n·d + (n + 1)·g = Hi   →   g = (Hi − n·d) / (n + 1)
```

- **Automático:** `n = max(1, ceil((Hi − g_máx) / (d + g_máx)))` — el menor n con `g ≤ g_máx`.
- Si ese `g` queda por debajo de la separación mínima, los dos límites son incompatibles: se mantiene la cuenta que respeta el máximo, se avisa y se proponen alternativas (n y n−1).
- **Manual:** se usa el n indicado; se avisa si `g > g_máx` o `g < g_mín`; error si `g ≤ 0`.
- Borde superior del barrote i (i = 0…n−1, desde el borde exterior): `pfH + g + i·(d + g)`. La distribución es simétrica.

## Marco

| Armado | Tramos superior/inferior (MS, MI) | Laterales (LI, LD) |
|---|---|---|
| Tramos horizontales completos | `W` | `Hi − 2·jg` (entre MS y MI) |
| Laterales completos | `Wi − 2·jg` (entre LI y LD) | `H` |

Los tramos MS/MI usan el perfil rectangular del marco o, si se elige, el caño redondo de los barrotes. Con caño redondo, `pfH = d`, así que el vano interior (`Hi`) y el largo de los laterales que van entre MS y MI se miden con ese diámetro; las piezas MS/MI comparten sección con los barrotes y se cortan y cuentan juntas en el plan.

## Refuerzo central (RC) — opcional

Se activa o desactiva por reja con un check. Cuando está activo:

- Centrado en `W/2`. Largo `Hi − 2·jg` (va entre MS y MI).

## Barrotes y refuerzo central

El largo de cada barrote depende de **cómo termina en los laterales** (`butt` = a tope, `inserted` = alojado en un agujero) y de **cómo cruza el refuerzo central** (`split` / `through`).

Distancia del extremo del barrote al borde exterior de la reja:

```
endInset = pf + jg            (a tope: el barrote apoya en la cara interior del lateral)
endInset = pared + freno      (alojado: atraviesa la pared interior y se frena antes de la cara exterior)
lateralPenetration = pf − endInset      → cuánto entra en cada lateral
```

Agujero del lateral (solo en modo alojado): Ø `d + holgura`, en la **cara interior**, uno por barrote y a la altura de su eje. La cara exterior queda lisa. Aviso si `d + holgura > profundidad_del_marco − 2·pared` (el agujero tocaría las paredes laterales del perfil). En el barrote **pasante** por el refuerzo central rige la misma regla: aviso si `d + holgura > profundidad_del_refuerzo − 2·pared`.

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
`T = largo comercial − refilado de punta` para caños nuevos; `T = largo del sobrante` para sobrantes del inventario.

## Aprovechamiento

```
material_empleado = caños_nuevos × largo_comercial + Σ largo de sobrantes usados
aprovechamiento   = Σ largo de piezas / material_empleado
```

## Obra multi-reja

Una **obra** agrupa una o más **rejas**. Del conjunto solo el empaquetado es común:

- **Parámetros de corte (obra):** largo comercial, disco, refilado de punta, reutilizar sobrantes y largo mínimo de sobrante. Son los mismos para todas las rejas (se compran los mismos caños y se corta con el mismo disco).
- **Geometría (por reja):** W, H, perfiles, orientación, barrotes, armado del marco, holgura por unión, extremos de los barrotes (a tope o alojados en el lateral), freno y holgura del agujero.
- **Plan unificado:** las piezas de todas las rejas se juntan y se optimizan por sección (ver `ALGORITMO.md`). La cantidad de caños de la obra es ≤ la suma de las rejas por separado.
- **Corte por reja:** un caño del plan unificado puede contener piezas de varias rejas; la vista por reja muestra esos caños marcando las piezas de las demás.

## Costos y presupuesto

```
materiales   = Σ (caños_nuevos_de_la_sección × precio_por_caño_de_la_sección)   [sobre el plan unificado]
consumibles  = discos + pintura + otros                                          [una vez por obra]
mano_de_obra = Σ por reja (horas × valor_hora   o   monto_fijo)                  [según el modo de cada reja]
total        = materiales + consumibles + mano_de_obra
```

El total **no** incluye margen de ganancia ni impuestos. Si falta el precio de una sección con caños a comprar, se informa y ese subtotal no entra en el total.

## Decisiones configurables

Largo comercial, disco, holgura por unión, refilado de punta, perfil de los tramos superior e inferior (mismo rectangular del marco o caño redondo de los barrotes), extremos de los barrotes (a tope o alojados en un agujero del lateral), freno de la punta, holgura de agujero, medidas reales de cada perfil, largo mínimo de sobrante reutilizable, precios por caño, consumibles y valor hora de mano de obra.
Sin cortes a inglete: todas las uniones del marco son a tope a 90°.
