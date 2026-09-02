import { router, publicProcedure, tokenProcedure, adminProcedure } from "../trpc";
import { z } from "zod";
import { reactivateToken, generateToken, signUuid, revokeToken } from "@/lib/tokenService";
import { documentsRouter } from "./documents";
import { naturalFormSchema, juridicaFormSchema } from "@/lib/validation";
import { syncFormToCrm } from "@/lib/crmSyncService";
import { TRPCError } from "@trpc/server";
import { logAuditEvent, computeDiff, sanitizeDetails } from "@/lib/auditService";
import { zoho, mergeCrmAndDraft } from "@/lib/zohoService";
import { sanitizeInput } from "@/lib/sanitizer";

/**
 * Passive scanning function to identify expired tokens, mark them as noted in the DB,
 * and record a note in Zoho CRM for compliance history tracking.
 */
async function checkAndLogExpiredTokens(prismaClient: any) {
  try {
    const expiredTokens = await prismaClient.token.findMany({
      where: {
        expiresAt: { lt: new Date() },
        used: false,
        expirationNoted: false,
      },
    });

    if (expiredTokens.length === 0) return;

    console.log(`[Expiration Tracker] Detectados ${expiredTokens.length} tokens expirados sin registrar en CRM.`);

    for (const token of expiredTokens) {
      try {
        // Mark as noted first to prevent race condition/duplicates
        await prismaClient.token.update({
          where: { token: token.token },
          data: { expirationNoted: true },
        });

        // Write note to Zoho CRM
        await zoho.service.createNote(
          token.crmContactId,
          "Enlace Expirado",
          `El enlace de acceso para el formulario de Debida Diligencia ha expirado.\n\n` +
          `Referencia de Token: ${token.token}\n` +
          `Fecha de Expiración: ${token.expiresAt.toLocaleString()}\n` +
          `Tipo de Formulario: ${token.type}\n` +
          `Actor: Sistema (Expiración automática)\n` +
          `Timestamp: ${new Date().toLocaleString()}\n` +
          `Resultado de Sincronización: Formulario expirado sin responder`
        );
        console.log(`[Expiration Tracker] Expiración de token ${token.token} registrada exitosamente en Zoho CRM.`);
      } catch (err) {
        console.error(`[Expiration Tracker Error] Falló al procesar expiración de token ${token.token}:`, err);
      }
    }
  } catch (error) {
    console.error("[Expiration Tracker Error] Error en barrido de tokens expirados:", error);
  }
}

