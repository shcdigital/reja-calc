# Spec Delta

## Purpose

Consolida las piezas de todas las rejas de una obra y las optimiza como un único plan de cortes y una única lista de materiales, manteniendo el desglose por reja.

## ADDED Requirements

### Requirement: Consolidación de piezas por sección

El sistema SHALL reunir las piezas de todas las rejas de la obra y agruparlas por sección de caño, de modo que las piezas de una misma sección —provenientes de una o varias rejas— se optimicen en conjunto. Piezas de secciones distintas SHALL NOT mezclarse en un mismo caño.

#### Scenario: Rejas con el mismo caño se optimizan juntas

- **WHEN** dos o más rejas de la obra usan el mismo perfil de caño
- **THEN** las piezas de esas rejas SHALL entrar en un mismo plan de cortes de esa sección

#### Scenario: Secciones distintas no se mezclan

- **WHEN** la obra incluye rejas con perfiles de sección diferente
- **THEN** el sistema SHALL generar un grupo de plan de cortes por cada sección, sin combinar piezas de distintas secciones en un mismo caño

### Requirement: Compra única de material para la obra

El sistema SHALL calcular la cantidad de caños comerciales a comprar por sección sobre el plan unificado de la obra. La cantidad total a comprar de una sección SHALL NOT ser mayor que la suma de las cantidades que resultarían de planificar cada reja por separado.

#### Scenario: El plan unificado no compra más que la suma por reja

- **WHEN** se compara el material a comprar del plan unificado con la suma de los planes de cada reja por separado
- **THEN** la cantidad total de caños a comprar de cada sección en el plan unificado SHALL ser menor o igual a la suma por reja

#### Scenario: Materiales consolidados de la obra

- **WHEN** el usuario consulta la lista de materiales de la obra
- **THEN** SHALL ver, por sección, los caños a comprar, las longitudes, las pérdidas y el aprovechamiento correspondientes al conjunto de todas las rejas

### Requirement: Desglose por reja dentro del plan de obra

El sistema SHALL mantener el detalle por reja (plano, piezas, plan de cortes y materiales de esa reja) además de los totales de la obra.

#### Scenario: Ver el plan de una reja

- **WHEN** el usuario selecciona una reja
- **THEN** el sistema SHALL mostrar el plano, las piezas y el plan de cortes de esa reja

#### Scenario: Ver los totales de la obra

- **WHEN** el usuario consulta la vista de obra
- **THEN** el sistema SHALL mostrar los materiales, los cortes y los costos sumados de todas las rejas

### Requirement: Sobrantes a nivel obra

El sistema SHALL permitir reutilizar los sobrantes guardados al optimizar el plan de la obra y SHALL registrar como sobrantes de la obra los tramos reutilizables que resulten del plan unificado, aplicándolos al inventario una sola vez por obra.

#### Scenario: Guardar sobrantes de la obra

- **WHEN** el usuario guarda los sobrantes del plan unificado
- **THEN** el sistema SHALL registrar los tramos reutilizables de todas las rejas y SHALL descontar del inventario los sobrantes que se hayan usado

#### Scenario: Reutilizar sobrantes en el plan de obra

- **WHEN** la reutilización de sobrantes está activa y hay sobrantes compatibles con una sección
- **THEN** el plan unificado SHALL usar esos sobrantes antes de recurrir a caños nuevos, respetando que cada pieza sale de un único tramo

### Requirement: Errores por reja no bloquean la obra

Una reja con errores de cálculo SHALL excluirse del plan unificado y SHALL informarse como aviso, sin impedir el cálculo de las restantes rejas de la obra.

#### Scenario: Reja con medidas inválidas

- **WHEN** una reja de la obra tiene medidas o parámetros inválidos
- **THEN** esa reja SHALL marcarse con su error, SHALL NOT aportar piezas al plan unificado y las demás rejas SHALL calcularse normalmente

#### Scenario: Obra sin rejas válidas

- **WHEN** ninguna reja de la obra se puede calcular
- **THEN** el sistema SHALL informar que no hay resultados para la obra y SHALL NOT mostrar un plan de cortes vacío como si fuera válido
