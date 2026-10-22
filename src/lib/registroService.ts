import prisma from "./prisma";
import { logAuditEvent } from "./auditService";
import { crearEnlaceConBorrador } from "./enlaceService";
import { zoho, mapFormToCrmPayload } from "./zohoService";
import { ESTADO_SIN_ASOCIAR } from "./ddEstados";
import { identificadorDelTemporal } from "./temporalFields";
import { PASO_DOCUMENTOS } from "./temporalScaffold";
import type { CoincidenciaZoho } from "./temporalValidation";
import type { ClientFormType } from "./tokenAccess";

export interface RegistroCreado {
  url: string;
  expiresAt: Date;
  ddCrmId: string;
}

const texto = (v: unknown): string => String(v ?? "").trim();

/** "+507 61234567", o undefined sin número. */
function telefono(codigo: unknown, numero: unknown): string | undefined {
  const n = texto(numero);
  return n ? [texto(codigo), n].filter(Boolean).join(" ") : undefined;
}

/** Quita las claves sin valor (Zoho borraría el campo con null / ""). */
function sinVacios(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined && v !== null && v !== ""));
}

/**
 * Formularios independientes (/registro/persona-natural y /persona-juridica):
 * al completar las secciones I a III crea SOLO el expediente de Debida_Diligencia
 * en Zoho, sin Socio de Negocio, Contacto ni Unidad, con todos los campos del
 * formulario escritos en el propio expediente. Después:
 *
 * 1. Name "nombre-proyecto"; la carpeta de documentos queda en
 *    ZOHO_WORKDRIVE_ROOT_FOLDER_ID/DD/... (sin socio se usa la raíz).
 * 2. Copia local del expediente (CrmContact) sin socio ni contacto, marcada con
 *    el submissionId del navegador.
 * 3. Enlace normal (Token + Draft) con los datos capturados, abierto en el paso
 *    de Documentos; el enlace queda escrito en el expediente.
 * 4. Nota en el expediente (y en los registros que ya tenían la identificación).
 *
 * Reintentos: el navegador manda el mismo `submissionId` en cada intento de un
 * mismo envío. Si el expediente ya se creó (hay un CrmContact con ese id), no se
 * crea otro en Zoho: se retoma desde el enlace. Dos envíos simultáneos del mismo
 * id comparten una sola ejecución.
 */
const enCurso = new Map<string, Promise<RegistroCreado>>();

export function crearRegistroEstandalone(params: RegistroParams): Promise<RegistroCreado> {
  const previo = enCurso.get(params.submissionId);
  if (previo) return previo;
  const ejecucion = ejecutar(params).finally(() => enCurso.delete(params.submissionId));
  enCurso.set(params.submissionId, ejecucion);
  return ejecucion;
}

interface RegistroParams {
  type: ClientFormType;
  data: Record<string, any>;
  appUrl: string;
  /** UUID que genera el navegador para este envío (ver /api/registro). */
  submissionId: string;
  /** Registros de Zoho que ya tenían su RUC / ID tributaria (el cliente confirmó sus datos). */
  coincidencias?: CoincidenciaZoho[];
  ipAddress?: string;
  userAgent?: string;
}

