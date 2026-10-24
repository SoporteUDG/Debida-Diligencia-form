import type { Temporal } from "@prisma/client";
import prisma from "./prisma";
import { logAuditEvent } from "./auditService";
import { crearEnlaceConBorrador } from "./enlaceService";
import {
  zoho,
  formatDDName,
  mapFormToContactPayload,
  CONTACT_STANDARD_FIELD,
  DD_CONTACT_FIELD,
} from "./zohoService";
import { ACCOUNT_RUC_FIELD, type CoincidenciaZoho } from "./temporalValidation";
import { identificadorDelTemporal } from "./temporalFields";

/** Paso en que se abre el enlace normal: Documentos (las secciones I a III ya están). */
export const PASO_DOCUMENTOS = 2;

export interface EnlaceDelTemporal {
  url: string;
  expiresAt: Date;
  ddCrmId: string;
}

/**
 * Crea en Zoho lo que necesita un cliente nuevo que completó el enlace temporal
 * (su RUC / ID tributaria no estaba en Zoho, ver temporalValidation) y le
 * genera su enlace normal del formulario:
 *
 * 1. Natural: Contact de la persona (contacto estándar del socio).
 *    Jurídica: no se crea Contact.
 * 2. Socio de Negocio (Accounts) "nombre-unidad-proyecto"; dispara workflows.
 *    Natural: después el Contact se ata al socio.
 * 3. Expediente de Debida_Diligencia "nombre-unidad-proyecto".
 * 4. Copias locales (CrmContact; en la natural también AccountContact).
 * 5. Enlace normal (Token + Draft) con los datos del temporal, abierto en el
 *    paso de Documentos; el enlace queda escrito en el expediente.
 * 6. Notas en lo creado.
 *
 * Sus datos pasan al borrador del enlace; del Temporal solo se guardan los ids
 * de Zoho al crearse cada registro: si algo falla, el reintento solo crea lo
 * que falta (lo local y el enlace se recrean sin duplicar el expediente).
 */
