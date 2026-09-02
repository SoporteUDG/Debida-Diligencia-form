import { z } from "zod";

// ==========================================
// SHARED VALIDATORS & REGEXES
// ==========================================

const phoneRegex = /^\+?\d{7,15}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// General check for non-empty strings
const requiredString = (fieldName: string) => 
  z.string({ message: `${fieldName} es requerido(a)` })
    .trim()
    .min(1, `${fieldName} es requerido(a)`);

// Optional string validator
const optionalString = z.string().trim().optional();

// Phone Validator
const phoneValidator = (fieldName: string) =>
  z.string({ message: `${fieldName} es requerido(a)` })
    .trim()
    .min(1, `${fieldName} es requerido(a)`)
    .refine(val => !val || /^\+?[\d\s\-]{7,20}$/.test(val), `${fieldName} debe ser un número telefónico válido (mínimo 7 dígitos)`);

const optionalPhoneValidator = 
  z.string()
    .trim()
    .optional()
    .refine(val => !val || /^\+?[\d\s\-]{7,20}$/.test(val), "El número debe ser un teléfono válido");

// Email Validator
const emailValidator = (fieldName: string) =>
  z.string({ message: `${fieldName} es requerido(a)` })
    .trim()
    .min(1, `${fieldName} es requerido(a)`)
    .email("Formato de correo electrónico inválido");

const optionalEmailValidator =
  z.string()
    .trim()
    .optional()
    .refine(val => !val || emailRegex.test(val), "Formato de correo electrónico inválido");

// Date Validator (Birthdates must be adult >= 18)
const adultBirthdateValidator = (fieldName: string) =>
  z.string({ message: `${fieldName} es requerido(a)` })
    .min(1, `${fieldName} es requerido(a)`)
    .refine((val) => {
      if (!val) return false;
      const birthDate = new Date(val);
      if (isNaN(birthDate.getTime())) return false;
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age >= 18;
    }, `${fieldName} indica menor de edad (se requiere ser mayor de 18 años)`);

// Past Date Validator (Constituent date, signature date, etc.)
const pastOrTodayDateValidator = (fieldName: string) =>
  z.string({ message: `${fieldName} es requerido(a)` })
    .min(1, `${fieldName} es requerido(a)`)
    .refine((val) => {
      if (!val) return false;
      const date = new Date(val);
      if (isNaN(date.getTime())) return false;
      const today = new Date();
      // Reset hours to compare only date parts
      today.setHours(23, 59, 59, 999);
      return date <= today;
    }, `${fieldName} no puede ser una fecha futura`);

// Percentage string validator
const percentageValidator = (fieldName: string, isRequired = false) => {
  if (isRequired) {
    return z.string({ message: `${fieldName} es requerido(a)` })
      .min(1, `${fieldName} es requerido(a)`)
      .refine(val => {
        const num = parseFloat(val);
        return !isNaN(num) && num >= 0 && num <= 100;
      }, `${fieldName} debe ser un porcentaje válido entre 0 y 100%`);
  }

  return z.string()
    .optional()
    .refine(val => {
      if (!val) return true;
      const num = parseFloat(val);
      return !isNaN(num) && num >= 0 && num <= 100;
    }, `${fieldName} debe ser un porcentaje válido entre 0 y 100%`);
};


// Expiration Date Validator (Identification Document must not be expired)
const idExpirationDateValidator = (fieldName: string) =>
  z.string()
    .trim()
    .optional()
    .refine((val) => {
      if (!val) return true;
      const expDate = new Date(val);
      if (isNaN(expDate.getTime())) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return expDate >= today;
    }, `${fieldName} indica que el documento de identificación se encuentra VENCIDO. Por favor proporcione una identificación vigente.`);


// ==========================================
// PERSONA NATURAL SCHEMAS BY STEP
// ==========================================

