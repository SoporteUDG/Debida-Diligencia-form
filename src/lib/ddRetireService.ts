import prisma from "@/lib/prisma";
import { zoho } from "@/lib/zohoService";
import { getAccessToken } from "@/lib/zohoAuthService";
import { logAuditEvent } from "@/lib/auditService";
import { reactivateToken } from "@/lib/tokenService";
import {
  deleteFileFromWorkDrive,
  getOrCreateCarpetaRetirados,
  localizarCarpetaExpediente,
  moveFolder,
} from "@/lib/workdriveService";

/**
 * Baja de expedientes de Debida_Diligencia.
 *
 * - Nunca enviado (sin Form): se ELIMINA (carpeta de WorkDrive, Zoho y Prisma).
 * - Enviado alguna vez: se ANULA (archivo reversible, nada se borra) y se puede
 *   REACTIVAR.
 *
 * Permisos: eliminar lo pide un usuario de Zoho (perfil validado aquí); anular y
 * reactivar los exige el router (ADMIN o SUPERADMIN). Este servicio vuelve a validar el
 * estado del expediente: no confía en lo que mostró la interfaz.
 */

export const ESTADO_ANULADO = "Anulado";
export const ESTADO_REACTIVADO = "En borrador";
/** Estados de Zoho con los que un expediente ya no se puede eliminar. */
const ESTADOS_NO_ELIMINABLES = ["En revisión", "Aprobado", ESTADO_ANULADO];

const MIN_MOTIVO = 10;

export class BajaDDError extends Error {
  constructor(message: string, public code: "NOT_FOUND" | "BAD_REQUEST" | "CONFLICT" | "FORBIDDEN") {
    super(message);
    this.name = "BajaDDError";
  }
}

interface Actor {
  id: string;
  email?: string;
}

function validarMotivo(reason: string) {
  if ((reason ?? "").trim().length < MIN_MOTIVO) {
    throw new BajaDDError(`Se requiere un motivo de al menos ${MIN_MOTIVO} caracteres.`, "BAD_REQUEST");
  }
}

async function cargarExpediente(crmContactId: string) {
  const contact = await prisma.crmContact.findUnique({
    where: { id: crmContactId },
    include: {
      forms: { select: { id: true, type: true } },
      drafts: { select: { id: true, type: true, data: true } },
    },
  });
  if (!contact) throw new BajaDDError("Expediente no encontrado.", "NOT_FOUND");
  const formType = contact.forms[0]?.type ?? contact.drafts[0]?.type ?? "NATURAL";
  return { contact, formType: formType as string };
}

/** Perfiles de Zoho CRM que pueden eliminar un expediente (botón en Zoho). */
export const PERFILES_ELIMINAR_DD = ["Gerente Gestión Inmobiliaria", "Administrador"];

const normalizarPerfil = (v: string) =>
  v.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

export function perfilPuedeEliminar(perfil: string | undefined | null): boolean {
  const p = normalizarPerfil(perfil ?? "");
  return !!p && PERFILES_ELIMINAR_DD.some((x) => normalizarPerfil(x) === p);
}

/**
 * ELIMINA un expediente cuyo formulario nunca se envió: carpeta del expediente
 * en WorkDrive (con los archivos subidos antes del envío; va a la papelera de
 * WorkDrive), registro de Zoho y registros de Prisma.
 *
 * Lo solicita un usuario de Zoho desde un botón personalizado (no desde el
 * portal de administración). Autorización: el perfil de Zoho del usuario
 * (actor.profile, leído de Zoho por quien llama) debe ser uno de
 * PERFILES_ELIMINAR_DD; aquí se vuelve a exigir. Además no debe existir ningún
 * Form ni un Estado de Zoho posterior a borrador. El orden prioriza lo
 * recuperable: primero la carpeta (papelera), luego Zoho, al final Prisma.
 */
