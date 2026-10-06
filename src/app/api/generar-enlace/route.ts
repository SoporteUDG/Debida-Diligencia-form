import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { zoho, DD_CONTACT_FIELD } from "@/lib/zohoService";
import { logAuditEvent } from "@/lib/auditService";
import { crearEnlaceConBorrador, prepararExpedienteRelacionado } from "@/lib/enlaceService";
import { resolverContactoDeExpediente, SinContactoExpedienteError, type AccountContactRow } from "@/lib/accountContactService";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { message: "El endpoint de generación de enlaces ZDK está activo y listo." },
    { headers: corsHeaders }
  );
}

/**
 * Botón de cada expediente de Debida_Diligencia en Zoho: genera el enlace del
 * formulario y, si es de Persona Jurídica, el expediente de Persona Natural del
 * Representante Legal (DD_relacionado en ambos sentidos).
 *
 * - Requiere un Contact de Zoho asociado al expediente (natural y jurídica). Sin él: 422.
 * - Jurídica: antes de crear se valida en Zoho (DD_relacionado) y en Prisma (expediente
 *   local con su borrador o formulario) que el relacionado no exista ya.
 * - Si el enlace y, en la jurídica, el relacionado ya están creados: 409
 *   (ALREADY_EXISTS). Para extender un enlace existente se usa /api/reactivar.
 *
 * Body: { recordId (ID del expediente), tipo: "natural" | "juridica", modulo? }
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    console.log(`[API Generar Enlace ZDK] POST recibido. Content-Type: ${contentType}`);

    let body: any = {};
    if (contentType.includes("application/json")) {
      body = await request.json();
    } else {
      const text = await request.text();
      try {
        body = JSON.parse(text);
      } catch (e) {
        // Ignorar si no es JSON válido
      }
    }

    const { recordId, tipo = "natural", modulo = "Debida_Diligencia" } = body;

    if (!recordId) {
      return NextResponse.json(
        { success: false, error: "El ID del registro de Zoho CRM (recordId) es requerido" },
        { status: 400, headers: corsHeaders }
      );
    }

    const isNatural = (tipo || "").toString().toLowerCase().includes("jur") ? false : true;
    const formPath = isNatural ? "persona-natural" : "persona-juridica";
    const clientType = isNatural ? "NATURAL" : "JURIDICA";

    console.log(`[API Generar Enlace ZDK] Solicitud recibida para CRM ID: ${recordId}, Tipo: ${formPath}`);

    // 1. Expediente en Zoho (fuente de verdad): contacto, socio y relacionado
    const ddRecord = await zoho.service.getDDRecord(recordId);
    if (!ddRecord) {
      return NextResponse.json(
        { success: false, error: `No se encontró el expediente ${recordId} en Zoho CRM`, code: "NOT_FOUND" },
        { status: 404, headers: corsHeaders }
      );
    }

    // 2. Contact de Zoho: obligatorio para generar (natural y jurídica)
    let accountContact: AccountContactRow;
    try {
      accountContact = await resolverContactoDeExpediente({ ddCrmId: recordId, clientType, ddRecord });
    } catch (err) {
      if (err instanceof SinContactoExpedienteError) {
        return NextResponse.json(
          { success: false, error: err.message, code: "SIN_CONTACTO", crmId: recordId },
          { status: 422, headers: corsHeaders }
        );
      }
      throw err;
    }

    let crmData: any = {};
    try {
      crmData = await zoho.service.getContact(recordId);
    } catch (err) {
      console.warn(`[API Generar Enlace ZDK] No se obtuvo datos directos de CRM para ID ${recordId}:`, err);
    }

    const firstName = crmData.firstName || crmData.contactoNombre || "Cliente";
    const lastName = crmData.lastName || crmData.contactoApellido || "";
    const clientName = (firstName && lastName) ? `${firstName} ${lastName}`.trim() : (crmData.razonSocial || firstName || "Cliente UDG");
    const projectName = crmData.nombreProyecto || crmData.projectName;
    const rawEmail = crmData.email || crmData.contactoEmail || "";
    const email = rawEmail.trim() ? rawEmail.trim() : `cliente@udg.com`;

    // 3. Expediente local, vinculado al Contact de Zoho
    const socioLookup = ddRecord.Socio_de_Negocios ?? ddRecord.Socio_de_Negocio;
    const socioId = String((socioLookup && typeof socioLookup === "object" ? socioLookup.id : socioLookup) ?? "").trim() || undefined;

    let contact = await prisma.crmContact.findUnique({
      where: { crmId: recordId },
    });
    if (!contact) {
      contact = await prisma.crmContact.create({
        data: {
          crmId: recordId,
          firstName: isNatural ? firstName : clientName,
          lastName: isNatural ? lastName : "",
          email,
          accountCrmId: socioId,
          accountContactId: accountContact.id,
        },
      });
    } else if (contact.accountContactId !== accountContact.id) {
      contact = await prisma.crmContact.update({
        where: { id: contact.id },
        data: { accountContactId: accountContact.id, ...(socioId && !contact.accountCrmId ? { accountCrmId: socioId } : {}) },
      });
    }

    // 4. ¿Qué existe ya? Enlace principal (borrador) y, en la jurídica, el relacionado
    //    (Zoho: DD_relacionado; Prisma: su expediente local con borrador o formulario)
    const enlaceExistente = await prisma.draft.findFirst({
      where: { crmContactId: contact.id, isAditional: false },
      select: { id: true },
    });

    let relacionadoCompleto = false;
    if (!isNatural) {
      const relacionado = ddRecord.dd_relacionado ?? ddRecord.DD_relacionado ?? ddRecord.DD_Relacionado;
      const relatedCrmId = String((relacionado && typeof relacionado === "object" ? relacionado.id : relacionado) ?? "").trim();
      if (relatedCrmId && relatedCrmId !== recordId) {
        const local = await prisma.crmContact.findUnique({
          where: { crmId: relatedCrmId },
          select: { _count: { select: { drafts: true, forms: true } } },
        });
        relacionadoCompleto = !!local && local._count.drafts + local._count.forms > 0;
      }
    }

    if (enlaceExistente && (isNatural || relacionadoCompleto)) {
      return NextResponse.json(
        {
          success: false,
          status: "already_exists",
          code: "ALREADY_EXISTS",
          error: isNatural
            ? "El enlace de este expediente ya fue creado."
            : "El enlace y el expediente relacionado (Representante Legal) de este expediente ya fueron creados.",
          crmId: recordId,
        },
        { status: 409, headers: corsHeaders }
      );
    }

    // URL base del portal (enlace principal y enlace del relacionado)
    const host = request.headers.get("host") || "debida-diligencia.duckdns.org";
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

    // 5. Jurídica sin relacionado completo: expediente de Persona Natural (Representante Legal)
    // enlazado en ambos sentidos por DD_relacionado, con el mismo Contact de Zoho.
    // Si Zoho ya tenía el relacionado pero Prisma no, se reutiliza (no se crea otro en Zoho).
    let related: { crmId: string; clientUrl: string | null } | null = null;
    if (!isNatural && !relacionadoCompleto) {
      try {
        related = await prepararExpedienteRelacionado({
          juridicaCrmId: recordId,
          clientName,
          projectName,
          appUrl,
          socioId,
          accountContact,
        });
      } catch (relErr) {
        console.error(`[API Generar Enlace ZDK Warning] Error al crear el expediente natural relacionado de ${recordId}:`, relErr);
      }
    }

    // 6. Token de 30 días, URL del formulario y borrador (solo si no existía ya el enlace)
    let tokenUuid: string | null = null;
    let clientUrl: string | null = null;
    let expiresAt: Date | null = null;
    if (!enlaceExistente) {
      ({ tokenUuid, clientUrl, expiresAt } = await crearEnlaceConBorrador({
        contactId: contact.id,
        crmId: recordId,
        isNatural,
        appUrl,
        contactCrmId: accountContact.crmId,
        draftData: {
          crmContactId: recordId,
          nombreProyecto: projectName,
          ...(isNatural
            ? { firstName: crmData.firstName || "", lastName: crmData.lastName || "", email }
            : { razonSocial: clientName }),
          // Contact de Zoho del expediente (lookup Nombre_de_contacto): viaja en form.data
          [DD_CONTACT_FIELD]: accountContact.crmId,
        },
      }));
    }

    // 7. Sincronizar actualización directamente con Zoho CRM
    try {
      if (clientUrl && expiresAt) {
        const resolvedModule = crmData.module || modulo || "Debida_Diligencia";
        await zoho.service.updateClientFormLink(recordId, resolvedModule, clientUrl, expiresAt, "Activo");
      }

      await zoho.service.createNote(
        recordId,
        `Enlace Generado (${isNatural ? "Persona Natural" : "Persona Jurídica"})`,
        `Se ha generado un nuevo enlace de acceso desde Canva / Zoho CRM Canvas.\n\n` +
        `Tipo de Formulario: ${isNatural ? "Persona Natural" : "Persona Jurídica"}\n` +
        `Contacto: ${accountContact.firstName} ${accountContact.lastName} (${accountContact.crmId})\n` +
        (clientUrl && expiresAt
          ? `Enlace del Formulario: ${clientUrl}\n` +
            `Vigencia del Enlace: ${expiresAt.toLocaleString()}\n` +
            `Estado del Enlace: Activo\n`
          : "") +
        (related
          ? `Expediente Relacionado (Persona Natural): ${related.crmId}\n` +
            (related.clientUrl ? `Enlace del Relacionado: ${related.clientUrl}\n` : "")
          : "") +
        `Timestamp: ${new Date().toLocaleString()}`
      );
      console.log(`[API Generar Enlace ZDK] Zoho CRM actualizado exitosamente para ${recordId}.`);
    } catch (crmErr) {
      console.error(`[API Generar Enlace ZDK Warning] Error al actualizar Zoho CRM:`, crmErr);
    }

    // 8. Auditoría
    await logAuditEvent({
      action: "LINK_GENERATE_ZDK",
      entityName: "Token",
      entityId: tokenUuid ?? recordId,
      details: {
        crmId: recordId,
        type: clientType,
        clientUrl,
        contactCrmId: accountContact.crmId,
        ...(related ? { relatedCrmId: related.crmId, relatedClientUrl: related.clientUrl } : {}),
      },
    });

    return NextResponse.json(
      {
        success: true,
        status: "success",
        message: clientUrl
          ? `¡Enlace de ${isNatural ? "Persona Natural" : "Persona Jurídica"} generado exitosamente!`
          : "¡Expediente relacionado (Representante Legal) generado exitosamente!",
        clientUrl,
        expiresAt,
        contactId: accountContact.crmId,
        ...(related ? { relatedCrmId: related.crmId, relatedClientUrl: related.clientUrl } : {}),
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error("[API Generar Enlace ZDK Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error interno del servidor" },
      { status: 500, headers: corsHeaders }
    );
  }
}