export const naturalStep1Schema = z.object({
  // Datos Generales
  nombreProyecto: requiredString("Nombre del Proyecto"),
  formaContacto: requiredString("Forma de Contacto"),
  formaContactoDetalle: optionalString,
  referidoPor: optionalString,
  firstName: requiredString("Nombre"),
  lastName: requiredString("Apellido(s)"),
  estadoCivil: requiredString("Estado Civil"),
  paisNacimiento: requiredString("País de Nacimiento"),
  paisResidenciaFiscal: requiredString("País de Residencia Fiscal"),
  idTributaria: requiredString("No. ID Tributaria"),
  nationality: requiredString("Nacionalidad"),
  tipoIdentificacion: requiredString("Tipo de Identificación"),
  otraNacionalidad: optionalString,
  idNumber: requiredString("N° de Identificación"),
  fechaVencimientoId: idExpirationDateValidator("Fecha de Vencimiento de Identificación"),
  estatusMigratorio: requiredString("Estatus Migratorio"),
  fechaNacimiento: adultBirthdateValidator("Fecha de Nacimiento"),

  // Ubicación y Datos Laborales
  direccionResidencial: requiredString("Dirección residencial"),
  ciudad: requiredString("Ciudad"),
  provinciaEstado: requiredString("Provincia / Estado"),
  paisResidencial: requiredString("País residencial"),
  email: emailValidator("E-mail"),
  telefonoCodigo: z.string().default("+507"),
  telefono: optionalPhoneValidator,
  celularCodigo: z.string().default("+507"),
  celular: phoneValidator("Celular"),

  profession: requiredString("Profesión u Oficio"),
  profesionOtros: optionalString,
  paisActividadLaboral: optionalString,
  employer: optionalString,
  actividadLaboral: optionalString,
  actividadLaboralOtros: optionalString,
  direccionLaboral: optionalString,
  cargoDesempena: optionalString,

  actEconPrincipal: optionalString,
  pctDedicacionPrincipal: percentageValidator("Porcentaje de Dedicación Principal", false),
  jurisdiccionPrincipal: optionalString,
  actEconSecundaria: optionalString,
  pctDedicacionSecundaria: percentageValidator("Porcentaje de Dedicación Secundaria"),
  jurisdiccionSecundaria: optionalString,

  // Perfil Financiero y PEP
  ingresosMensuales: requiredString("Ingresos Mensuales"),
  medioPago: requiredString("Medio de Pago"),
  fuenteFondosInmueble: requiredString("Fuente de Fondos"),
  montoServiciosAnuales: optionalString,
  adquiereNombreTercero: optionalString,
  destinoInmueble: optionalString,
  esPep: requiredString("Persona Expuesta Políticamente (PEP)"),
  pepNombre: optionalString,
  pepCargo: optionalString,
  pepInstitucion: optionalString,
  pepRelacion: optionalString,
}).superRefine((data, ctx) => {
  // Conditional: formaContacto === "Otros"
  if ((data.formaContacto === "Otros" || data.formaContacto === "Otro") && (!data.formaContactoDetalle || data.formaContactoDetalle.trim() === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Debe especificar el detalle cuando selecciona 'Otros' en Formas de Contacto",
      path: ["formaContactoDetalle"],
    });
  }
  // Conditional: formaContacto === "Referido"
  if (data.formaContacto === "Referido" && (!data.referidoPor || data.referidoPor.trim() === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Debe ingresar el nombre de la persona que lo refirió",
      path: ["referidoPor"],
    });
  }
  // Conditional: profession === "Otros"
  if (data.profession === "Otros" && (!data.profesionOtros || data.profesionOtros.trim() === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Debe especificar la profesión u oficio cuando selecciona 'Otros'",
      path: ["profesionOtros"],
    });
  }
  // Conditional: actividadLaboral === "OTROS"
  if (data.actividadLaboral === "OTROS" && (!data.actividadLaboralOtros || data.actividadLaboralOtros.trim() === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Debe especificar la actividad laboral cuando selecciona 'OTROS'",
      path: ["actividadLaboralOtros"],
    });
  }
  // Sum of percentages <= 100%
  const p1 = parseFloat(data.pctDedicacionPrincipal || "0");
  const p2 = parseFloat(data.pctDedicacionSecundaria || "0");
  if (!isNaN(p1) && !isNaN(p2) && p1 + p2 > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `La suma de dedicación principal (${p1}%) y secundaria (${p2}%) no puede superar el 100%`,
      path: ["pctDedicacionSecundaria"],
    });
  }
  // Conditional PEP fields
  if (data.esPep === "Sí") {
    if (!data.pepNombre || data.pepNombre.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El nombre completo del PEP es requerido",
        path: ["pepNombre"],
      });
    }
    if (!data.pepCargo || data.pepCargo.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El cargo desempeñado es requerido",
        path: ["pepCargo"],
      });
    }
    if (!data.pepInstitucion || data.pepInstitucion.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La institución/entidad es requerida",
        path: ["pepInstitucion"],
      });
    }
    if (!data.pepRelacion || data.pepRelacion.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La relación/parentesco es requerida",
        path: ["pepRelacion"],
      });
    }
  }
});

