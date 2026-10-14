import prisma from "@/lib/prisma";
import { logAuditEvent } from "./auditService";
import { zoho, mapRepresentanteToDDPayload, CAMPOS_EXCLUSIVOS_REPRESENTANTE } from "./zohoService";

/**
 * Triggers Zoho CRM contact synchronization for a submitted Form.
 * This function handles idempotency, development bypass for placeholder credentials,
 * and records attempts/results in the CrmSync database table.
 *
 * @param formId Unique ID of the Form to synchronize.
 */
export async function syncFormToCrm(formId: string) {
  let form: any = null;
  try {
    // 1. Fetch form details along with CRM contact info
    form = await prisma.form.findUnique({
      where: { id: formId },
      include: {
        crmContact: { include: { accountContact: true } },
        // Contacto relacionado (role RELATED) que llenó el formulario
        accountContact: true,
        // Archivos vigentes: marcan las casillas de documentos recibidos en Zoho
        documents: {
          where: { deletedAt: null },
          select: { name: true, documentType: true, personType: true },
        },
      },
    });

    if (!form) {
      console.error(`[CRM Sync Error] No se encontró el formulario con ID: ${formId}`);
      return { success: false, error: "Formulario no encontrado" };
    }

    // Enlace de un contacto relacionado: solo actualiza los datos básicos de su
    // Contact de Zoho; el expediente de Debida_Diligencia es del contacto estándar.
    // Sin contacto es el Representante Legal (jurídica): solo escribe sus campos
    // exclusivos en el expediente jurídico, nunca los compartidos con Persona Natural.
    const representante = form.role === "RELATED" && !form.accountContactId;
    const soloContacto = form.role === "RELATED" && !representante;

    // Un expediente adicional no vincula su información de cliente a Zoho
    if (form.isAditional && !soloContacto && !representante) {
      console.log(`[CRM Sync] El formulario ${formId} es adicional; no se sincroniza con Zoho CRM.`);
      return { success: true, skipped: true };
    }

    // 2. Resolve/Create CrmSync record for tracking
    let crmSync = await prisma.crmSync.findUnique({
      where: { formId },
    });

    if (!crmSync) {
      crmSync = await prisma.crmSync.create({
        data: {
          formId,
          status: "PENDING",
        },
      });
    }

    // Idempotency check: If sync succeeded already, do not re-run
    if (crmSync.status === "SUCCESS") {
      console.log(`[CRM Sync] El formulario ${formId} ya se sincronizó con éxito previamente.`);
      return { success: true, message: "Ya sincronizado previamente" };
    }

    // 3. Mark sync status as IN_PROGRESS and increment attempts
    await prisma.crmSync.update({
      where: { formId },
      data: {
        status: "IN_PROGRESS",
        attempts: { increment: 1 },
        lastAttempt: new Date(),
      },
    });

    const clientId = process.env.ZOHO_CLIENT_ID;
    const clientSecret = process.env.ZOHO_CLIENT_SECRET;
    const refreshToken = process.env.ZOHO_REFRESH_TOKEN;

    // Check if configuration uses local/development placeholders
    const isPlaceholder =
      !clientId ||
      clientId === "placeholder_client_id" ||
      !clientSecret ||
      clientSecret === "placeholder_client_secret" ||
      !refreshToken ||
      refreshToken === "placeholder_refresh_token";

    if (isPlaceholder) {
      console.log(`[CRM Sync] Credenciales de Zoho son placeholders. Simulando sincronización exitosa para el formulario: ${formId}`);
      
      const simulatedCrmId = form.crmContact?.crmId || "simulated-crm-contact-id";
      await prisma.crmSync.update({
        where: { formId },
        data: {
          status: "SUCCESS",
          crmId: simulatedCrmId,
          errorMessage: null,
        },
      });

      await logAuditEvent({
        action: "ZOHO_CRM_SYNC",
        entityName: "Form",
        entityId: formId,
        details: {
          status: "SUCCESS",
          mocked: true,
          crmContactId: form.crmContact?.id || null,
          crmId: simulatedCrmId,
        },
      });

      return { success: true, mocked: true };
    }

    // Relacionado: el registro sincronizado es su Contact; principal: el expediente
    const crmContactId = soloContacto ? form.accountContact?.crmId : form.crmContact?.crmId;
    if (!crmContactId) {
      throw new Error(
        soloContacto
          ? "El formulario del contacto relacionado no tiene un Contact de Zoho vinculado."
          : "No se encontró un crmId (ID de contacto de Zoho CRM) asociado a este formulario."
      );
    }

    // 4. Trigger Zoho CRM contact/lead update with the mapped form data
    console.log(`[CRM Sync] Iniciando petición PUT de actualización para ${soloContacto ? "el Contact relacionado" : "contacto CRM"}: ${crmContactId}`);

    // Con contacto vinculado, los datos personales se escriben en el Contact
    // de Zoho y no en el expediente de Debida_Diligencia.
    const contactCrmId = form.crmContact?.accountContact?.crmId as string | undefined;
    const syncResult = representante
      ? await zoho.service.updateDDFields(crmContactId, mapRepresentanteToDDPayload(form.data))
      : soloContacto
      ? await zoho.service.updateAccountContact(crmContactId, form.type as any, form.data)
      : await zoho.service.updateContact(
          crmContactId,
          form.type as any,
          form.data,
          { contactCrmId, documentos: form.documents }
        );

    // 5. Update CrmSync to SUCCESS on success
    await prisma.crmSync.update({
      where: { formId },
      data: {
        status: "SUCCESS",
        crmId: crmContactId,
        errorMessage: null,
      },
    });

    await logAuditEvent({
      action: "ZOHO_CRM_SYNC",
      entityName: "Form",
      entityId: formId,
      details: {
        status: "SUCCESS",
        mocked: !!syncResult.mocked,
        crmContactId: form.crmContact?.id || null,
        crmId: crmContactId,
      },
    });

    console.log(`[CRM Sync Success] Formulario ${formId} sincronizado con éxito en Zoho CRM.`);

    // Log success note in Zoho CRM (relacionado: en el expediente, solo como nota)
    try {
      const relacionado = soloContacto
        ? `${form.accountContact?.firstName ?? ""} ${form.accountContact?.lastName ?? ""}`.trim() || crmContactId
        : "";
      await zoho.service.createNote(
        soloContacto ? form.crmContact?.crmId ?? crmContactId : crmContactId,
        representante
          ? "Formulario del Representante Legal Completado"
          : soloContacto ? "Formulario de Contacto Relacionado Completado" : "Formulario Completado",
        (representante
          ? `El Representante Legal completó su formulario. Solo se actualizaron sus campos exclusivos (${CAMPOS_EXCLUSIVOS_REPRESENTANTE.join(", ")}).\n\n`
          : soloContacto
          ? `El contacto relacionado ${relacionado} (${crmContactId}) completó su formulario. Se actualizaron solo los datos de su Contact; este expediente no se modificó.\n\n`
          : `El cliente completó y envió el formulario de Debida Diligencia.\n\n`) +
        `Referencia del Formulario: ${formId}\n` +
        `Proyecto: ${form.projectName || "General UDG"}\n` +
        `Actor: Cliente (Portal)\n` +
        `Timestamp: ${new Date().toLocaleString()}\n` +
        `Resultado de Sincronización: Éxito (Sincronizado correctamente en CRM)`
      );
    } catch (noteErr) {
      console.error(`[CRM Sync Warning] Error al registrar nota de éxito en Zoho CRM para el formulario ${formId}:`, noteErr);
    }

    return { success: true };

  } catch (error: any) {
    const errorMsg = error.message || String(error);
    console.error(`[CRM Sync Error] Falló sincronización de formulario ${formId}:`, error);

    try {
      await prisma.crmSync.update({
        where: { formId },
        data: {
          status: "FAILED",
          errorMessage: errorMsg,
        },
      });
    } catch (dbErr) {
      console.error("[CRM Sync Error] No se pudo guardar el error en la tabla CrmSync:", dbErr);
    }

    // Log sync failure note in Zoho CRM if the CRM contact ID is resolved
    try {
      const crmContactId = form?.crmContact?.crmId;
      if (crmContactId) {
        await zoho.service.createNote(
          crmContactId,
          "Intento de Sincronización de Formulario Fallido",
          `El cliente completó el formulario de Debida Diligencia, pero falló la sincronización con el CRM.\n\n` +
          `Referencia del Formulario: ${formId}\n` +
          `Proyecto: ${form?.projectName || "General UDG"}\n` +
          `Actor: Sistema de Sincronización\n` +
          `Timestamp: ${new Date().toLocaleString()}\n` +
          `Resultado de Sincronización: Fallido - ${errorMsg}`
        );
      }
    } catch (noteErr) {
      console.error(`[CRM Sync Warning] Error al registrar nota de fallo en Zoho CRM para el formulario ${formId}:`, noteErr);
    }

    await logAuditEvent({
      action: "ZOHO_CRM_SYNC",
      entityName: "Form",
      entityId: formId,
      details: {
        status: "FAILED",
        error: errorMsg,
        crmContactId: form?.crmContact?.id || null,
      },
    });

    return { success: false, error: errorMsg };
  }
}
