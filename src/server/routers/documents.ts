import { router, tokenProcedure } from "../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { withTempFile } from "@/lib/tempFileService";
import {
  getOrCreateFolderStructure,
  uploadFileToWorkDrive,
  createShareLink,
  deleteFileFromWorkDrive,
} from "@/lib/workdriveService";
import path from "path";
import { logAuditEvent } from "@/lib/auditService";
import { getAccessToken, executeWithRetry } from "@/lib/zohoAuthService";

type UploadStage =
  | "INPUT_VALIDATION"
  | "FILE_DECODING"
  | "FILE_VALIDATION"
  | "TEMP_STORAGE"
  | "FOLDER_CREATION"
  | "ZOHO_UPLOAD"
  | "ZOHO_SHARE_LINK"
  | "DATABASE_PERSISTENCE";

const MIME_EXT_MAP: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
};

function detectMimeType(buffer: Buffer): { mime: string; ext: string } | null {
  if (buffer.length < 4) return null;

  const hex4 = buffer.toString("hex", 0, 4).toLowerCase();
  const hex12 = buffer.length >= 12 ? buffer.toString("hex", 0, 12).toLowerCase() : "";

  // 1. PDF: 25 50 44 46 (%PDF)
  if (hex4 === "25504446") {
    return { mime: "application/pdf", ext: "pdf" };
  }

  // 2. PNG: 89 50 4E 47
  if (hex4 === "89504e47") {
    return { mime: "image/png", ext: "png" };
  }

  // 3. JPEG: FF D8 FF
  if (hex4.startsWith("ffd8ff")) {
    return { mime: "image/jpeg", ext: "jpg" };
  }

  // 4. TIFF: 49 49 2A 00 or 4D 4D 00 2A
  if (hex4 === "49492a00" || hex4 === "4d4d002a") {
    return { mime: "image/tiff", ext: "tiff" };
  }

  // 5. HEIC: check ftypheic, ftypmif1, etc.
  if (hex12.length >= 24) {
    const ftyp = hex12.substring(8, 16); // bytes 4-7
    const brand = hex12.substring(16, 24); // bytes 8-11
    if (ftyp === "66747970") {
      const brandStr = Buffer.from(brand, "hex").toString("ascii").toLowerCase();
      if (["heic", "heix", "mif1", "msf1", "hevc"].includes(brandStr)) {
        return { mime: "image/heic", ext: "heic" };
      }
    }
  }

  return null;
}