// Paso 2: Documentos (Anterior Paso 4)
export const naturalStep2Schema = z.object({
  idFile: requiredString("Copia de ID"),
  proofAddressFile: optionalString,
  origenFondosFile: optionalString,
  hasEstadoCuenta: z.boolean().default(false),
  hasCertificacionBancaria: z.boolean().default(false),
  otrosAdjuntosFile: optionalString,
});

// Paso 3: Declaración y Firma (Anterior Paso 5)
export const naturalStep3Schema = z.object({
  termsAccepted: z.boolean().refine(val => val === true, "Debe aceptar los términos y condiciones de la declaración jurada"),
  signerName: requiredString("Nombre del Firmante"),
  signatureDate: pastOrTodayDateValidator("Fecha de Firma"),
  firmaImage: requiredString("Firma Digital (Imagen de la firma)"),
});

// Placeholder step schemas for compatibility with unused imports if any
export const naturalStep4Schema = z.object({});
export const naturalStep5Schema = z.object({});

// Final Combined Schema for Natural Person
export const naturalFormSchema = z.object({
  ...naturalStep1Schema.shape,
  ...naturalStep2Schema.shape,
  ...naturalStep3Schema.shape,
  conclusionesVerificacion: optionalString,
}).superRefine((data, ctx) => {
  // Apply the same conditional refinements
  if (data.profession === "Otros" && (!data.profesionOtros || data.profesionOtros.trim() === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Debe especificar la profesión u oficio cuando selecciona 'Otros'",
      path: ["profesionOtros"],
    });
  }
  if (data.actividadLaboral === "OTROS" && (!data.actividadLaboralOtros || data.actividadLaboralOtros.trim() === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Debe especificar la actividad laboral cuando selecciona 'OTROS'",
      path: ["actividadLaboralOtros"],
    });
  }
  const p1 = parseFloat(data.pctDedicacionPrincipal || "0");
  const p2 = parseFloat(data.pctDedicacionSecundaria || "0");
  if (!isNaN(p1) && !isNaN(p2) && p1 + p2 > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `La suma de dedicación principal y secundaria no puede superar el 100%`,
      path: ["pctDedicacionSecundaria"],
    });
  }
});


// ==========================================
// PERSONA JURÍDICA SCHEMAS BY STEP
// ==========================================

// GjcMember Schema (Junta Directiva)
export const gjcMemberSchema = z.object({
  id: z.string(),
  cargo: requiredString("Cargo de Miembro GJC"),
  nombre: requiredString("Nombre de Miembro GJC"),
  apellidos: requiredString("Apellidos de Miembro GJC"),
  nacionalidad: requiredString("Nacionalidad de Miembro GJC"),
  fechaNacimiento: adultBirthdateValidator("Fecha de Nacimiento de Miembro GJC"),
  nroId: requiredString("No. de Identificación de Miembro GJC"),
  direccion: requiredString("Dirección de Miembro GJC"),
});

// Helper for required percentage in dynamic bfMemberSchema
function requiredPercentageStringValidator(fieldName: string) {
  return z.string({ message: `${fieldName} es requerido` })
    .min(1, `${fieldName} es requerido`)
    .refine(val => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0 && num <= 100;
    }, `${fieldName} debe estar entre 0.01 y 100%`);
}

// BfMember Schema (Beneficiario Final)
export const bfMemberSchema = z.object({
  id: z.string(),
  nombreCompleto: requiredString("Nombre Completo de Beneficiario Final"),
  noIdentificacion: requiredString("No. Identificación de Beneficiario Final"),
  nacionalidad: requiredString("Nacionalidad de Beneficiario Final"),
  fechaAdquisicion: pastOrTodayDateValidator("Fecha de Adquisición de BF"),
  porcentajeParticipacion: requiredPercentageStringValidator("Porcentaje de Participación de BF"),
  paisNacimiento: requiredString("País de Nacimiento de Beneficiario Final"),
  direccion: requiredString("Dirección de Beneficiario Final"),
});

