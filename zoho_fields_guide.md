# Guía de Campos y Nombres de API - Zoho CRM (Módulo Debida_Diligencia)

Esta guía detalla los nombres de etiqueta de los campos (Label) y sus respectivos nombres de API (API Name) en Zoho CRM para el módulo personalizado **`Debida_Diligencia`** y sus subformularios.

estructura de filas
 | Nombre del Campo (Etiqueta) | Nombre de API | Tipo de Datos / Opciones | Mapeado desde el Formulario |

---

## Módulo Principal (no aplican informacion a Zoho)

* **Nombre de API del Módulo**: `Debida_Diligencia` 

| Datos principales |
| **Nombre de Debida Diligencia** | `Name` | Línea única (String) | Nombre completo (Natural) / Razón Social (Jurídico)
| **Enlace de Formulario** | `Enlace_de_Formulario` | URL | Enlace firmado de debida diligencia |
| **Vigencia del enlace** | `Vigencia_del_enlace` | Fecha-hora (DateTime) | Fecha de expiración de enlace |
| **Estado del enlace** | `Estado_del_enlace` | Picklist (Lista) | Estado del link generado |
| **Estado** | `Estado` | Picklist (Lista) | Estado del expediente (ej. `"Completado"`, `"Aprobado"`) |
| **Tipo de Persona** | `Tipo_de_Persona` | Picklist (`"Persona Natural"` / `"Persona Jurídica"`) | Tipo de cliente |

## 1. Datos de cabecera
| Nombre del Campo (Etiqueta) | Nombre de API | Tipo de Datos / Opciones | Mapeado desde el Formulario |
| **Proyecto** | `Proyecto` | Picklist (Lista)  {projects Zoho} | nombreProyecto (FormState)|
| **Forma de contacto** | `Forma_de_contacto` | Línea única (String) | formaContacto or formaContactoDetalle (FormState)|
| **Referido por** | `Referido_por` | Línea única (String) | referidoPor (FormState) |

## 2. Formulario persona juridica 
| Datos de identificacion Juridica |
| **Razón social** | `Raz_n_social` | Línea única (String) | razonSocial (FormState) |
| **Tipo de sociedad** | `Tipo_de_sociedad` | Picklist (Lista)  {same as options} | tipoSociedad (FormState) |
| **Tipo de cliente** | `Tipo_de_cliente` | Picklist (Lista)  {same as options} | tipoCliente (FormState) |
| **Estado de sociedad** | `Estado_sociedad` | Picklist (Lista)  {same as options} | estadoSociedad (FormState) |
| **Tipo de identificacion** | `Tipo_de_identificacion` | Picklist (Lista)  {same as options} | tipoDocumentoIdentidad (FormState) |
| **Actividad Principal** | `Actividad_Principal` | Línea única (String) | actividadPrincipal (FormState) |
| **RUC / NIT** | `RUC_NIT` | Línea única (String) | numeroDocumento (FormState) |
| **Fecha vencimiento ID** | `Fecha_vencimiento_ID` | Fecha (date) | fechaVencimientoId (FormState) |
| **ID tributaria** | `ID_tributaria` | Línea única (String) | numeroIdTributaria (FormState) |
| **País donde tributa** | `Pa_s_donde_tributa` | Picklist (Lista)  {same as options} | paisTributacion (FormState) |
| **País donde opera** | `Pa_s_donde_opera` | Picklist (Lista)  {same as options} | paisOpera (FormState) |
| **Fecha de constitución** | `Fecha_de_constituci_n` | Fecha (Date) | fechaConstitucion (FormState) |
| **Pais de inscripción** | `Pais_de_inscripci_n` | Picklist (Lista)  {same as options} | paisInscripcion (FormState) |

| Persona de contacto |
| **Nombre contacto** | `Nombre_contacto` | Línea única (String) | contactoNombre + contactoApellido(FormState) |
| **Identificación Contacto** | `Identificaci_n_Contacto` | Línea única (String) | contactoId (FormState) |
| **Telefono contacto** | `Telefono_contacto` | Teléfono | contactoTelefono (FormState) |
| **Correo de contacto** | `Correo_de_contacto` | Correo electrónico | contactoEmail (FormState)  |
| **Ocupa cargo** | `Ocupa_cargo` | Checkbox (Boolean) | ifContacto (FormState) |
| **Cargo de contacto** | `Cargo_de_contacto` | Línea única (String) | contactoCargo (FormState) |