export const appRouter = router({
  documents: documentsRouter,
  // 1. Public query (Accessible by anyone)
  hello: publicProcedure
    .input(
      z.object({
        name: z.string().optional(),
      }).optional()
    )
    .query(({ input, ctx }) => {
      return {
        greeting: `Hola, ${input?.name || "invitado"}!`,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        timestamp: new Date().toISOString(),
      };
    }),

  // 2. Client token-protected query (Requires valid client UUID.HMAC token)
  getClientInfo: tokenProcedure.query(async ({ ctx }) => {
    if (!ctx.client.crmContactId) {
      await logAuditEvent({
        action: "PORTAL_ACCESS",
        entityName: "Token",
        entityId: ctx.client.tokenUuid as string,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
        details: {
          crmContactId: null,
          clientType: ctx.client.type,
          firstName: "Invitado",
        },
      });

      return {
        success: true,
        client: {
          crmContactId: null,
          type: ctx.client.type,
          tokenUuid: ctx.client.tokenUuid,
          firstName: "Invitado",
          lastName: "",
          email: "",
        },
      };
    }

    let contact = await ctx.prisma.crmContact.findUnique({
      where: { id: ctx.client.crmContactId },
    });

    if (contact && contact.crmId) {
      try {
        const crmData = await zoho.service.getContact(contact.crmId);
        const firstName = crmData.type === "NATURAL" ? crmData.firstName : crmData.contactoNombre;
        const lastName = crmData.type === "NATURAL" ? crmData.lastName : crmData.contactoApellido;
        const email = crmData.type === "NATURAL" ? crmData.email : crmData.contactoEmail;

        contact = await ctx.prisma.crmContact.update({
          where: { id: ctx.client.crmContactId },
          data: {
            firstName: firstName || contact.firstName,
            lastName: lastName || contact.lastName,
            email: email || contact.email,
          },
        });
      } catch (err) {
        console.error(`[getClientInfo] Error al sincronizar caché de contacto desde Zoho CRM para crmId ${contact.crmId}:`, err);
      }
    }

    await logAuditEvent({
      action: "PORTAL_ACCESS",
      entityName: "Token",
      entityId: ctx.client.tokenUuid as string,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
      details: {
        crmContactId: ctx.client.crmContactId,
        clientType: ctx.client.type,
        firstName: contact?.firstName || "Desconocido",
      },
    });

    return {
      success: true,
      client: {
        crmContactId: ctx.client.crmContactId,
        type: ctx.client.type,
        tokenUuid: ctx.client.tokenUuid,
        firstName: contact?.firstName || "Desconocido",
        lastName: contact?.lastName || "",
        email: contact?.email || "",
      },
    };
  }),

  // 2.1 saveDraft (Client Token Protected): Save or update client progress draft
  saveDraft: tokenProcedure
    .input(
      z.object({
        data: z.any(),
        step: z.number().int().min(0),
        clientLastSavedAt: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Fetch existing draft to perform concurrency verification
      const existing = await ctx.prisma.draft.findUnique({
        where: { token: ctx.client!.tokenUuid as string },
      });

      // Concurrency control: if database draft is newer than what the client reports
      if (existing && input.clientLastSavedAt) {
        const dbTime = new Date(existing.updatedAt).getTime();
        const clientTime = new Date(input.clientLastSavedAt).getTime();
        
        // 1 second buffer to tolerate minor clock skews
        if (dbTime > clientTime + 1000) {
          return {
            success: false,
            conflict: true,
            message: "Conflicto de concurrencia: El borrador fue guardado con posterioridad desde otro dispositivo o pestaña.",
            data: existing.data,
            step: existing.step,
            updatedAt: existing.updatedAt.toISOString(),
          };
        }
      }

      // Upsert draft safely scoped to the validated token
      const draft = await ctx.prisma.draft.upsert({
        where: { token: ctx.client!.tokenUuid as string },
        update: {
          data: input.data || {},
          step: input.step,
          updatedAt: new Date(),
        },
        create: {
          token: ctx.client!.tokenUuid as string,
          type: ctx.client!.type as any, // NATURAL or JURIDICA
          data: input.data || {},
          step: input.step,
          crmContactId: ctx.client!.crmContactId || null,
        },
      });

      // Compute differences for audit trail
      const diff = computeDiff(existing?.data || {}, input.data || {});

      await logAuditEvent({
        action: "DRAFT_SAVE",
        entityName: "Draft",
        entityId: draft.id,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
        details: {
          step: input.step,
          diff,
        },
      });

      return {
        success: true,
        conflict: false,
        updatedAt: draft.updatedAt.toISOString(),
        draftId: draft.id,
      };
    }),

  getDraft: tokenProcedure.query(async ({ ctx }) => {
    // 1. Fetch existing draft
    const draft = await ctx.prisma.draft.findUnique({
      where: { token: ctx.client!.tokenUuid as string },
    });

    // 2. Fetch Zoho CRM contact ID if mapped to local CrmContact
    let crmId: string | null = null;
    if (ctx.client!.crmContactId) {
      const contact = await ctx.prisma.crmContact.findUnique({
        where: { id: ctx.client!.crmContactId },
      });
      if (contact) {
        crmId = contact.crmId;
      }
    }

    // 3. Retrieve pre-loaded details from Zoho CRM and merge them
    let mergedData: any = draft ? draft.data : {};
    if (crmId) {
      try {
        const crmData = await zoho.service.getContact(crmId);
        mergedData = mergeCrmAndDraft(crmData, mergedData);
      } catch (err) {
        console.error(`[getDraft] Error pre-loading details from Zoho CRM for ID ${crmId}:`, err);
      }
    }

    // 4. If draft does not exist, initialize it in the database
    if (!draft) {
      const newDraft = await ctx.prisma.draft.create({
        data: {
          token: ctx.client!.tokenUuid as string,
          type: ctx.client!.type as any,
          data: mergedData,
          step: 0,
          crmContactId: ctx.client!.crmContactId || null,
        },
      });

      return {
        success: true,
        exists: true,
        data: newDraft.data,
        step: newDraft.step,
        updatedAt: newDraft.updatedAt.toISOString(),
      };
    }

    // 5. If draft exists, update the merged data in the database
    const updatedDraft = await ctx.prisma.draft.update({
      where: { id: draft.id },
      data: {
        data: mergedData,
      },
    });

    return {
      success: true,
      exists: true,
      data: updatedDraft.data,
      step: updatedDraft.step,
      updatedAt: updatedDraft.updatedAt.toISOString(),
    };
  }),

  // 3. Admin-protected query (Requires valid admin ID.HMAC token and ADMIN/SUPERADMIN role)
  getAdminInfo: adminProcedure.query(({ ctx }) => {
    return {
      success: true,
      admin: ctx.admin,
    };
  }),

  // 4. Admin-protected mutation: Extend/Reactivate a client token
  reactivateClientToken: adminProcedure
    .input(
      z.object({
        tokenUuid: z.string().min(1, "Se requiere un token válido"),
        extendDays: z.number().int().min(1).default(30),
      })
    )
    .mutation(async ({ input }) => {
      const result = await reactivateToken(input.tokenUuid, input.extendDays);
      return result;
    }),

  // 4.1 Admin-protected mutation: Regenerate link (revoke old token, generate new, update Draft & Zoho)
  regenerateClientLink: adminProcedure
    .input(
      z.object({
        tokenUuid: z.string().min(1, "Se requiere un token válido"),
        expiresInDays: z.number().int().min(1).default(30),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // 1. Fetch the old token
      const oldToken = await ctx.prisma.token.findUnique({
        where: { token: input.tokenUuid },
      });

      if (!oldToken) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Token antiguo no encontrado",
        });
      }

      // 2. Revoke the old token
      await revokeToken(input.tokenUuid);

      // 3. Generate a new token for the same contact
      const signedToken = await generateToken(oldToken.crmContactId, oldToken.type, input.expiresInDays);
      const newTokenUuid = signedToken.split(".")[0];

      // 4. Find and update the associated Draft
      const draft = await ctx.prisma.draft.findUnique({
        where: { token: input.tokenUuid },
      });

      if (draft) {
        await ctx.prisma.draft.update({
          where: { id: draft.id },
          data: {
            token: newTokenUuid,
            updatedAt: new Date(),
          },
        });
      }

      // 5. Fetch local CrmContact to get crmId and query Zoho CRM module info
      const crmContact = await ctx.prisma.crmContact.findUnique({
        where: { id: oldToken.crmContactId },
      });

      let clientUrl = "";
      if (crmContact && crmContact.crmId) {
        const isNatural = draft?.type === "NATURAL";
        const formPath = isNatural ? "persona-natural" : "persona-juridica";
        const host = ctx.req.headers.get("host") || "localhost:3000";
        const protocol = ctx.req.headers.get("x-forwarded-proto") || "http";
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
        clientUrl = `${appUrl}/${formPath}?token=${signedToken}`;

        try {
          // Fetch the CRM record using getContact to resolve which module it lives in
          const crmData = await zoho.service.getContact(crmContact.crmId);
          const resolvedModule = crmData.module || "Contacts";

          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + input.expiresInDays);

          // Sync the new link back to Zoho CRM
          await zoho.service.updateClientFormLink(crmContact.crmId, resolvedModule, clientUrl, expiresAt, "Activo");
        } catch (err) {
          console.error(`[regenerateClientLink CRM Error] Falló actualización de enlace en Zoho para ${crmContact.crmId}:`, err);
        }
      }

      // 6. Log audit event
      await logAuditEvent({
        action: "LINK_REGENERATE",
        entityName: "Draft",
        entityId: draft?.id || null,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
        userId: ctx.admin?.id || null,
        details: sanitizeDetails({
          oldTokenUuid: input.tokenUuid,
          newTokenUuid,
          crmContactId: oldToken.crmContactId,
          clientUrl,
        }),
      });

      return {
        success: true,
        signedToken,
        clientUrl,
      };
    }),

  // 4.2 Admin-protected mutation: Send Client Reminder (re-pushes link to Zoho CRM to trigger emails/workflows)
  sendClientReminder: adminProcedure
    .input(
      z.object({
        tokenUuid: z.string().min(1, "Se requiere un token válido"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // 1. Fetch the token metadata
      const token = await ctx.prisma.token.findUnique({
        where: { token: input.tokenUuid },
      });

      if (!token) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Token no encontrado",
        });
      }

      // 2. Fetch local CrmContact
      const crmContact = await ctx.prisma.crmContact.findUnique({
        where: { id: token.crmContactId },
      });

      if (!crmContact || !crmContact.crmId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "El token no tiene un contacto de Zoho CRM asociado",
        });
      }

      // 2.1 Fetch associated Draft to check the type
      const draft = await ctx.prisma.draft.findUnique({
        where: { token: token.token },
      });

      if (!draft) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No se encontró ningún borrador asociado a este token",
        });
      }

      const isNatural = draft.type === "NATURAL";
      const formPath = isNatural ? "persona-natural" : "persona-juridica";
      const host = ctx.req.headers.get("host") || "localhost:3000";
      const protocol = ctx.req.headers.get("x-forwarded-proto") || "http";
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
      
      // Determine if short token (no dot) or legacy signed token
      const signedToken = token.token.length === 14 
        ? token.token 
        : `${token.token}.${signUuid(token.token)}`;
      const clientUrl = `${appUrl}/${formPath}?token=${signedToken}`;

      // 3. Fetch the CRM record using getContact to resolve which module it lives in
      const crmData = await zoho.service.getContact(crmContact.crmId);
      const resolvedModule = crmData.module || "Contacts";

      // 4. Re-push the link to Zoho CRM to trigger CRM workflows/emails
      const syncResult = await zoho.service.updateClientFormLink(crmContact.crmId, resolvedModule, clientUrl);
      if (!syncResult.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Error al actualizar Zoho CRM: " + syncResult.error,
        });
      }

      // 5. Log audit event
      await logAuditEvent({
        action: "LINK_REMINDER_SEND",
        entityName: "Token",
        entityId: token.token,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
        userId: ctx.admin?.id || null,
        details: sanitizeDetails({
          crmContactId: token.crmContactId,
          crmId: crmContact.crmId,
          module: resolvedModule,
        }),
      });

      return {
        success: true,
      };
    }),

  // Admin query: Retrieve all forms/submissions and drafts mapped into a unified layout
  getSubmissions: adminProcedure.query(async ({ ctx }) => {
    // Passive scan for expired tokens
    await checkAndLogExpiredTokens(ctx.prisma);

    // 1. Fetch submitted forms
    const forms = await ctx.prisma.form.findMany({
      orderBy: { submittedAt: "desc" },
      include: {
        crmSync: true,
        workDriveSync: true,
        sapSync: true,
        signature: true,
        legalRepresentative: true,
        gjcMembers: true,
        bfMembers: true,
        documents: true,
        crmContact: true,
      },
    });

    // 2. Fetch active drafts
    const drafts = await ctx.prisma.draft.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        crmContact: true,
        documents: true,
      },
    });

    const draftTokens = drafts.map((d: any) => d.token);
    const dbTokens = await ctx.prisma.token.findMany({
      where: { token: { in: draftTokens } },
    });
    const tokenMap = new Map<string, any>(dbTokens.map((t: any) => [t.token, t]));

    // 3. Map drafts into submission schema
    const mappedDrafts = drafts.map((draft: any) => {
      const draftData = (draft.data || {}) as any;
      const clientName = draft.crmContact
        ? `${draft.crmContact.firstName} ${draft.crmContact.lastName}`.trim()
        : (draftData.firstName || draftData.lastName
          ? `${draftData.firstName || ""} ${draftData.lastName || ""}`.trim()
          : draftData.razonSocial || "Cliente Pendiente");

      const tokenRecord = tokenMap.get(draft.token);

      return {
        id: draft.id,
        type: draft.type.toLowerCase(),
        status: "DRAFT", // Indicates pending client response
        clientName,
        projectName: draftData.nombreProyecto || draftData.projectName || "General UDG",
        conclusionesVerificacion: "",
        submittedAt: null, // Indicates not submitted yet
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt,
        data: {
          ...draftData,
          conclusionesVerificacion: "",
          documents: draft.documents,
          crmContact: draft.crmContact,
          isDraftRecord: true,
          token: `${draft.token}.${signUuid(draft.token)}`,
          tokenExpiresAt: tokenRecord?.expiresAt ? new Date(tokenRecord.expiresAt).toISOString() : null,
          tokenUsed: Boolean(tokenRecord?.used),
        },
      };
    });

    // 4. Map forms to make sure data payload includes all joined fields
    const mappedForms = forms.map((form: any) => ({
      id: form.id,
      type: form.type.toLowerCase(),
      status: form.status,
      clientName: form.clientName,
      projectName: form.projectName,
      conclusionesVerificacion: form.conclusionesVerificacion || "",
      submittedAt: form.submittedAt,
      createdAt: form.createdAt,
      updatedAt: form.updatedAt,
      data: {
        ...(form.data as any),
        conclusionesVerificacion: form.conclusionesVerificacion,
        crmSync: form.crmSync,
        workDriveSync: form.workDriveSync,
        sapSync: form.sapSync,
        signature: form.signature,
        legalRepresentative: form.legalRepresentative,
        gjcMembers: form.gjcMembers,
        bfMembers: form.bfMembers,
        documents: form.documents,
        crmContact: form.crmContact,
        isDraftRecord: false,
      },
    }));

    return [...mappedForms, ...mappedDrafts];
  }),

  // Admin mutation: Save verification conclusions for a submission
  updateConclusions: adminProcedure
    .input(
      z.object({
        formId: z.string().uuid(),
        conclusiones: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const updated = await ctx.prisma.form.update({
        where: { id: input.formId },
        data: {
          conclusionesVerificacion: sanitizeInput(input.conclusiones),
        },
      });
      return updated;
    }),

  // Admin mutation: Approve a client submission
  approveForm: adminProcedure
    .input(
      z.object({
        formId: z.string().uuid("ID de formulario inválido"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        console.log(`[tRPC Admin] Aprobando formulario con ID: ${input.formId}`);

        // Find the form first
        const form = await ctx.prisma.form.findUnique({
          where: { id: input.formId },
          include: { crmContact: true },
        });

        if (!form) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "El expediente no existe.",
          });
        }

        // Idempotency: check if already approved
        if (form.status === "APPROVED") {
          return { success: true, message: "El expediente ya se encuentra aprobado." };
        }

        // Update status in database
        const updatedForm = await ctx.prisma.form.update({
          where: { id: input.formId },
          data: {
            status: "APPROVED",
            updatedAt: new Date(),
          },
        });

        // Write note to Zoho CRM
        if (form.crmContact?.crmId) {
          try {
            const adminEmail = ctx.admin?.email || "Oficial de Cumplimiento";
            await zoho.service.createNote(
              form.crmContact.crmId,
              "Formulario Aprobado",
              `El formulario de Debida Diligencia ha sido aprobado por la Oficina de Cumplimiento UDG.\n\n` +
              `Referencia del Formulario: ${form.id}\n` +
              `Proyecto: ${form.projectName || "General UDG"}\n` +
              `Actor: ${adminEmail} (Oficial de Cumplimiento)\n` +
              `Timestamp: ${new Date().toLocaleString()}\n` +
              `Resultado de Sincronización: Expediente Evaluado y Aprobado`
            );
          } catch (noteErr) {
            console.error(`[tRPC Admin Warning] Error al escribir nota de aprobación en Zoho CRM:`, noteErr);
          }
        }

        // Log audit event
        await ctx.prisma.auditLog.create({
          data: {
            action: "FORM_APPROVE",
            entityName: "Form",
            entityId: form.id,
            ipAddress: ctx.ip,
            userAgent: ctx.userAgent,
            userId: ctx.admin?.id || null,
            details: {
              clientName: form.clientName,
              projectName: form.projectName,
              approvedBy: ctx.admin?.email || "System",
            },
          },
        });

        return { success: true, form: updatedForm };
      } catch (error: any) {
        console.error("[tRPC Admin Error] Falló al aprobar formulario:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Error al aprobar formulario: ${error.message || error}`,
          cause: error,
        });
      }
    }),

  // Admin query: Search Contacts and Leads from Zoho CRM
  searchCrmContacts: adminProcedure
    .input(
      z.object({
        query: z.string().min(1, "El término de búsqueda es requerido"),
      })
    )
    .query(async ({ input }) => {
      const results = await zoho.service.searchContacts(input.query);
      return results;
    }),

  // Admin mutation: Generate signed client link and register pending draft
  generateClientLink: adminProcedure
    .input(
      z.object({
        crmId: z.string().min(1, "El ID de CRM del contacto es requerido"),
        clientType: z.enum(["NATURAL", "JURIDICA"]),
        projectName: z.string().min(1, "El nombre del proyecto es requerido"),
        advisorName: z.string().min(1, "El nombre del asesor es requerido"),
        module: z.enum(["Contacts", "Leads", "Debida_Diligencia"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // 1. Fetch contact details from Zoho CRM to preload
      const crmData = await zoho.service.getContact(input.crmId);

      // 2. Resolve identity metadata based on natural vs corporate
      const isNatural = input.clientType === "NATURAL";
      const firstName = isNatural ? (crmData.firstName || "") : (crmData.contactoNombre || "");
      const lastName = isNatural ? (crmData.lastName || "") : (crmData.contactoApellido || "");
      const email = isNatural ? (crmData.email || "") : (crmData.contactoEmail || "");
      const phone = isNatural ? (crmData.celular || "") : (crmData.contactoTelefono || "");

      // 3. Upsert local CrmContact
      const localContact = await ctx.prisma.crmContact.upsert({
        where: { crmId: input.crmId },
        update: {
          firstName: firstName || "Pre-carga",
          lastName: lastName || "CRM",
          email: email || `${input.crmId}@crm.udg.com`,
          phone: phone || null,
        },
        create: {
          crmId: input.crmId,
          firstName: firstName || "Pre-carga",
          lastName: lastName || "CRM",
          email: email || `${input.crmId}@crm.udg.com`,
          phone: phone || null,
        },
      });

      // 4. Generate access token
      const signedToken = await generateToken(localContact.id, "ACCESS", 30);
      const tokenUuid = signedToken.split(".")[0];

      // 5. Construct initial pre-loaded form payload
      const initialPayload: any = {
        nombreProyecto: input.projectName,
        projectName: input.projectName,
        asesorAsignado: input.advisorName,
        firstName: firstName,
        lastName: lastName,
        email: email,
        celular: phone,
        idNumber: crmData.idNumber || crmData.contactoId || "",
        // Specific fields for Persona Jurídica Contact Person:
        contactoNombre: crmData.contactoNombre || firstName,
        contactoApellido: crmData.contactoApellido || lastName,
        contactoEmail: crmData.contactoEmail || email,
        contactoTelefono: crmData.contactoTelefono || phone,
        contactoId: crmData.contactoId || crmData.idNumber || "",
        razonSocial: crmData.razonSocial || "",
        numeroDocumento: crmData.numeroDocumento || "",
      };

      // 6. Create Draft in database
      const draft = await ctx.prisma.draft.create({
        data: {
          token: tokenUuid,
          type: input.clientType as any,
          crmContactId: localContact.id,
          step: 0,
          data: initialPayload,
        },
      });

      // 7. Log audit event
      await logAuditEvent({
        action: "LINK_GENERATE",
        entityName: "Draft",
        entityId: draft.id,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
        userId: ctx.admin?.id || null,
        details: sanitizeDetails({
          crmId: input.crmId,
          clientType: input.clientType,
          projectName: input.projectName,
          advisorName: input.advisorName,
          tokenUuid,
        }),
      });

      // 8. Construct public URL link
      const host = ctx.req.headers.get("host") || "localhost:3000";
      const protocol = ctx.req.headers.get("x-forwarded-proto") || "http";
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
      const formPath = isNatural ? "persona-natural" : "persona-juridica";
      const clientUrl = `${appUrl}/${formPath}?token=${signedToken}`;

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      // 9. Update Zoho CRM asynchronously in background
      zoho.service.updateClientFormLink(input.crmId, input.module, clientUrl, expiresAt, "Activo").catch((err) => {
        console.error(`[generateClientLink CRM Warning] Falló actualización de enlace en Zoho para ${input.crmId}:`, err);
      });

      return {
        success: true,
        signedToken,
        clientUrl,
        draftId: draft.id,
      };
    }),

  // 5. formDraft sub-router for submission
  formDraft: router({
    submitForm: tokenProcedure.mutation(async ({ ctx }) => {
      // 1. Fetch draft from database
      const draft = await ctx.prisma.draft.findUnique({
        where: { token: ctx.client!.tokenUuid as string },
      });

      if (!draft) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No se encontró ningún borrador asociado a esta sesión.",
        });
      }

      const draftData = (draft.data || {}) as any;

      // 2. Idempotency Check: If already submitted, return existing form ID
      if (draftData.completed) {
        return {
          success: true,
          alreadySubmitted: true,
          message: "El expediente ya ha sido completado y enviado anteriormente.",
          submissionId: draftData.submittedFormId,
        };
      }

      // 3. Perform final validation based on type
      const isNatural = draft.type === "NATURAL";
      const schema = isNatural ? naturalFormSchema : juridicaFormSchema;
      
      // Sanitizar recursivamente los inputs contra inyecciones XSS antes de validar y guardar
      const sanitizedDraftData = sanitizeInput(draftData);
      const validation = schema.safeParse(sanitizedDraftData);

      if (!validation.success) {
        const fieldErrors = validation.error.issues
          .map((issue) => `${issue.path.length ? issue.path.join(".") : "Campo"}: ${issue.message}`)
          .join(" | ");
        
        console.error("[Submit Form Zod Error] Borrador no pasó validación final:", fieldErrors, JSON.stringify(sanitizedDraftData));

        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Faltan campos obligatorios por completar: ${fieldErrors}`,
          cause: validation.error,
        });
      }

      const validatedData = validation.data as any;

      // 4. Run database persistence transaction
      const dbForm = await ctx.prisma.$transaction(async (tx: any) => {
        // Create the form
        const clientName = isNatural
          ? `${validatedData.firstName || ""} ${validatedData.lastName || ""}`.trim() || "Cliente Natural"
          : validatedData.razonSocial || "Empresa Registrada";

        const form = await tx.form.create({
          data: {
            type: draft.type,
            status: "SUBMITTED",
            clientName,
            projectName: validatedData.nombreProyecto || "General UDG",
            crmContactId: ctx.client!.crmContactId || null,
            data: validatedData as any,
            conclusionesVerificacion: validatedData.conclusionesVerificacion || null,
            submittedAt: new Date(),
            signature: {
              create: {
                signerName: validatedData.signerName,
                signatureDate: new Date(validatedData.signatureDate),
                firmaImage: validatedData.firmaImage,
              },
            },
            ...(isNatural
              ? {}
              : {
                  legalRepresentative: {
                    create: {
                      nombre: validatedData.rlNombre,
                      fechaNacimiento: validatedData.rlFechaNacimiento ? new Date(validatedData.rlFechaNacimiento) : null,
                      nacionalidad: validatedData.rlNacionalidad,
                      noIdentificacion: validatedData.rlNoIdentificacion,
                      profesionOcupacion: validatedData.rlProfesionOcupacion,
                      actividadEconomica: validatedData.rlActividadEconomica || null,
                      direccion: validatedData.rlDireccion || null,
                      paisResidencia: validatedData.rlPaisResidencia || null,
                      telefono: validatedData.rlTelefono || null,
                      objetoInvestigacion: validatedData.rlObjetoInvestigacion,
                    },
                  },
                  gjcMembers: {
                    create: (validatedData.gjcMembers || []).map((m: any) => ({
                      cargo: m.cargo,
                      nombre: m.nombre,
                      apellidos: m.apellidos,
                      nacionalidad: m.nacionalidad,
                      fechaNacimiento: m.fechaNacimiento ? new Date(m.fechaNacimiento) : null,
                      nroId: m.nroId,
                      direccion: m.direccion,
                    })),
                  },
                  bfMembers: {
                    create: (validatedData.bfMembers || []).map((m: any) => ({
                      nombreCompleto: m.nombreCompleto,
                      noIdentificacion: m.noIdentificacion,
                      nacionalidad: m.nacionalidad,
                      fechaAdquisicion: m.fechaAdquisicion ? new Date(m.fechaAdquisicion) : null,
                      porcentajeParticipacion: m.porcentajeParticipacion,
                      paisNacimiento: m.paisNacimiento,
                      direccion: m.direccion,
                    })),
                  },
                }),
          },
        });

        // Link existing uploaded Documents from draft to the newly created form
        await tx.document.updateMany({
          where: { draftId: draft.id },
          data: { formId: form.id },
        });

        // Initialize synchronization placeholders
        await tx.crmSync.create({
          data: {
            formId: form.id,
            status: "PENDING",
          },
        });

        await tx.workDriveSync.create({
          data: {
            formId: form.id,
            status: "PENDING",
          },
        });

        await tx.sapSync.create({
          data: {
            formId: form.id,
            status: "PENDING",
          },
        });

        // Update the draft to set completed: true and save the submittedFormId
        const updatedDraftData = {
          ...draftData,
          completed: true,
          submittedFormId: form.id,
        };

        await tx.draft.update({
          where: { id: draft.id },
          data: {
            data: updatedDraftData,
          },
        });

        // Create an audit log for form submission
        await tx.auditLog.create({
          data: {
            action: "FORM_SUBMIT",
            entityName: "Form",
            entityId: form.id,
            ipAddress: ctx.ip,
            userAgent: ctx.userAgent,
            userId: null,
            details: sanitizeDetails({
              type: draft.type,
              clientName,
              projectName: form.projectName,
            }),
          },
        });

        return form;
      });

      // 5. Revoke token if it is a database-backed token (i.e. not starting with "draft-")
      const rawToken = ctx.req.headers.get("authorization")?.replace("Bearer ", "") || ctx.req.headers.get("x-client-token");
      if (rawToken && !rawToken.startsWith("draft-")) {
        try {
          const parts = rawToken.split(".");
          const tokenUuid = parts.length === 2 ? parts[0] : rawToken;
          await ctx.prisma.token.update({
            where: { token: tokenUuid },
            data: { used: true, updatedAt: new Date() },
          });
        } catch (tokenErr) {
          console.error("[Submit Form] Error revoking access token:", tokenErr);
        }
      }

      // 6. Trigger Zoho CRM sync in the background asynchronously
      syncFormToCrm(dbForm.id).catch((syncErr) => {
        console.error(`[Submit Form Sync Warning] Error in CRM sync background promise for form ${dbForm.id}:`, syncErr);
      });

      return {
        success: true,
        alreadySubmitted: false,
        message: "Formulario enviado y persistido correctamente en la base de datos",
        submissionId: dbForm.id,
      };
    }),

    // 12. Consultar Cronología / Audit Trail del Expediente
    getAuditTrail: publicProcedure
      .input(
        z.object({
          formId: z.string(),
        })
      )
      .query(async ({ input, ctx }) => {
        const logs = await ctx.prisma.auditLog.findMany({
          where: {
            OR: [
              { entityId: input.formId },
              { entityId: { contains: input.formId } },
            ],
          },
          orderBy: { createdAt: "desc" },
        });

        return logs.map((log: any) => ({
          id: log.id,
          action: log.action,
          entityName: log.entityName,
          entityId: log.entityId,
          actor: log.userId ? `Usuario (${log.userId})` : "Cliente / Sistema",
          timestamp: log.createdAt.toISOString(),
          ipAddress: log.ipAddress || "-",
          details: log.details,
        }));
      }),
  }),
});

export type AppRouter = typeof appRouter;
