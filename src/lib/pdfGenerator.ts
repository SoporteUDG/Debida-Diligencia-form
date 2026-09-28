import { esDescargable, esMarcadorWorkDrive } from "./workdriveFileId";

/**
 * Descarga el expediente en PDF desde el navegador.
 *
 * El formulario se dibuja en el servidor (/api/documents/expediente-pdf) con el
 * mismo generador que el consolidado archivado en WorkDrive, así ambos PDFs
 * son idénticos. Aquí sólo se le anexan los documentos adjuntos, descargados
 * por /api/documents/download con la autorización de quien consulta.
 */
export async function generatePDF(
  type: "natural" | "juridica",
  data: any,
  id: string,
  dateStr: string,
  documents?: any[],
  /**
   * Token del expediente con el que se piden los anexos a /api/documents/download.
   * Quien llama lo tiene a mano (el estado del formulario, el enlace de consulta);
   * buscarlo en localStorage no funciona: la página lo borra al enviar, justo
   * antes de mostrar el botón de descarga.
   * El panel de administración no lo necesita: se autoriza por su cookie.
   */
  authToken?: string | null
) {
  const typePrefix = type === "natural" ? "Natural" : "Juridica";
  const fileName = `Expediente_UDG_${typePrefix}_${id}.pdf`;

  try {
    // 1. Formulario, generado en el servidor
    const response = await fetch("/api/documents/expediente-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, data, id, date: dateStr, documents: documents || [] }),
    });
    if (!response.ok) {
      throw new Error(`El servidor respondió ${response.status} al generar el PDF.`);
    }
    const formPdfBytes = await response.arrayBuffer();

    // 2. Anexos
    // Mismo criterio que completeDossierService: un marcador de sincronización
    // no es un id descargable y se reporta como tal, no como fallo de descarga.
    const activeDocuments = (documents || []).filter(esDescargable);
    const pendientesDeSync = (documents || []).filter((d: any) => esMarcadorWorkDrive(d.zohoFileId));
    if (pendientesDeSync.length > 0) {
      console.warn(
        `[PDF Generator] ${pendientesDeSync.length} anexo(s) aún sin sincronizar con WorkDrive; no se incluyen: ` +
        pendientesDeSync.map((d: any) => d.name).join(", ")
      );
    }

    if (activeDocuments.length === 0) {
      descargar(new Blob([formPdfBytes], { type: "application/pdf" }), fileName);
      return;
    }

    console.log(`[PDF Generator] Preparando para combinar ${activeDocuments.length} anexos...`);
    const { PDFDocument } = await import("pdf-lib");
    const mergedPdf = await PDFDocument.load(formPdfBytes);

    // El token explícito manda. Como respaldo se miran las claves que el
    // formulario sí escribe, por si se descarga antes de enviar.
    const draftToken =
      authToken ||
      localStorage.getItem("udg_due_diligence_natural_token") ||
      localStorage.getItem("udg_due_diligence_juridica_token") ||
      "";

    for (const doc of activeDocuments) {
      try {
        console.log(`[PDF Generator] Cargando anexo: ${doc.name} (ID: ${doc.zohoFileId})`);
        const proxyUrl = `/api/documents/download?fileId=${encodeURIComponent(doc.zohoFileId)}&token=${encodeURIComponent(draftToken)}`;
        const fileRes = await fetch(proxyUrl);

        if (!fileRes.ok) {
          const motivo =
            fileRes.status === 401
              ? "sin autorización para descargar anexos (falta el token del expediente o la sesión de administrador)"
              : fileRes.statusText;
          console.warn(`[PDF Generator] No se pudo descargar anexo "${doc.name}":`, motivo);
          continue;
        }

        const fileBytes = await fileRes.arrayBuffer();
        const lowerName = String(doc.name || "").toLowerCase();

        if (lowerName.endsWith(".pdf") || doc.fileType === "application/pdf") {
          const attachmentPdf = await PDFDocument.load(fileBytes);
          const copiedPages = await mergedPdf.copyPages(attachmentPdf, attachmentPdf.getPageIndices());
          copiedPages.forEach((page) => mergedPdf.addPage(page));
          console.log(`[PDF Generator] PDF combinado: ${doc.name}`);
        } else if (
          lowerName.endsWith(".jpg") ||
          lowerName.endsWith(".jpeg") ||
          doc.fileType === "image/jpeg"
        ) {
          const image = await mergedPdf.embedJpg(fileBytes);
          const page = mergedPdf.addPage();
          const { width, height } = page.getSize();

          // Scale image to fit within A4 limits with margins
          const scale = Math.min((width - 40) / image.width, (height - 40) / image.height);
          page.drawImage(image, {
            x: (width - image.width * scale) / 2,
            y: (height - image.height * scale) / 2,
            width: image.width * scale,
            height: image.height * scale,
          });
          console.log(`[PDF Generator] Imagen combinada: ${doc.name}`);
        }
      } catch (docErr) {
        console.error(`[PDF Generator Error] Falló al combinar anexo "${doc.name}":`, docErr);
      }
    }

    const mergedPdfBytes = await mergedPdf.save();
    descargar(new Blob([new Uint8Array(mergedPdfBytes)], { type: "application/pdf" }), fileName);
    console.log(`[PDF Generator] Descarga del expediente combinado iniciada.`);
  } catch (error) {
    console.error("Error generating PDF:", error);
    alert("Hubo un error al generar el PDF.");
  }
}

function descargar(blob: Blob, fileName: string) {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
}
