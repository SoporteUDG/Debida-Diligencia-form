import prisma from "@/lib/prisma";
import { executeWithRetry } from "@/lib/zohoAuthService";
import {
  getOrCreateFolderStructure,
  uploadFileToWorkDrive,
  createShareLink,
} from "@/lib/workdriveService";
import { generateCompleteDossierPDF, PREFIJO_EXPEDIENTE_CONSOLIDADO } from "@/lib/completeDossierService";
import { logAuditEvent } from "@/lib/auditService";
import { zoho } from "@/lib/zohoService";

/**
 * Synchronizes a submitted Form with Zoho WorkDrive:
 * 1. Resolves folder hierarchy (/DD/YYYY/MM/Apellido_Nombre_ID/)
 * 2. Generates the detailed full dossier PDF (including attached docs/images merged)
 * 3. Uploads the consolidated PDF to the client's WorkDrive folder
 * 4. Generates a public shareable WorkDrive link
 * 5. Updates WorkDriveSync record and Form record in database
 * 
 * Idempotent: If already synchronized with SUCCESS, returns immediately.
 */
export async function syncFormToWorkDrive(formId: string) {
  console.log(`[WorkDrive Sync] Iniciando sincronización para formulario: ${formId}`);

  let form: any = null;
  try {
    form = await prisma.form.findUnique({
      where: { id: formId },
      include: {
        crmContact: true,
        documents: {
          where: { deletedAt: null },
        },
      },
    });

    if (!form) {
      console.error(`[WorkDrive Sync Error] Formulario no encontrado: ${formId}`);
      return { success: false, error: "Formulario no encontrado" };
    }

    // Resolve or initialize WorkDriveSync record
    let syncRecord = await prisma.workDriveSync.findUnique({
      where: { formId },
    });

    if (!syncRecord) {
      syncRecord = await prisma.workDriveSync.create({
        data: { formId, status: "PENDING" },
      });
    }

    // Sólo se omite si la versión ya consolidada es la vigente. Tras una
    // enmienda (v2, v3…) hay que regenerar el expediente consolidado.
    if (
      syncRecord.status === "SUCCESS" &&
      syncRecord.folderUrl &&
      (syncRecord.syncedVersion ?? 1) >= (form.currentVersion ?? 1)
    ) {
      console.log(
        `[WorkDrive Sync] Formulario ${formId} ya sincronizado en su versión vigente (v${syncRecord.syncedVersion ?? 1}).`
      );
      return { success: true, folderUrl: syncRecord.folderUrl };
    }

    // Mark as IN_PROGRESS
    await prisma.workDriveSync.update({
      where: { formId },
      data: {
        status: "IN_PROGRESS",
        attempts: { increment: 1 },
        lastAttempt: new Date(),
      },
    });

    const clientId = process.env.ZOHO_CLIENT_ID;
    const isPlaceholder =
      !clientId ||
      clientId === "placeholder_client_id" ||
      process.env.ZOHO_WORKDRIVE_ROOT_FOLDER_ID === "placeholder_root_folder_id";

    if (isPlaceholder) {
      console.log(`[WorkDrive Sync] Credenciales en modo placeholder. Simulando éxito para: ${formId}`);
      await prisma.workDriveSync.update({
        where: { formId },
        data: {
          status: "SUCCESS",
          folderUrl: "https://workdrive.zoho.com/mock-folder",
          errorMessage: null,
        },
      });
      return { success: true, mocked: true };
    }

    // El expediente consolidado se arma SIEMPRE desde la versión sellada
    // (FormVersion), nunca desde el borrador. Si por algún motivo no existe la
    // fila de versión, se usa form.data, que es el mismo snapshot vigente.
    const versionSellada = await prisma.formVersion.findFirst({
      where: { formId: form.id },
      orderBy: { version: "desc" },
    });
    const versionNumero = versionSellada?.version ?? form.currentVersion ?? 1;
    const datosVersion = versionSellada?.data ?? form.data;

    if (!versionSellada) {
      console.warn(
        `[WorkDrive Sync] El formulario ${formId} no tiene FormVersion sellada; se usa Form.data como respaldo.`
      );
    }

    // Determine folder structure parameters
    const submittedAt = versionSellada?.submittedAt || form.submittedAt || new Date();
    const yearStr = submittedAt.getFullYear().toString();
    const monthStr = String(submittedAt.getMonth() + 1).padStart(2, "0");

    const sanitizeStr = (s: string) => (s || "").trim().replace(/[^a-zA-Z0-9_\-]/g, "_");
    const contact = form.crmContact;
    const clientIdentifier = contact
      ? sanitizeStr(`${contact.lastName || ""}_${contact.firstName || ""}_${contact.crmId || form.id.substring(0, 8)}`)
      : sanitizeStr(`${form.clientName || "Cliente"}_${form.id.substring(0, 8)}`);

    // Execute with OAuth retry logic
    const result = await executeWithRetry(async (accessToken) => {
      // 1. Get or create folder structure in WorkDrive
      console.log(`[WorkDrive Sync] Creando/obteniendo estructura de carpetas para ${clientIdentifier}...`);
      const folderStructure = await getOrCreateFolderStructure(
        yearStr,
        monthStr,
        clientIdentifier,
        ["Expediente_Consolidado"],
        accessToken
      );

      const targetFolderId = folderStructure.clientFolderId;

      // 2. Generate the complete dossier PDF desde la VERSIÓN sellada
      console.log(`[WorkDrive Sync] Generando PDF consolidado para formulario ${formId} (v${versionNumero})...`);
      const pdfBuffer = await generateCompleteDossierPDF(
        form.type,
        datosVersion,
        form.id,
        submittedAt,
        form.documents || [],
        accessToken,
        versionNumero
      );

      // 3. Upload dossier PDF to WorkDrive.
      //    El nombre incluye la versión: una enmienda no pisa el expediente
      //    consolidado de la versión anterior.
      const pdfFileName = `${PREFIJO_EXPEDIENTE_CONSOLIDADO}${clientIdentifier}_v${versionNumero}.pdf`;
      console.log(`[WorkDrive Sync] Subiendo "${pdfFileName}" a WorkDrive (carpeta ID: ${targetFolderId})...`);

      const fileId = await uploadFileToWorkDrive(
        targetFolderId,
        pdfFileName,
        pdfBuffer,
        accessToken
      );

      // 4. Create public shareable link
      let shareUrl: string | null = null;
      try {
        shareUrl = await createShareLink(fileId, accessToken);
      } catch (linkErr) {
        console.warn(`[WorkDrive Sync Warning] No se pudo generar enlace público compartido:`, linkErr);
      }

      // 5. Also attach the consolidated PDF directly to the Zoho CRM record's Attachments related list
      const crmContactId = form.crmContact?.crmId;
      if (crmContactId) {
        try {
          console.log(`[WorkDrive Sync] Subiendo copia del expediente a Archivos Adjuntos de Zoho CRM (${crmContactId})...`);
          await zoho.service.uploadAttachment(
            crmContactId,
            pdfFileName,
            pdfBuffer
          );
        } catch (crmAttErr) {
          console.warn(`[WorkDrive Sync Warning] No se pudo adjuntar el archivo directamente en Zoho CRM para ${crmContactId}:`, crmAttErr);
        }
      }

      return {
        fileId,
        targetFolderId,
        shareUrl,
      };
    });

    // 5. Update database record to SUCCESS
    await prisma.workDriveSync.update({
      where: { formId },
      data: {
        status: "SUCCESS",
        folderUrl: result.shareUrl || `https://workdrive.zoho.com/home/folders/${result.targetFolderId}`,
        errorMessage: null,
        syncedVersion: versionNumero,
      },
    });

    // Save consolidated PDF as document record
    try {
      await prisma.document.create({
        data: {
          formId: form.id,
          name: `${PREFIJO_EXPEDIENTE_CONSOLIDADO}${clientIdentifier}_v${versionNumero}.pdf`,
          fileType: "application/pdf",
          url: result.shareUrl || `/api/documents/download?fileId=${result.fileId}`,
          zohoFileId: result.fileId,
          status: "APPROVED",
        },
      });
    } catch (docDbErr) {
      console.warn("[WorkDrive Sync Warning] No se pudo guardar el Documento consolidado en DB:", docDbErr);
    }

    await logAuditEvent({
      action: "WORKDRIVE_SYNC",
      entityName: "Form",
      entityId: formId,
      details: {
        status: "SUCCESS",
        folderId: result.targetFolderId,
        fileId: result.fileId,
        shareUrl: result.shareUrl,
      },
    });

    console.log(`[WorkDrive Sync Success] Formulario ${formId} sincronizado con éxito en WorkDrive. Carpeta: ${result.targetFolderId}`);
    return { success: true, folderId: result.targetFolderId, fileId: result.fileId };

  } catch (err: any) {
    const errorMsg = err.message || String(err);
    console.error(`[WorkDrive Sync Error] Falló sincronización de ${formId}:`, err);

    try {
      await prisma.workDriveSync.update({
        where: { formId },
        data: {
          status: "FAILED",
          errorMessage: errorMsg,
        },
      });
    } catch (dbErr) {
      console.error("[WorkDrive Sync Error] No se pudo guardar estado FAILED en DB:", dbErr);
    }

    await logAuditEvent({
      action: "WORKDRIVE_SYNC",
      entityName: "Form",
      entityId: formId,
      details: {
        status: "FAILED",
        error: errorMsg,
      },
    });

    return { success: false, error: errorMsg };
  }
}