export async function eliminarDDNoEnviado(params: {
  /** ID del registro de Debida_Diligencia en Zoho (CrmContact.crmId) */
  crmId: string;
  reason?: string;
  actor: { id: string; email?: string; name?: string; profile: string };
  ip?: string | null;
}) {
  const { crmId, actor } = params;
  if (!perfilPuedeEliminar(actor.profile)) {
    throw new BajaDDError(
      `Su perfil de Zoho ("${actor.profile}") no está autorizado para eliminar expedientes.`,
      "FORBIDDEN"
    );
  }
  const reason = params.reason?.trim() || `Solicitado desde Zoho por ${actor.name || actor.email || actor.id}`;

  const existente = await prisma.crmContact.findFirst({ where: { crmId, deletedAt: null }, select: { id: true } });
  if (!existente) throw new BajaDDError("Expediente no encontrado.", "NOT_FOUND");
  const { contact, formType } = await cargarExpediente(existente.id);
  if (contact.retiredAt) {
    throw new BajaDDError("El expediente está anulado: reactívelo antes de eliminarlo.", "CONFLICT");
  }
  if (contact.forms.length > 0) {
    throw new BajaDDError("El formulario ya fue enviado: solo puede anularse, no eliminarse.", "CONFLICT");
  }

  // Zoho: estado y relacionado. Si Zoho falla se aborta: no se borra a ciegas.
  const registro = await zoho.service.getDDRecord(contact.crmId);
  const estado = String(registro?.Estado ?? "").trim();
  if (ESTADOS_NO_ELIMINABLES.includes(estado)) {
    throw new BajaDDError(`El expediente está en estado "${estado}" en Zoho: no se puede eliminar.`, "CONFLICT");
  }
  if (await zoho.service.getRelatedDDId(contact.crmId)) {
    throw new BajaDDError("El expediente tiene un expediente relacionado (DD_relacionado): desvincúlelo primero.", "CONFLICT");
  }

  // 1. Carpeta de WorkDrive (papelera). Debe resolverse antes de borrar el DD de Zoho.
  const accessToken = await getAccessToken();
  const { clientFolderId } = await localizarCarpetaExpediente(contact.crmId, formType, accessToken);
  if (clientFolderId) await deleteFileFromWorkDrive(clientFolderId, accessToken);

  // 2. Zoho
  await zoho.service.deleteDDRecord(contact.crmId);

  // 3. Prisma (tokens, borradores y sus documentos caen en cascada)
  await prisma.crmContact.delete({ where: { id: contact.id } });

  await logAuditEvent({
    action: "DD_DELETE",
    entityName: "CrmContact",
    entityId: contact.id,
    userId: null,
    ipAddress: params.ip ?? null,
    details: {
      crmId: contact.crmId,
      reason,
      zohoUserId: actor.id,
      zohoUser: actor.email,
      zohoProfile: actor.profile,
      folderTrashed: clientFolderId,
    },
  });

  return { success: true, crmId: contact.crmId, carpetaEliminada: !!clientFolderId };
}

/**
 * ANULA un expediente ya enviado (reversible): marca el archivo en Prisma, pone
 * Estado = "Anulado" en Zoho, cierra el borrador y los enlaces, y mueve la
 * carpeta a /{Socio}/DD/_Retirados/. Nada se borra.
 */
