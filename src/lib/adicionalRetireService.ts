import prisma from "@/lib/prisma";
import { getAccessToken } from "@/lib/zohoAuthService";
import { logAuditEvent } from "@/lib/auditService";
import { BajaDDError, perfilPuedeEliminar } from "@/lib/ddRetireService";
import { reactivateToken } from "@/lib/tokenService";
import { contextoCarpetaAdicional } from "@/lib/adicionalFolderContext";
import {
  deleteFileFromWorkDrive,
  getOrCreateCarpetaRetirados,
  localizarCarpetaExpediente,
  moveFolder,
} from "@/lib/workdriveService";

/**
 * Baja de un expediente ADICIONAL (enlace/borrador/formulario con isAditional),
 * identificado por su token. Mismas reglas que un expediente de Debida_Diligencia,
 * pero a nivel de adicional: el expediente principal, su registro de Zoho y sus
 * demás adicionales no se tocan nunca.
 *
 * - Nunca enviado (sin Form): se ELIMINA (carpeta de WorkDrive a la papelera, token,
 *   borrador y documentos de Prisma).
 * - Enviado (con Form): se ANULA (Form archivado con motivo, token vencido, carpeta
 *   movida a /{Socio}/DD/_Retirados). Nada se borra. No se escribe en Zoho.
 *
 * La carpeta del adicional es /{Socio}/DD/{FORMTYPE}-adicional de {DD} ({token8})/.
 */

const MIN_MOTIVO = 10;

interface Actor {
  id: string;
  email?: string;
  name?: string;
  profile: string;
}

