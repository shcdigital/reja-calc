# Spec Delta

## Purpose

Calcula el presupuesto de la obra sumando el costo de los materiales, los consumibles y la mano de obra, para que el herrero pueda cotizar el trabajo completo.

## ADDED Requirements

### Requirement: Total de obra por suma de conceptos

El sistema SHALL calcular el presupuesto de la obra como la suma de materiales (caños a comprar) más consumibles más mano de obra. El sistema SHALL NOT agregar margen de ganancia ni impuestos al total.

#### Scenario: Desglose de conceptos

- **WHEN** el usuario consulta el presupuesto de la obra
- **THEN** el sistema SHALL mostrar el subtotal de materiales, el de consumibles y el de mano de obra, y el total de la obra como su suma

#### Scenario: El total no incluye margen ni impuestos

- **WHEN** el usuario consulta el total de la obra
- **THEN** el total SHALL ser exactamente materiales + consumibles + mano de obra, sin porcentajes de ganancia ni de impuestos

#### Scenario: Sin precios cargados

- **WHEN** no hay precios cargados para ningún material
- **THEN** el sistema SHALL mostrar las cantidades y SHALL NOT inventar importes, indicando que faltan precios

### Requirement: Costo de materiales por sección

El sistema SHALL calcular el costo de materiales multiplicando la cantidad de caños a comprar de cada sección por el precio por caño cargado para esa sección, y SHALL sumar los subtotales de todas las secciones de la obra. Si falta el precio de una sección con caños a comprar, el sistema SHALL informarlo y SHALL NOT incluir ese subtotal en el total.

#### Scenario: Sección compartida por varias rejas

- **WHEN** varias rejas de la obra usan la misma sección de caño con un precio cargado
- **THEN** el sistema SHALL multiplicar la cantidad total de caños de esa sección (de toda la obra) por el precio y SHALL incluir el subtotal una sola vez

#### Scenario: Falta el precio de una sección

- **WHEN** una sección tiene caños a comprar pero no tiene precio cargado
- **THEN** el sistema SHALL listar esa sección como «sin precio» y el total SHALL NOT incluir su costo

### Requirement: Consumibles de la obra

El sistema SHALL permitir cargar consumibles a nivel obra (al menos discos de corte, pintura y otros consumibles) y SHALL sumarlos al presupuesto una sola vez para toda la obra.

#### Scenario: Consumibles se cuentan una vez

- **WHEN** el usuario carga un valor de consumibles para la obra
- **THEN** ese valor SHALL incluirse una sola vez en el presupuesto, independientemente de la cantidad de rejas

### Requirement: Mano de obra por reja según modo elegido

Cada reja SHALL tener un modo de mano de obra elegible entre «por horas» y «monto fijo». En modo «por horas», el costo de esa reja SHALL ser las horas estimadas multiplicadas por un valor hora de la obra. En modo «monto fijo», el costo SHALL ser el monto cargado para esa reja. El sistema SHALL sumar la mano de obra de todas las rejas.

#### Scenario: Mano de obra por horas

- **WHEN** una reja está en modo «por horas» con horas estimadas y el valor hora de la obra definido
- **THEN** el costo de mano de obra de esa reja SHALL ser horas × valor hora

#### Scenario: Mano de obra por monto fijo

- **WHEN** una reja está en modo «monto fijo» con un monto cargado
- **THEN** el costo de mano de obra de esa reja SHALL ser ese monto, sin depender del valor hora

#### Scenario: Cambiar el valor hora recalcula las rejas por horas

- **WHEN** el usuario cambia el valor hora de la obra
- **THEN** SHALL recalcularse la mano de obra de todas las rejas en modo «por horas» y SHALL mantenerse igual la de las rejas en modo «monto fijo»

### Requirement: Comportamiento con presupuesto incompleto

El sistema SHALL distinguir entre un presupuesto sin precios y uno parcial, y SHALL informar qué conceptos faltan en lugar de presentar un total engañoso.

#### Scenario: Presupuesto parcial

- **WHEN** hay precios cargados para algunos materiales o conceptos pero faltan otros
- **THEN** el sistema SHALL mostrar el total de lo cargado y SHALL indicar explícitamente qué falta para completar el presupuesto
