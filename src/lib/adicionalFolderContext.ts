import prisma from "@/lib/prisma";
import type { AdicionalCarpeta, RolCarpeta } from "@/lib/workdriveService";

/**
 * Datos para ubicar la carpeta de WorkDrive de un enlace no principal
 * (relacionado, Representante Legal o adicional), que vive al lado de la del
 * expediente principal, en /{Socio}/DD (ver AdicionalCarpeta).
 *
 * - `formType`: tipo del expediente PRINCIPAL; es el que da nombre a su carpeta
 *   (Principal-{FORMTYPE}-{DD}). Un enlace puede ser de otro tipo que el principal.
 * - `adicional`: token, nombre dado, tipo y rol del enlace (según su borrador).
 */
export async function contextoCarpetaAdicional(params: {
  crmContactId: string | null | undefined;
  token: string;
  tipo: string;
  /** Datos del borrador/formulario del adicional (razonSocial, firstName, lastName) */
  data?: unknown;
  /** Nombre ya resuelto (p. ej. Form.clientName); tiene prioridad sobre `data` */
  nombre?: string | null;
}): Promise<{ formType: string; adicional: AdicionalCarpeta }> {
  const d = (params.data as Record<string, any>) || {};
  const nombre =
    (params.nombre || "").trim() ||
    String(d.razonSocial || "").trim() ||
    `${d.firstName || ""} ${d.lastName || ""}`.trim() ||
    "Adicional";

  let principal: string | undefined;
  if (params.crmContactId) {
    principal =
      (await prisma.form.findFirst({
        where: { crmContactId: params.crmContactId, isAditional: false },
        orderBy: { createdAt: "asc" },
        select: { type: true },
      }))?.type ??
      (await prisma.draft.findFirst({
        where: { crmContactId: params.crmContactId, isAditional: false },
        orderBy: { createdAt: "asc" },
        select: { type: true },
      }))?.type;
  }

  // Rol del enlace: RELATED con contacto = relacionado; sin contacto = Representante Legal
  const borrador = await prisma.draft.findUnique({
    where: { token: params.token },
    select: { role: true, accountContactId: true },
  });
  const rol: RolCarpeta =
    borrador?.role === "RELATED" ? (borrador.accountContactId ? "Relacionado" : "Representante Legal") : "Adicional";

  return {
    formType: principal ?? params.tipo,
    adicional: { token: params.token, nombre, tipo: params.tipo, rol },
  };
}