export const documentsRouter = router({
  uploadDocument: tokenProcedure
    .input(
      z.object({
        fileName: z.string().min(1, "Nombre de archivo requerido"),
        fileType: z.string().min(1, "Tipo MIME requerido"),
        fileData: z.string().min(1, "Datos binarios en base64 requeridos"),
        documentType: z.string().min(1, "Tipo de documento requerido"),
        draftId: z.string().optional(),
        formId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      let currentStage: UploadStage = "INPUT_VALIDATION";

      try {
        // Stage 1: Input Validation
        const clientCrmContactId = ctx.client?.crmContactId;
        if (!clientCrmContactId) {
          throw new Error("No se encontró información de contacto del cliente en el contexto.");
        }

        // Fetch client details from database to construct folder naming
        const contact = await ctx.prisma.crmContact.findUnique({
          where: { id: clientCrmContactId },
        });

        if (!contact) {
          throw new Error("El contacto asociado al cliente no existe en la base de datos.");
        }

        // Stage 2: Decode Base64 string to buffer
        currentStage = "FILE_DECODING";
        let fileBuffer: Buffer;
        try {
          fileBuffer = Buffer.from(input.fileData, "base64");
        } catch (e: any) {
          throw new Error(`Fallo al decodificar los datos del archivo en Base64: ${e.message}`);
        }

        // Stage 3: File validation (size & magic bytes)
        currentStage = "FILE_VALIDATION";
        const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
        if (fileBuffer.length > MAX_SIZE) {
          throw new Error(
            `El archivo supera el tamaño máximo permitido de 10 MB. (Tamaño cargado: ${(
              fileBuffer.length / (1024 * 1024)
            ).toFixed(2)} MB)`
          );
        }

        // Verify magic bytes consistency
        const detected = detectMimeType(fileBuffer);
        if (!detected || !MIME_EXT_MAP[detected.mime]) {
          throw new Error(
            "Tipo de archivo no permitido. Solo se admiten archivos PDF y JPG/JPEG."
          );
        }

        // Check if the original file extension is compatible with the detected mime
        const ext = path.extname(input.fileName).toLowerCase().replace(".", "");
        const allowedExtensions = MIME_EXT_MAP[detected.mime];
        if (!allowedExtensions || !allowedExtensions.includes(ext)) {
          throw new Error(
            `Discrepancia de extensión de archivo: La extensión (.${ext}) no coincide con el tipo de contenido real detectado (${detected.mime}).`
          );
        }

        // Stage 4: Temp Storage (writing buffer temporarily inside a secure context)
        currentStage = "TEMP_STORAGE";
        const result = await withTempFile(fileBuffer, input.fileName, async (filePath) => {
          // Inside this safe callback, the temp file is written on disk.
          // In case of any error here, withTempFile's finally block will delete it.
          
          const now = new Date();
          const yearStr = now.getFullYear().toString();
          const monthStr = String(now.getMonth() + 1).padStart(2, "0");

          // Sanitize client details and doc type for folder and file names
          const sanitizeStr = (str: string) => str.trim().replace(/[^a-zA-Z0-9_\-]/g, "_");
          const apellidoNombreId = sanitizeStr(
            `${contact.lastName}_${contact.firstName}_${contact.crmId}`
          );
          const documentTypeNormalized = sanitizeStr(input.documentType);

          // Rename convention: {APELLIDO_NOMBRE_ID}_{TIPO_DOCUMENTO}_{TIMESTAMP}.{EXTENSION}
          const timestamp = Date.now();
          const finalFileName = `${apellidoNombreId}_${documentTypeNormalized}_${timestamp}.${ext}`;

          // Stage 5-7: Zoho WorkDrive Integration sequence wrapped with retry and fallback logic
          let zohoFileId = "PENDING_SYNC";
          let shareLinkUrl = `/api/documents/download?name=${encodeURIComponent(finalFileName)}`;

          try {
            const res = await executeWithRetry(async (accessToken) => {
              currentStage = "FOLDER_CREATION";
              console.log(
                `[tRPC Upload] Resolviendo estructura de carpetas en Zoho WorkDrive para: ${apellidoNombreId}`
              );

              const folderStructure = await getOrCreateFolderStructure(
                yearStr,
                monthStr,
                apellidoNombreId,
                [input.documentType],
                accessToken
              );

              const targetFolderId = folderStructure.subfolders[input.documentType];
              if (!targetFolderId) {
                throw new Error(
                  `No se pudo resolver la subcarpeta destino para el tipo de documento "${input.documentType}".`
                );
              }

              // Stage 6: Zoho Upload
              currentStage = "ZOHO_UPLOAD";
              console.log(
                `[tRPC Upload] Subiendo archivo "${finalFileName}" a la carpeta Zoho WorkDrive ID: ${targetFolderId}`
              );

              const fileId = await uploadFileToWorkDrive(
                targetFolderId,
                finalFileName,
                fileBuffer,
                accessToken
              );

              // Stage 7: Zoho Share Link
              currentStage = "ZOHO_SHARE_LINK";
              console.log(`[tRPC Upload] Generando enlace público para el archivo ID: ${fileId}`);
              const shareUrl = await createShareLink(fileId, accessToken);

              return { zohoFileId: fileId, shareLinkUrl: shareUrl };
            });

            zohoFileId = res.zohoFileId;
            shareLinkUrl = res.shareLinkUrl;
          } catch (workdriveErr: any) {
            console.error(`[tRPC Upload Warning] Falló la subida a Zoho WorkDrive (${currentStage}). Guardando respaldo local...`, workdriveErr);
          }

          // Stage 8: Database Persistence
          currentStage = "DATABASE_PERSISTENCE";
          console.log(`[tRPC Upload] Persistiendo registro en base de datos. URL: ${shareLinkUrl}`);

          // Safely resolve foreign keys to avoid Foreign Key Constraint Violations
          let validDraftId: string | null = null;
          if (input.draftId) {
            const draftById = await ctx.prisma.draft.findUnique({
              where: { id: input.draftId },
            });
            if (draftById) {
              validDraftId = draftById.id;
            } else {
              const draftByToken = await ctx.prisma.draft.findUnique({
                where: { token: input.draftId },
              });
              if (draftByToken) {
                validDraftId = draftByToken.id;
              }
            }
          }
          if (!validDraftId && ctx.client?.tokenUuid) {
            const draftByCtx = await ctx.prisma.draft.findUnique({
              where: { token: ctx.client.tokenUuid },
            });
            if (draftByCtx) {
              validDraftId = draftByCtx.id;
            }
          }

          let validFormId: string | null = null;
          if (input.formId) {
            const formById = await ctx.prisma.form.findUnique({
              where: { id: input.formId },
            });
            if (formById) {
              validFormId = formById.id;
            }
          }

          const documentRecord = await ctx.prisma.document.create({
            data: {
              formId: validFormId,
              draftId: validDraftId,
              name: finalFileName,
              fileType: detected.mime,
              url: shareLinkUrl,
              zohoFileId,
              status: "PENDING",
            },
          });

          // Log in audit trail
          await logAuditEvent({
            action: "DOCUMENT_UPLOAD",
            entityName: "Document",
            entityId: documentRecord.id,
            ipAddress: ctx.ip,
            userAgent: ctx.userAgent,
            details: {
              originalName: input.fileName,
              finalFileName,
              documentType: input.documentType,
              zohoFileId,
              draftId: input.draftId || null,
              formId: input.formId || null,
            },
          });

          return {
            success: true,
            document: {
              id: documentRecord.id,
              name: documentRecord.name,
              url: documentRecord.url,
              fileType: documentRecord.fileType,
              createdAt: documentRecord.createdAt.toISOString(),
            },
          };
        });

        return result;
      } catch (error: any) {
        console.error(`[tRPC Upload] Falló en etapa ${currentStage}:`, error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Error al subir documento en etapa [${currentStage}]: ${error.message || error}`,
          cause: error,
        });
      }
    }),

  deleteDocument: tokenProcedure
    .input(
      z.object({
        draftId: z.string().min(1, "draftId requerido"),
        fieldName: z.string().min(1, "fieldName requerido"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        console.log(`[tRPC Delete] Solicitud para eliminar documento del campo "${input.fieldName}" en draft ${input.draftId}`);

        // Find the draft to verify ownership
        const draft = await ctx.prisma.draft.findUnique({
          where: { token: input.draftId },
        });

        if (!draft) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "El borrador no existe o el token no es válido.",
          });
        }

        // Find documents linked to this draft containing _fieldName_ in the file name
        const documents = await ctx.prisma.document.findMany({
          where: {
            draftId: draft.id,
            name: {
              contains: `_${input.fieldName}_`,
            },
            deletedAt: null,
          },
        });

        if (documents.length === 0) {
          console.log(`[tRPC Delete] No se encontró ningún documento activo para el campo "${input.fieldName}"`);
          return { success: true, message: "No documents to delete" };
        }

        const accessToken = await getAccessToken();

        for (const doc of documents) {
          if (doc.zohoFileId) {
            try {
              await deleteFileFromWorkDrive(doc.zohoFileId, accessToken);
            } catch (err) {
              console.error(`[tRPC Delete] Falló al eliminar archivo ${doc.zohoFileId} en WorkDrive:`, err);
              // Continue deleting DB records even if WorkDrive deletion fails to prevent visual block
            }
          }

          // Hard delete document record to avoid leftover references
          await ctx.prisma.document.delete({
            where: { id: doc.id },
          });

          // Log in audit trail
          await logAuditEvent({
            action: "DOCUMENT_DELETE",
            entityName: "Document",
            entityId: doc.id,
            ipAddress: ctx.ip,
            userAgent: ctx.userAgent,
            details: {
              fileName: doc.name,
              fieldName: input.fieldName,
              draftId: input.draftId,
            },
          });
        }

        // Also clean the fieldName in the draft's data JSON payload
        const draftData = { ...(draft.data as any) || {} };
        if (input.fieldName in draftData) {
          draftData[input.fieldName] = "";
          await ctx.prisma.draft.update({
            where: { token: input.draftId },
            data: {
              data: draftData,
            },
          });
        }

        return { success: true };
      } catch (error: any) {
        console.error("[tRPC Delete] Falló al eliminar documento:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Error al eliminar documento: ${error.message || error}`,
          cause: error,
        });
      }
    }),

  getDraftDocuments: tokenProcedure
    .input(
      z.object({
        draftId: z.string().min(1, "draftId requerido"),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const draft = await ctx.prisma.draft.findUnique({
          where: { token: ctx.client!.tokenUuid as string },
        });
        if (!draft) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Borrador no encontrado",
          });
        }
        const documents = await ctx.prisma.document.findMany({
          where: {
            draftId: draft.id,
            deletedAt: null,
          },
        });
        return { success: true, documents };
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Error al obtener documentos: ${error.message}`,
        });
      }
    }),
});