/** Acepta el token solo o la URL del enlace (…?token=<uuid>). */
export function extraerToken(valor: string): string {
  const v = (valor || "").trim();
  const match = v.match(/[?&]token=([^&#]+)/);
  return (match ? decodeURIComponent(match[1]) : v).split(".")[0];
}

async function cargarAdicional(token: string) {
  const draft = await prisma.draft.findUnique({
    where: { token },
    include: { crmContact: true },
  });
  if (!draft || !draft.crmContact) throw new BajaDDError("No existe un expediente adicional con ese token.", "NOT_FOUND");
  // Guarda: este servicio jamás debe operar sobre un borrador del expediente principal
  if (!draft.isAditional) {
    throw new BajaDDError("El token no corresponde a un expediente adicional.", "BAD_REQUEST");
  }
  const contact = draft.crmContact;
  if (contact.retiredAt || contact.deletedAt) {
    throw new BajaDDError("El expediente principal está anulado: reactívelo primero.", "CONFLICT");
  }
  const form = await prisma.form.findFirst({ where: { tokenUuid: token, isAditional: true } });
  return { draft, contact, form };
}

/**
 * Punto de entrada del botón: elimina si nunca se envió, anula si ya se envió.
 * El perfil de Zoho (leído de Zoho por quien llama) debe poder eliminar expedientes.
 */
export async function bajaAdicional(params: { token: string; reason?: string; actor: Actor; ip?: string | null }) {
  if (!perfilPuedeEliminar(params.actor.profile)) {
    throw new BajaDDError(
      `Su perfil de Zoho ("${params.actor.profile}") no está autorizado para eliminar expedientes.`,
      "FORBIDDEN"
    );
  }
  const token = extraerToken(params.token);
  if (!token) throw new BajaDDError("El token es requerido.", "BAD_REQUEST");

  const { form } = await cargarAdicional(token);
  return form
    ? anularAdicional({ token, reason: params.reason ?? "", actor: params.actor, ip: params.ip })
    : eliminarAdicional({ token, reason: params.reason, actor: params.actor, ip: params.ip });
}

/** ELIMINA un adicional que nunca se envió: carpeta (papelera), token, borrador y documentos. */
export async function eliminarAdicional(params: { token: string; reason?: string; actor: Actor; ip?: string | null }) {
  const token = extraerToken(params.token);
  const reason = params.reason?.trim() || `Solicitado desde Zoho por ${params.actor.name || params.actor.email || params.actor.id}`;

  const { draft, contact, form } = await cargarAdicional(token);
  if (form) throw new BajaDDError("El formulario adicional ya fue enviado: solo puede anularse, no eliminarse.", "CONFLICT");

  // 1. Carpeta del adicional (dentro de la del principal) a la papelera de WorkDrive,
  //    antes de borrar nada en Prisma
  const accessToken = await getAccessToken();
  const { formType } = await contextoCarpetaAdicional({ crmContactId: contact.id, token, tipo: draft.type });
  const { clientFolderId } = await localizarCarpetaExpediente(contact.crmId, formType, accessToken, token);
  if (clientFolderId) await deleteFileFromWorkDrive(clientFolderId, accessToken);

  // 2. Prisma: documentos caen en cascada con el borrador
  await prisma.$transaction([
    prisma.draft.delete({ where: { id: draft.id } }),
    prisma.token.deleteMany({ where: { token } }),
  ]);

  await logAuditEvent({
    action: "ADICIONAL_DELETE",
    entityName: "Draft",
    entityId: draft.id,
    userId: null,
    ipAddress: params.ip ?? null,
    details: {
      crmId: contact.crmId,
      token,
      reason,
      zohoUserId: params.actor.id,
      zohoUser: params.actor.email,
      zohoProfile: params.actor.profile,
      folderTrashed: clientFolderId,
    },
  });

  return { success: true, action: "deleted" as const, crmId: contact.crmId, token, carpetaEliminada: !!clientFolderId };
}

/** ANULA un adicional ya enviado (reversible): archiva el Form, vence el token y mueve la carpeta a _Retirados. */
export async function anularAdicional(params: { token: string; reason: string; actor: Actor; ip?: string | null }) {
  const token = extraerToken(params.token);
  const reason = (params.reason ?? "").trim();
  if (reason.length < MIN_MOTIVO) {
    throw new BajaDDError(`Se requiere un motivo de al menos ${MIN_MOTIVO} caracteres.`, "BAD_REQUEST");
  }

  const { draft, contact, form } = await cargarAdicional(token);
  if (!form) throw new BajaDDError("El formulario adicional nunca se envió: corresponde eliminarlo, no anularlo.", "CONFLICT");
  if (form.retiredAt) throw new BajaDDError("El formulario adicional ya está anulado.", "CONFLICT");

  // 1. Carpeta -> _Retirados (se recuerda dónde estaba)
  let retiredFolderId: string | null = null;
  let retiredOriginFolderId: string | null = null;
  const accessToken = await getAccessToken();
  const { formType } = await contextoCarpetaAdicional({ crmContactId: contact.id, token, tipo: form.type });
  const { ddFolderId, clientFolderId, expedienteFolderId } = await localizarCarpetaExpediente(
    contact.crmId,
    formType,
    accessToken,
    token
  );
  if (ddFolderId && clientFolderId && expedienteFolderId) {
    const retirados = await getOrCreateCarpetaRetirados(ddFolderId, accessToken);
    await moveFolder(clientFolderId, retirados, accessToken);
    retiredFolderId = clientFolderId;
    // Origen: la carpeta del expediente principal, donde vive el adicional
    retiredOriginFolderId = expedienteFolderId;
  }

  // 2. Prisma: Form archivado, token vencido y borrador cerrado
  const ahora = new Date();
  await prisma.$transaction([
    prisma.form.update({
      where: { id: form.id },
      data: {
        retiredAt: ahora,
        retiredReason: reason,
        retiredBy: params.actor.id,
        retiredFolderId,
        retiredOriginFolderId,
        deletedAt: ahora,
      },
    }),
    prisma.token.updateMany({ where: { token }, data: { expiresAt: ahora } }),
    prisma.draft.update({
      where: { id: draft.id },
      data: { data: { ...((draft.data as any) || {}), retired: true }, expiresAt: ahora },
    }),
  ]);

  await logAuditEvent({
    action: "ADICIONAL_RETIRE",
    entityName: "Form",
    entityId: form.id,
    userId: null,
    ipAddress: params.ip ?? null,
    details: {
      crmId: contact.crmId,
      token,
      reason,
      zohoUserId: params.actor.id,
      zohoUser: params.actor.email,
      zohoProfile: params.actor.profile,
      movedFolder: retiredFolderId,
    },
  });

  return { success: true, action: "retired" as const, crmId: contact.crmId, token, formId: form.id, carpetaMovida: !!retiredFolderId };
}

/**
 * REACTIVA un adicional anulado: devuelve su carpeta a la del expediente principal,
 * reabre el borrador, desarchiva el Form y reactiva el token 30 días. Con el mismo
 * token que se usó para anularlo. Para extender el enlace de un adicional activo
 * (y autorizar una modificación) se usa /api/reactivar con `token`.
 */
export async function reactivarAdicional(params: { token: string; actor: Actor; ip?: string | null }) {
  if (!perfilPuedeEliminar(params.actor.profile)) {
    throw new BajaDDError(
      `Su perfil de Zoho ("${params.actor.profile}") no está autorizado para reactivar expedientes.`,
      "FORBIDDEN"
    );
  }
  const token = extraerToken(params.token);
  if (!token) throw new BajaDDError("El token es requerido.", "BAD_REQUEST");

  const { draft, contact, form } = await cargarAdicional(token);
  if (!form || !form.retiredAt) {
    throw new BajaDDError("El expediente adicional no está anulado.", "CONFLICT");
  }

  // 1. Carpeta de vuelta a la del expediente principal
  if (form.retiredFolderId && form.retiredOriginFolderId) {
    await moveFolder(form.retiredFolderId, form.retiredOriginFolderId, await getAccessToken());
  }

  // 2. Prisma
  await prisma.$transaction([
    prisma.form.update({
      where: { id: form.id },
      data: {
        retiredAt: null,
        retiredReason: null,
        retiredBy: null,
        retiredFolderId: null,
        retiredOriginFolderId: null,
        deletedAt: null,
      },
    }),
    prisma.draft.update({
      where: { id: draft.id },
      data: { data: { ...((draft.data as any) || {}), retired: false }, expiresAt: null },
    }),
  ]);

  // 3. Enlace: 30 días más (no escribe en Zoho: es un adicional)
  const reactivado = await reactivateToken(token, 30);

  await logAuditEvent({
    action: "ADICIONAL_REACTIVATE",
    entityName: "Form",
    entityId: form.id,
    userId: null,
    ipAddress: params.ip ?? null,
    details: {
      crmId: contact.crmId,
      token,
      zohoUserId: params.actor.id,
      zohoUser: params.actor.email,
      restoredFolder: form.retiredFolderId,
    },
  });

  return {
    success: true,
    crmId: contact.crmId,
    token,
    formId: form.id,
    expiresAt: reactivado.success ? reactivado.newExpiresAt : null,
  };
}
