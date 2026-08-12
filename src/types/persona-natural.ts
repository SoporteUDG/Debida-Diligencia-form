export interface FormState {
  // Step 1: Initial Info
  nombreProyecto: string;
  formaContacto: string;

  // Step 1: Identificación del Cliente
  firstName: string; // Nombre
  lastName: string;  // Apellido(s)
  paisNacimiento: string;
  paisResidenciaFiscal: string;
  idTributaria: string;
  nationality: string; // Nacionalidad
  tipoIdentificacion: string;
  otraNacionalidad: string;
  idNumber: string; // N° de Identificación
  estatusMigratorio: string;
  fechaNacimiento: string;

  // Step 2: Jurisdicción / Ubicación Geográfica
  direccionResidencial: string;
  ciudad: string;
  provinciaEstado: string;
  paisResidencial: string;
  email: string;
  telefonoCodigo: string;
  telefono: string;
  celularCodigo: string;
  celular: string;

  // Step 2: Datos Laborales
  profession: string; // Profesión u Oficio
  profesionOtros: string;
  paisActividadLaboral: string;
  employer: string; // Nombre de Empresa Donde Labora
  actividadLaboral: string; // Actividad/Ocupación Laboral, Empresarial o Comercial
  actividadLaboralOtros: string;
  direccionLaboral: string;
  cargoDesempena: string;

  // Step 2: Actividades Económicas o Profesionales
  actEconPrincipal: string;
  pctDedicacionPrincipal: string;
  jurisdiccionPrincipal: string;
  actEconSecundaria: string;
  pctDedicacionSecundaria: string;
  jurisdiccionSecundaria: string;

  // Step 3: Perfil Financiero
  ingresosMensuales: string;
  medioPago: string;
  fuenteFondosInmueble: string;
  montoServiciosAnuales: string;
  adquiereNombreTercero: string;
  destinoInmueble: string;
  esPep: string;
  pepNombre: string;
  pepCargo: string;
  pepInstitucion: string;
  pepRelacion: string;

  // Step 4: Documents
  idFile: string;
  origenFondosFile: string;
  proofAddressFile: string;
  hasEstadoCuenta: boolean;
  hasCertificacionBancaria: boolean;
  otrosAdjuntosFile: string;

  // Step 5: Terms & Sign
  termsAccepted: boolean;
  signerName: string;
  signatureDate: string;
  firmaImage: string;

  // Solo para uso de la empresa
  conclusionesVerificacion: string;
}

export const INITIAL_FORM_STATE: FormState = {
  nombreProyecto: "",
  formaContacto: "",

  firstName: "",
  lastName: "",
  paisNacimiento: "",
  paisResidenciaFiscal: "",
  idTributaria: "",
  nationality: "",
  tipoIdentificacion: "",
  otraNacionalidad: "",
  idNumber: "",
  estatusMigratorio: "",
  fechaNacimiento: "",

  direccionResidencial: "",
  ciudad: "",
  provinciaEstado: "",
  paisResidencial: "",
  email: "",
  telefonoCodigo: "+507",
  telefono: "",
  celularCodigo: "+507",
  celular: "",

  profession: "",
  profesionOtros: "",
  paisActividadLaboral: "",
  employer: "",
  actividadLaboral: "",
  actividadLaboralOtros: "",
  direccionLaboral: "",
  cargoDesempena: "",

  actEconPrincipal: "",
  pctDedicacionPrincipal: "",
  jurisdiccionPrincipal: "",
  actEconSecundaria: "",
  pctDedicacionSecundaria: "",
  jurisdiccionSecundaria: "",

  ingresosMensuales: "",
  medioPago: "",
  fuenteFondosInmueble: "",
  montoServiciosAnuales: "",
  adquiereNombreTercero: "",
  destinoInmueble: "",
  esPep: "",
  pepNombre: "",
  pepCargo: "",
  pepInstitucion: "",
  pepRelacion: "",

  idFile: "",
  origenFondosFile: "",
  proofAddressFile: "",
  hasEstadoCuenta: false,
  hasCertificacionBancaria: false,
  otrosAdjuntosFile: "",

  termsAccepted: false,
  signerName: "",
  signatureDate: "",
  firmaImage: "",

  conclusionesVerificacion: "",
};