export async function anularDD(params: { crmContactId: string; reason: string; actor: Actor; ip?: string | null }) {
  const { crmContactId, reason, actor } = params;
  validarMotivo(reason);

  const { contact, formType } = await cargarExpediente(crmContactId);
  if (contact.retiredAt) throw new BajaDDError("El expediente ya está anulado.", "CONFLICT");
  if (contact.forms.length === 0) {
    throw new BajaDDError("El formulario nunca se envió: corresponde eliminarlo, no anularlo.", "CONFLICT");
  }

  // 1. Carpeta -> _Retirados (se recuerda dónde estaba)
  let retiredFolderId: string | null = null;
  let retiredOriginFolderId: string | null = null;
  const accessToken = await getAccessToken();
  const { ddFolderId, clientFolderId } = await localizarCarpetaExpediente(contact.crmId, formType, accessToken);
  if (ddFolderId && clientFolderId) {
    const retirados = await getOrCreateCarpetaRetirados(ddFolderId, accessToken);
    await moveFolder(clientFolderId, retirados, accessToken);
    retiredFolderId = clientFolderId;
    retiredOriginFolderId = ddFolderId;
  }

  // 2. Zoho
  await zoho.service.setDDEstado(contact.crmId, ESTADO_ANULADO);

  // 3. Prisma: archivo, enlaces vencidos y borrador cerrado
  const ahora = new Date();
  await prisma.$transaction([
    prisma.crmContact.update({
      where: { id: contact.id },
      data: {
        retiredAt: ahora,
        retiredReason: reason.trim(),
        retiredBy: actor.id,
        retiredFolderId,
        retiredOriginFolderId,
        deletedAt: ahora,
      },
    }),
    prisma.token.updateMany({ where: { crmContactId: contact.id }, data: { expiresAt: ahora } }),
    ...contact.drafts.map((d) =>
      prisma.draft.update({
        where: { id: d.id },
        data: { data: { ...((d.data as any) || {}), retired: true }, expiresAt: ahora },
      })
    ),
  ]);

  await logAuditEvent({
    action: "DD_RETIRE",
    entityName: "CrmContact",
    entityId: contact.id,
    userId: actor.id,
    ipAddress: params.ip ?? null,
    details: { crmId: contact.crmId, reason, actor: actor.email, movedFolder: retiredFolderId },
  });

  return { success: true, crmId: contact.crmId, carpetaMovida: !!retiredFolderId };
}

/**
 * REACTIVA un expediente anulado: devuelve la carpeta a su lugar original,
 * Estado = "En borrador" en Zoho, reabre el borrador y reactiva su enlace.
 */
export async function reactivarDD(params: { crmContactId: string; actor: Actor; ip?: string | null }) {
  const { crmContactId, actor } = params;

  const { contact } = await cargarExpediente(crmContactId);
  if (!contact.retiredAt) throw new BajaDDError("El expediente no está anulado.", "CONFLICT");

  // 1. Carpeta de vuelta a /{Socio}/DD/
  if (contact.retiredFolderId && contact.retiredOriginFolderId) {
    await moveFolder(contact.retiredFolderId, contact.retiredOriginFolderId, await getAccessToken());
  }

  // 2. Zoho
  await zoho.service.setDDEstado(contact.crmId, ESTADO_REACTIVADO);

  // 3. Prisma
  await prisma.$transaction([
    prisma.crmContact.update({
      where: { id: contact.id },
      data: {
        retiredAt: null,
        retiredReason: null,
        retiredBy: null,
        retiredFolderId: null,
        retiredOriginFolderId: null,
        deletedAt: null,
      },
    }),
    ...contact.drafts.map((d) =>
      prisma.draft.update({
        where: { id: d.id },
        data: { data: { ...((d.data as any) || {}), retired: false }, expiresAt: null },
      })
    ),
  ]);

  // 4. Enlace: se reactiva el token del borrador y se refleja en Zoho
  const draft = await prisma.draft.findFirst({ where: { crmContactId: contact.id }, orderBy: { createdAt: "desc" } });
  if (draft) {
    const token = await reactivateToken(draft.token, 30);
    if (token.success && token.newExpiresAt) {
      try {
        await zoho.service.updateClientFormLink(contact.crmId, "Debida_Diligencia", undefined, token.newExpiresAt, "Activo");
      } catch (err) {
        console.warn(`[DD Retire] No se pudo actualizar el estado del enlace de ${contact.crmId} en Zoho:`, err);
      }
    }
  }

  await logAuditEvent({
    action: "DD_REACTIVATE",
    entityName: "CrmContact",
    entityId: contact.id,
    userId: actor.id,
    ipAddress: params.ip ?? null,
    details: { crmId: contact.crmId, actor: actor.email, restoredFolder: contact.retiredFolderId },
  });

  return { success: true, crmId: contact.crmId };
}
