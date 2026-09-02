import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateToken } from "@/lib/tokenService";
import { zoho } from "@/lib/zohoService";
import { logAuditEvent } from "@/lib/auditService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return NextResponse.json({ message: "El endpoint de generación de enlaces ZDK está activo y listo." });
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

    const clientName = crmData.name || crmData.razonSocial || "Cliente UDG";
    const projectName = crmData.projectName || "Altos del Parque";
    const email = crmData.email || "cliente@udg.com";

    if (!contact) {
      contact = await prisma.crmContact.create({
        data: {
          crmId: recordId,
          firstName: isNatural ? (crmData.firstName || clientName) : clientName,
          lastName: isNatural ? (crmData.lastName || "") : "",
          email,
        },
      });
      console.log(`[API Generar Enlace ZDK] Contacto local creado con ID: ${contact.id}`);
    }

    // 2. Generar un nuevo token de 30 días
    const tokenUuid = await generateToken(contact.id, "ACCESS", 30);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // 3. Construir la URL del formulario
    const host = request.headers.get("host") || "debida-diligencia.duckdns.org";
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
    const clientUrl = `${appUrl}/${formPath}?token=${tokenUuid}`;

    // 4. Crear o actualizar borrador
    await prisma.draft.upsert({
      where: { token: tokenUuid },
      create: {
        token: tokenUuid,
        type: isNatural ? "NATURAL" : "JURIDICA",
        data: {
          crmContactId: recordId,
          nombreProyecto: projectName,
          ...(isNatural
            ? { firstName: crmData.firstName || "", lastName: crmData.lastName || "", email }
            : { razonSocial: clientName, contactoEmail: email }),
        },
      },
      update: {
        updatedAt: new Date(),
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
      },
    });

    return NextResponse.json({
      success: true,
      status: "success",
      message: `¡Enlace de ${isNatural ? "Persona Natural" : "Persona Jurídica"} generado exitosamente!`,
      clientUrl,
      expiresAt,
    });
  } catch (error: any) {
    console.error("[API Generar Enlace ZDK Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}
