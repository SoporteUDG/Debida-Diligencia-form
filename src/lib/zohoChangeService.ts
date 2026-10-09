import prisma from "@/lib/prisma";
import { zoho, mapFormToCrmPayload } from "@/lib/zohoService";
import { logAuditEvent } from "@/lib/auditService";
import { sellarNuevaVersion } from "@/lib/formVersionService";
import { syncFormToWorkDrive } from "@/lib/workdriveSyncService";
import { PROFESSIONS } from "@/lib/naturalOptions";

/**
 * Cambios hechos en Zoho CRM -> portal.
 *
 * Un workflow de Zoho avisa (webhook) que un expediente de Debida_Diligencia
 * cambió, pero no dice qué campos. Por eso se guarda una copia de los campos
 * mapeados de cada registro (ZohoRecordSnapshot) y en cada aviso se compara el
 * registro actual contra esa copia:
 *
 *  - Solo cuentan los campos de Zoho que corresponden a un campo del
 *    formulario. El resto son campos propios de Zoho y se ignoran sin registrar.
 *  - Si el valor nuevo ya coincide con el portal (p. ej. el cambio lo hizo la
 *    propia sincronización del portal) no hay nada que hacer.
 *  - Expediente en borrador: se actualiza el borrador.
 *  - Expediente completado: se actualiza y se sella una versión nueva.
 */

type FormType = "NATURAL" | "JURIDICA";
type Datos = Record<string, any>;

/**
 * Traduce el valor de un campo de Zoho a campos del formulario. Devuelve null
 * cuando el valor no se puede representar en el formulario (p. ej. una opción
 * que no existe en el selector).
 */
type AFormulario = (valor: unknown, actual: Datos) => Datos | null;

interface CampoInverso {
  zoho: string;
  aForm: AFormulario;
}

export interface CambioZoho {
  campoZoho: string;
  anterior: string;
  nuevo: string;
  campos: Datos;
}

// ---------------------------------------------------------------------------
// Normalización (misma representación para Zoho, la copia y el portal)
// ---------------------------------------------------------------------------

/** Valor de Zoho o del payload como texto comparable. */
export function normalizar(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map(normalizar).filter(Boolean).sort().join(", ");
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return normalizar(o.name ?? o.display_value ?? o.value ?? o.id ?? "");
  }
  const s = String(v).trim();
  return s.toLowerCase() === "null" ? "" : s;
}

const esVerdadero = (v: unknown) => normalizar(v) === "true";

// ---------------------------------------------------------------------------
// Traducciones Zoho -> formulario
// ---------------------------------------------------------------------------

const texto = (campo: string): AFormulario => (v) => ({ [campo]: normalizar(v) });

const fecha = (campo: string): AFormulario => (v) => ({ [campo]: normalizar(v).slice(0, 10) });

const siNo = (campo: string): AFormulario => (v) => ({ [campo]: esVerdadero(v) ? "Sí" : "No" });

/** Picklist múltiple -> "Efectivo, Cheque" (formato del formulario). */
const lista = (campo: string): AFormulario => (v) => ({
  [campo]: (Array.isArray(v) ? v : String(v ?? "").split(","))
    .map(normalizar)
    .filter(Boolean)
    .join(", "),
});

/** "+507 6000-0000" -> código + número. Sin código se conserva el actual. */
const telefono = (campoCodigo: string, campoNumero: string): AFormulario => (v) => {
  const s = normalizar(v);
  const m = /^(\+\d+)\s+(.+)$/.exec(s);
  return m ? { [campoCodigo]: m[1], [campoNumero]: m[2] } : { [campoNumero]: s };
};

/** Nombre completo -> nombre y apellido (mitad y mitad, como en relatedDraftService). */
const nombreCompleto = (campoNombre: string, campoApellido: string): AFormulario => (v) => {
  const partes = normalizar(v).split(/\s+/).filter(Boolean);
  const mitad = Math.ceil(partes.length / 2);
  return {
    [campoNombre]: partes.length > 1 ? partes.slice(0, mitad).join(" ") : partes.join(" "),
    [campoApellido]: partes.length > 1 ? partes.slice(mitad).join(" ") : "",
  };
};

