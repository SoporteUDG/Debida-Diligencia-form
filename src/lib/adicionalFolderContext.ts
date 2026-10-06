import prisma from "@/lib/prisma";
import type { AdicionalCarpeta } from "@/lib/workdriveService";

/**
 * Datos para ubicar la carpeta de WorkDrive de un expediente adicional, que vive
 * dentro de la carpeta del expediente principal (ver AdicionalCarpeta).
 *
 * - `formType`: tipo del expediente PRINCIPAL; es el que da nombre a su carpeta
 *   ({FORMTYPE}-{DD}). Un adicional puede ser de otro tipo que el principal.
 * - `adicional`: token, nombre dado y tipo del adicional.
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

  return {
    formType: principal ?? params.tipo,
    adicional: { token: params.token, nombre, tipo: params.tipo },
  };
}
