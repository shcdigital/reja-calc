
## Purpose

Permite elegir el estilo de una reja (moderna o clásica) y deja preparado el dominio para otros productos (puertas, portones, frentes), incorporando el estilo clásico con medidas estándar argentinas.

## Requirements

### Requirement: Estilo de reja seleccionable

Cada reja SHALL tener un estilo elegible entre `moderna` y `clasica`. El estilo `moderna` SHALL usar marco de caño estructural y barrotes de caño redondo. El estilo `clasica` SHALL usar marco de planchuela y barrotes de hierro macizo cuadrado. El estilo por defecto para rejas nuevas y para rejas migradas sin estilo SHALL ser `moderna`.

#### Scenario: Reja nueva es moderna por defecto

- **WHEN** se crea una reja nueva
- **THEN** su estilo SHALL ser `moderna` y su cálculo SHALL coincidir con el comportamiento previo

#### Scenario: Cambiar el estilo recalcula la reja

- **WHEN** el usuario cambia el estilo de la reja activa de `moderna` a `clasica`
- **THEN** el sistema SHALL recalcular la geometría, el despiece, el plan de cortes y la vista previa con los parámetros del estilo clásico

#### Scenario: El estilo no afecta a las demás rejas

- **WHEN** el usuario cambia el estilo de la reja activa
- **THEN** las demás rejas de la obra SHALL conservar su estilo y configuración

### Requirement: Estilo clásico para ventanas

Para una reja de tipo `ventana` con estilo `clasica`, el sistema SHALL calcular un marco de planchuela con barrotes verticales de hierro macizo cuadrado insertados en agujeros de las planchuelas superior e inferior. El refuerzo central, si está habilitado, SHALL ser un travesaño horizontal. Las piezas del marco SHALL usar la sección de la planchuela y los barrotes SHALL usar la sección de la barra maciza cuadrada.

#### Scenario: Despiece del estilo clásico

- **WHEN** se calcula una reja clásica válida
- **THEN** el despiece SHALL incluir los cuatro tramos del marco con la sección de la planchuela y un barrote vertical por posición con la sección de la barra maciza cuadrada, con los largos correspondientes a barrotes insertados en las planchuelas

#### Scenario: Plan de cortes por sección

- **WHEN** se calcula una reja clásica
- **THEN** el plan de cortes SHALL agrupar las piezas de planchuela y las de barra maciza cuadrada en secciones distintas, con sus propias barras a comprar

#### Scenario: Perfil incompatible con el estilo

- **WHEN** una configuración guardada tiene un estilo clásico con un barrote redondo o un estilo moderno con una barra maciza
- **THEN** el sistema SHALL reemplazar el perfil incompatible por el perfil por defecto del estilo y recalcular sin usar el perfil equivocado

### Requirement: Catálogo estándar argentino para el estilo clásico

El catálogo por defecto SHALL incluir planchuelas estándar (1" × 1/8", 1" × 3/16", 1" × 1/4", 1 1/4" × 3/16", 1 1/4" × 1/4", 1 1/2" × 3/16", 1 1/2" × 1/4" y 2" × 1/4") y barras macizas cuadradas estándar de herrería argentina (5/16" = 7,94 mm, 3/8" = 9,53 mm, 7/16" = 11,11 mm, 1/2" = 12,70 mm, 9/16" = 14,29 mm, 5/8" = 15,88 mm, 3/4" = 19,05 mm, 7/8" = 22,22 mm y 1" = 25,40 mm), con etiquetas comerciales en español. El estilo clásico SHALL seleccionar por defecto el hierro macizo cuadrado de 1/2" y una planchuela de 1 1/4" × 3/16". El usuario SHALL poder editar o agregar perfiles como en el estilo moderno.

#### Scenario: Catálogo incluye planchuelas estándar

- **WHEN** se carga el catálogo por defecto
- **THEN** SHALL existir al menos una planchuela de 1" × 3/16" y una de 1 1/4" × 3/16" en la lista de perfiles rectangulares

#### Scenario: Catálogo incluye barras macizas cuadradas estándar

- **WHEN** se carga el catálogo por defecto
- **THEN** SHALL existir al menos una barra maciza cuadrada de 12,7 mm y una de 14,29 mm en la lista de perfiles de barrote, y el estilo clásico no SHALL ofrecer barras redondas

#### Scenario: Barrote moderno es caño redondo

- **WHEN** se configura una reja moderna
- **THEN** el selector de barrotes SHALL ofrecer únicamente caños redondos huecos, no barras macizas

#### Scenario: Barrote clásico es barra maciza cuadrada

- **WHEN** se configura una reja clásica
- **THEN** el selector de barrotes SHALL ofrecer únicamente barras macizas cuadradas, no caños ni barras redondas

### Requirement: Tipo de producto

Cada reja SHALL tener un tipo de producto. En esta versión solo SHALL estar implementado `ventana`. Los valores `puerta-abrir`, `puerta-corrediza`, `porton-dos-hojas`, `porton-corredizo` y `frente` SHALL existir como valores válidos del dominio para preparar la extensión futura, pero su geometría y su interfaz SHALL estar marcadas como no implementadas y no SHALL producir cálculos.

#### Scenario: Reja nueva es ventana por defecto

- **WHEN** se crea una reja nueva
- **THEN** su tipo de producto SHALL ser `ventana`

#### Scenario: Tipo de producto no implementado no calcula

- **WHEN** una reja tiene un tipo de producto distinto de `ventana`
- **THEN** el sistema SHALL informar que ese tipo aún no está implementado y no SHALL generar despiece ni plan de cortes

### Requirement: Persistencia y migración de estilo y tipo de producto

El sistema SHALL guardar el estilo y el tipo de producto de cada reja en el almacenamiento local. Al cargar una reja guardada sin esos campos, el sistema SHALL normalizarla a `moderna` y `ventana` sin perder el resto de la configuración.

#### Scenario: Migración de reja antigua

- **WHEN** se carga una obra guardada por una versión anterior sin los campos `style` y `productKind`
- **THEN** cada reja SHALL quedar con estilo `moderna` y tipo de producto `ventana`, conservando medidas, perfiles y parámetros

#### Scenario: Persistencia round-trip

- **WHEN** el usuario configura una reja clásica y recarga la aplicación
- **THEN** la reja SHALL restaurarse con estilo `clasica` y los mismos parámetros

### Requirement: Preparación para otros productos

El dominio SHALL exponer un punto único (función o registro) para resolver la geometría según el par `(productKind, style)`, de modo que agregar un nuevo producto solo requiera implementar ese caso sin modificar el resto del pipeline (corte, materiales, presupuesto). El pipeline de corte, materiales y presupuesto SHALL ser independiente del tipo de producto y del estilo.

#### Scenario: Pipeline reutilizable

- **WHEN** se agrega un nuevo tipo de producto en el futuro
- **THEN** el plan de cortes, la lista de materiales y el presupuesto SHALL seguir funcionando sin cambios, consumiendo las piezas que la geometría del nuevo producto genere
