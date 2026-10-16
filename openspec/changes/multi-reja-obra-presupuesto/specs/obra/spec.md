# Spec Delta

## Purpose

Permite agrupar varias rejas en una misma obra, nombrarlas y conservarlas entre sesiones en el navegador, eligiendo en cada momento sobre qué reja se trabaja.

## ADDED Requirements

### Requirement: La obra contiene varias rejas

El sistema SHALL mantener una obra compuesta por una o más rejas. Cada reja SHALL tener un identificador estable, un nombre y su propia configuración de cálculo, independiente de las demás.

#### Scenario: Agregar una reja

- **WHEN** el usuario presiona «Agregar reja»
- **THEN** se agrega una reja nueva con un nombre autogenerado del tipo «Reja N» y esa reja queda seleccionada como la reja activa

#### Scenario: Editar afecta solo a la reja activa

- **WHEN** el usuario modifica parámetros de la ventana, perfiles, barrotes o costos
- **THEN** los cambios SHALL aplicarse únicamente a la reja activa y no SHALL modificar la configuración de las demás rejas

#### Scenario: La obra nunca queda vacía

- **WHEN** el usuario intenta eliminar la única reja de la obra
- **THEN** el sistema SHALL impedir que la obra quede sin rejas, ya sea bloqueando la acción o dejando una reja vacía

### Requirement: Nombres de reja para la obra

Cada reja SHALL tener un nombre editable que la identifique dentro de la obra, con un valor autogenerado por defecto. El nombre SHALL usarse para identificar la reja en los resultados, el documento y el resumen compartido.

#### Scenario: Renombrar una reja

- **WHEN** el usuario edita el nombre de una reja
- **THEN** el nuevo nombre SHALL mostrarse en la lista de rejas y en todos los resultados de esa reja

#### Scenario: Nombre autogenerado único

- **WHEN** se crea una reja nueva sin darle un nombre
- **THEN** el sistema SHALL asignar un nombre no repetido dentro de la obra

### Requirement: Gestión del conjunto de rejas

El sistema SHALL permitir seleccionar la reja activa, duplicar una reja existente y eliminar rejas de la obra.

#### Scenario: Seleccionar la reja activa

- **WHEN** el usuario elige otra reja de la lista
- **THEN** el sistema SHALL mostrar la configuración, el plano, los materiales y el plan de cortes de la reja elegida

#### Scenario: Duplicar una reja

- **WHEN** el usuario duplica una reja
- **THEN** se crea una reja nueva con una copia de la configuración de la original y un nombre distinto

#### Scenario: Eliminar una reja

- **WHEN** el usuario elimina una reja que no es la única de la obra
- **THEN** el sistema SHALL pedir confirmación y, si se confirma, quitar la reja y seleccionar otra reja activa

### Requirement: Persistencia de la obra en el navegador

El sistema SHALL guardar la obra completa (rejas, configuración, catálogo, inventario, unidad y reja activa) en el almacenamiento local del navegador y SHALL restaurarla al volver a abrir la aplicación. Si el almacenamiento local no está disponible, la aplicación SHALL seguir funcionando en memoria sin bloquearse.

#### Scenario: Recargar la aplicación conserva la obra

- **WHEN** el usuario recarga la página después de agregar rejas y editar sus valores
- **THEN** la obra SHALL restaurarse con las mismas rejas, nombres, configuraciones y reja activa

#### Scenario: Almacenamiento no disponible

- **WHEN** el almacenamiento local está deshabilitado o lleno
- **THEN** la aplicación SHALL continuar operando con los valores en memoria y SHALL NOT fallar

### Requirement: Migración desde los datos de una sola reja

El sistema SHALL migrar, en la primera apertura, los datos guardados por la versión anterior (configuración, catálogo, inventario, nombre de obra y unidad) a la reja 1 de una obra por defecto, sin perder información. Si ya existe una obra guardada, el sistema SHALL NOT sobrescribirla con datos antiguos.

#### Scenario: Primera apertura con datos anteriores

- **WHEN** la aplicación se abre por primera vez después de la actualización y existen datos de la versión de una sola reja
- **THEN** esos datos SHALL convertirse en la reja 1 de la obra y conservarse la configuración, el catálogo, el inventario y la unidad

#### Scenario: Datos antiguos junto a una obra existente

- **WHEN** ya existe una obra guardada y también quedan datos de la versión anterior
- **THEN** el sistema SHALL conservar la obra existente y SHALL NOT importar ni pisar sus datos con los antiguos