// Paso 1: Datos de la Empresa, Gobierno y Finanzas (Unifica antiguos pasos 1, 2 y 3)
export const juridicaStep1Schema = z.object({
  // Identificación
  nombreProyecto: requiredString("Nombre del Proyecto"),
  formaContacto: requiredString("Forma de Contacto"),
  formaContactoDetalle: optionalString,
  referidoPor: optionalString,
  razonSocial: requiredString("Razón Social"),
  tipoSociedad: requiredString("Tipo de Sociedad"),
  tipoCliente: requiredString("Tipo de Cliente"),
  tipoDocumentoIdentidad: requiredString("Tipo de Documento Identidad"),
  actividadPrincipal: requiredString("Actividad Principal"),
  numeroDocumento: requiredString("Número de Documento"),
  fechaVencimientoId: idExpirationDateValidator("Fecha de Vencimiento de Identificación"),
  numeroIdTributaria: requiredString("No. ID Tributaria"),
  paisTributacion: requiredString("País de Tributación"),
  porcentajeActividad: percentageValidator("Porcentaje de Actividad Comercial", true),
  fechaConstitucion: pastOrTodayDateValidator("Fecha de Constitución"),
  paisOpera: requiredString("País donde Opera"),
  paisInscripcion: requiredString("País de Inscripción"),
  fechaNacimiento: pastOrTodayDateValidator("Fecha de Nacimiento (Registro)"),

  // Contact Person
  contactoNombre: requiredString("Nombre de Contacto"),
  contactoApellido: requiredString("Apellido de Contacto"),
  contactoId: requiredString("Identificación de Contacto"),
  contactoTelefono: phoneValidator("Teléfono de Contacto"),
  contactoEmail: emailValidator("Email de Contacto"),

  // General Company Data
  empresaDireccion: requiredString("Dirección de la Empresa"),
  empresaCiudad: requiredString("Ciudad de la Empresa"),
  empresaProvincia: requiredString("Provincia de la Empresa"),
  empresaPais: requiredString("País de la Empresa"),
  empresaTelefonoCodigo: z.string().default("+507"),
  empresaTelefono: phoneValidator("Teléfono de la Empresa"),
  empresaCelularCodigo: z.string().default("+507"),
  empresaCelular: phoneValidator("Celular de la Empresa"),
  empresaEmail: emailValidator("Email de la Empresa"),

  // Gobierno y RL
  rlNombre: requiredString("Nombre y Apellido de Representante Legal"),
  rlFechaNacimiento: adultBirthdateValidator("Fecha de Nacimiento de Representante Legal"),
  rlNacionalidad: requiredString("Nacionalidad de Representante Legal"),
  rlEstadoCivil: requiredString("Estado Civil de Representante Legal"),
  rlNoIdentificacion: requiredString("No. Identificación de Representante Legal"),
  rlProfesionOcupacion: requiredString("Profesión / Ocupación de Representante Legal"),
  rlActividadEconomica: requiredString("Actividad Económica de Representante Legal"),
  rlDireccion: requiredString("Dirección de Representante Legal"),
  rlPaisResidencia: requiredString("País de Residencia de Representante Legal"),
  rlTelefono: phoneValidator("Teléfono de Representante Legal"),
  rlObjetoInvestigacion: requiredString("Pregunta Legal AML"),
  gjcMembers: z.array(gjcMemberSchema).min(1, "Debe agregar al menos un (1) miembro de Gobierno Corporativo / Junta Directiva"),

  // Beneficiarios Finales y Finanzas
  bfMembers: z.array(bfMemberSchema).min(1, "Debe registrar al menos un (1) Beneficiario Final"),
  ingresosMensuales: requiredString("Ingresos Mensuales"),
  medioPago: requiredString("Medio de Pago"),
  fuenteFondosInmueble: requiredString("Usted Adquiere el Bien Inmueble con Fondos"),
  montoServiciosAnuales: requiredString("Monto de Servicios Anuales"),
  esPep: requiredString("Pregunta de PEP de Persona Jurídica"),
  pepNombre: optionalString,
  pepCargo: optionalString,
  pepInstitucion: optionalString,
  pepRelacion: optionalString,
  actividadComercial: requiredString("Actividad Comercial"),
  origenFondos: requiredString("Origen de Fondos"),
  destinoFondos: requiredString("Destino de Fondos"),
  volumenVentas: requiredString("Volumen de Ventas"),
  bancoReferencia: requiredString("Banco de Referencia"),
}).superRefine((data, ctx) => {
  // Validate that sum of BfMembers percentages is <= 100%
  const sumPct = data.bfMembers.reduce((sum, member) => {
    const val = parseFloat(member.porcentajeParticipacion || "0");
    return sum + (isNaN(val) ? 0 : val);
  }, 0);
  if (sumPct > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `La suma de participación de los Beneficiarios Finales (${sumPct}%) no puede exceder el 100%`,
      path: ["bfMembers"],
    });
  }

  // Validate conditional PEP fields
  if (data.esPep === "Sí") {
    if (!data.pepNombre || data.pepNombre.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El nombre completo del PEP es requerido",
        path: ["pepNombre"],
      });
    }
    if (!data.pepCargo || data.pepCargo.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El cargo desempeñado es requerido",
        path: ["pepCargo"],
      });
    }
    if (!data.pepInstitucion || data.pepInstitucion.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La institución/entidad es requerida",
        path: ["pepInstitucion"],
      });
    }
    if (!data.pepRelacion || data.pepRelacion.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La relación/parentesco es requerida",
        path: ["pepRelacion"],
      });
    }
  }
});

