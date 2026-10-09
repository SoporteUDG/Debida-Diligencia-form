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

interface PersonDocument {
  personType: "GJC" | "BF" | "RL";
  personId: string;      
  documentType: "copiaIdFile"; // room to grow if you ever add more per-person doc types
  fileName: string;
}

export type DocumentTarget =
  | { kind: "static"; field: keyof FormState; fileName?: string }
  | { kind: "person"; personType: "GJC" | "BF" | "RL"; personId: string; documentType: "copiaIdFile" };



export interface FormState {
  // Step 1: Initial Info
  nombreProyecto: string;
  formaContacto: string;
  formaContactoDetalle: string;
  referidoPor: string;

  // Step 1: Identificación del Cliente
  razonSocial: string;
  tipoSociedad: string;
  estadoSociedad: string;
  tipoCliente: string;
  tipoDocumentoIdentidad: string;
  actividadPrincipal: string;
  fechaVencimientoId: string;
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
  ifContacto: string;
  contactoCargo: string;

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
  rlEstadoCivil: string;
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
  terceroNombre: string;
  terceroNacionalidad: string;
  terceroVinculo: string;
  terceroFuenteFondos: string;
  adquiereMasUnidades: string;
  cantidadUnidadesInmobiliarias: string;
  montoServiciosAnuales: string;
  esPep: string;
  pepNombre: string;
  pepCargo: string;
  pepInstitucion: string;
  pepRelacion: string;


  //not used anymore
  actividadComercial: string;
  origenFondos: string;
  destinoFondos: string;
  volumenVentas: string;
  bancoReferencia: string;
  
  // Step 4: Documents
  personDocuments: PersonDocument[];
  origenFondosFile: string[]; // multi-file field
  pactoSocialFile: string[];
  avisoOperacionesFile: string;
  serviciosPublicosFile: string;
  certBancariaFile: string;
  certRegistroFile: string;
  certComprasFile: string;

  
  // Step 5: Terms and Signature
  termsAccepted: boolean;
  signatureConfirmed: boolean;
  signerName: string;
  signatureDate: string;
  firmaImage: string; // Base64 representation of signature canvas
  conclusionesVerificacion: string; // Solo para uso de la empresa
  crmid: string; // CRM ID
}

