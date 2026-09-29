import { z } from "zod";

// ==========================================
// SHARED VALIDATORS & REGEXES
// ==========================================

const phoneRegex = /^\+?\d{7,15}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Longitud máxima de los campos de texto libre
const MAX_TEXT = 255;
const maxLengthMessage = (max: number) => `El texto no puede superar ${max} caracteres`;

// Nombres de personas: letras (con acentos), espacios, apóstrofos, guiones y puntos
const personNameRegex = /^\p{L}[\p{L}\s'’.\-]*$/u;
// Números de identificación: letras, números, espacios, guiones, puntos o barras
const idNumberRegex = /^[A-Za-z0-9][A-Za-z0-9\s.\-\/]*$/;

// General check for non-empty strings
const requiredString = (fieldName: string, max = MAX_TEXT) =>
  z.string({ message: `${fieldName} es requerido(a)` })
    .trim()
    .min(1, `${fieldName} es requerido(a)`)
    .max(max, maxLengthMessage(max));

// Valores que no son texto libre (archivos, firma en base64): sin límite de longitud
const requiredValue = (fieldName: string) =>
  z.string({ message: `${fieldName} es requerido(a)` })
    .trim()
    .min(1, `${fieldName} es requerido(a)`);

// Nombre de persona requerido
const requiredPersonName = (fieldName: string) =>
  requiredString(fieldName)
    .refine((val) => !val || personNameRegex.test(val), `${fieldName} solo puede contener letras`);

// Nombre de persona opcional (se exige desde superRefine cuando corresponde)
const optionalPersonName = (fieldName: string) =>
  z.string()
    .trim()
    .max(MAX_TEXT, maxLengthMessage(MAX_TEXT))
    .optional()
    .refine((val) => !val || personNameRegex.test(val), `${fieldName} solo puede contener letras`);

// Número de identificación / tributario requerido
const idNumberValidator = (fieldName: string) =>
  requiredString(fieldName, 50)
    .refine((val) => !val || val.length >= 3, `${fieldName} debe tener al menos 3 caracteres`)
    .refine((val) => !val || idNumberRegex.test(val), `${fieldName} solo puede contener letras, números, espacios, guiones, puntos o barras`);

const requiredFileList = (fieldName: string) =>
  z.array(z.string(), { message: `${fieldName} es requerido(a)` })
    .refine(
      (files) => files.some((f) => f.trim() !== ""),
      `Debe adjuntar al menos un (1) archivo de ${fieldName}`
    );
// Optional multi-file list (any number of files, blanks ignored)
const optionalFileList = z.array(z.string()).optional();

// Optional string validator
const optionalString = z.string().trim().max(MAX_TEXT, maxLengthMessage(MAX_TEXT)).optional();

// Referencias opcionales a archivos: sin límite de longitud
const optionalValue = z.string().trim().optional();

// Cantidad entera positiva opcional (se exige desde superRefine cuando corresponde)
const optionalQuantity = (fieldName: string) =>
  z.string()
    .trim()
    .optional()
    .refine((val) => !val || (/^\d+$/.test(val) && parseInt(val, 10) > 0), `${fieldName} debe ser un número entero mayor a 0`);

/** Marca el campo como requerido si está vacío (para campos condicionales). */
const requireIfEmpty = (ctx: z.RefinementCtx, value: string | undefined, fieldName: string, path: string) => {
  if (!value || value.trim() === "") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${fieldName} es requerido(a)`, path: [path] });
  }
};

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


// Monetary / Quantitative string validator (e.g., 5000, 5,000.00)
const monetaryValidator = (fieldName: string, isRequired = true) => {
  if (isRequired) {
    return z.string({ message: `${fieldName} es requerido(a)` })
      .trim()
      .min(1, `${fieldName} es requerido(a)`)
      .refine((val) => {
        const clean = val.replace(/[\$,\s]/g, "");
        if (!clean) return false;
        if (!/^\d+(\.\d{1,2})?$/.test(clean)) return false;
        const num = parseFloat(clean);
        return !isNaN(num) && num > 0;
      }, `${fieldName} debe ser un monto numérico válido mayor a 0 (ej: 5000 o 5,000.00)`);
  }
  return z.string()
    .trim()
    .optional()
    .refine((val) => {
      if (!val) return true;
      const clean = val.replace(/[\$,\s]/g, "");
      if (!clean) return true;
      if (!/^\d+(\.\d{1,2})?$/.test(clean)) return false;
      const num = parseFloat(clean);
      return !isNaN(num) && num >= 0;
    }, `${fieldName} debe ser un monto numérico válido`);
};

// Multi-select validator for Medio de Pago
const medioPagoValidator = (fieldName: string) =>
  z.string({ message: `${fieldName} es requerido(a)` })
    .trim()
    .min(1, `Debe seleccionar al menos un ${fieldName}`)
    .refine((val) => {
      const parts = val.split(",").map((s) => s.trim()).filter(Boolean);
      return parts.length > 0;
    }, `Debe seleccionar al menos un ${fieldName}`);

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

const isYes = (val: string | undefined) => val === "Sí" || val === "Si";

// ==========================================
// SHARED CONDITIONAL RULES
// (se aplican tanto en el schema del paso como en el schema final)
// ==========================================

interface ContactoData {
  formaContacto?: string;
  formaContactoDetalle?: string;
  referidoPor?: string;
}

function refineFormaContacto(data: ContactoData, ctx: z.RefinementCtx) {
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
}

interface PepData {
  esPep?: string;
  pepNombre?: string;
  pepCargo?: string;
  pepInstitucion?: string;
  pepRelacion?: string;
}

function refinePep(data: PepData, ctx: z.RefinementCtx) {
  if (!isYes(data.esPep)) return;
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


// ==========================================
// PERSONA NATURAL SCHEMAS BY STEP
// ==========================================

const naturalStep1Shape = {
  // Datos Generales
  nombreProyecto: requiredString("Nombre del Proyecto"),
  formaContacto: requiredString("Forma de Contacto"),
  formaContactoDetalle: optionalString,
  referidoPor: optionalPersonName("Nombre de quien lo refirió"),
  firstName: requiredPersonName("Nombre"),
  lastName: requiredPersonName("Apellido(s)"),
  estadoCivil: requiredString("Estado Civil"),
  paisNacimiento: requiredString("País de Nacimiento"),
  paisResidenciaFiscal: requiredString("País de Residencia Fiscal"),
  idTributaria: idNumberValidator("No. ID Tributaria"),
  nationality: requiredString("Nacionalidad"),
  tipoIdentificacion: requiredString("Tipo de Identificación"),
  otraNacionalidad: optionalString,
  idNumber: idNumberValidator("N° de Identificación"),
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
  employer: requiredString("Nombre de Empresa Donde Labora"),
  actividadLaboral: optionalString,
  actividadLaboralOtros: optionalString,
  direccionLaboral: optionalString,
  cargoDesempena: optionalString,
  esPropietario: optionalString,
  usaFondos: optionalString,

  actEconPrincipal: requiredString("Actividad Económica Principal"),
  otroActEcon: optionalString,
  pctDedicacionPrincipal: percentageValidator("Porcentaje de Dedicación Principal", false),
  jurisdiccionPrincipal: optionalString,
  actEconSecundaria: optionalString,
  pctDedicacionSecundaria: percentageValidator("Porcentaje de Dedicación Secundaria"),
  jurisdiccionSecundaria: optionalString,

  // Perfil Financiero y PEP
  ingresosMensuales: monetaryValidator("Ingresos Mensuales"),
  medioPago: medioPagoValidator("Medio de Pago"),
  fuenteFondosInmueble: requiredString("Fuente de Fondos"),
  ifOtroNombre: optionalString,
  ifTerceroNombre: optionalPersonName("Nombre Completo de Tercero"),
  ifTerceroNacionalidad: optionalString,
  ifTerceroFuenteDeIngresos: optionalString,
  ifTerceroRelacion: optionalString,
  montoServiciosAnuales: requiredString("¿Tiene previsto adquirir más de una unidad inmobiliaria?"),
  cantidadServiciosAnuales: optionalQuantity("Cantidad aproximada de unidades"),

  adquiereNombreTercero: requiredString("¿Adquiere el inmueble a nombre de otra persona?"),
  nombreTercero: optionalPersonName("Nombre Completo de la Persona"),
  destinoInmueble: requiredString("Propósito, Uso y Destino del Inmueble"),
  esPep: requiredString("Persona Expuesta Políticamente (PEP)"),
  pepNombre: optionalPersonName("Nombre Completo del PEP"),
  pepCargo: optionalString,
  pepInstitucion: optionalString,
  pepRelacion: optionalString,
};

type NaturalStep1Data = z.infer<z.ZodObject<typeof naturalStep1Shape>>;

function refineNaturalStep1(data: NaturalStep1Data, ctx: z.RefinementCtx) {
  refineFormaContacto(data, ctx);

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
  // Conditional: es propietario/accionista → origen de los fondos
  if (data.esPropietario && data.esPropietario !== "No") {
    requireIfEmpty(ctx, data.usaFondos, "¿Los fondos provendrán de dicha sociedad?", "usaFondos");
  }
  // Conditional: actEconPrincipal === "Otros"
  if (data.actEconPrincipal === "Otros") {
    requireIfEmpty(ctx, data.otroActEcon, "Otra Actividad Económica", "otroActEcon");
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

  // Conditional: fuente de fondos "Otros" / "Terceros"
  const fuente = data.fuenteFondosInmueble || "";
  if (fuente.includes("Otros")) {
    requireIfEmpty(ctx, data.ifOtroNombre, "Otra fuente de fondos", "ifOtroNombre");
  }
  if (fuente.includes("Terceros")) {
    requireIfEmpty(ctx, data.ifTerceroNombre, "Nombre Completo de Tercero", "ifTerceroNombre");
    requireIfEmpty(ctx, data.ifTerceroFuenteDeIngresos, "Fuente de Ingreso del Tercero", "ifTerceroFuenteDeIngresos");
    requireIfEmpty(ctx, data.ifTerceroRelacion, "Relación con el Tercero", "ifTerceroRelacion");
    requireIfEmpty(ctx, data.ifTerceroNacionalidad, "Nacionalidad del Tercero", "ifTerceroNacionalidad");
  }

  // Conditional: más de una unidad → cantidad
  if (isYes(data.montoServiciosAnuales)) {
    requireIfEmpty(ctx, data.cantidadServiciosAnuales, "Cantidad aproximada de unidades", "cantidadServiciosAnuales");
  }
  // Conditional: adquiere a nombre de otra persona → nombre
  if (isYes(data.adquiereNombreTercero)) {
    requireIfEmpty(ctx, data.nombreTercero, "Nombre Completo de la Persona", "nombreTercero");
  }

  refinePep(data, ctx);
}

export const naturalStep1Schema = z.object(naturalStep1Shape).superRefine(refineNaturalStep1);

// Paso 2: Documentos (Anterior Paso 4)
export const naturalStep2Schema = z.object({
  idFile: requiredValue("Copia de ID"),
  proofAddressFile: optionalValue,
  origenFondosFile: optionalFileList,
  hasEstadoCuenta: optionalFileList,
  hasCertificacionBancaria: optionalValue,
});

// Paso 3: Declaración y Firma (Anterior Paso 5)
export const naturalStep3Schema = z.object({
  termsAccepted: z.boolean().refine(val => val === true, "Debe dar consentimiento legal y autorizar el análisis de prevención"),
  signatureConfirmed: z.boolean().refine(val => val === true, "Debe confirmar la veracidad, validez de la firma digital y compromiso de firma física"),
  signerName: requiredPersonName("Nombre del Firmante"),
  signatureDate: pastOrTodayDateValidator("Fecha de Firma"),
  firmaImage: requiredValue("Firma Digital (Imagen de la firma)"),
});

// Placeholder step schemas for compatibility with unused imports if any
export const naturalStep4Schema = z.object({});
export const naturalStep5Schema = z.object({});

// Final Combined Schema for Natural Person
export const naturalFormSchema = z.object({
  ...naturalStep1Shape,
  ...naturalStep2Schema.shape,
  ...naturalStep3Schema.shape,
  conclusionesVerificacion: optionalValue,
}).superRefine(refineNaturalStep1);


// ==========================================
// PERSONA JURÍDICA SCHEMAS BY STEP
// ==========================================

// GjcMember Schema (Junta Directiva)
export const gjcMemberSchema = z.object({
  id: z.string(),
  cargo: requiredString("Cargo de Miembro GJC"),
  nombre: requiredPersonName("Nombre de Miembro GJC"),
  apellidos: requiredPersonName("Apellidos de Miembro GJC"),
  nacionalidad: requiredString("Nacionalidad de Miembro GJC"),
  fechaNacimiento: adultBirthdateValidator("Fecha de Nacimiento de Miembro GJC"),
  nroId: idNumberValidator("No. de Identificación de Miembro GJC"),
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
  nombreCompleto: requiredPersonName("Nombre Completo de Beneficiario Final"),
  noIdentificacion: idNumberValidator("No. Identificación de Beneficiario Final"),
  nacionalidad: requiredString("Nacionalidad de Beneficiario Final"),
  fechaAdquisicion: pastOrTodayDateValidator("Fecha de Adquisición de BF"),
  porcentajeParticipacion: requiredPercentageStringValidator("Porcentaje de Participación de BF"),
  paisNacimiento: requiredString("País de Nacimiento de Beneficiario Final"),
  direccion: requiredString("Dirección de Beneficiario Final"),
});

// Paso 1: Datos de la Empresa, Gobierno y Finanzas (Unifica antiguos pasos 1, 2 y 3)
const juridicaStep1Shape = {
  // Identificación
  nombreProyecto: requiredString("Nombre del Proyecto"),
  formaContacto: requiredString("Forma de Contacto"),
  formaContactoDetalle: optionalString,
  referidoPor: optionalPersonName("Nombre de quien lo refirió"),
  razonSocial: requiredString("Razón Social"),
  tipoSociedad: requiredString("Tipo de Sociedad"),
  estadoSociedad: requiredString("Estado de la Sociedad"),
  tipoCliente: requiredString("Tipo de Cliente"),
  tipoDocumentoIdentidad: requiredString("Tipo de Documento Identidad"),
  actividadPrincipal: requiredString("Actividad Principal"),
  numeroDocumento: idNumberValidator("Número de Documento"),
  fechaVencimientoId: idExpirationDateValidator("Fecha de Vencimiento de Identificación"),
  numeroIdTributaria: idNumberValidator("No. ID Tributaria"),
  paisTributacion: requiredString("País de Tributación"),
  //delete

  fechaConstitucion: pastOrTodayDateValidator("Fecha de Constitución"),
  paisOpera: requiredString("País donde Opera"),
  paisInscripcion: requiredString("País de Inscripción"),

  //delete

  // Contact Person
  contactoNombre: requiredPersonName("Nombre de Contacto"),
  contactoApellido: requiredPersonName("Apellido de Contacto"),
  contactoId: idNumberValidator("Identificación de Contacto"),
  contactoTelefono: phoneValidator("Teléfono de Contacto"),
  contactoEmail: emailValidator("Email de Contacto"),
  ifContacto: requiredString("¿Tiene cargo en la empresa?"),
  contactoCargo: optionalString,

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
  rlNombre: requiredPersonName("Nombre y Apellido de Representante Legal"),
  rlFechaNacimiento: adultBirthdateValidator("Fecha de Nacimiento de Representante Legal"),
  rlNacionalidad: requiredString("Nacionalidad de Representante Legal"),
  rlEstadoCivil: requiredString("Estado Civil de Representante Legal"),
  rlNoIdentificacion: idNumberValidator("No. Identificación de Representante Legal"),
  rlProfesionOcupacion: requiredString("Profesión / Ocupación de Representante Legal"),
  rlActividadEconomica: requiredString("Actividad Económica de Representante Legal"),
  rlDireccion: requiredString("Dirección de Representante Legal"),
  rlPaisResidencia: requiredString("País de Residencia de Representante Legal"),
  rlTelefono: phoneValidator("Teléfono de Representante Legal"),
  rlObjetoInvestigacion: requiredString("Pregunta Legal AML"),
  gjcMembers: z.array(gjcMemberSchema).min(1, "Debe agregar al menos un (1) miembro de Gobierno Corporativo / Junta Directiva"),

  // Beneficiarios Finales y Finanzas
  bfMembers: z.array(bfMemberSchema).min(1, "Debe registrar al menos un (1) Beneficiario Final"),
  ingresosMensuales: monetaryValidator("Ingresos Mensuales"),
  medioPago: medioPagoValidator("Medio de Pago"),
  fuenteFondosInmueble: medioPagoValidator("Usted Adquiere el Bien Inmueble con Fondos"),
  terceroNombre: optionalPersonName("Nombre Completo de Tercero"),
  terceroNacionalidad: optionalString,
  terceroVinculo: optionalString,
  terceroFuenteFondos: optionalString,
  adquiereMasUnidades: requiredString("¿Tiene previsto adquirir más de una unidad inmobiliaria?"),
  cantidadUnidadesInmobiliarias: optionalString,
  montoServiciosAnuales: optionalString,
  esPep: requiredString("Pregunta de PEP de Persona Jurídica"),
  pepNombre: optionalPersonName("Nombre Completo del PEP"),
  pepCargo: optionalString,
  pepInstitucion: optionalString,
  pepRelacion: optionalString,
  destinoFondos: requiredString("Destino de Fondos"),

  //maybe delete these fields if not needed
  actividadComercial: optionalString,
  origenFondos: optionalString,
  volumenVentas: optionalString,
  bancoReferencia: optionalString,
};

type JuridicaStep1Data = z.infer<z.ZodObject<typeof juridicaStep1Shape>>;

function refineJuridicaStep1(data: JuridicaStep1Data, ctx: z.RefinementCtx) {
  refineFormaContacto(data, ctx);

  // Conditional: la persona de contacto ocupa un cargo → cuál
  if (isYes(data.ifContacto)) {
    requireIfEmpty(ctx, data.contactoCargo, "Cargo que ocupa dentro de la sociedad", "contactoCargo");
  }

  // Validate that sum of BfMembers percentages is <= 100%
  const sumPct = (data.bfMembers || []).reduce((sum, member) => {
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

  // Validate conditional Terceros fields when selected in fuenteFondosInmueble
  if (data.fuenteFondosInmueble && data.fuenteFondosInmueble.includes("Terceros")) {
    if (!data.terceroNombre || data.terceroNombre.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El nombre completo de la persona que aportará los fondos es requerido",
        path: ["terceroNombre"],
      });
    }
    if (!data.terceroNacionalidad || data.terceroNacionalidad.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La nacionalidad del tercero es requerida",
        path: ["terceroNacionalidad"],
      });
    }
    if (!data.terceroVinculo || data.terceroVinculo.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El vínculo con la persona jurídica es requerido",
        path: ["terceroVinculo"],
      });
    }
    if (!data.terceroFuenteFondos || data.terceroFuenteFondos.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La fuente de los fondos del tercero es requerida",
        path: ["terceroFuenteFondos"],
      });
    }
  }

  // Validate conditional cantidadUnidadesInmobiliarias when adquiereMasUnidades === "Sí"
  if (isYes(data.adquiereMasUnidades)) {
    const raw = (data.cantidadUnidadesInmobiliarias || "").trim();
    if (!/^\d+$/.test(raw) || parseInt(raw, 10) <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debe ingresar una cantidad aproximada de unidades válida (mínimo 1)",
        path: ["cantidadUnidadesInmobiliarias"],
      });
    }
  }

  refinePep(data, ctx);
}

export const juridicaStep1Schema = z.object(juridicaStep1Shape).superRefine(refineJuridicaStep1);

// Paso 2: Documentos (Anterior Paso 4)
export const juridicaStep2Schema = z.object({

  avisoOperacionesFile: requiredValue("Copia de Certificado de Aviso de Operaciones"),
  origenFondosFile: requiredFileList("Aunque sea un Archivo de Origen de Fondos"),
  pactoSocialFile: requiredFileList("Aunque sea un Archivo de Pacto Social"),
  serviciosPublicosFile: optionalValue,
  certBancariaFile: optionalValue,
  certRegistroFile: optionalValue,
  certComprasFile: optionalValue,


});

// Paso 3: Declaración y Firma (Anterior Paso 5)
export const juridicaStep3Schema = z.object({
  termsAccepted: z.boolean().refine(val => val === true, "Debe dar consentimiento legal y autorizar el análisis de prevención"),
  signatureConfirmed: z.boolean().refine(val => val === true, "Debe confirmar la veracidad, validez de la firma digital y compromiso de firma física"),
  signerName: requiredPersonName("Nombre del Representante Legal o Firmante"),
  signatureDate: pastOrTodayDateValidator("Fecha de Firma"),
  firmaImage: requiredValue("Firma Digital (Imagen de la firma)"),
  crmid: optionalString,
});

// Placeholders for compatibility
export const juridicaStep4Schema = z.object({});
export const juridicaStep5Schema = z.object({});

// Final Combined Schema for Juridical Person
export const juridicaFormSchema = z.object({
  ...juridicaStep1Shape,
  ...juridicaStep2Schema.shape,
  ...juridicaStep3Schema.shape,
  conclusionesVerificacion: optionalValue,
}).superRefine(refineJuridicaStep1);