export async function crearEstructuraDelTemporal(temporal: Temporal, appUrl: string): Promise<EnlaceDelTemporal> {
  const type = temporal.type;
  const esNatural = type === "NATURAL";
  const d = (temporal.data as Record<string, any>) ?? {};

  const nombre = esNatural ? `${texto(d.firstName)} ${texto(d.lastName)}`.trim() : texto(d.razonSocial);
  if (!nombre) throw new Error(`El temporal ${temporal.id} no tiene nombre de cliente: no se crea nada en Zoho.`);
  const unidad = texto(temporal.unidadVendidaNombre);
  const proyecto = texto(temporal.proyecto) || texto(d.nombreProyecto);
  const nombreRegistro = formatDDName({ socio: nombre, unidad, proyecto });

  const guardar = (ids: { contactCrmId?: string; accountCrmId?: string; ddCrmId?: string }) =>
    prisma.temporal.update({ where: { id: temporal.id }, data: ids });

  // Datos de contacto del cliente: la persona (natural) o la empresa (jurídica)
  const email = texto(esNatural ? d.email : d.empresaEmail || d.contactoEmail);
  const celular = esNatural
    ? telefono(d.celularCodigo, d.celular) ?? telefono(d.telefonoCodigo, d.telefono) ?? ""
    : telefono(d.empresaTelefonoCodigo, d.empresaTelefono) ?? "";

  const { contactCrmId, accountCrmId } = await crearContactoYSocio({
    type,
    data: d,
    nombreRegistro,
    proyecto,
    unidadVendidaId: temporal.unidadVendidaId,
    contactCrmId: temporal.contactCrmId,
    accountCrmId: temporal.accountCrmId,
    guardar,
  });


  // ---------- 3. Expediente de Debida_Diligencia ----------
  // Opciones de Forma_de_contacto (las del formulario). "Otros" se reemplaza por
  // su detalle (como al completar el formulario); otro valor fuera de la lista no se envía.
  const OPCIONES_DD = {
    Forma_de_contacto: [
      "Pagina Web", "Alta Gerencia", "BBDD interna", "BD Vendedor", "Broker", "Campañas internas",
      "Chat", "Encuentra 24", "Eventos", "Facebook", "Ferias", "Google AdWords", "Instagram",
      "Landing casa desde 150", "Linkedln", "Referido", "Timelines", "WhatsApp",
    ],
  } as const;
  const formaContacto = esOtros(d.formaContacto)
    ? texto(d.formaContactoDetalle) || undefined
    : opcion(OPCIONES_DD, "Forma_de_contacto", texto(d.formaContacto));

  let ddCrmId = temporal.ddCrmId;
  if (!ddCrmId) {
    ({ debidaId: ddCrmId } = await zoho.service.createDebidaDiligenciaRecord({
      accountCrmId,
      clientType: type,
      name: nombre,
      overRideName: nombre,
      projectName: proyecto || undefined,
      unidad: temporal.unidadVendidaId ? { id: temporal.unidadVendidaId } : null,
      unidadNombre: unidad || undefined,
      // Natural: el expediente apunta a su Contact (Nombre_de_contacto)
      contactCrmId: contactCrmId ?? undefined,
      ...(esNatural ? {} : { razonSocial: nombre, nombreNatural: texto(d.rlNombre) || undefined }),
      camposExtra: sinVacios({
        Forma_de_contacto: formaContacto,
        Referido_por: texto(d.formaContacto) === "Referido" ? texto(d.referidoPor) || undefined : undefined,
      }),
    }));
    if (!ddCrmId) throw new Error("Zoho CRM no devolvió el ID del expediente creado");
    await guardar({ ddCrmId });
  }
  if (contactCrmId) await zoho.service.vincularContactoADD(contactCrmId, ddCrmId);

  // ---------- 4. Copias locales ----------
  const accountContact = contactCrmId
    ? await prisma.accountContact.upsert({
        where: { crmId: contactCrmId },
        update: { accountCrmId, deletedAt: null },
        create: {
          crmId: contactCrmId,
          accountCrmId,
          firstName: texto(d.firstName),
          lastName: texto(d.lastName),
          email: email || null,
          phone: celular || null,
          isStandard: true,
        },
      })
    : null;
  const crmContact = await prisma.crmContact.upsert({
    where: { crmId: ddCrmId },
    update: { accountCrmId, ...(accountContact ? { accountContactId: accountContact.id } : {}) },
    create: {
      crmId: ddCrmId,
      firstName: esNatural ? texto(d.firstName) : nombre,
      lastName: esNatural ? texto(d.lastName) : "",
      email: email || "cliente@udg.com",
      phone: celular || null,
      accountCrmId,
      accountContactId: accountContact?.id ?? null,
    },
  });

  // ---------- 5. Enlace normal con los datos del temporal ----------
  const { tokenUuid, clientUrl, expiresAt } = await crearEnlaceConBorrador({
    contactId: crmContact.id,
    crmId: ddCrmId,
    isNatural: esNatural,
    appUrl,
    contactCrmId: contactCrmId ?? undefined,
    draftData: {
      crmContactId: ddCrmId,
      nombreProyecto: proyecto,
      ...(contactCrmId ? { [DD_CONTACT_FIELD]: contactCrmId } : {}),
    },
    datosCliente: d,
    step: PASO_DOCUMENTOS,
  });
  await zoho.service.updateClientFormLink(ddCrmId, "Debida_Diligencia", clientUrl, expiresAt, "Activo");

  // ---------- 6. Notas ----------
  const resumen =
    `Creado desde el enlace temporal ${temporal.id}.\n\n` +
    `Tipo: ${esNatural ? "Persona Natural" : "Persona Jurídica"}\n` +
    `Cliente: ${nombre}\n` +
    `Identificación: ${identificadorDelTemporal(type, d) || "(sin identificación)"}\n` +
    `Unidad: ${unidad || "(sin unidad)"}\n` +
    `Proyecto: ${proyecto || "(sin proyecto)"}\n` +
    (contactCrmId ? `Contacto: ${nombre} (${contactCrmId})\n` : "") +
    `Socio de Negocio: ${accountCrmId}\n` +
    `Debida Diligencia: ${ddCrmId}\n` +
    `Enlace del Formulario: ${clientUrl}\n` +
    `Vigencia del Enlace: ${expiresAt.toLocaleString()}\n` +
    `Timestamp: ${new Date().toLocaleString()}`;
  const notas: Array<[string, "Accounts" | "Contacts" | "Debida_Diligencia", string]> = [
    ...(contactCrmId ? [[contactCrmId, "Contacts", "Contacto creado desde enlace temporal"] as [string, "Contacts", string]] : []),
    [accountCrmId, "Accounts", "Socio de Negocio creado desde enlace temporal"],
    [ddCrmId, "Debida_Diligencia", "Expediente y enlace creados desde enlace temporal"],
  ];
  for (const [id, modulo, titulo] of notas) {
    try {
      await zoho.service.createNote(id, titulo, resumen, modulo);
    } catch (err) {
      console.warn(`[Temporal Scaffold] No se pudo crear la nota en ${modulo} ${id}:`, err);
    }
  }

  await logAuditEvent({
    action: "TEMPORAL_SCAFFOLD",
    entityName: "Temporal",
    entityId: temporal.id,
    details: { type, contactCrmId, accountCrmId, ddCrmId, tokenUuid, nombre: nombreRegistro },
  });
  console.log(
    `[Temporal Scaffold] Temporal ${temporal.id}: ${contactCrmId ? `contacto ${contactCrmId}, ` : ""}socio ${accountCrmId}, expediente ${ddCrmId}.`
  );

  return { url: clientUrl, expiresAt, ddCrmId };
}