/**
 * Selector con opción "Otros" + campo de detalle: una opción del selector se
 * guarda tal cual; cualquier otro texto va como "Otros" + detalle.
 */
const conOtros = (campo: string, campoDetalle: string, opciones: readonly string[]): AFormulario => (v) => {
  const s = normalizar(v);
  if (!s) return { [campo]: "" };
  return opciones.includes(s) && !/^otros?$/i.test(s)
    ? { [campo]: s, [campoDetalle]: "" }
    : { [campo]: "Otros", [campoDetalle]: s };
};

/** Solo acepta valores (separados por coma) que existan en el selector. */
const enOpciones = (campo: string, opciones: readonly string[]): AFormulario => (v) => {
  const items = normalizar(v).split(",").map((x) => x.trim()).filter(Boolean);
  return items.every((x) => opciones.includes(x)) ? { [campo]: items.join(", ") } : null;
};

// Opciones de los selectores (deben coincidir con los componentes del formulario)
const FORMA_CONTACTO_NATURAL = [
  "Broker", "Campañas internas", "Chat", "Encuentra 24", "Eventos", "Facebook", "Ferias",
  "Google AdWords", "Instagram", "Landing casa desde 150", "Linkedln", "Referido", "Timelines",
  "WhatsApp", "Sala de Ventas", "Valla", "Otros",
];
const FORMA_CONTACTO_JURIDICA = [
  "Mercadeo (feria, evento, revista, valla)",
  "Redes Sociales",
  "Referencia Interna (ej. colaborador, vendedor, sala de ventas)",
  "Referencia Externa (ej. corredor, broker, cliente, familiar, cliente antiguo)",
  "Referido",
  "Otros",
];
const ACT_ECON_NATURAL = [
  "Asalariado", "Trabajador independiente", "Ingresos provenientes de empresas propias", "Otros",
];
const FUENTE_FONDOS_NATURAL = ["Propios", "Financiamiento", "Terceros"];

// ---------------------------------------------------------------------------
// Mapeo inverso de mapFormToCrmPayload
// ---------------------------------------------------------------------------

const CABECERA_Y_PEP = (formaContacto: readonly string[]): CampoInverso[] => [
  { zoho: "Proyecto", aForm: texto("nombreProyecto") },
  { zoho: "Forma_de_contacto", aForm: conOtros("formaContacto", "formaContactoDetalle", formaContacto) },
  { zoho: "Referido_por", aForm: texto("referidoPor") },
  { zoho: "Es_PEP", aForm: siNo("esPep") },
  { zoho: "PEP_nombre", aForm: texto("pepNombre") },
  { zoho: "PEP_cargo", aForm: texto("pepCargo") },
  { zoho: "PEP_instituci_n", aForm: texto("pepInstitucion") },
  { zoho: "PEP_relaci_n", aForm: texto("pepRelacion") },
  { zoho: "Promedio_mensual", aForm: texto("ingresosMensuales") },
  { zoho: "Medios_de_Pago", aForm: lista("medioPago") },
];

