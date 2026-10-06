import prisma from "@/lib/prisma";
import { zoho } from "@/lib/zohoService";
import { getAccessToken } from "@/lib/zohoAuthService";
import { logAuditEvent } from "@/lib/auditService";
import { reactivateToken } from "@/lib/tokenService";
import {
  deleteFileFromWorkDrive,
  findFolderAdicional,
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
      forms: { select: { id: true, type: true, isAditional: true, tokenUuid: true, retiredAt: true }, orderBy: { createdAt: "asc" } },
      drafts: { select: { id: true, type: true, data: true, isAditional: true, token: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!contact) throw new BajaDDError("Expediente no encontrado.", "NOT_FOUND");
  // El tipo del expediente principal da nombre a su carpeta; un adicional puede ser de otro tipo
  const formType =
    contact.forms.find((f) => !f.isAditional)?.type ??
    contact.drafts.find((d) => !d.isAditional)?.type ??
    "NATURAL";
  return { contact, formType: formType as string };
}

/** Perfiles de Zoho CRM que pueden eliminar un expediente (botón en Zoho). */
// "Administrator" es el nombre en inglés del perfil de administrador de Zoho (así lo devuelve la API)
export const PERFILES_ELIMINAR_DD = ["Gerente Gestión Inmobiliaria", "Administrador", "Administrator"];

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
  // Con algún formulario enviado (principal o adicional) no se elimina: eliminar mandaría sus
  // archivos a la papelera. Este botón es la única vía hacia la baja desde Zoho, así que en ese
  // caso se ANULA (reversible). Los borradores adicionales nunca enviados se eliminan con la anulación.
  if (contact.forms.length > 0) {
    const anulado = await anularDD({
      crmContactId: contact.id,
      reason,
      actor: { id: actor.id, email: actor.email },
      ip: params.ip,
    });
    return { ...anulado, action: "retired" as const };
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

  return { success: true, action: "deleted" as const, crmId: contact.crmId, carpetaEliminada: !!clientFolderId };
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

  // Expedientes adicionales (sus carpetas viven dentro de la del principal):
  // - borrador nunca enviado: se ELIMINA (carpeta a la papelera, borrador, documentos y token)
  // - formulario enviado: se ANULA junto con el principal (su carpeta viaja con la del principal)
  const tokensEnviados = new Set(contact.forms.map((f) => f.tokenUuid).filter(Boolean));
  const draftsAdicionales = contact.drafts.filter((d) => d.isAditional);
  const borradoresAEliminar = draftsAdicionales.filter((d) => !tokensEnviados.has(d.token));
  const formsAdicionalesAAnular = contact.forms.filter((f) => f.isAditional && !f.retiredAt);

  // 1. Carpetas. Primero las de los borradores adicionales (papelera) y luego la del
  //    expediente -> _Retirados (se recuerda dónde estaba)
  let retiredFolderId: string | null = null;
  let retiredOriginFolderId: string | null = null;
  const accessToken = await getAccessToken();
  const { ddFolderId, clientFolderId } = await localizarCarpetaExpediente(contact.crmId, formType, accessToken);
  if (clientFolderId) {
    for (const d of borradoresAEliminar) {
      const carpetaAdicional = await findFolderAdicional(clientFolderId, d.token, accessToken);
      if (carpetaAdicional) await deleteFileFromWorkDrive(carpetaAdicional, accessToken);
    }
  }
  if (ddFolderId && clientFolderId) {
    const retirados = await getOrCreateCarpetaRetirados(ddFolderId, accessToken);
    await moveFolder(clientFolderId, retirados, accessToken);
    retiredFolderId = clientFolderId;
    retiredOriginFolderId = ddFolderId;
  }

  // 2. Zoho
  await zoho.service.setDDEstado(contact.crmId, ESTADO_ANULADO);

  // 3. Prisma: archivo, enlaces vencidos y borradores cerrados
  const ahora = new Date();
  const motivoAdicional = `Anulado junto con el expediente principal: ${reason.trim()}`;
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
    // Borradores adicionales nunca enviados: eliminados (los documentos caen en cascada)
    ...borradoresAEliminar.flatMap((d) => [
      prisma.draft.delete({ where: { id: d.id } }),
      prisma.token.deleteMany({ where: { token: d.token } }),
    ]),
    // Formularios adicionales enviados: anulados. Sin retiredFolderId: su carpeta viaja con la del
    // principal; reactivarAdicional no la mueve y basta con reactivar el expediente principal.
    ...formsAdicionalesAAnular.map((f) =>
      prisma.form.update({
        where: { id: f.id },
        data: { retiredAt: ahora, retiredReason: motivoAdicional, retiredBy: actor.id, deletedAt: ahora },
      })
    ),
    // Borradores restantes (principal y adicionales enviados): cerrados
    ...contact.drafts
      .filter((d) => !borradoresAEliminar.includes(d))
      .map((d) =>
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
    details: {
      crmId: contact.crmId,
      reason,
      actor: actor.email,
      movedFolder: retiredFolderId,
      adicionalesEliminados: borradoresAEliminar.length,
      adicionalesAnulados: formsAdicionalesAAnular.length,
    },
  });

  return {
    success: true,
    crmId: contact.crmId,
    carpetaMovida: !!retiredFolderId,
    adicionalesEliminados: borradoresAEliminar.length,
    adicionalesAnulados: formsAdicionalesAAnular.length,
  };
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
    // Solo los borradores del principal: los adicionales anulados junto con él se reactivan
    // uno a uno (/api/reactivar-adicional), y los eliminados no vuelven.
    ...contact.drafts
      .filter((d) => !d.isAditional)
      .map((d) =>
        prisma.draft.update({
          where: { id: d.id },
          data: { data: { ...((d.data as any) || {}), retired: false }, expiresAt: null },
        })
      ),
  ]);

  // 4. Enlace: se reactiva el token del borrador del principal y se refleja en Zoho
  const draft = await prisma.draft.findFirst({
    where: { crmContactId: contact.id, isAditional: false },
    orderBy: { createdAt: "desc" },
  });
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
