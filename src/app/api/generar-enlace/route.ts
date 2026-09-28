import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateToken } from "@/lib/tokenService";
import { zoho } from "@/lib/zohoService";
import { logAuditEvent } from "@/lib/auditService";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * Genera un token de acceso de 30 días para el contacto, construye la URL del
 * formulario y crea su borrador. El borrador queda vinculado al contacto
 * (Draft.crmContactId) para que el autocompletado del expediente relacionado
 * lo encuentre al enviarse el otro formulario.
 */
async function crearEnlaceConBorrador(params: {
  contactId: string;
  isNatural: boolean;
  appUrl: string;
  draftData: Record<string, any>;
}): Promise<{ tokenUuid: string; clientUrl: string; expiresAt: Date }> {
  const tokenUuid = await generateToken(params.contactId, "ACCESS", 30);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const formPath = params.isNatural ? "persona-natural" : "persona-juridica";
  const clientUrl = `${params.appUrl}/${formPath}?token=${tokenUuid}`;

  await prisma.draft.upsert({
    where: { token: tokenUuid },
    create: {
      token: tokenUuid,
      type: params.isNatural ? "NATURAL" : "JURIDICA",
      crmContactId: params.contactId,
      data: params.draftData,
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
 */
async function prepararExpedienteRelacionado(params: {
  juridicaCrmId: string;
  clientName: string;
  projectName?: string;
  appUrl: string;
}): Promise<{ crmId: string; clientUrl: string | null }> {
  const { juridicaCrmId, clientName, projectName, appUrl } = params;
  const esSimulado = juridicaCrmId.startsWith("mock-") || juridicaCrmId === "simulated-crm-contact-id";

  // 1. Expediente relacionado existente (enlace regenerado)
  let relatedCrmId: string | null = null;
  if (!esSimulado) {
    try {
      relatedCrmId = await zoho.service.getRelatedDDId(juridicaCrmId);
    } catch (err) {
      console.warn(`[API Generar Enlace ZDK] No se pudo leer DD_relacionado de ${juridicaCrmId}:`, err);
    }
  }

  // 2. Crear el expediente natural en Zoho, ya apuntando al jurídico
  if (!relatedCrmId || relatedCrmId === juridicaCrmId) {
    // Mismo Socio de Negocio que el jurídico (define el Name y la carpeta de documentos)
    let socioId: string | undefined;
    if (!esSimulado) {
      try {
        socioId = (await zoho.service.getSocioDocumentsLink(juridicaCrmId)).socioId || undefined;
      } catch (err) {
        console.warn(`[API Generar Enlace ZDK] No se pudo leer el Socio de Negocio de ${juridicaCrmId}:`, err);
      }
    }

    const created = await zoho.service.createDebidaDiligenciaRecord({
      accountCrmId: socioId,
      clientType: "NATURAL",
      name: `Representante Legal ${clientName}`,
      projectName,
      relatedDDId: juridicaCrmId,
    });
    if (!created.debidaId) throw new Error("Zoho CRM no devolvió el ID del expediente natural creado");
    relatedCrmId = created.debidaId;
    console.log(`[API Generar Enlace ZDK] Expediente natural ${relatedCrmId} creado para el jurídico ${juridicaCrmId}.`);
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
    console.log(`[API Generar Enlace ZDK] El expediente relacionado ${relatedCrmId} ya fue completado; no se genera enlace.`);
    return { crmId: relatedCrmId, clientUrl: null };
  }

  // 5. Token, URL y borrador del relacionado
  const { clientUrl, expiresAt } = await crearEnlaceConBorrador({
    contactId: relatedContact.id,
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
    console.error(`[API Generar Enlace ZDK Warning] Error al actualizar el enlace del relacionado ${relatedCrmId}:`, crmErr);
  }

  return { crmId: relatedCrmId, clientUrl };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { message: "El endpoint de generación de enlaces ZDK está activo y listo." },
    { headers: corsHeaders }
  );
}

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
        { status: 400 }
      );
    }

    const isNatural = (tipo || "").toString().toLowerCase().includes("jur") ? false : true;
    const formPath = isNatural ? "persona-natural" : "persona-juridica";

    console.log(`[API Generar Enlace ZDK] Solicitud recibida para CRM ID: ${recordId}, Tipo: ${formPath}`);

    // 1. Buscar o crear el contacto local por su crmId
    let contact = await prisma.crmContact.findUnique({
      where: { crmId: recordId },
    });

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

    if (!contact) {
      contact = await prisma.crmContact.create({
          data: {
            crmId: recordId,
            firstName: isNatural ? firstName : clientName,
            lastName: isNatural ? lastName : "",
            email,
          },
        });
    }

    // URL base del portal (enlace principal y enlace del relacionado)
    const host = request.headers.get("host") || "debida-diligencia.duckdns.org";
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

    // 1.5 Crear registro relacionado si juridica: expediente de Persona Natural
    // (Representante Legal) enlazado en ambos sentidos por DD_relacionado.
    let related: { crmId: string; clientUrl: string | null } | null = null;
    if (!isNatural) {
      try {
        related = await prepararExpedienteRelacionado({
          juridicaCrmId: recordId,
          clientName,
          projectName,
          appUrl,
        });
      } catch (relErr) {
        console.error(`[API Generar Enlace ZDK Warning] Error al crear el expediente natural relacionado de ${recordId}:`, relErr);
      }
    }

    // 2-4. Token de 30 días, URL del formulario y borrador
    const { tokenUuid, clientUrl, expiresAt } = await crearEnlaceConBorrador({
      contactId: contact.id,
      isNatural,
      appUrl,
      draftData: {
        crmContactId: recordId,
        nombreProyecto: projectName,
        ...(isNatural
          ? { firstName: crmData.firstName || "", lastName: crmData.lastName || "", email }
          : { razonSocial: clientName }),
      },
    });

    // 5. Sincronizar actualización directamente con Zoho CRM
    try {
      const resolvedModule = crmData.module || modulo || "Debida_Diligencia";
      await zoho.service.updateClientFormLink(recordId, resolvedModule, clientUrl, expiresAt, "Activo");
      
      await zoho.service.createNote(
        recordId,
        `Enlace Generado (${isNatural ? "Persona Natural" : "Persona Jurídica"})`,
        `Se ha generado un nuevo enlace de acceso desde Canva / Zoho CRM Canvas.\n\n` +
        `Tipo de Formulario: ${isNatural ? "Persona Natural" : "Persona Jurídica"}\n` +
        `Enlace del Formulario: ${clientUrl}\n` +
        `Vigencia del Enlace: ${expiresAt.toLocaleString()}\n` +
        `Estado del Enlace: Activo\n` +
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

    // 6. Auditoría
    await logAuditEvent({
      action: "LINK_GENERATE_ZDK",
      entityName: "Token",
      entityId: tokenUuid,
      details: {
        crmId: recordId,
        type: isNatural ? "NATURAL" : "JURIDICA",
        clientUrl,
        ...(related ? { relatedCrmId: related.crmId, relatedClientUrl: related.clientUrl } : {}),
      },
    });

    return NextResponse.json(
      {
        success: true,
        status: "success",
        message: `¡Enlace de ${isNatural ? "Persona Natural" : "Persona Jurídica"} generado exitosamente!`,
        clientUrl,
        expiresAt,
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