const CAMPOS_JURIDICA: CampoInverso[] = [
  ...CABECERA_Y_PEP(FORMA_CONTACTO_JURIDICA),

  { zoho: "Raz_n_social", aForm: texto("razonSocial") },
  { zoho: "Tipo_de_sociedad", aForm: texto("tipoSociedad") },
  { zoho: "Tipo_de_Cliente", aForm: texto("tipoCliente") },
  { zoho: "Estado_sociedad", aForm: texto("estadoSociedad") },
  { zoho: "Tipo_de_identificacion", aForm: texto("tipoDocumentoIdentidad") },
  { zoho: "Actividad_Principal", aForm: texto("actividadPrincipal") },
  { zoho: "Fecha_vencimiento_ID", aForm: fecha("fechaVencimientoId") },
  { zoho: "ID_tributaria", aForm: texto("numeroIdTributaria") },
  { zoho: "Pa_s_donde_tributa", aForm: texto("paisTributacion") },
  { zoho: "Pa_s_donde_opera", aForm: texto("paisOpera") },
  { zoho: "Fecha_de_constituci_n", aForm: fecha("fechaConstitucion") },
  { zoho: "Pais_de_inscripci_n", aForm: texto("paisInscripcion") },

  { zoho: "Nombre_contacto", aForm: nombreCompleto("contactoNombre", "contactoApellido") },
  { zoho: "Identificaci_n_Contacto", aForm: texto("contactoId") },
  { zoho: "Telefono_contacto", aForm: texto("contactoTelefono") },
  { zoho: "Correo_de_contacto", aForm: texto("contactoEmail") },
  { zoho: "Ocupa_cargo", aForm: siNo("ifContacto") },
  { zoho: "Cargo_de_contacto", aForm: texto("contactoCargo") },

  { zoho: "Direccion_Calle", aForm: texto("empresaDireccion") },
  { zoho: "Ciudad", aForm: texto("empresaCiudad") },
  { zoho: "Provincia", aForm: texto("empresaProvincia") },
  { zoho: "Pa_s", aForm: texto("empresaPais") },
  { zoho: "Tel_fono", aForm: telefono("empresaTelefonoCodigo", "empresaTelefono") },
  { zoho: "Celular", aForm: telefono("empresaCelularCodigo", "empresaCelular") },
  { zoho: "Email_corporativo", aForm: texto("empresaEmail") },

  { zoho: "Nombre_natural", aForm: texto("rlNombre") },
  { zoho: "Estado_Civil", aForm: texto("rlEstadoCivil") },
  { zoho: "Nacionalidad", aForm: texto("rlNacionalidad") },
  { zoho: "Numero_Identificacion", aForm: texto("rlNoIdentificacion") },
  { zoho: "Fecha_de_nacimiento", aForm: fecha("rlFechaNacimiento") },
  { zoho: "Profesi_n", aForm: texto("rlProfesionOcupacion") },
  { zoho: "Actividad_Persona", aForm: texto("rlActividadEconomica") },
  { zoho: "Pais_de_residencia_fiscal", aForm: texto("rlPaisResidencia") },
  { zoho: "Direccion_Representante", aForm: texto("rlDireccion") },
  { zoho: "Telefono_Representante", aForm: texto("rlTelefono") },
  { zoho: "Declaraci_n_del_origen_il_cito_firmada", aForm: siNo("rlObjetoInvestigacion") },

  { zoho: "Fuente_de_Fondos", aForm: texto("fuenteFondosInmueble") },
  { zoho: "Mas_unidades_inmobiliarias", aForm: siNo("adquiereMasUnidades") },
  { zoho: "Cantidad_inmuebles", aForm: texto("cantidadUnidadesInmobiliarias") },
  { zoho: "Tercero_Aportante_Nombre", aForm: texto("terceroNombre") },
  { zoho: "Tercero_Aportante_Nacionalidad", aForm: texto("terceroNacionalidad") },
  { zoho: "Tercero_Aportante_Relaci_n", aForm: texto("terceroVinculo") },
  { zoho: "Tercero_Aportante_Fuente_de_Fondos", aForm: texto("terceroFuenteFondos") },
];

