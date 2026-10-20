# Spec Delta

## Purpose

Permite elegir el estilo de una reja (moderna o clásica) y deja preparado el dominio para otros productos (puertas, portones, frentes), incorporando el estilo clásico con medidas estándar argentinas.

## ADDED Requirements

### Requirement: Estilo de reja seleccionable

Cada reja SHALL tener un estilo elegible entre `moderna` y `clasica`. El estilo `moderna` SHALL reproducir el comportamiento actual (marco de caño estructural y barrotes de caño redondo). El estilo `clasica` SHALL usar marco de planchuela y barrotes de hierro macizo. El estilo por defecto para rejas nuevas y para rejas migradas sin estilo SHALL ser `moderna`.

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

Para una reja de tipo `ventana` con estilo `clasica`, el sistema SHALL calcular un marco de planchuela con barrotes de hierro macizo insertados en agujeros de los laterales, siguiendo la misma lógica de barrotes alojados que el estilo moderno. Las piezas del marco SHALL usar la sección de la planchuela y los barrotes SHALL usar la sección del hierro macizo.

#### Scenario: Despiece del estilo clásico

- **WHEN** se calcula una reja clásica válida
- **THEN** el despiece SHALL incluir los cuatro tramos del marco con la sección de la planchuela y un barrote por posición con la sección del hierro macizo, con los largos correspondientes a barrotes alojados

#### Scenario: Plan de cortes por sección

- **WHEN** se calcula una reja clásica
- **THEN** el plan de cortes SHALL agrupar las piezas de planchuela y las de hierro macizo en secciones distintas, con sus propios caños a comprar

### Requirement: Catálogo estándar argentino para el estilo clásico

El catálogo por defecto SHALL incluir planchuelas perforadas estándar (1" × 3/16", 1 1/4" × 3/16", 1 1/4" × 1/4" y 1 1/2" × 1/4") y barrotes de hierro macizo redondos estándar (1/2" = 12,7 mm, 9/16" = 14,3 mm, 5/8" = 15,9 mm y 3/4" = 19,1 mm), con etiquetas comerciales en español. El usuario SHALL poder editar o agregar perfiles como en el estilo moderno.

#### Scenario: Catálogo incluye planchuelas estándar

- **WHEN** se carga el catálogo por defecto
- **THEN** SHALL existir al menos una planchuela de 1" × 3/16" y una de 1 1/4" × 3/16" en la lista de perfiles rectangulares

#### Scenario: Catálogo incluye barrotes macizos estándar

- **WHEN** se carga el catálogo por defecto
- **THEN** SHALL existir al menos un perfil redondo de 12,7 mm y uno de 14,3 mm en la lista de perfiles redondos

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