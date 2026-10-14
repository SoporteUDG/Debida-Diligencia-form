import prisma from "@/lib/prisma";
import type { Draft, LinkRole } from "@prisma/client";
import { crearEnlaceConBorrador } from "@/lib/enlaceService";
import { zoho } from "@/lib/zohoService";
import type { AccountContactRow } from "@/lib/accountContactService";

/**
 * Enlaces de un expediente (Debida_Diligencia) según su rol (ver LinkRole):
 * - PRINCIPAL: el del expediente (natural: contacto estándar; jurídica: la
 *   empresa), vinculado al registro de Zoho.
 * - RELATED: uno por cada otro contacto del Socio de Negocio, sobre el mismo
 *   expediente. Son adicionales (isAditional): solo actualizan su Contact de
 *   Zoho, y se reactivan / dan de baja por su token como los adicionales.
 *   Jurídica: el del Representante Legal es un RELATED SIN contacto
 *   (accountContactId nulo); solo escribe sus campos exclusivos del expediente.
 * - ADITIONAL: los generados desde /api/generar-adicional.
 */

/** Enlace RELATED sin contacto: el del Representante Legal de una jurídica. */
export const esEnlaceRepresentante = (d: { role: LinkRole; accountContactId: string | null }) =>
  d.role === "RELATED" && !d.accountContactId;

export type LinkStatus = "Activo" | "Vencido" | "Utilizado" | "Anulado" | "Desconocido";