/**
 * El cliente ya existía en Zoho y confirmó que sus datos son correctos: no se
 * crea nada; se deja una nota en cada registro coincidente para que el asesor
 * continúe el proceso.
 */
export async function registrarClienteExistente(temporal: Temporal, coincidencias: CoincidenciaZoho[]): Promise<void> {
  const d = (temporal.data as Record<string, any>) ?? {};
  const contenido =
    `El cliente completó el enlace temporal ${temporal.id} con una identificación que ya existe en Zoho ` +
    `y confirmó que su información es correcta. No se crearon registros nuevos.\n\n` +
    `Identificación: ${identificadorDelTemporal(temporal.type, d)}\n` +
    `Unidad: ${texto(temporal.unidadVendidaNombre) || "(sin unidad)"}\n` +
    `Proyecto: ${texto(temporal.proyecto) || texto(d.nombreProyecto) || "(sin proyecto)"}\n` +
    `Timestamp: ${new Date().toLocaleString()}`;
  for (const c of coincidencias) {
    try {
      await zoho.service.createNote(c.id, "Cliente existente completó un enlace temporal", contenido, c.module);
    } catch (err) {
      console.warn(`[Temporal Scaffold] No se pudo crear la nota en ${c.module} ${c.id}:`, err);
    }
  }
  await logAuditEvent({
    action: "TEMPORAL_EXISTING_CLIENT",
    entityName: "Temporal",
    entityId: temporal.id,
    details: { coincidencias: coincidencias.map((c) => `${c.module}:${c.id}`) },
  });
}

/**
 * Pasos 1 y 2 del temporal, reutilizables: crea el Contact (solo natural, como
 * contacto estándar) y el Socio de Negocio (Accounts, dispara workflows) del
 * cliente a partir de los datos de su formulario, y ata el Contact al socio.
 * Con `contactCrmId` / `accountCrmId` ya conocidos no vuelve a crearlos (reintentos);
 * `guardar` se llama con cada id apenas se crea.
 */
