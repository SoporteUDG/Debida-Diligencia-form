export interface FormState {
  // Step 1: Initial Info
  nombreProyecto: string;
  formaContacto: string;
  formaContactoDetalle: string;
  referidoPor: string;

  // Step 1: Identificación del Cliente
  firstName: string; // Nombre
  lastName: string;  // Apellido(s)
  estadoCivil: string; // Estado Civil
  paisNacimiento: string;
  paisResidenciaFiscal: string;
  idTributaria: string;
  nationality: string; // Nacionalidad
  tipoIdentificacion: string;
  otraNacionalidad: string;
  idNumber: string; // N° de Identificación
  fechaVencimientoId: string;
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
  esPropietario: string;
  usaFondos: string;

  // Step 2: Actividades Económicas o Profesionales
  actEconPrincipal: string;
  otroActEcon: string;
  pctDedicacionPrincipal: string;
  jurisdiccionPrincipal: string;
  actEconSecundaria: string;
  pctDedicacionSecundaria: string;
  jurisdiccionSecundaria: string;

  // Step 3: Perfil Financiero
  ingresosMensuales: string;
  medioPago: string;
  fuenteFondosInmueble: string;
  ifOtroNombre: string, //depende de fuenteFondosInmueble
  ifTerceroNombre: string,//depende de fuenteFondosInmueble
  ifTerceroNacionalidad: string,//depende de fuenteFondosInmueble
  ifTerceroFuenteDeIngresos: string,//depende de fuenteFondosInmueble
  ifTerceroRelacion: string,//depende de fuenteFondosInmueble
  montoServiciosAnuales: string;
  cantidadServiciosAnuales: string;//depende de montoServiciosAnuales 

  adquiereNombreTercero: string;
  nombreTercero: string;
  destinoInmueble: string;
  esPep: string;
  pepNombre: string;
  pepCargo: string;
  pepInstitucion: string;
  pepRelacion: string;

  // Step 4: Documents
  idFile: string;
  origenFondosFile: string[]; // multi-file field
  proofAddressFile: string;
  hasEstadoCuenta: string[]; // multi-file field
  hasCertificacionBancaria: string;
  otrosAdjuntosFile: string;

  // Step 5: Terms & Sign
  termsAccepted: boolean;
  signatureConfirmed: boolean;
  signerName: string;
  signatureDate: string;
  firmaImage: string;

  // Solo para uso de la empresa
  conclusionesVerificacion: string;
}

export const INITIAL_FORM_STATE: FormState = {
  nombreProyecto: "",
  formaContacto: "",
  formaContactoDetalle: "",
  referidoPor: "",

  firstName: "",
  lastName: "",
  estadoCivil: "",
  paisNacimiento: "",
  paisResidenciaFiscal: "",
  idTributaria: "",
  nationality: "",
  tipoIdentificacion: "",
  otraNacionalidad: "",
  idNumber: "",
  fechaVencimientoId: "",
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
  esPropietario: "",
  usaFondos: "",

  actEconPrincipal: "",
  otroActEcon: "",
  pctDedicacionPrincipal: "",
  jurisdiccionPrincipal: "",
  actEconSecundaria: "",
  pctDedicacionSecundaria: "",
  jurisdiccionSecundaria: "",

  ingresosMensuales: "",
  medioPago: "",
  fuenteFondosInmueble: "",
  ifOtroNombre: "",
  ifTerceroNombre: "",
  ifTerceroNacionalidad: "",
  ifTerceroFuenteDeIngresos: "",
  ifTerceroRelacion: "",
  montoServiciosAnuales: "",
  cantidadServiciosAnuales: "",

  adquiereNombreTercero: "",
  nombreTercero: "",
  destinoInmueble: "",
  esPep: "",
  pepNombre: "",
  pepCargo: "",
  pepInstitucion: "",
  pepRelacion: "",

  idFile: "",
  origenFondosFile: [],
  proofAddressFile: "",
  hasEstadoCuenta: [],
  hasCertificacionBancaria: "",
  otrosAdjuntosFile: "",

  termsAccepted: false,
  signatureConfirmed: false,
  signerName: "",
  signatureDate: "",
  firmaImage: "",

  conclusionesVerificacion: "",
};