| DATOS GENERALES DE LA EMPRESA |
| **Dirección / Calle** | `Direccion_Calle` | Multilínea (Text Area) | empresaDireccion (FormState) |
| **Ciudad** | `Ciudad` | Línea única (String) | empresaCiudad (FormState) |
| **Provincia** | `Provincia` | Línea única (String) | empresaProvincia (FormState) |
| **País** | `Pa_s` | Picklist (Lista)  {same as options} | empresaPais (FormState) |
| **Teléfono** | `Tel_fono` | Teléfono | empresaTelefonoCodigo+" "+empresaTelefono |
| **Celular** | `Celular` | Teléfono | empresaCelularCodigo+" "+empresaCelular |
| **Email corporativo** | `Email_corporativo` | Correo electrónico | empresaEmail (FormState)|

| Gobierno | gjcMembers | 
* **Nombre de API del Subformulario**: `Gobierno_Coporativo_Junta_Directiva` *(Nota: No lleva la letra **r** intermedia, está escrito exactamente como `Coporativo` en la API)*

| **Nombre y apellido** | `Nombre_y_apellido` | Línea única (String) | nombre + apellidos (GjcMember) |
| **Cargo** | `Cargo` | Picklist (Lista)  {same as options} | Cargo (GjcMember) |
| **Nacionalidad** | `Nacionalidad` | Picklist (Lista)  {same as options} | Nacionalidad (GjcMember) |
| **Fecha de nacimiento** | `Fecha_de_nacimiento` | Fecha (Date) | fechaNacimiento (GjcMember) |
| **No. Identificación** | `No_Identificaci_n` | Línea única (String) | nroId (GjcMember) |
| **Dirección** | `Direcci_ó_n` | Línea única (String) | direccion (GjcMember) |

| REPRESENTANTE LEGAL O APODERADO |
| **Nombre natural** | `Nombre_natural` | Línea única (String) | rlNombre (FormState) |
| **Estado Civil** | `Estado_Civil` | Picklist (Lista)  {same as options} | rlEstadoCivil (FormState) |
| **Nacionalidad** | `Nacionalidad` | Línea única (String) | rlNacionalidad (FormState) |
| **Numero Identificacion** | `Numero_Identificacion` | Línea única (String) | rlNoIdentificacion (FormState) |
| **Fecha de nacimiento** | `Fecha_de_nacimiento` | Fecha (Date) | rlFechaNacimiento (FormState) |
| **Profesión** | `Profesi_n` | Línea única (String) | rlProfesionOcupacion (FormState) |
| **Actividad Persona** | `Actividad_Persona` | Línea única (String) | rlActividadEconomica (FormState) |
| **Pais de residencia fiscal** | `Pais_de_residencia_fiscal` | Línea única (String) | rlPaisResidencia (FormState) |
| **Direccion Representante** | `Direccion_Representante` | Línea multiple (String) | rlDireccion (FormState) |
| **Telefono Representante** | `Telefono_Representante` | Teléfono | rlTelefono (FormState) |

| **Declaración del origen ilícito firmada** | `Declaraci_n_del_origen_il_cito_firmada` | Checkbox (Boolean) | rlObjetoInvestigacion (FormState) |


| Beneficiarios final | BfMember |
* **Nombre de API del Subformulario**: `Beneficiario_Finales`

| **Nombre completo** | `Nombre_completo` | Línea única (String) | nombreCompleto (BfMember) |
| **No. Identificación** | `No_Identificaci_n` | Línea única (String) | noIdentificacion (BfMember)  |
| **Nacionalidad** | `Nacionalidad` | Picklist / Línea única | nacionalidad (BfMember)  |
| **% Participación** | `Participaci_n` | Decimal / Porcentaje | porcentajeParticipacion (BfMember)  |
| **Pais nac. / Residencia** | `Pais_nac_Residencia` | Línea única | paisNacimiento (BfMember)  |
| **Fecha de BF** | `Fecha_de_BF` | Fecha (Date) | fechaAdquisicion (BfMember)  |
| **Dirección** | `Direcci_n` | Línea única (String) | direccion (BfMember)  |

| PERFIL FINANCIERO |
| **Promedio mensual** | `Promedio_mensual` | Money | ingresosMensuales (FormState) |
| **Medios de Pago** | `Medios_de_Pago` | Picklist multiple (Lista) | medioPago (FormState) |
| **Fuente de Fondos** | `Fuente_de_Fondos` | Linea multiple | fuenteFondosInmueble (FormState) |
| **Mas unidades inmobiliarias** | `Mas_unidades_inmobiliarias` | Checkbox (Boolean) | adquiereMasUnidades (FormState) parse no,si into false, true|
| **Cantidad inmuebles** | `Cantidad_inmuebles` | Numero | cantidadUnidadesInmobiliarias (FormState) |

|if tercero|
| **Tercero Aportante Nombre** | `Tercero_Aportante_Nombre` | Linea unica | terceroNombre (FormState) |
| **Tercero Aportante Nacionalidad** | `Tercero_Aportante_Nacionalidad` | Linea unica | terceroNacionalidad (FormState) |
| **Tercero Aportante Relación** | `Tercero_Aportante_Relaci_n` | Linea unica | terceroVinculo (FormState) |
| **Tercero Aportante Fuente de Fondos** | `Tercero_Aportante_Fuente_de_Fondos` | Linea unica | terceroFuenteFondos (FormState) |