export const INITIAL_FORM_STATE: FormState = {
  nombreProyecto: "",
  formaContacto: "",
  formaContactoDetalle: "",
  referidoPor: "",
  
  razonSocial: "",
  tipoSociedad: "",
  estadoSociedad: "",
  tipoCliente: "",
  tipoDocumentoIdentidad: "",
  actividadPrincipal: "",
  fechaVencimientoId: "",
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
  ifContacto: "",
  contactoCargo: "",
  
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
  rlEstadoCivil: "",
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
  terceroNombre: "",
  terceroNacionalidad: "",
  terceroVinculo: "",
  terceroFuenteFondos: "",
  adquiereMasUnidades: "",
  cantidadUnidadesInmobiliarias: "",
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
  personDocuments: [],
  origenFondosFile: [""],
  pactoSocialFile: [""],
  avisoOperacionesFile: "",
  serviciosPublicosFile: "",
  certBancariaFile: "",
  certRegistroFile: "",
  certComprasFile: "",

  
  // Step 5
  termsAccepted: false,
  signatureConfirmed: false,
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
  { code: "+93", country: "Afganistán (+93)" },
  { code: "+355", country: "Albania (+355)" },
  { code: "+49", country: "Alemania (+49)" },
  { code: "+376", country: "Andorra (+376)" },
  { code: "+244", country: "Angola (+244)" },
  { code: "+1", country: "Antigua y Barbuda (+1)" },
  { code: "+966", country: "Arabia Saudita (+966)" },
  { code: "+213", country: "Argelia (+213)" },
  { code: "+374", country: "Armenia (+374)" },
  { code: "+61", country: "Australia (+61)" },
  { code: "+43", country: "Austria (+43)" },
  { code: "+994", country: "Azerbaiyán (+994)" },
  { code: "+1", country: "Bahamas (+1)" },
  { code: "+973", country: "Baréin (+973)" },
  { code: "+880", country: "Bangladés (+880)" },
  { code: "+1", country: "Barbados (+1)" },
  { code: "+32", country: "Bélgica (+32)" },
  { code: "+501", country: "Belice (+501)" },
  { code: "+229", country: "Benín (+229)" },
  { code: "+375", country: "Bielorrusia (+375)" },
  { code: "+591", country: "Bolivia (+591)" },
  { code: "+387", country: "Bosnia y Herzegovina (+387)" },
  { code: "+267", country: "Botsuana (+267)" },
  { code: "+673", country: "Brunéi (+673)" },
  { code: "+359", country: "Bulgaria (+359)" },
  { code: "+226", country: "Burkina Faso (+226)" },
  { code: "+257", country: "Burundi (+257)" },
  { code: "+975", country: "Bután (+975)" },
  { code: "+238", country: "Cabo Verde (+238)" },
  { code: "+855", country: "Camboya (+855)" },
  { code: "+237", country: "Camerún (+237)" },
  { code: "+974", country: "Catar (+974)" },
  { code: "+235", country: "Chad (+235)" },
  { code: "+357", country: "Chipre (+357)" },
  { code: "+57", country: "Colombia (+57)" },
  { code: "+269", country: "Comoras (+269)" },
  { code: "+850", country: "Corea del Norte (+850)" },
  { code: "+82", country: "Corea del Sur (+82)" },
  { code: "+225", country: "Costa de Marfil (+225)" },
  { code: "+506", country: "Costa Rica (+506)" },
  { code: "+385", country: "Croacia (+385)" },
  { code: "+53", country: "Cuba (+53)" },
  { code: "+45", country: "Dinamarca (+45)" },
  { code: "+253", country: "Yibuti (+253)" },
  { code: "+1", country: "Dominica (+1)" },
  { code: "+1", country: "República Dominicana (+1)" },
  { code: "+20", country: "Egipto (+20)" },
  { code: "+503", country: "El Salvador (+503)" },
  { code: "+971", country: "Emiratos Árabes Unidos (+971)" },
  { code: "+291", country: "Eritrea (+291)" },
  { code: "+421", country: "Eslovaquia (+421)" },
  { code: "+386", country: "Eslovenia (+386)" },
  { code: "+372", country: "Estonia (+372)" },
  { code: "+251", country: "Etiopía (+251)" },
  { code: "+63", country: "Filipinas (+63)" },
  { code: "+358", country: "Finlandia (+358)" },
  { code: "+241", country: "Gabón (+241)" },
  { code: "+220", country: "Gambia (+220)" },
  { code: "+995", country: "Georgia (+995)" },
  { code: "+233", country: "Ghana (+233)" },
  { code: "+30", country: "Grecia (+30)" },
  { code: "+1", country: "Granada (+1)" },
  { code: "+502", country: "Guatemala (+502)" },
  { code: "+224", country: "Guinea (+224)" },
  { code: "+245", country: "Guinea-Bisáu (+245)" },
  { code: "+240", country: "Guinea Ecuatorial (+240)" },
  { code: "+592", country: "Guyana (+592)" },
  { code: "+509", country: "Haití (+509)" },
  { code: "+504", country: "Honduras (+504)" },
  { code: "+36", country: "Hungría (+36)" },
  { code: "+91", country: "India (+91)" },
  { code: "+62", country: "Indonesia (+62)" },
  { code: "+964", country: "Irak (+964)" },
  { code: "+98", country: "Irán (+98)" },
  { code: "+353", country: "Irlanda (+353)" },
  { code: "+354", country: "Islandia (+354)" },
  { code: "+972", country: "Israel (+972)" },
  { code: "+81", country: "Japón (+81)" },
  { code: "+962", country: "Jordania (+962)" },
  { code: "+7", country: "Kazajistán (+7)" },
  { code: "+254", country: "Kenia (+254)" },
  { code: "+996", country: "Kirguistán (+996)" },
  { code: "+686", country: "Kiribati (+686)" },
  { code: "+965", country: "Kuwait (+965)" },
  { code: "+856", country: "Laos (+856)" },
  { code: "+266", country: "Lesoto (+266)" },
  { code: "+371", country: "Letonia (+371)" },
  { code: "+961", country: "Líbano (+961)" },
  { code: "+231", country: "Liberia (+231)" },
  { code: "+218", country: "Libia (+218)" },
  { code: "+423", country: "Liechtenstein (+423)" },
  { code: "+370", country: "Lituania (+370)" },
  { code: "+352", country: "Luxemburgo (+352)" },
  { code: "+389", country: "Macedonia del Norte (+389)" },
  { code: "+261", country: "Madagascar (+261)" },
  { code: "+60", country: "Malasia (+60)" },
  { code: "+265", country: "Malaui (+265)" },
  { code: "+960", country: "Maldivas (+960)" },
  { code: "+223", country: "Malí (+223)" },
  { code: "+356", country: "Malta (+356)" },
  { code: "+212", country: "Marruecos (+212)" },
  { code: "+692", country: "Islas Marshall (+692)" },
  { code: "+230", country: "Mauricio (+230)" },
  { code: "+222", country: "Mauritania (+222)" },
  { code: "+52", country: "México (+52)" },
  { code: "+691", country: "Micronesia (+691)" },
  { code: "+373", country: "Moldavia (+373)" },
  { code: "+377", country: "Mónaco (+377)" },
  { code: "+976", country: "Mongolia (+976)" },
  { code: "+382", country: "Montenegro (+382)" },
  { code: "+258", country: "Mozambique (+258)" },
  { code: "+95", country: "Myanmar (+95)" },
  { code: "+264", country: "Namibia (+264)" },
  { code: "+674", country: "Nauru (+674)" },
  { code: "+977", country: "Nepal (+977)" },
  { code: "+505", country: "Nicaragua (+505)" },
  { code: "+227", country: "Níger (+227)" },
  { code: "+234", country: "Nigeria (+234)" },
  { code: "+47", country: "Noruega (+47)" },
  { code: "+64", country: "Nueva Zelanda (+64)" },
  { code: "+968", country: "Omán (+968)" },
  { code: "+92", country: "Pakistán (+92)" },
  { code: "+680", country: "Palaos (+680)" },
  { code: "+970", country: "Palestina (+970)" },
  { code: "+675", country: "Papúa Nueva Guinea (+675)" },
  { code: "+974", country: "Catar (+974)" },
  { code: "+7", country: "Rusia (+7)" },
  { code: "+250", country: "Ruanda (+250)" },
  { code: "+685", country: "Samoa (+685)" },
  { code: "+378", country: "San Marino (+378)" },
  { code: "+1", country: "San Cristóbal y Nieves (+1)" },
  { code: "+1", country: "Santa Lucía (+1)" },
  { code: "+239", country: "Santo Tomé y Príncipe (+239)" },
  { code: "+221", country: "Senegal (+221)" },
  { code: "+381", country: "Serbia (+381)" },
  { code: "+248", country: "Seychelles (+248)" },
  { code: "+232", country: "Sierra Leona (+232)" },
  { code: "+65", country: "Singapur (+65)" },
  { code: "+963", country: "Siria (+963)" },
  { code: "+252", country: "Somalia (+252)" },
  { code: "+94", country: "Sri Lanka (+94)" },
  { code: "+268", country: "Esuatini (+268)" },
  { code: "+27", country: "Sudáfrica (+27)" },
  { code: "+211", country: "Sudán del Sur (+211)" },
  { code: "+249", country: "Sudán (+249)" },
  { code: "+46", country: "Suecia (+46)" },
  { code: "+66", country: "Tailandia (+66)" },
  { code: "+886", country: "Taiwán (+886)" },
  { code: "+255", country: "Tanzania (+255)" },
  { code: "+992", country: "Tayikistán (+992)" },
  { code: "+670", country: "Timor Oriental (+670)" },
  { code: "+228", country: "Togo (+228)" },
  { code: "+676", country: "Tonga (+676)" },
  { code: "+1", country: "Trinidad y Tobago (+1)" },
  { code: "+216", country: "Túnez (+216)" },
  { code: "+993", country: "Turkmenistán (+993)" },
  { code: "+90", country: "Turquía (+90)" },
  { code: "+688", country: "Tuvalu (+688)" },
  { code: "+380", country: "Ucrania (+380)" },
  { code: "+256", country: "Uganda (+256)" },
  { code: "+598", country: "Uruguay (+598)" },
  { code: "+998", country: "Uzbekistán (+998)" },
  { code: "+678", country: "Vanuatu (+678)" },
  { code: "+379", country: "Ciudad del Vaticano (+379)" },
  { code: "+84", country: "Vietnam (+84)" },
  { code: "+967", country: "Yemen (+967)" },
  { code: "+260", country: "Zambia (+260)" },
  { code: "+263", country: "Zimbabue (+263)" },
];
