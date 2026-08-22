# Guía de Campos y Nombres de API - Zoho CRM (Módulo Debida_Diligencia)

Esta guía detalla los nombres de etiqueta de los campos (Label) y sus respectivos nombres de API (API Name) en Zoho CRM para el módulo personalizado **`Debida_Diligencia`** y sus subformularios.

---

## 1. Módulo Principal

* **Nombre de API del Módulo**: `Debida_Diligencia`

| Nombre del Campo (Etiqueta) | Nombre de API | Tipo de Datos / Opciones | Mapeado desde el Formulario |
| :--- | :--- | :--- | :--- |
| **Nombre de Debida Diligencia** | `Name` | Línea única (String) | Nombre completo (Natural) / Razón Social (Jurídico) |
| **Enlace de Formulario** | `Enlace_de_Formulario` | URL | Enlace firmado de debida diligencia |
| **Vigencia del enlace** | `Vigencia_del_enlace` | Fecha-hora (DateTime) | Fecha de expiración de enlace |
| **Estado del enlace** | `Estado_del_enlace` | Picklist (Lista) | Estado del link generado |
| **Estado** | `Estado` | Picklist (Lista) | Estado del expediente (ej. `"Completado"`, `"Aprobado"`) |
| **Tipo de Persona** | `Tipo_de_Persona` | Picklist (`"Persona Natural"` / `"Persona Jurídica"`) | Tipo de cliente |
| **Razón social** | `Raz_n_social` | Línea única (String) | Razón social (Solo Jurídico) |
| **RUC / NIT** | `RUC_NIT` | Línea única (String) | RUC o NIT de la empresa o persona |
| **Fecha de constitución** | `Fecha_de_constituci_n` | Fecha (Date) | Fecha constitución de empresa |
| **Actividad Principal** | `Actividad_Principal` | Línea única (String) | Profesión / Actividad económica principal |
| **Teléfono** | `Tel_fono` | Teléfono | Celular o teléfono de contacto |
| **Correo electrónico** | `Email` | Correo electrónico | Correo de contacto principal |
| **Email corporativo** | `Email_corporativo` | Correo electrónico | Correo de la empresa (Solo Jurídico) |
| **País** | `Pa_s` | Línea única (String) | País residencial / País de constitución |
| **Provincia** | `Provincia` | Línea única (String) | Provincia / Estado residencial u operacional |
| **Ciudad** | `Ciudad` | Línea única (String) | Ciudad residencial u operacional |
| **Dirección / Calle** | `Direccion_Calle` | Multilínea (Text Area) | Dirección completa |
| **Origen de Fondos** | `Origen_de_Fondos` | Picklist (Lista) | Origen de fondos de la operación |
| **Medio de Pago** | `Medio_de_Pago` | Picklist (Lista) | Método de pago (ej. transferencia, cheque) |
| **Propósito del inmueble** | `Prop_sito_del_inmueble` | Picklist (Lista) | Propósito de la transacción |
| **Monto anual estimado** | `Monto_anual_estimado` | Picklist (Lista) | Ingreso anual o monto anual estimado |
| **A nombre de otro** | `A_nombre_de_otro` | Checkbox (Boolean) | Indica si actúa a nombre de un tercero (Natural) |
| **Nombre de contacto** | `Nombre_de_contacto` | Lookup (Buscar en `Contacts`) | Contacto comercial asociado |
| **Proyecto** | `Proyecto` | Lookup (Buscar en módulo `Proyectos`) | Nombre del proyecto de interés |
| **Fecha de Ingreso** | `Fecha_de_Ingreso` | Fecha (Date) | Fecha en la que se guarda en CRM |

---

## 2. Subformulario: Beneficiarios Finales

* **Nombre de API del Subformulario**: `Beneficiario_Finales`

| Campo en CRM (Etiqueta) | Nombre de API | Tipo de Datos | Mapeado desde el Formulario |
| :--- | :--- | :--- | :--- |
| **Nombre completo** | `Nombre_completo` | Línea única (String) | Nombre del beneficiario final |
| **No. Identificación** | `No_Identificaci_n` | Línea única (String) | Cédula, pasaporte o documento de identidad |
| **Nacionalidad** | `Nacionalidad` | Picklist / Línea única | Nacionalidad del beneficiario |
| **% Participación** | `Participaci_n` | Decimal / Porcentaje | Porcentaje de acciones/participación |
| **Pais nac. / Residencia** | `Pais_nac_Residencia` | Línea única | País de nacimiento o residencia actual |

---

## 3. Subformulario: Gobierno Corporativo / Junta Directiva

* **Nombre de API del Subformulario**: `Gobierno_Coporativo_Junta_Directiva` *(Nota: No lleva la letra **r** intermedia, está escrito exactamente como `Coporativo` en la API)*

| Campo en CRM (Etiqueta) | Nombre de API | Tipo de Datos | Mapeado desde el Formulario |
| :--- | :--- | :--- | :--- |
| **Nombre y apellido** | `Nombre_y_apellido` | Línea única (String) | Nombre y apellido concatenados |
| **Cargo** | `Cargo` | Picklist / Línea única | Cargo en la junta (ej. Presidente, Director) |
| **Nacionalidad** | `Nacionalidad` | Picklist / Línea única | Nacionalidad del miembro |
| **Fecha de nacimiento** | `Fecha_de_nacimiento` | Fecha (Date) | Fecha de nacimiento |
| **No. Identificación** | `No_Identificaci_n` | Línea única (String) | Cédula, pasaporte o ID del miembro |
| **BF desde** | `BF_desde` | Fecha (Date) | Fecha en la que inicia como beneficiario final |