export async function crearContactoYSocio(params: {
  type: "NATURAL" | "JURIDICA";
  data: Record<string, any>;
  /** Account_Name del socio ("nombre-unidad-proyecto"). */
  nombreRegistro: string;
  proyecto: string;
  unidadVendidaId?: string | null;
  contactCrmId?: string | null;
  accountCrmId?: string | null;
  guardar?: (ids: { contactCrmId?: string; accountCrmId?: string }) => Promise<unknown>;
}): Promise<{ contactCrmId: string | null; accountCrmId: string }> {
  const { type, data: d, nombreRegistro, proyecto, guardar } = params;
  const esNatural = type === "NATURAL";
  const temporal = { unidadVendidaId: params.unidadVendidaId, contactCrmId: params.contactCrmId, accountCrmId: params.accountCrmId };
  const email = texto(esNatural ? d.email : d.empresaEmail || d.contactoEmail);
  const celular = esNatural
    ? telefono(d.celularCodigo, d.celular) ?? telefono(d.telefonoCodigo, d.telefono) ?? ""
    : telefono(d.empresaTelefonoCodigo, d.empresaTelefono) ?? "";

  // ---------- 1. Contact (solo natural) ----------
  let contactCrmId: string | null = null;
  if (esNatural) {
    // Requeridos al crear en Zoho: Proyecto, Celular, Direcci_n_F_sica, Empresa,
    // Fecha_Nacimiento, Nacionalidad_2 y Profesi_n.
    const contacto: Record<string, unknown> = {
      // Datos de identificación de la persona (mismo mapeo que al completar el formulario)
      ...mapFormToContactPayload("NATURAL", d),
      First_Name: texto(d.firstName) || undefined,
      Last_Name: texto(d.lastName) || texto(d.firstName),
      Nombre_Completo: texto(d.firstName) || undefined,
      Apellido: texto(d.lastName) || texto(d.firstName),
      ID_de_Contacto: `${texto(d.firstName)} ${texto(d.lastName)}` || texto(d.firstName),
      Email: email || undefined,
      Proyecto: proyecto || undefined,
      Direcci_n_F_sica: texto(d.direccionResidencial) || undefined,
      Empresa: texto(d.employer) || undefined,
      Fecha_Nacimiento: fecha(d.fechaNacimiento),
      Nacionalidad_2: texto(d.nationality) || undefined,
      Profesi_n: texto(esOtros(d.profession) ? d.profesionOtros : d.profession) || undefined,
      C_I_P_Pasaporte: texto(d.idNumber) || undefined,
      // Contacto estándar (principal) del Socio de Negocio
      [CONTACT_STANDARD_FIELD]: true,
    };
    contactCrmId = temporal.contactCrmId ?? null;
    if (!contactCrmId) {
      ({ id: contactCrmId } = await zoho.service.createRecord("Contacts", sinVacios(contacto)));
      await guardar?.({ contactCrmId });
    }
  }

  // ---------- 2. Socio de Negocio ----------
  // Opciones de los picklists de Accounts que escribe el portal. Un valor
  // fuera de la lista no se envía (se avisa en el log).
  const OPCIONES_SOCIO = {
    Persona_de_Tipo: ["Natural", "Jurídica"],
    Proyecto: [
      "Alive", "Altos del Parque", "Caminos de Centennial", "Deici", "Guayacán", "Living73",
      "New West I", "New West II", "Paramount", "Spotlight", "The Hub",
    ],
  } as const;

  const socio: Record<string, unknown> = {
    Account_Name: nombreRegistro,
    Persona_de_Tipo: opcion(OPCIONES_SOCIO, "Persona_de_Tipo", esNatural ? "Natural" : "Jurídica"),
    Proyecto: opcion(OPCIONES_SOCIO, "Proyecto", proyecto),
    Unidad_Vendida1: temporal.unidadVendidaId ? { id: temporal.unidadVendidaId } : undefined,
    [ACCOUNT_RUC_FIELD]: identificadorDelTemporal(type, d) || undefined,
    // Representante legal (lo lee generar-expediente)
    Nombre_Extranjero_No_en_Peachtree: esNatural ? undefined : texto(d.rlNombre) || undefined,
    Phone: celular || undefined,
    Billing_Street: texto(esNatural ? d.direccionResidencial : d.empresaDireccion) || undefined,
    Billing_City: texto(esNatural ? d.ciudad : d.empresaCiudad) || undefined,
    Billing_State: texto(esNatural ? d.provinciaEstado : d.empresaProvincia) || undefined,
    Billing_Country: texto(esNatural ? d.paisResidencial : d.empresaPais) || undefined,
    Estatus_Debida_Diligencia: "En borrador",
    // Requerido al crear: el socio nuevo se replica a SAP
    Replicar_SAP1: "No",
    // Lookup al Contact estándar recién creado (la jurídica no tiene Contact)
    Contacto_Principal: contactCrmId ? { id: contactCrmId } : undefined,
  };
  let accountCrmId = temporal.accountCrmId ?? null;
  if (!accountCrmId) {
    ({ id: accountCrmId } = await zoho.service.createRecord("Accounts", sinVacios(socio), {
      dispararWorkflows: true,
    }));
    await guardar?.({ accountCrmId });
  }
  // Natural: el Contact se ata al socio (idempotente: en un reintento no cambia nada)
  if (contactCrmId) {
    await zoho.service.updateRecord("Contacts", contactCrmId, { Account_Name: { id: accountCrmId } });
  }
  return { contactCrmId, accountCrmId: accountCrmId! };
}

// ==========================================
// Helpers
// ==========================================

function texto(v: unknown): string {
  return String(v ?? "").trim();
}

/** Opciones "Otros" / "Otro" que se reemplazan por su campo de detalle. */
function esOtros(v: unknown): boolean {
  return /^otros?$/i.test(texto(v));
}

/** Fecha del formulario como YYYY-MM-DD, o undefined. */
function fecha(v: unknown): string | undefined {
  return texto(v).slice(0, 10) || undefined;
}

/** "+507 61234567", o undefined sin número. */
function telefono(codigo: unknown, numero: unknown): string | undefined {
  const n = texto(numero);
  if (!n) return undefined;
  return [texto(codigo), n].filter(Boolean).join(" ");
}

/** El valor si está entre las opciones del picklist; si no, undefined (no se envía). */
function opcion<T extends Record<string, readonly string[]>>(opciones: T, campo: keyof T, valor: string): string | undefined {
  if (!valor) return undefined;
  if (opciones[campo].includes(valor)) return valor;
  console.warn(`[Temporal Scaffold] "${valor}" no es una opción de ${String(campo)}: no se envía.`);
  return undefined;
}

/** Quita las claves sin valor (Zoho borraría el campo con null / ""). */
function sinVacios(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined && v !== null && v !== ""));
}
