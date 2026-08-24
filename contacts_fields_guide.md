# Guía de Campos y Nombres de API - Zoho CRM (Módulo Contacts)

Esta guía detalla los nombres de etiqueta de los campos (Label) y sus respectivos nombres de API (API Name) en Zoho CRM para el módulo de **`Contacts`** (Contactos), incluyendo campos del Representante Legal (RL), Junta Directiva (GJC) y Beneficiarios Finales (BF) según los datos provistos.

---

## 1. Datos Generales y del Representante Legal (1 RL)

| Rótulo del Campo (Etiqueta) | Nombre de API | Tipo de Datos | Descripción / Uso |
| :--- | :--- | :--- | :--- |
| **Apellidos** | `Last_Name` | Línea única | Apellidos del contacto principal |
| **Apellido** | `Apellido` | Línea única | Apellido |
| **Asistente** | `Assistant` | Línea única | Nombre del asistente |
| **Bancos** | `Bancos` | Lista de selección | Información bancaria |
| **Beneficiario Final** | `Beneficiario_Final` | Línea única | Nombre de beneficiario final |
| **Bien Para la Persona de Nombre** | `Bien_Para_la_Persona_de_Nombre` | Línea única | Detalle de bienes |
| **Buyer Persona** | `Buyer_Persona` | Selección múltiple | Clasificación comercial |
| **C.I.P./ Pasaporte** | `C_I_P_Pasaporte` | Línea única | Identificación o pasaporte alternativo |
| **Campaña** | `Campa_a` | Línea única | Campaña comercial |
| **Cantidad de Visitas** | `Cantidad_de_Visitas` | Número | Número de visitas |
| **Cargo Junta Directiva** | `Cargo_Junta_Directiva` | Línea única | Cargo en junta directiva |
| **Cargo que Desempeña** | `Cargo_que_Desempe_a` | Línea única | Ocupación laboral |
| **Carta de Autorización de APC** | `Carta_de_Autorizaci_n_de_APC` | Booleano | Autorización firmada |
| **Cédula** | `C_dula` | Línea única | Documento de identidad (cédula principal) |
| **Cédula de Identidad Personal** | `C_dula_de_Identidad_Personal` | Línea única | Documento de identidad nacional |
| **Cédula o Pasaporte** | `C_dula_o_Pasaporte` | Línea única | Cédula o número de pasaporte |
| **1 RL - Nombre y Apellido** | `Nombre_y_Apellido` | Línea única | Nombre completo del Representante Legal |
| **1 RL - No. Identificación** | `RL_No_Identificaci_n` | Línea única | Documento de identidad del Representante Legal |
| **1 RL - Teléfono** | `RL_Tel_fono` | Teléfono | Teléfono del Representante Legal |
| **1 RL - Fecha de Nacimiento** | `aaa` | Fecha | Fecha de nacimiento del Representante Legal |
| **1 RL - Nacionalidad** | `RL_Nacionalidad` | Lista de selección | Nacionalidad del Representante Legal |
| **1 RL - Profesión / Ocupación** | `RL_Profesi_n_Ocupaci_n` | Línea única | Profesión del Representante Legal |
| **1 RL - Actividad Económica** | `RL_Actividad_Econ_mica` | Línea única | Actividad económica del Representante Legal |
| **1 RL - Dirección** | `RL_Direcci_n` | Línea única | Dirección del Representante Legal |
| **1 RL - País de Residencia** | `RL_Pa_s_de_Residencia` | Lista de selección | País de residencia del Representante Legal |
| **Actividad Económica Principal** | `Actividad_Econ_mica_Principal` | Línea única | Actividad económica principal del contacto |
| **Actividad Económica Secundaria** | `Actividad_Econ_mica_Secundaria`| Línea única | Actividad económica secundaria del contacto |
| **Actividad/Ocupación Laboral** | `Actividad_Ocupaci_n_Laboral` | Lista de selección | Ocupación laboral |
| **% de Actividad Dedicada (si aplica)** | `De_Actividad_Dedicada_si_aplica` | Porcentaje | Porcentaje de dedicación |
| **Activo** | `Activo` | Booleano | Estado activo/inactivo |
| **Apellido Familiar PEP** | `Apellido_Familiar_PEP` | Línea única | Apellido del familiar que es PEP |

