# Spec Delta

## Purpose

Genera un documento profesional de la obra en PDF descargable y comparte un resumen de la obra por WhatsApp, para que el herrero entregue el trabajo al cliente sin rearmar la información a mano.

## ADDED Requirements

### Requirement: Documento de obra descargable en PDF

El sistema SHALL generar y descargar un archivo PDF del documento de obra armado por la propia aplicación, sin depender de servicios externos. El documento SHALL incluir el nombre de la obra, la lista de rejas con sus medidas exteriores, el despiece y el plano de cada reja, el plan de cortes y los materiales consolidados de la obra y, si el presupuesto está habilitado, sus conceptos y el total. El documento SHALL incluir el aviso estructural.

#### Scenario: Descargar el PDF de la obra

- **WHEN** el usuario solicita descargar el PDF
- **THEN** el sistema SHALL generar un archivo PDF con el contenido de la obra y SHALL iniciar su descarga

#### Scenario: El PDF incluye todas las rejas

- **WHEN** la obra tiene varias rejas
- **THEN** el PDF SHALL contener una sección por reja y SHALL incluir además los totales consolidados de la obra

#### Scenario: El PDF informa que es una herramienta de cálculo

- **WHEN** se genera el PDF
- **THEN** el documento SHALL incluir el aviso de que la herramienta calcula medidas y cortes y no verifica la seguridad estructural de la reja

#### Scenario: Nombre de archivo seguro

- **WHEN** el nombre de la obra contiene caracteres no válidos para un nombre de archivo
- **THEN** el sistema SHALL construir un nombre de archivo válido a partir del nombre de la obra

### Requirement: Documento de obra imprimible

El sistema SHALL ofrecer una versión imprimible del documento de obra que oculte los controles de la interfaz al imprimir y que incluya el contenido de todas las rejas de la obra.

#### Scenario: Imprimir o guardar como PDF del navegador

- **WHEN** el usuario elige imprimir el documento de obra
- **THEN** la versión impresa SHALL mostrar el contenido de la obra sin los controles de la pantalla, permitiendo guardarla como PDF desde el navegador

### Requirement: Compartir la obra por WhatsApp

El sistema SHALL permitir compartir la obra por WhatsApp mediante un enlace que abra la aplicación con un resumen de texto ya redactado. El resumen SHALL incluir el nombre de la obra, las rejas con sus medidas y los totales de materiales y costos cuando estén disponibles.

#### Scenario: Abrir WhatsApp con el resumen

- **WHEN** el usuario elige compartir la obra por WhatsApp
- **THEN** el sistema SHALL abrir WhatsApp con un mensaje precargado que resuma la obra y sus rejas

#### Scenario: Resumen sin presupuesto

- **WHEN** el presupuesto no está habilitado o faltan precios
- **THEN** el resumen SHALL omitir los importes de costos o SHALL aclarar que no están incluidos, sin mostrar un total incorrecto

### Requirement: Compartición nativa cuando esté disponible

El sistema SHALL usar la compartición nativa del dispositivo (Web Share API) cuando esté disponible y SHALL recurrir al enlace de WhatsApp cuando no lo esté.

#### Scenario: Compartir con la hoja nativa del sistema

- **WHEN** el dispositivo ofrece compartición nativa y el usuario elige compartir
- **THEN** el sistema SHALL invocar la hoja de compartición del sistema con el resumen de la obra

#### Scenario: Compartición nativa no disponible

- **WHEN** el dispositivo no ofrece compartición nativa
- **THEN** el sistema SHALL usar el enlace de WhatsApp como alternativa
