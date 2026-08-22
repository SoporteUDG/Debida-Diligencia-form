import prisma from "@/lib/prisma";
import { logAuditEvent } from "./auditService";
import { zoho } from "./zohoService";

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
      include: { crmContact: true },
    });

    if (!form) {
      console.error(`[CRM Sync Error] No se encontró el formulario con ID: ${formId}`);
      return { success: false, error: "Formulario no encontrado" };
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

    const crmContactId = form.crmContact?.crmId;
    if (!crmContactId) {
      throw new Error("No se encontró un crmId (ID de contacto de Zoho CRM) asociado a este formulario.");
    }

    // 4. Trigger Zoho CRM contact/lead update with the mapped form data
    console.log(`[CRM Sync] Iniciando petición PUT de actualización para contacto CRM: ${crmContactId}`);

    const syncResult = await zoho.service.updateContact(
      crmContactId,
      form.type as any,
      form.data
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

    // Log success note in Zoho CRM
    try {
      await zoho.service.createNote(
        crmContactId,
        "Formulario Completado",
        `El cliente completó y envió el formulario de Debida Diligencia.\n\n` +
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
