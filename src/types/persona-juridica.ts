export interface GjcMember {
  id: string;
  cargo: string;
  nombre: string;
  apellidos: string;
  nacionalidad: string;
  fechaNacimiento: string;
  nroId: string;
  direccion: string;
}

export interface BfMember {
  id: string;
  nombreCompleto: string;
  noIdentificacion: string;
  nacionalidad: string;
  fechaAdquisicion: string;
  porcentajeParticipacion: string;
  paisNacimiento: string;
  direccion: string;
}

export interface FormState {
  // Step 1: Initial Info
  nombreProyecto: string;
  formaContacto: string;

  // Step 1: Identificación del Cliente
  razonSocial: string;
  tipoSociedad: string;
  tipoCliente: string;
  tipoDocumentoIdentidad: string;
  actividadPrincipal: string;
  numeroDocumento: string;
  numeroIdTributaria: string;
  paisTributacion: string;
  porcentajeActividad: string;
  fechaConstitucion: string;
  paisOpera: string;
  paisInscripcion: string;
  fechaNacimiento: string;

  // Step 1: Persona de Contacto
  contactoNombre: string;
  contactoApellido: string;
  contactoId: string;
  contactoTelefono: string;
  contactoEmail: string;

  // Step 1: Datos Generales
  empresaDireccion: string;
  empresaCiudad: string;
  empresaProvincia: string;
  empresaPais: string;
  empresaTelefonoCodigo: string;
  empresaTelefono: string;
  empresaCelularCodigo: string;
  empresaCelular: string;
  empresaEmail: string;
  
  // Step 2: Gobierno & RL
  rlNombre: string;
  rlFechaNacimiento: string;
  rlNacionalidad: string;
  rlNoIdentificacion: string;
  rlProfesionOcupacion: string;
  rlActividadEconomica: string;
  rlDireccion: string;
  rlPaisResidencia: string;
  rlTelefono: string;
  rlObjetoInvestigacion: string;
  gjcMembers: GjcMember[];
  
  // Step 3: Beneficiarios Finales y Perfil Financiero
  bfMembers: BfMember[];
  ingresosMensuales: string;
  medioPago: string;
  fuenteFondosInmueble: string;
  montoServiciosAnuales: string;
  esPep: string;
  pepNombre: string;
  pepCargo: string;
  pepInstitucion: string;
  pepRelacion: string;
  actividadComercial: string;
  origenFondos: string;
  destinoFondos: string;
  volumenVentas: string;
  bancoReferencia: string;
  
  // Step 4: Documents
  copiaIdFile: string;
  origenFondosFile: string;
  pactoSocialFile: string;
  avisoOperacionesFile: string;
  serviciosPublicosFile: string;
  certBancariaFile: string;
  certRegistroFile: string;

  checkedCopiaId: boolean;
  checkedOrigenFondos: boolean;
  checkedPactoSocial: boolean;
  checkedAvisoOperaciones: boolean;
  checkedServiciosPublicos: boolean;
  checkedCertBancaria: boolean;
  checkedCertRegistro: boolean;
  
  // Step 5: Terms and Signature
  termsAccepted: boolean;
  signerName: string;
  signatureDate: string;
  firmaImage: string; // Base64 representation of signature canvas
  conclusionesVerificacion: string; // Solo para uso de la empresa
  crmid: string; // CRM ID
}