| PERSONA EXPUESTA POLÍTICAMENTE (PEP) |
| **Es PEP** | `Es_PEP` | Checkbox (Boolean) | esPep (FormState) parse no,si into false, true|
| **PEP nombre** | `PEP_nombre` | Línea única (String) | pepNombre (FormState)  |
| **PEP cargo** | `PEP_cargo` | Línea única (String) | pepCargo (FormState)  |
| **PEP institución** | `PEP_instituci_n` | Línea única (String) | pepInstitucion (FormState)  |
| **PEP relación** | `PEP_relaci_n` | Línea única (String) | pepRelacion (FormState)  |

| Documentos |
| **Cédula de Representante Legal** | `C_dula_de_Representante_Legal` | Checkbox (Boolean) | personDocuments (FormState)|
| **Documentos de Junta Directiva** | `Carta_de_Junta_Directiva` | Checkbox (Boolean) | personDocuments (FormState)|
| **Declaración Jurada de Beneficiario Final** | `Declaraci_n_Jurada_de_Beneficiario_Final` | Checkbox (Boolean) | personDocuments (FormState)|

| **Aviso de Operaciones** | `Aviso de Operaciones` | Checkbox (Boolean) | avisoOperacionesFile (FormState)|
| **Estados Financieros** | `Estados Financieros` | Checkbox (Boolean) | origenFondosFile (FormState)|
| **Pacto Social** | `Pacto Social` | Checkbox (Boolean) | pactoSocialFile (FormState)|
| **Certificado de Registro Público** | `Certificado de Registro Público` | Checkbox (Boolean) | certRegistroFile (FormState)|
| **Certificado Bancario** | `Certificado Bancario` | Checkbox (Boolean) | certBancariaFile (FormState)|
| **Carta de compra de beneficiarios** | `Carta de compra de beneficiarios` | Checkbox (Boolean) | certComprasFile (FormState)|


## 3. Formulario persona juridica 
| Datos de identificacion Juridica |
| **Nombre natural** | `Nombre_natural` | Línea única (String) | firstName + lastName (FormState) |
| **Pais de nacimiento** | `Pais_de_nacimiento` | Línea única (String) | paisNacimiento (FormState) |
| **Pais de residencia fiscal** | `Pais_de_residencia_fiscal` | Línea única (String) | paisResidenciaFiscal (FormState) |
| **ID tributaria** | `ID_tributaria` | Línea única (String) | idTributaria (FormState) |
| **Nacionalidad** | `Nacionalidad` | Línea única (String) | nationality (FormState) |
| **Tipo de identificacion** | `Tipo_de_identificacion` | Picklist (Lista) {same as options} | tipoIdentificacion (FormState) |
| **Otra nacionalidad** | `Otra_nacionalidad` | Línea única (String) | otraNacionalidad (FormState) |
| **Estado Civil** | `Estado_Civil` | Picklist (Lista)  {same as options} | estadoCivil (FormState) |
| **Numero Identificacion** | `Numero_Identificacion` | Línea única (String) | idNumber (FormState) |
| **Fecha vencimiento ID** | `Fecha_vencimiento_ID` | Fecha (Date) | fechaVencimientoId (FormState) |
| **Fecha de nacimiento** | `Fecha_de_nacimiento` | Fecha (Date) | fechaNacimiento (FormState) |
| **Estado migratorio** | `Estado_migratorio` | Picklist (Lista)  {same as options} | estatusMigratorio (FormState) |

| JURISDICCIÓN / UBICACIÓN GEOGRÁFICA |
| **Dirección / Calle** | `Direccion_Calle` | Multilínea (Text Area) | direccionResidencial (FormState) |
| **Ciudad** | `Ciudad` | Línea única (String) | ciudad (FormState) |
| **Provincia** | `Provincia` | Línea única (String) | provinciaEstado (FormState) |
| **País** | `Pa_s` | Picklist (Lista)  {same as options} | paisResidencial (FormState) |
| **Teléfono** | `Tel_fono` | Teléfono | telefonoCodigo+" "+telefono |
| **Celular** | `Celular` | Teléfono | celularCodigo+" "+celular |
| **Email corporativo** | `Email_corporativo` | Correo electrónico | email (FormState)|

