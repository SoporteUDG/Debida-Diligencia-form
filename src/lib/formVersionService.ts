import prisma from "@/lib/prisma";

/**
 * Versionado de expedientes.
 *
 * Reglas:
 *  - Un expediente enviado queda bloqueado: no se puede modificar.
 *  - "Reactivar Enlace" (Zoho CRM) crea una FormEditAuthorization pendiente
 *    que habilita exactamente UNA modificación y registra al responsable.
 *  - Cada envío sella una FormVersion inmutable con el FormState completo.
 *    La v1 es el envío original; cada reenvío autorizado incrementa la versión.
 */

/** Campos internos que no aportan nada al comparar dos versiones. */
const CAMPOS_IGNORADOS = new Set(["completed", "submittedFormId"]);

/**
 * Nombres de los campos de primer nivel que cambiaron entre dos snapshots.
 * Se usa solo para mostrar el resumen en auditoría: el dato autoritativo
 * siempre es el snapshot completo.
 */
export function calcularCamposCambiados(anterior: any, nuevo: any): string[] {
  const previo = (anterior || {}) as Record<string, unknown>;
  const actual = (nuevo || {}) as Record<string, unknown>;
  const claves = new Set([...Object.keys(previo), ...Object.keys(actual)]);
  const cambiados: string[] = [];

  for (const clave of claves) {
    if (CAMPOS_IGNORADOS.has(clave)) continue;
    if (JSON.stringify(previo[clave]) !== JSON.stringify(actual[clave])) {
      cambiados.push(clave);
    }
  }

  return cambiados.sort();
}

/**
 * Autorización vigente (no consumida y no vencida) para modificar el
 * expediente de un contacto. Devuelve null si el expediente está bloqueado.
 */
export async function obtenerAutorizacionVigente(crmContactId: string, formId?: string | null) {
  return prisma.formEditAuthorization.findFirst({
    where: {
      crmContactId,
      consumedAt: null,
      expiresAt: { gt: new Date() },
      ...(formId ? { OR: [{ formId }, { formId: null }] } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Registra el permiso de edición que nace al pulsar "Reactivar Enlace".
 * Se asocia al expediente enviado más reciente del contacto, si existe.
 */
export async function registrarAutorizacionEdicion(params: {
  crmContactId: string;
  authorizedBy: string;
  reason?: string | null;
  tokenUuid?: string | null;
  expiresAt: Date;
  source?: string;
}) {
  const formVigente = await prisma.form.findFirst({
    where: { crmContactId: params.crmContactId, deletedAt: null },
    orderBy: { submittedAt: "desc" },
    select: { id: true },
  });

  const autorizacion = await prisma.formEditAuthorization.create({
    data: {
      formId: formVigente?.id ?? null,
      crmContactId: params.crmContactId,
      tokenUuid: params.tokenUuid ?? null,
      authorizedBy: params.authorizedBy,
      reason: params.reason ?? null,
      expiresAt: params.expiresAt,
      source: params.source ?? "ZOHO_REACTIVAR",
    },
  });

  console.log(
    `[FormVersion] Autorización de edición ${autorizacion.id} creada por "${params.authorizedBy}" para el contacto ${params.crmContactId}` +
      (formVigente ? ` (expediente ${formVigente.id})` : " (sin expediente enviado todavía)")
  );

  return autorizacion;
}

/**
 * Sella la versión inicial de un expediente recién enviado.
 * No lleva responsable: nadie autorizó el envío original.
 */
export async function sellarVersionInicial(form: {
  id: string;
  data: any;
  status: any;
  clientName: string;
  projectName: string;
  submittedAt?: Date | null;
}) {
  return prisma.formVersion.create({
    data: {
      formId: form.id,
      version: 1,
      data: form.data,
      status: form.status,
      clientName: form.clientName,
      projectName: form.projectName,
      changedFields: [],
      submittedAt: form.submittedAt ?? new Date(),
    },
  });
}

/**
 * Sella una versión nueva tras un reenvío autorizado y consume la autorización.
 * Devuelve la versión creada.
 */
export async function sellarNuevaVersion(params: {
  formId: string;
  data: any;
  status: any;
  clientName: string;
  projectName: string;
  autorizacion: { id: string; authorizedBy: string; reason: string | null };
  datosAnteriores: any;
}) {
  const form = await prisma.form.findUnique({
    where: { id: params.formId },
    select: { currentVersion: true },
  });
  const siguiente = (form?.currentVersion ?? 1) + 1;

  const version = await prisma.formVersion.create({
    data: {
      formId: params.formId,
      version: siguiente,
      data: params.data,
      status: params.status,
      clientName: params.clientName,
      projectName: params.projectName,
      authorizationId: params.autorizacion.id,
      authorizedBy: params.autorizacion.authorizedBy,
      reason: params.autorizacion.reason,
      changedFields: calcularCamposCambiados(params.datosAnteriores, params.data),
      submittedAt: new Date(),
    },
  });

  await prisma.form.update({
    where: { id: params.formId },
    data: { currentVersion: siguiente },
  });

  await prisma.formEditAuthorization.update({
    where: { id: params.autorizacion.id },
    data: { consumedAt: new Date(), consumedByVersionId: version.id, formId: params.formId },
  });

  console.log(
    `[FormVersion] Expediente ${params.formId} actualizado a la versión ${siguiente} ` +
      `por "${params.autorizacion.authorizedBy}". Campos modificados: ${version.changedFields.join(", ") || "(ninguno)"}`
  );

  return version;
}