const CAMPOS_NATURAL: CampoInverso[] = [
  ...CABECERA_Y_PEP(FORMA_CONTACTO_NATURAL),

  { zoho: "Nombre_natural", aForm: nombreCompleto("firstName", "lastName") },
  { zoho: "Pais_de_nacimiento", aForm: texto("paisNacimiento") },
  { zoho: "Pais_de_residencia_fiscal", aForm: texto("paisResidenciaFiscal") },
  { zoho: "Nacionalidad", aForm: texto("nationality") },
  { zoho: "Tipo_de_identificacion", aForm: texto("tipoIdentificacion") },
  { zoho: "Otra_nacionalidad", aForm: texto("otraNacionalidad") },
  { zoho: "Estado_Civil", aForm: texto("estadoCivil") },
  { zoho: "Numero_Identificacion", aForm: texto("idNumber") },
  { zoho: "Fecha_vencimiento_ID", aForm: fecha("fechaVencimientoId") },
  { zoho: "Fecha_de_nacimiento", aForm: fecha("fechaNacimiento") },
  { zoho: "Estado_migratorio", aForm: texto("estatusMigratorio") },

  { zoho: "Direccion_Calle", aForm: texto("direccionResidencial") },
  { zoho: "Ciudad", aForm: texto("ciudad") },
  { zoho: "Provincia", aForm: texto("provinciaEstado") },
  { zoho: "Pa_s", aForm: texto("paisResidencial") },
  { zoho: "Tel_fono", aForm: telefono("telefonoCodigo", "telefono") },
  { zoho: "Celular", aForm: telefono("celularCodigo", "celular") },
  { zoho: "Email_corporativo", aForm: texto("email") },

  { zoho: "Profesi_n", aForm: conOtros("profession", "profesionOtros", PROFESSIONS) },
  { zoho: "Pa_s_de_Empresa", aForm: texto("paisActividadLaboral") },
  { zoho: "Empresa_donde_labora", aForm: texto("employer") },
  { zoho: "Direcci_n_laboral", aForm: texto("direccionLaboral") },
  { zoho: "Cargo_en_la_Empresa", aForm: texto("cargoDesempena") },

  { zoho: "Actividad_Persona", aForm: conOtros("actEconPrincipal", "otroActEcon", ACT_ECON_NATURAL) },
  { zoho: "Porcentaje_Actividad_principal", aForm: texto("pctDedicacionPrincipal") },
  { zoho: "Jurisdicci_n_de_Operaci_n_Principal", aForm: texto("jurisdiccionPrincipal") },
  { zoho: "Otras_Actividades", aForm: texto("actEconSecundaria") },
  { zoho: "Porcentaje_Otra_Actividad", aForm: texto("pctDedicacionSecundaria") },
  { zoho: "Jurisdicci_n_de_Otra_operaci_n", aForm: texto("jurisdiccionSecundaria") },

  { zoho: "Fuente_de_Fondos", aForm: enOpciones("fuenteFondosInmueble", FUENTE_FONDOS_NATURAL) },
  { zoho: "Mas_unidades_inmobiliarias", aForm: siNo("montoServiciosAnuales") },
  { zoho: "Cantidad_inmuebles", aForm: texto("cantidadServiciosAnuales") },
  { zoho: "Tercero_Aportante_Nombre", aForm: texto("ifTerceroNombre") },
  { zoho: "Tercero_Aportante_Nacionalidad", aForm: texto("ifTerceroNacionalidad") },
  { zoho: "Tercero_Aportante_Relaci_n", aForm: texto("ifTerceroRelacion") },
  { zoho: "Tercero_Aportante_Fuente_de_Fondos", aForm: texto("ifTerceroFuenteDeIngresos") },

  { zoho: "A_nombre_de_otro", aForm: siNo("adquiereNombreTercero") },
  { zoho: "Nombre_de_Otro", aForm: texto("nombreTercero") },
  { zoho: "Prop_sito_del_inmueble", aForm: texto("destinoInmueble") },
];

const camposDe = (tipo: FormType) => (tipo === "JURIDICA" ? CAMPOS_JURIDICA : CAMPOS_NATURAL);

/** Copia normalizada de los campos mapeados de un registro de Zoho. */
export function tomarCopia(tipo: FormType, registro: Datos): Record<string, string> {
  const copia: Record<string, string> = {};
  for (const { zoho: campo } of camposDe(tipo)) copia[campo] = normalizar(registro[campo]);
  return copia;
}