// Paso 2: Documentos (Anterior Paso 4)
export const juridicaStep2Schema = z.object({
  avisoOperacionesFile: requiredString("Copia de Certificado de Aviso de Operaciones"),
  copiaIdFile: requiredString("Copia de Cédula o Pasaporte"),
  origenFondosFile: optionalString,
  pactoSocialFile: optionalString,
  serviciosPublicosFile: optionalString,
  certBancariaFile: optionalString,
  certRegistroFile: optionalString,
  
  checkedCopiaId: z.boolean().default(false),
  checkedOrigenFondos: z.boolean().default(false),
  checkedPactoSocial: z.boolean().default(false),
  checkedAvisoOperaciones: z.boolean().default(false),
  checkedServiciosPublicos: z.boolean().default(false),
  checkedCertBancaria: z.boolean().default(false),
  checkedCertRegistro: z.boolean().default(false),
});

// Paso 3: Declaración y Firma (Anterior Paso 5)
export const juridicaStep3Schema = z.object({
  termsAccepted: z.boolean().refine(val => val === true, "Debe aceptar la declaración jurada"),
  signerName: requiredString("Nombre del Representante Legal o Firmante"),
  signatureDate: pastOrTodayDateValidator("Fecha de Firma"),
  firmaImage: requiredString("Firma Digital (Imagen de la firma)"),
  crmid: optionalString,
});

// Placeholders for compatibility
export const juridicaStep4Schema = z.object({});
export const juridicaStep5Schema = z.object({});

// Final Combined Schema for Juridical Person
export const juridicaFormSchema = z.object({
  ...juridicaStep1Schema.shape,
  ...juridicaStep2Schema.shape,
  ...juridicaStep3Schema.shape,
  conclusionesVerificacion: optionalString,
}).superRefine((data, ctx) => {
  // Validate GjcMembers items
  if (!data.gjcMembers || data.gjcMembers.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Debe agregar al menos un (1) miembro de Gobierno Corporativo / Junta Directiva",
      path: ["gjcMembers"],
    });
  }

  // Validate BfMembers items
  if (!data.bfMembers || data.bfMembers.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Debe registrar al menos un (1) Beneficiario Final",
      path: ["bfMembers"],
    });
  } else {
    const sumPct = data.bfMembers.reduce((sum, member) => {
      const val = parseFloat(member.porcentajeParticipacion || "0");
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
    if (sumPct > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `La suma de participación de los Beneficiarios Finales (${sumPct}%) no puede exceder el 100%`,
        path: ["bfMembers"],
      });
    }
  }
});