---

## 2. Gobierno Corporativo / Junta Directiva (GJC)
Los campos de Gobierno Corporativo están numerados para admitir múltiples miembros:

### Miembro 1 (1 - GJC)
* **Nombre**: `GJC_Nombre`
* **Apellidos**: `GJC_Apellidos`
* **Cargo**: `GJC_CARGO`
* **No. de ID**: `GJC_No_de_ID`
* **Fecha de Nacimiento**: `GJC_Fecha_de_Nacimiento`
* **Nacionalidad**: `GJC_Nacionalidad`
* **Dirección**: `GJC_Direcci_n`

### Miembro 2 (2 - GJC)
* **Nombre**: `GJC_Nombre1`
* **Apellidos**: `GJC_Apellidos?` (Nota: verificar si lleva signo de interrogación en CRM)
* **Cargo**: `GJC_Cargo1`
* **No. de ID**: `GJC_No_de_ID2`
* **Fecha de Nacimiento**: `GJC_Fecha_de_Nacimiento1`
* **Nacionalidad**: `GJC_Nacionalidad2`
* **Dirección**: `GJC_Direcci_n3`

### Miembro 3 (3 - GJC)
* **Nombre**: `GJC_Nombre3`
* **Apellidos**: `GJC_Apellidos1`
* **Cargo**: `GJC_Cargo3`
* **No. de ID**: `GJC_No_de_ID1`
* **Fecha de Nacimiento**: `GJC_Fecha_de_Nacimiento3`
* **Dirección**: `GJC_Direcci_n2`

### Miembro 4 (4 - GJC)
* **Nombre**: `GJC_Nombre2`
* **Apellidos**: `GJC_Apellidos3`
* **Cargo**: `GJC_Cargo2`
* **No. de ID**: `GJC_No_de_ID3`
* **Fecha de Nacimiento**: `GJC_Fecha_de_Nacimiento2`
* **Nacionalidad**: `GJC_Nacionalidad3`
* **Dirección**: `GJC_Direcci_n1`

---

## 3. Beneficiarios Finales (BF)
Los campos de Beneficiarios Finales están mapeados de forma numerada para admitir múltiples registros:

### Beneficiario 1 (1. BF)
* **Nombre completo**: `BF_Nombre_completo`
* **No. Identificación**: `BF_No_Identificaci_n`
* **% de Participación**: `BF_de_Participaci_n`
* **Nacionalidad**: `BF_Nacionalidad`
* **País de Nacimiento**: `BF_Pa_s_de_Nacimiento`
* **Fecha En La Que Adquiere Control**: `BF_Fecha_En_La_Que_Adquiere_Control...`
* **Dirección**: `BF_Direcci_n1`

### Beneficiario 2 (2. BF)
* **Nombre completo**: `BF_Nombre_completo1`
* **No. Identificación**: `BF_No_Identificaci_n1`
* **% de Participación**: `BF_de_Participaci_n1`
* **Nacionalidad**: `BF_Nacionalidad1`
* **País de Nacimiento**: `BF_Pa_s_de_Nacimiento1`
* **Fecha En La Que Adquiere Control**: `BF_Fecha_En_La_Que_Adquiere_Control...`
* **Dirección**: `BF_Direcci_n2`

### Beneficiario 3 (3. BF)
* **Nombre completo**: `BF_Nombre_completo2`
* **No. Identificación**: `BF_No_Identificaci_n2`
* **% de Participación**: `BF_de_Participaci_n2`
* **Nacionalidad**: `BF_Nacionalidad2`
* **País de Nacimiento**: `BF_Pa_s_de_Nacimiento2`
* **Fecha En La Que Adquiere Control**: `BF_Fecha_En_La_Que_Adquiere_Control...`
* **Dirección**: `BF_Direcci_n`