export interface EnlaceExpediente {
  token: string;
  draftId: string;
  formId: string | null;
  role: LinkRole;
  type: Draft["type"];
  step: number;
  completed: boolean;
  name: string | null;
  /** Contact de Zoho del enlace (PRINCIPAL y RELATED). */
  contactId: string | null;
  /** Enlace del Representante Legal (jurídica): RELATED sin contacto. */
  representante: boolean;
  projectName: string | null;
  clientUrl: string;
  linkStatus: LinkStatus;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

type DraftConContacto = Draft & { accountContact?: { crmId: string; firstName: string; lastName: string } | null };

/** Estado, URL y datos de presentación de cada borrador (enlace). */
export async function describirEnlaces(drafts: DraftConContacto[], appUrl: string): Promise<EnlaceExpediente[]> {
  if (!drafts.length) return [];

  const [tokens, forms] = await Promise.all([
    prisma.token.findMany({
      where: { token: { in: drafts.map((d) => d.token) } },
      select: { token: true, used: true, expiresAt: true },
    }),
    prisma.form.findMany({
      where: { tokenUuid: { in: drafts.map((d) => d.token) }, deletedAt: null },
      select: { id: true, tokenUuid: true },
    }),
  ]);
  const tokenByValue = new Map(tokens.map((t) => [t.token, t]));
  const formByToken = new Map(forms.map((f) => [f.tokenUuid, f.id]));
  const now = new Date();

  return drafts.map((d) => {
    const t = tokenByValue.get(d.token);
    const data = (d.data || {}) as Record<string, any>;
    const linkStatus: LinkStatus = data.retired
      ? "Anulado"
      : !t
        ? "Desconocido"
        : t.used
          ? "Utilizado"
          : t.expiresAt < now
            ? "Vencido"
            : "Activo";
    const formPath = d.type === "NATURAL" ? "persona-natural" : "persona-juridica";
    const delContacto = d.accountContact ? `${d.accountContact.firstName} ${d.accountContact.lastName}`.trim() : "";

    return {
      token: d.token,
      draftId: d.id,
      formId: formByToken.get(d.token) ?? null,
      role: d.role,
      type: d.type,
      step: d.step,
      completed: !!data.completed,
      name: data.razonSocial || [data.firstName, data.lastName].filter(Boolean).join(" ") || delContacto || null,
      contactId: d.accountContact?.crmId ?? null,
      representante: esEnlaceRepresentante(d),
      projectName: data.nombreProyecto || null,
      clientUrl: `${appUrl}/${formPath}?token=${d.token}`,
      linkStatus,
      expiresAt: t?.expiresAt ?? d.expiresAt ?? null,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  });
}

/**
 * Enlaces de contactos de un expediente: el PRINCIPAL vigente (el último, si se
 * regeneró) y los RELATED. El principal lleva el contacto del expediente
 * (CrmContact.accountContact).
 */
export async function enlacesDeContactos(crmContactId: string, appUrl: string): Promise<EnlaceExpediente[]> {
  const contacto = { select: { crmId: true, firstName: true, lastName: true } } as const;
  const [crmContact, principal, relacionados] = await Promise.all([
    prisma.crmContact.findUnique({ where: { id: crmContactId }, select: { accountContact: contacto } }),
    prisma.draft.findFirst({
      where: { crmContactId, role: "PRINCIPAL" },
      orderBy: { createdAt: "desc" },
      include: { accountContact: contacto },
    }),
    prisma.draft.findMany({
      where: { crmContactId, role: "RELATED" },
      orderBy: { createdAt: "asc" },
      include: { accountContact: contacto },
    }),
  ]);

  const drafts: DraftConContacto[] = [];
  if (principal) drafts.push({ ...principal, accountContact: principal.accountContact ?? crmContact?.accountContact ?? null });
  // Representante Legal (jurídica) justo después del principal
  drafts.push(...relacionados.filter(esEnlaceRepresentante), ...relacionados.filter((d) => !esEnlaceRepresentante(d)));
  return describirEnlaces(drafts, appUrl);
}

/**
 * Enlaces que ya cuentan como existentes: los vigentes y los anulados cuyo
 * formulario se envió (se reactivan con /api/reactivar-adicional, no se vuelven
 * a crear). Un anulado sin formulario se puede volver a generar.
 */
async function enlacesExistentes<T extends { token: string; data: unknown }>(drafts: T[]): Promise<T[]> {
  const anulados = drafts.filter((d) => (d.data as any)?.retired);
  if (!anulados.length) return drafts;
  const enviados = new Set(
    (
      await prisma.form.findMany({
        where: { tokenUuid: { in: anulados.map((d) => d.token) } },
        select: { tokenUuid: true },
      })
    ).map((f) => f.tokenUuid)
  );
  return drafts.filter((d) => !(d.data as any)?.retired || enviados.has(d.token));
}

/** ¿El expediente ya tiene el enlace del Representante Legal (ver enlacesExistentes)? */
export async function tieneEnlaceRepresentante(crmContactId: string): Promise<boolean> {
  const drafts = await prisma.draft.findMany({
    where: { crmContactId, role: "RELATED", accountContactId: null },
    select: { token: true, data: true },
  });
  return (await enlacesExistentes(drafts)).length > 0;
}

/** Nombre completo -> nombre y apellido (mitad y mitad, como al precargar desde Zoho). */
function partirNombre(full?: string): { firstName: string; lastName: string } {
  const partes = (full ?? "").split(/\s+/).filter(Boolean);
  const mitad = Math.ceil(partes.length / 2);
  return { firstName: partes.slice(0, mitad).join(" "), lastName: partes.slice(mitad).join(" ") };
}

/**
 * Jurídica: enlace del Representante Legal sobre el mismo expediente jurídico,
 * como un RELATED sin contacto. No crea registros en Zoho: al completarse solo
 * escribe los campos exclusivos del representante (ver mapRepresentanteToDDPayload).
 */
export async function crearEnlaceRepresentante(params: {
  /** CrmContact (expediente) jurídico. */
  crmContact: { id: string; crmId: string };
  /** Representante_legal del Socio de Negocio. */
  representanteLegal: string;
  appUrl: string;
  projectName?: string;
}): Promise<{ tokenUuid: string; clientUrl: string; expiresAt: Date }> {
  const { crmContact, representanteLegal, appUrl, projectName } = params;
  return crearEnlaceConBorrador({
    contactId: crmContact.id,
    crmId: crmContact.crmId,
    isNatural: true,
    appUrl,
    role: "RELATED",
    draftData: {
      crmContactId: crmContact.crmId,
      nombreProyecto: projectName,
      ...partirNombre(representanteLegal),
      email: "",
    },
  });
}

/**
 * Ata cada Contact al expediente (lookup Contacts.Debida_Diligencia). Nunca
 * lanza: si el campo aún no existe en Zoho solo se registra el aviso.
 */
export async function vincularContactosAlExpediente(ddCrmId: string, contactCrmIds: string[]): Promise<string[]> {
  const vinculados: string[] = [];
  for (const contactId of contactCrmIds) {
    try {
      await zoho.service.vincularContactoADD(contactId, ddCrmId);
      vinculados.push(contactId);
    } catch (err) {
      console.warn(`[Contact Links] No se pudo vincular el Contact ${contactId} al expediente ${ddCrmId}:`, err);
    }
  }
  return vinculados;
}

/**
 * Contactos (AccountContact.id) que ya tienen un enlace RELATED en el expediente
 * (ver enlacesExistentes).
 */
export async function contactosConEnlaceRelacionado(crmContactId: string): Promise<Set<string>> {
  const drafts = await prisma.draft.findMany({
    where: { crmContactId, role: "RELATED", accountContactId: { not: null } },
    select: { token: true, accountContactId: true, data: true },
  });
  return new Set((await enlacesExistentes(drafts)).map((d) => d.accountContactId!));
}

/**
 * Crea el enlace RELATED de un contacto sobre el expediente de su Socio de
 * Negocio: token de 30 días, URL y borrador precargado desde su Contact de Zoho.
 * No crea ni escribe registros en Zoho.
 */
export async function crearEnlaceRelacionado(params: {
  /** CrmContact (expediente) principal. */
  crmContact: { id: string; crmId: string };
  accountContact: AccountContactRow;
  appUrl: string;
  projectName?: string;
}): Promise<{ tokenUuid: string; clientUrl: string; expiresAt: Date }> {
  const { crmContact, accountContact, appUrl, projectName } = params;
  return crearEnlaceConBorrador({
    contactId: crmContact.id,
    crmId: crmContact.crmId,
    isNatural: true,
    appUrl,
    role: "RELATED",
    contactCrmId: accountContact.crmId,
    accountContactId: accountContact.id,
    draftData: {
      crmContactId: crmContact.crmId,
      nombreProyecto: projectName,
      firstName: accountContact.firstName,
      lastName: accountContact.lastName,
      email: "",
    },
  });
}