/**
 * Campos que nunca se precargan desde Zoho: documentos, sus casillas, términos
 * y firma. El cliente debe adjuntarlos, marcarlos y firmar él mismo.
 */
export function esCampoNoPrecargable(clave: string): boolean {
  return (
    /File$/.test(clave) ||
    /^checked[A-Z]/.test(clave) ||
    /^has[A-Z]/.test(clave) ||
    clave === "personDocuments" ||
    clave === "termsAccepted" ||
    /^signature|^signer|^firma/i.test(clave)
  );
}

/**
 * Datos del formulario a partir de un registro de Zoho, para precargar un
 * borrador nuevo. Un campo vacío o una casilla desmarcada no se precargan: en
 * Zoho equivalen a "sin dato", no a una respuesta del cliente.
 */
export function datosFormularioDesdeZoho(tipo: FormType, registro: Datos): Datos {
  const datos: Datos = {};
  for (const { zoho: campo, aForm } of camposDe(tipo)) {
    const valor = normalizar(registro[campo]);
    if (valor === "" || valor === "false") continue;

    const traducido = aForm(registro[campo], datos);
    if (!traducido) continue;
    for (const [clave, v] of Object.entries(traducido)) {
      if (esCampoNoPrecargable(clave) || normalizar(v) === "") continue;
      datos[clave] = v;
    }
  }
  return datos;
}

// ---------------------------------------------------------------------------
// Cálculo de cambios
// ---------------------------------------------------------------------------

/**
 * Compara el registro actual de Zoho con la copia anterior y devuelve los
 * cambios a aplicar en el formulario.
 *
 * Sin copia anterior (primer aviso de ese registro) se compara contra lo que
 * el portal enviaría a Zoho, pero un campo vacío o una casilla desmarcada en
 * Zoho no se toma como cambio: en un borrador Zoho todavía no tiene los datos
 * del cliente y se borrarían.
 */
export function calcularCambiosDesdeZoho(
  tipo: FormType,
  registro: Datos,
  copiaAnterior: Record<string, string> | null,
  datosActuales: Datos
): { cambios: Datos; detalle: CambioZoho[]; ignorados: string[] } {
  const enviado = mapFormToCrmPayload(tipo, datosActuales) as Datos;
  const cambios: Datos = {};
  const detalle: CambioZoho[] = [];
  const ignorados: string[] = [];

  for (const { zoho: campo, aForm } of camposDe(tipo)) {
    const nuevo = normalizar(registro[campo]);
    const delPortal = normalizar(enviado[campo]);
    const anterior = copiaAnterior ? copiaAnterior[campo] ?? "" : delPortal;

    if (nuevo === anterior) continue;
    if (!copiaAnterior && (nuevo === "" || nuevo === "false")) continue;
    // El portal ya tiene ese valor (p. ej. lo escribió su propia sincronización)
    if (nuevo === delPortal) continue;

    const traducido = aForm(registro[campo], datosActuales);
    if (!traducido) {
      ignorados.push(campo);
      continue;
    }

    const efectivos: Datos = {};
    for (const [clave, valor] of Object.entries(traducido)) {
      if (normalizar(datosActuales[clave]) !== normalizar(valor)) efectivos[clave] = valor;
    }
    if (Object.keys(efectivos).length === 0) continue;

    Object.assign(cambios, efectivos);
    detalle.push({ campoZoho: campo, anterior, nuevo, campos: efectivos });
  }

  return { cambios, detalle, ignorados };
}

// ---------------------------------------------------------------------------
// Orquestación
// ---------------------------------------------------------------------------

export interface ResultadoCambioZoho {
  estado: "IGNORADO" | "SIN_CAMBIOS" | "BORRADOR_ACTUALIZADO" | "EXPEDIENTE_VERSIONADO";
  motivo?: string;
  cambios?: CambioZoho[];
  ignorados?: string[];
  version?: number;
}

