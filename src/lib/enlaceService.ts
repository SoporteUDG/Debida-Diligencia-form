import prisma from "@/lib/prisma";
import type { LinkRole } from "@prisma/client";
import { generateToken } from "@/lib/tokenService";
import { zoho, contactRecordToFormData } from "@/lib/zohoService";
import { datosFormularioDesdeZoho } from "@/lib/zohoChangeService";

/**
 * Genera un token de acceso de 30 días para el contacto, construye la URL del
 * formulario y crea su borrador. El borrador queda vinculado al contacto
 * (Draft.crmContactId) para que el autocompletado del expediente relacionado
 * lo encuentre al enviarse el otro formulario.
 *
 * El borrador nace con los campos que ya existan en el registro de Zoho CRM
 * (salvo documentos, sus casillas, términos y firma).
 *
 * `role` (ver LinkRole; `isAditional` equivale a ADITIONAL):
 * - PRINCIPAL: se precarga desde el registro de Zoho y el Contact vinculado.
 * - RELATED: enlace de otro contacto del Socio de Negocio sobre el mismo
 *   expediente; solo se precarga desde su Contact. Queda como adicional
 *   (isAditional): su información no se escribe en el registro de Zoho.
 * - ADITIONAL: no se precarga desde Zoho CRM y queda marcado como adicional.
 */
export async function crearEnlaceConBorrador(params: {
  contactId: string;
  crmId: string;
  isNatural: boolean;
  appUrl: string;
  draftData: Record<string, any>;
  isAditional?: boolean;
  role?: LinkRole;
  /** Contact de Zoho vinculado: sus datos personales también precargan el borrador. */
  contactCrmId?: string;
  /** AccountContact del enlace RELATED. */
  accountContactId?: string;
}): Promise<{ tokenUuid: string; clientUrl: string; expiresAt: Date }> {
  const role: LinkRole = params.role ?? (params.isAditional ? "ADITIONAL" : "PRINCIPAL");
  const tokenUuid = await generateToken(params.contactId, "ACCESS", 30);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const formPath = params.isNatural ? "persona-natural" : "persona-juridica";
  const clientUrl = `${params.appUrl}/${formPath}?token=${tokenUuid}`;
  const formType = params.isNatural ? "NATURAL" : "JURIDICA";

  let desdeZoho: Record<string, any> = {};
  try {
    const registro = role !== "PRINCIPAL" ? null : await zoho.service.getDDRecord(params.crmId);
    if (registro) desdeZoho = datosFormularioDesdeZoho(formType, registro);
  } catch (err) {
    console.warn(`[Enlace Service] No se pudo precargar el borrador desde el registro ${params.crmId}:`, err);
  }

  let desdeContacto: Record<string, any> = {};
  try {
    const contacto = role === "ADITIONAL" || !params.contactCrmId ? null : await zoho.service.getAccountContactRecord(params.contactCrmId);
    if (contacto) desdeContacto = contactRecordToFormData(formType, contacto);
  } catch (err) {
    console.warn(`[Enlace Service] No se pudo precargar el borrador desde el contacto ${params.contactCrmId}:`, err);
  }

  await prisma.draft.upsert({
    where: { token: tokenUuid },
    create: {
      token: tokenUuid,
      type: formType,
      crmContactId: params.contactId,
      isAditional: role !== "PRINCIPAL",
      role,
      accountContactId: params.accountContactId ?? null,
      data: { ...params.draftData, ...desdeZoho, ...desdeContacto },
    },
    update: {
      crmContactId: params.contactId,
      updatedAt: new Date(),
    },
  });

  return { tokenUuid, clientUrl, expiresAt };
}