async function ejecutar(params: RegistroParams): Promise<RegistroCreado> {
  const { type, data: d, appUrl } = params;
  const esNatural = type === "NATURAL";

  const nombre = esNatural ? `${texto(d.firstName)} ${texto(d.lastName)}`.trim() : texto(d.razonSocial);
  if (!nombre) throw new Error("El formulario no tiene nombre de cliente: no se crea nada en Zoho.");
  const proyecto = texto(d.nombreProyecto);

  const email = texto(esNatural ? d.email : d.empresaEmail || d.contactoEmail);
  const celular = esNatural
    ? telefono(d.celularCodigo, d.celular) ?? telefono(d.telefonoCodigo, d.telefono)
    : telefono(d.empresaTelefonoCodigo, d.empresaTelefono);

  // Un intento anterior de este mismo envío ya creó el expediente: se retoma desde ahí
  let crmContact = await prisma.crmContact.findUnique({ where: { submissionId: params.submissionId } });
  const retomado = !!crmContact;

  if (!crmContact) {
    // ---------- 1. Expediente en Zoho con todos los campos del formulario ----------
    // Sin contacto vinculado: los datos personales van en el propio expediente.
    const { debidaId } = await zoho.service.createDebidaDiligenciaRecord({
      clientType: type,
      name: nombre,
      overRideName: nombre,
      projectName: proyecto || undefined,
      sinSocio: true,
      estado: ESTADO_SIN_ASOCIAR,
      ...(esNatural ? {} : { razonSocial: nombre, nombreNatural: texto(d.rlNombre) || undefined }),
      camposExtra: sinVacios(mapFormToCrmPayload(type, d)),
    });
    if (!debidaId) throw new Error("Zoho CRM no devolvió el ID del expediente creado");

    // ---------- 2. Copia local (de aquí en adelante un reintento ya no duplica) ----------
    crmContact = await prisma.crmContact.create({
      data: {
        crmId: debidaId,
        submissionId: params.submissionId,
        firstName: esNatural ? texto(d.firstName) : nombre,
        lastName: esNatural ? texto(d.lastName) : "",
        email: email || "cliente@udg.com",
        phone: celular || null,
      },
    });
  }
  const ddCrmId = crmContact.crmId;

  // ---------- 3. Enlace normal con los datos capturados ----------
  const { tokenUuid, clientUrl, expiresAt } = await crearEnlaceConBorrador({
    contactId: crmContact.id,
    crmId: ddCrmId,
    isNatural: esNatural,
    appUrl,
    draftData: { crmContactId: ddCrmId, nombreProyecto: proyecto },
    datosCliente: d,
    step: PASO_DOCUMENTOS,
  });
  await zoho.service.updateClientFormLink(ddCrmId, "Debida_Diligencia", clientUrl, expiresAt, "Activo");

  // ---------- 4. Notas ----------
  const coincidencias = params.coincidencias ?? [];
  const resumen =
    `Creado desde el formulario independiente /registro/${esNatural ? "persona-natural" : "persona-juridica"}.\n\n` +
    `Tipo: ${esNatural ? "Persona Natural" : "Persona Jurídica"}\n` +
    `Cliente: ${nombre}\n` +
    `Identificación: ${identificadorDelTemporal(type, d) || "(sin identificación)"}\n` +
    `Proyecto: ${proyecto || "(sin proyecto)"}\n` +
    `Debida Diligencia: ${ddCrmId}\n` +
    `Enlace del Formulario: ${clientUrl}\n` +
    `Vigencia del Enlace: ${expiresAt.toLocaleString()}\n` +
    (coincidencias.length
      ? `Ya existía en Zoho (el cliente confirmó sus datos): ${coincidencias.map((c) => `${c.module} ${c.name} (${c.id})`).join(", ")}\n`
      : "") +
    `Timestamp: ${new Date().toLocaleString()}`;
  const destinos: Array<[string, CoincidenciaZoho["module"], string]> = [
    [ddCrmId, "Debida_Diligencia", "Expediente y enlace creados desde formulario independiente"],
    ...coincidencias.map((c): [string, CoincidenciaZoho["module"], string] => [
      c.id,
      c.module,
      "Cliente existente completó un formulario independiente",
    ]),
  ];
  for (const [id, modulo, titulo] of destinos) {
    try {
      await zoho.service.createNote(id, titulo, resumen, modulo);
    } catch (err) {
      console.warn(`[Registro] No se pudo crear la nota en ${modulo} ${id}:`, err);
    }
  }

  await logAuditEvent({
    action: "REGISTRO_ESTANDALONE",
    entityName: "CrmContact",
    entityId: crmContact.id,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    details: { type, ddCrmId, tokenUuid, retomado, clienteExistente: coincidencias.length > 0 },
  });
  console.log(`[Registro] Expediente ${ddCrmId} (${type}) ${retomado ? "retomado" : "creado"} sin socio.`);

  return { url: clientUrl, expiresAt, ddCrmId };
}