| Datos Laborales |
| **Profesión** | `Profesi_n` | Línea única (String) | profession or profesionOtros (FormState) |
| **País de Empresa** | `Pa_s_de_Empresa` | Línea única (String) | paisActividadLaboral (FormState) |
| **Empresa donde labora** | `Empresa_donde_labora` | Línea única (String) | employer (FormState) |
| **Actividad Empresa** | `Actividad_Empresa` | Línea única (String) | actividadLaboral or actividadLaboralOtros (FormState) |
| **Dirección laboral** | `Direcci_n_laboral` | Línea multiple (String) | direccionLaboral (FormState) |
| **Cargo en la Empresa** | `Cargo_en_la_Empresa` | Línea única (String) | cargoDesempena (FormState) |

| **Patrimonio en la empresa** | `Patrimonio_en_la_empresa` | Checkbox (Boolean) | esPropietario (FormState)|
| **Fondos provienen de la Empresa** | `Fondos_provienen_de_la_Empresa` | Checkbox (Boolean) | usaFondos (FormState)|

| ACTIVIDADES ECONÓMICAS O PROFESIONALES |
| **Actividad Persona** | `Actividad_Persona` | Línea única (String) | actEconPrincipal or otroActEcon (FormState) |
| **Porcentaje Actividad principal** | `Porcentaje_Actividad_principal` | porcentaje (String) | pctDedicacionPrincipal (FormState) |
| **Jurisdicción de Operación Principal** | `Jurisdicci_n_de_Operaci_n_Principal` | Línea única (String) | jurisdiccionPrincipal (FormState) |
| **Otras Actividades** | `Otras_Actividades` | Línea única (String) | actEconSecundaria (FormState) |
| **Porcentaje Otra Actividad** | `Porcentaje_Otra_Actividad` | porcentaje (String) | pctDedicacionSecundaria (FormState) |
| **Jurisdicción_de_Otra_operación** | `Jurisdicci_n_de_Otra_operaci_n` | Línea única (String) | jurisdiccionSecundaria (FormState) |


| PERFIL FINANCIERO |
| **Promedio mensual** | `Promedio mensual` | Money | ingresosMensuales (FormState) |
| **Medios de Pago** | `Medios_de_Pago` | Picklist multiple (Lista) | medioPago (FormState) |
| **Fuente de Fondos** | `Fuente_de_Fondos` | Linea multiple | fuenteFondosInmueble or ifOtroNombre (FormState) |
| **Mas unidades inmobiliarias** | `Mas_unidades_inmobiliarias` | Checkbox (Boolean) | montoServiciosAnuales (FormState) parse no,si into false, true|
| **Cantidad inmuebles** | `Cantidad_inmuebles` | Numero | cantidadServiciosAnuales (FormState) |

|if tercero|
| **Tercero Aportante Nombre** | `Fuente_de_Fondos` | Linea unica | ifTerceroNombre (FormState) |
| **Tercero Aportante Nacionalidad** | `Fuente_de_Fondos` | Linea unica | ifTerceroNacionalidad (FormState) |
| **Tercero Aportante Relación** | `Tercero_Aportante_Relación` | Linea unica | ifTerceroRelacion (FormState) |
| **Tercero Aportante Fuente de Fondos** | `Tercero_Aportante_Fuente_de_Fondos` | Linea unica | ifTerceroFuenteDeIngresos (FormState) |

| IDENTIFICACIÓN DEL BENEFICIARIO DEL INMUEBLE |
| **¿A nombre de otro?** | `A_nombre_de_otro` | Checkbox (Boolean) | adquiereNombreTercero (FormState) parse no,si into false, true|
| **Nombre de Otro** | `Nombre_de_Otro` | Linea unica | nombreTercero (FormState) |
| **Propósito del inmueble** | `Prop_sito_del_inmueble` | Picklist (Lista)  {same as options} | destinoInmueble (FormState) |     


| PERSONA EXPUESTA POLÍTICAMENTE (PEP) |
| **Es PEP** | `Es_PEP` | Checkbox (Boolean) | esPep (FormState) parse no,si into false, true|
| **PEP nombre** | `PEP_nombre` | Línea única (String) | pepNombre (FormState)  |
| **PEP cargo** | `PEP_cargo` | Línea única (String) | pepCargo (FormState)  |
| **PEP institución** | `PEP_instituci_n` | Línea única (String) | pepInstitucion (FormState)  |
| **PEP relación** | `PEP_relaci_n` | Línea única (String) | pepRelacion (FormState)  |


| Documentos |
| **Carta de Certificación Bancaria** | `Carta_de_Certificaci_n_Bancaria` | Checkbox (Boolean) | hasCertificacionBancaria (FormState)|
| **Certificación de Ingresos** | `Certificaci_n_de_Ingresos` | Checkbox (Boolean) | origenFondosFile (FormState)|
| **Movimientos Bancarios 6 Meses** | `Movimientos_Bancarios_6_Meses` | Checkbox (Boolean) | hasEstadoCuenta (FormState)|
| **Identificación Personal** | `Identificaci_n_Personal` | Checkbox (Boolean) | idFile (FormState)|