/** Borrador vigente del contacto (por Draft.crmContactId o por sus tokens). */
async function buscarBorrador(crmContactId: string) {
  const tokens = await prisma.token.findMany({ where: { crmContactId }, select: { token: true } });
  return prisma.draft.findFirst({
    where: { isAditional: false, OR: [{ crmContactId }, { token: { in: tokens.map((t) => t.token) } }] },
    orderBy: { updatedAt: "desc" },
  });
}

async function guardarCopia(crmId: string, copia: Record<string, string>) {
  await prisma.zohoRecordSnapshot.upsert({
    where: { crmId },
    update: { data: copia },
    create: { crmId, data: copia },
  });
}

/**
 * Procesa el aviso de cambio de un expediente de Zoho CRM.
 *
 * @param crmId ID del registro de Debida_Diligencia
 * @param usuario Usuario de Zoho que hizo el cambio (queda como responsable de la versión)
 */
export async function procesarCambioZoho(crmId: string, usuario?: string | null): Promise<ResultadoCambioZoho> {
  const contacto = await prisma.crmContact.findUnique({ where: { crmId } });
  if (!contacto) return { estado: "IGNORADO", motivo: "el expediente no existe en el portal" };

  const registro = await zoho.service.getDDRecord(crmId);
  if (!registro) return { estado: "IGNORADO", motivo: "no se pudo leer el registro en Zoho CRM" };

  const form = await prisma.form.findFirst({
    where: { crmContactId: contacto.id, deletedAt: null, isAditional: false },
    orderBy: { submittedAt: "desc" },
  });
  const borrador = form ? null : await buscarBorrador(contacto.id);

  const snapshot = await prisma.zohoRecordSnapshot.findUnique({ where: { crmId } });
  const copiaAnterior = (snapshot?.data as Record<string, string> | undefined) ?? null;

  if (!form && !borrador) {
    const tipoRegistro: FormType = /jur/i.test(normalizar(registro.Tipo_de_Persona)) ? "JURIDICA" : "NATURAL";
    await guardarCopia(crmId, tomarCopia(tipoRegistro, registro));
    return { estado: "IGNORADO", motivo: "el expediente no tiene borrador ni formulario" };
  }

  const tipo = (form?.type ?? borrador!.type) as FormType;
  const datosActuales = ((form?.data ?? borrador!.data) || {}) as Datos;
  const { cambios, detalle, ignorados } = calcularCambiosDesdeZoho(tipo, registro, copiaAnterior, datosActuales);

  // La copia se actualiza siempre: el siguiente aviso compara contra este estado.
  await guardarCopia(crmId, tomarCopia(tipo, registro));

  if (ignorados.length) {
    console.warn(`[Zoho Cambios] ${crmId}: valores sin equivalente en el formulario, no aplicados: ${ignorados.join(", ")}`);
  }
  if (detalle.length === 0) return { estado: "SIN_CAMBIOS", ignorados };

  const responsable = (usuario || "").trim() || "Zoho CRM";
  const resumen = detalle.map((c) => c.campoZoho).join(", ");

  // Borrador: se actualiza. updatedAt hace que un cliente con el formulario
  // abierto reciba el aviso de conflicto en lugar de pisar el cambio.
  if (!form) {
    await prisma.draft.update({
      where: { id: borrador!.id },
      data: { data: { ...datosActuales, ...cambios }, updatedAt: new Date() },
    });

    await logAuditEvent({
      action: "ZOHO_CHANGE_DRAFT",
      entityName: "Draft",
      entityId: borrador!.id,
      details: { crmId, usuario: responsable, cambios: detalle },
    });
    console.log(`[Zoho Cambios] Borrador ${borrador!.id} (${crmId}) actualizado por "${responsable}": ${resumen}`);
    return { estado: "BORRADOR_ACTUALIZADO", cambios: detalle, ignorados };
  }

  // Expediente completado: se actualiza y se sella una versión nueva.
  const nuevosDatos = { ...datosActuales, ...cambios };
  const clientName =
    tipo === "NATURAL"
      ? `${nuevosDatos.firstName || ""} ${nuevosDatos.lastName || ""}`.trim() || form.clientName
      : nuevosDatos.razonSocial || form.clientName;
  const projectName = nuevosDatos.nombreProyecto || form.projectName;

  await prisma.form.update({
    where: { id: form.id },
    data: { data: nuevosDatos, clientName, projectName },
  });

  if (tipo === "JURIDICA") {
    const rl: Datos = {};
    if ("rlNombre" in cambios) rl.nombre = nuevosDatos.rlNombre;
    if ("rlNacionalidad" in cambios) rl.nacionalidad = nuevosDatos.rlNacionalidad;
    if ("rlNoIdentificacion" in cambios) rl.noIdentificacion = nuevosDatos.rlNoIdentificacion;
    if ("rlProfesionOcupacion" in cambios) rl.profesionOcupacion = nuevosDatos.rlProfesionOcupacion || null;
    if ("rlActividadEconomica" in cambios) rl.actividadEconomica = nuevosDatos.rlActividadEconomica || null;
    if ("rlDireccion" in cambios) rl.direccion = nuevosDatos.rlDireccion || null;
    if ("rlPaisResidencia" in cambios) rl.paisResidencia = nuevosDatos.rlPaisResidencia || null;
    if ("rlTelefono" in cambios) rl.telefono = nuevosDatos.rlTelefono || null;
    if ("rlObjetoInvestigacion" in cambios) rl.objetoInvestigacion = nuevosDatos.rlObjetoInvestigacion;
    if ("rlFechaNacimiento" in cambios) {
      const f = new Date(nuevosDatos.rlFechaNacimiento);
      rl.fechaNacimiento = nuevosDatos.rlFechaNacimiento && !isNaN(f.getTime()) ? f : null;
    }
    if (Object.keys(rl).length) {
      await prisma.legalRepresentative.updateMany({ where: { formId: form.id }, data: rl });
    }
  }

  // El borrador del expediente enviado también refleja el cambio: es lo que ve
  // el cliente si se le reactiva el enlace.
  const borradorEnviado = await prisma.draft.findFirst({
    where: { data: { path: ["submittedFormId"], equals: form.id } },
  });
  if (borradorEnviado) {
    await prisma.draft.update({
      where: { id: borradorEnviado.id },
      data: { data: { ...((borradorEnviado.data as Datos) || {}), ...cambios } },
    });
  }

  // La versión exige una autorización: se registra una ya vencida (no habilita
  // ninguna otra edición) con el usuario de Zoho como responsable.
  const autorizacion = await prisma.formEditAuthorization.create({
    data: {
      formId: form.id,
      crmContactId: contacto.id,
      authorizedBy: responsable,
      reason: `Cambio realizado en Zoho CRM: ${resumen}`,
      source: "ZOHO_WORKFLOW",
      expiresAt: new Date(),
    },
  });

  const version = await sellarNuevaVersion({
    formId: form.id,
    data: nuevosDatos,
    status: form.status,
    clientName,
    projectName,
    autorizacion,
    datosAnteriores: datosActuales,
  });

  await logAuditEvent({
    action: "ZOHO_CHANGE_FORM",
    entityName: "Form",
    entityId: form.id,
    details: { crmId, usuario: responsable, version: version.version, cambios: detalle },
  });
  console.log(
    `[Zoho Cambios] Expediente ${form.id} (${crmId}) actualizado a la versión ${version.version} por "${responsable}": ${resumen}`
  );

  // Regenera el expediente en WorkDrive con la versión nueva. No se sincroniza
  // de vuelta a Zoho: el cambio viene de ahí.
  syncFormToWorkDrive(form.id).catch((e) => console.error("[Zoho Cambios] Error al sincronizar WorkDrive:", e));

  return { estado: "EXPEDIENTE_VERSIONADO", cambios: detalle, ignorados, version: version.version };
}
