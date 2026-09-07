import { PDFDocument as PDFLibDoc } from "pdf-lib";
import { generateServerPDF } from "./serverPdfGenerator";

/**
 * Downloads a file from Zoho WorkDrive by its fileId using Zoho OAuth access token.
 */
async function fetchWorkDriveFileBuffer(fileId: string, accessToken: string): Promise<Buffer | null> {
  try {
    const url = `https://www.zohoapis.com/workdrive/api/v1/download/${fileId}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
      },
    });

    if (!res.ok) {
      console.warn(`[PDF Merge] No se pudo descargar anexo de WorkDrive (ID: ${fileId}): ${res.status} ${res.statusText}`);
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.error(`[PDF Merge] Error al descargar archivo ${fileId} de WorkDrive:`, err);
    return null;
  }
}

/**
 * Generates the complete, detailed PDF dossier combining:
 * 1. The official structured form report (all personal, labor, PEP, and financial fields)
 * 2. Electronic signature block with image
 * 3. All attached documents (PDFs appended page by page, and JPG/PNG images embedded into A4 pages)
 * 
 * Returns the final merged PDF Buffer ready to be uploaded to Zoho WorkDrive.
 */
export async function generateCompleteDossierPDF(
  type: "NATURAL" | "JURIDICA",
  data: any,
  formId: string,
  submittedAt: Date,
  documents: Array<{ name: string; fileType: string; zohoFileId?: string | null }>,
  accessToken?: string
): Promise<Buffer> {
  // 1. Generate base form PDF with PDFKit
  console.log(`[Dossier PDF] Generando reporte principal para formulario: ${formId}`);
  const basePdfBuffer = await generateServerPDF(type, data, formId, submittedAt, documents);

  // 2. Load into pdf-lib for merging attachments
  const mergedPdf = await PDFLibDoc.load(basePdfBuffer);

  // Filter valid attached documents
  const activeDocs = (documents || []).filter(
    (d) => d.zohoFileId && d.zohoFileId !== "PENDING_SYNC" && d.zohoFileId !== "LOCAL_BACKUP"
  );

  if (activeDocs.length > 0 && accessToken) {
    console.log(`[Dossier PDF] Combinando ${activeDocs.length} anexos desde WorkDrive...`);

    for (const doc of activeDocs) {
      try {
        console.log(`[Dossier PDF] Descargando y anexando: ${doc.name} (WorkDrive ID: ${doc.zohoFileId})`);
        const fileBuffer = await fetchWorkDriveFileBuffer(doc.zohoFileId!, accessToken);
        if (!fileBuffer) continue;

        const lowerName = (doc.name || "").toLowerCase();
        const isPdf = lowerName.endsWith(".pdf") || doc.fileType === "application/pdf";
        const isJpg = lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg") || doc.fileType === "image/jpeg";
        const isPng = lowerName.endsWith(".png") || doc.fileType === "image/png";

        if (isPdf) {
          try {
            const attachmentDoc = await PDFLibDoc.load(fileBuffer, { ignoreEncryption: true });
            const pageIndices = attachmentDoc.getPageIndices();
            const copiedPages = await mergedPdf.copyPages(attachmentDoc, pageIndices);
            copiedPages.forEach((page) => mergedPdf.addPage(page));
            console.log(`[Dossier PDF] Anexo PDF integrado: ${doc.name} (${copiedPages.length} páginas)`);
          } catch (pdfErr) {
            console.warn(`[Dossier PDF] No se pudo parsear PDF del anexo "${doc.name}":`, pdfErr);
          }
        } else if (isJpg) {
          try {
            const embeddedImage = await mergedPdf.embedJpg(fileBuffer);
            const page = mergedPdf.addPage();
            const { width, height } = page.getSize();
            const scale = Math.min((width - 60) / embeddedImage.width, (height - 60) / embeddedImage.height, 1);
            const imgW = embeddedImage.width * scale;
            const imgH = embeddedImage.height * scale;
            const x = (width - imgW) / 2;
            const y = (height - imgH) / 2;

            page.drawImage(embeddedImage, { x, y, width: imgW, height: imgH });
            console.log(`[Dossier PDF] Anexo JPG integrado: ${doc.name}`);
          } catch (imgErr) {
            console.warn(`[Dossier PDF] Error al incrustar JPG "${doc.name}":`, imgErr);
          }
        } else if (isPng) {
          try {
            const embeddedImage = await mergedPdf.embedPng(fileBuffer);
            const page = mergedPdf.addPage();
            const { width, height } = page.getSize();
            const scale = Math.min((width - 60) / embeddedImage.width, (height - 60) / embeddedImage.height, 1);
            const imgW = embeddedImage.width * scale;
            const imgH = embeddedImage.height * scale;
            const x = (width - imgW) / 2;
            const y = (height - imgH) / 2;

            page.drawImage(embeddedImage, { x, y, width: imgW, height: imgH });
            console.log(`[Dossier PDF] Anexo PNG integrado: ${doc.name}`);
          } catch (pngErr) {
            console.warn(`[Dossier PDF] Error al incrustar PNG "${doc.name}":`, pngErr);
          }
        }
      } catch (attachmentErr) {
        console.error(`[Dossier PDF Error] Error al procesar anexo "${doc.name}":`, attachmentErr);
      }
    }
  }

  const finalBytes = await mergedPdf.save();
  console.log(`[Dossier PDF] Expediente completo consolidado exitosamente. Tamaño: ${(finalBytes.length / 1024).toFixed(1)} KB`);
  return Buffer.from(finalBytes);
}