export const INITIAL_FORM_STATE: FormState = {
  nombreProyecto: "",
  formaContacto: "",
  
  razonSocial: "",
  tipoSociedad: "",
  tipoCliente: "",
  tipoDocumentoIdentidad: "",
  actividadPrincipal: "",
  numeroDocumento: "",
  numeroIdTributaria: "",
  paisTributacion: "",
  porcentajeActividad: "",
  fechaConstitucion: "",
  paisOpera: "",
  paisInscripcion: "",
  fechaNacimiento: "",
  
  contactoNombre: "",
  contactoApellido: "",
  contactoId: "",
  contactoTelefono: "",
  contactoEmail: "",
  
  empresaDireccion: "",
  empresaCiudad: "",
  empresaProvincia: "",
  empresaPais: "",
  empresaTelefonoCodigo: "+507",
  empresaTelefono: "",
  empresaCelularCodigo: "+507",
  empresaCelular: "",
  empresaEmail: "",
  
  rlNombre: "",
  rlFechaNacimiento: "",
  rlNacionalidad: "",
  rlNoIdentificacion: "",
  rlProfesionOcupacion: "",
  rlActividadEconomica: "",
  rlDireccion: "",
  rlPaisResidencia: "",
  rlTelefono: "",
  rlObjetoInvestigacion: "",
  gjcMembers: [
    {
      id: "gjc-initial-1",
      cargo: "",
      nombre: "",
      apellidos: "",
      nacionalidad: "",
      fechaNacimiento: "",
      nroId: "",
      direccion: "",
    }
  ],
  
  bfMembers: [
    {
      id: "bf-initial-1",
      nombreCompleto: "",
      noIdentificacion: "",
      nacionalidad: "",
      fechaAdquisicion: "",
      porcentajeParticipacion: "",
      paisNacimiento: "",
      direccion: "",
    },
    {
      id: "bf-initial-2",
      nombreCompleto: "",
      noIdentificacion: "",
      nacionalidad: "",
      fechaAdquisicion: "",
      porcentajeParticipacion: "",
      paisNacimiento: "",
      direccion: "",
    }
  ],
  ingresosMensuales: "",
  medioPago: "",
  fuenteFondosInmueble: "",
  montoServiciosAnuales: "",
  esPep: "",
  pepNombre: "",
  pepCargo: "",
  pepInstitucion: "",
  pepRelacion: "",
  actividadComercial: "",
  origenFondos: "",
  destinoFondos: "Adquisición de unidad residencial - UDG Group",
  volumenVentas: "",
  bancoReferencia: "",
  
  // Step 4
  copiaIdFile: "",
  origenFondosFile: "",
  pactoSocialFile: "",
  avisoOperacionesFile: "",
  serviciosPublicosFile: "",
  certBancariaFile: "",
  certRegistroFile: "",

  checkedCopiaId: false,
  checkedOrigenFondos: false,
  checkedPactoSocial: false,
  checkedAvisoOperaciones: false,
  checkedServiciosPublicos: false,
  checkedCertBancaria: false,
  checkedCertRegistro: false,
  
  // Step 5
  termsAccepted: false,
  signerName: "",
  signatureDate: "",
  firmaImage: "",
  conclusionesVerificacion: "",
  crmid: "",
};

export const PHONE_CODES = [
  { code: "+507", country: "Panamá (+507)" },
  { code: "+1", country: "EUA/Canadá (+1)" },
  { code: "+34", country: "España (+34)" },
  { code: "+57", country: "Colombia (+57)" },
  { code: "+58", country: "Venezuela (+58)" },
  { code: "+506", country: "Costa Rica (+506)" },
  { code: "+52", country: "México (+52)" },
  { code: "+54", country: "Argentina (+54)" },
  { code: "+56", country: "Chile (+56)" },
  { code: "+51", country: "Perú (+51)" },
  { code: "+593", country: "Ecuador (+593)" },
  { code: "+55", country: "Brasil (+55)" },
  { code: "+598", country: "Uruguay (+598)" },
  { code: "+595", country: "Paraguay (+595)" },
  { code: "+33", country: "Francia (+33)" },
  { code: "+44", country: "Reino Unido (+44)" },
  { code: "+39", country: "Italia (+39)" },
  { code: "+49", country: "Alemania (+49)" },
  { code: "+41", country: "Suiza (+41)" },
  { code: "+86", country: "China (+86)" },
];
