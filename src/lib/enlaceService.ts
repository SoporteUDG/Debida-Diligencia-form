import prisma from "@/lib/prisma";
import { generateToken } from "@/lib/tokenService";
import { zoho } from "@/lib/zohoService";
import { datosFormularioDesdeZoho } from "@/lib/zohoChangeService";

/**
 * Genera un token de acceso de 30 días para el contacto, construye la URL del
 * formulario y crea su borrador. El borrador queda vinculado al contacto
 * (Draft.crmContactId) para que el autocompletado del expediente relacionado
 * lo encuentre al enviarse el otro formulario.
 *
 * El borrador nace con los campos que ya existan en el registro de Zoho CRM
 * (salvo documentos, sus casillas, términos y firma).
 */
export async function crearEnlaceConBorrador(params: {
  contactId: string;
  crmId: string;
  isNatural: boolean;
  appUrl: string;
  draftData: Record<string, any>;
}): Promise<{ tokenUuid: string; clientUrl: string; expiresAt: Date }> {
  const tokenUuid = await generateToken(params.contactId, "ACCESS", 30);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const formPath = params.isNatural ? "persona-natural" : "persona-juridica";
  const clientUrl = `${params.appUrl}/${formPath}?token=${tokenUuid}`;
  const formType = params.isNatural ? "NATURAL" : "JURIDICA";

  let desdeZoho: Record<string, any> = {};
  try {
    const registro = await zoho.service.getDDRecord(params.crmId);
    if (registro) desdeZoho = datosFormularioDesdeZoho(formType, registro);
  } catch (err) {
    console.warn(`[Enlace Service] No se pudo precargar el borrador desde el registro ${params.crmId}:`, err);
  }

  await prisma.draft.upsert({
    where: { token: tokenUuid },
    create: {
      token: tokenUuid,
      type: formType,
      crmContactId: params.contactId,
      data: { ...params.draftData, ...desdeZoho },
    },
    update: {
      crmContactId: params.contactId,
      updatedAt: new Date(),
    },
  });

  return { tokenUuid, clientUrl, expiresAt };
}

/**
 * Crea (o reutiliza) el expediente de Persona Natural relacionado a un
 * expediente de Persona Jurídica: registro en Zoho CRM con DD_relacionado en
 * ambos sentidos, contacto local, token, URL y borrador.
 *
 * Si el expediente jurídico ya tiene DD_relacionado se reutiliza en lugar de
 * crear otro registro. Si el relacionado ya envió su formulario no se genera un
 * nuevo enlace (clientUrl = null).
 *
 * `socioId` evita volver a leer el Socio de Negocio del jurídico cuando quien
 * llama ya lo conoce; `overRideName` sustituye al socio en el Name del
 * expediente natural.
 */
export async function prepararExpedienteRelacionado(params: {
  juridicaCrmId: string;
  clientName: string;
  projectName?: string;
  appUrl: string;
  socioId?: string;
  overRideName?: string;
}): Promise<{ crmId: string; clientUrl: string | null }> {
  const { juridicaCrmId, clientName, projectName, appUrl, overRideName } = params;
  const esSimulado = juridicaCrmId.startsWith("mock-") || juridicaCrmId === "simulated-crm-contact-id";

  // 1. Expediente relacionado existente (enlace regenerado)
  let relatedCrmId: string | null = null;
  if (!esSimulado) {
    try {
      relatedCrmId = await zoho.service.getRelatedDDId(juridicaCrmId);
    } catch (err) {
      console.warn(`[Enlace Service] No se pudo leer DD_relacionado de ${juridicaCrmId}:`, err);
    }
  }

  // 2. Crear el expediente natural en Zoho, ya apuntando al jurídico
  if (!relatedCrmId || relatedCrmId === juridicaCrmId) {
    // Mismo Socio de Negocio que el jurídico (define el Name y la carpeta de documentos)
    let socioId = params.socioId;
    if (!socioId && !esSimulado) {
      try {
        socioId = (await zoho.service.getSocioDocumentsLink(juridicaCrmId)).socioId || undefined;
      } catch (err) {
        console.warn(`[Enlace Service] No se pudo leer el Socio de Negocio de ${juridicaCrmId}:`, err);
      }
    }

    const created = await zoho.service.createDebidaDiligenciaRecord({
      accountCrmId: socioId,
      clientType: "NATURAL",
      name: `Representante Legal ${clientName}`,
      projectName,
      relatedDDId: juridicaCrmId,
      overRideName,
    });
    if (!created.debidaId) throw new Error("Zoho CRM no devolvió el ID del expediente natural creado");
    relatedCrmId = created.debidaId;
    console.log(`[Enlace Service] Expediente natural ${relatedCrmId} creado para el jurídico ${juridicaCrmId}.`);
  }

  // 3. El jurídico apunta al natural
  await zoho.service.setRelatedDD(juridicaCrmId, relatedCrmId);

  // 4. Contacto local del relacionado
  let relatedContact = await prisma.crmContact.findUnique({ where: { crmId: relatedCrmId } });
  if (!relatedContact) {
    relatedContact = await prisma.crmContact.create({
      data: {
        crmId: relatedCrmId,
        firstName: "Representante Legal",
        lastName: clientName,
        email: `cliente@udg.com`,
      },
    });
  }

  const yaEnviado = await prisma.form.findFirst({
    where: { crmContactId: relatedContact.id, deletedAt: null },
    select: { id: true },
  });
  if (yaEnviado) {
    console.log(`[Enlace Service] El expediente relacionado ${relatedCrmId} ya fue completado; no se genera enlace.`);
    return { crmId: relatedCrmId, clientUrl: null };
  }

  // 5. Token, URL y borrador del relacionado
  const { clientUrl, expiresAt } = await crearEnlaceConBorrador({
    contactId: relatedContact.id,
    crmId: relatedCrmId,
    isNatural: true,
    appUrl,
    draftData: {
      crmContactId: relatedCrmId,
      nombreProyecto: projectName,
      firstName: "",
      lastName: "",
      email: "",
    },
  });

  // 6. Enlace del relacionado en Zoho
  try {
    await zoho.service.updateClientFormLink(relatedCrmId, "Debida_Diligencia", clientUrl, expiresAt, "Activo");
    await zoho.service.createNote(
      relatedCrmId,
      "Enlace Generado (Persona Natural)",
      `Se ha generado el enlace del Representante Legal relacionado al expediente jurídico ${juridicaCrmId}.\n\n` +
      `Enlace del Formulario: ${clientUrl}\n` +
      `Vigencia del Enlace: ${expiresAt.toLocaleString()}\n` +
      `Estado del Enlace: Activo\n` +
      `Timestamp: ${new Date().toLocaleString()}`
    );
  } catch (crmErr) {
    console.error(`[Enlace Service Warning] Error al actualizar el enlace del relacionado ${relatedCrmId}:`, crmErr);
  }

  return { crmId: relatedCrmId, clientUrl };
}
