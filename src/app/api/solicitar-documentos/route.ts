import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { reactivateToken, signUuid } from "@/lib/tokenService";
import { zoho } from "@/lib/zohoService";
import { logAuditEvent } from "@/lib/auditService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  console.log(`[API Solicitar Docs] GET recibido. Headers:`, Object.fromEntries(request.headers.entries()));
  return NextResponse.json({ message: "El endpoint de solicitud de documentos está activo y listo." });
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    console.log(`[API Solicitar Docs] POST recibido. Content-Type: ${contentType}`);

    let body: any = {};
    if (contentType.includes("application/json")) {
      body = await request.json();
    } else {
      const text = await request.text();
      console.log(`[API Solicitar Docs] POST body no es JSON (texto): ${text}`);
      try {
        body = JSON.parse(text);
      } catch (e) {
        // Ignorar
      }
    }

    const { recordId } = body;

    if (!recordId) {
      return NextResponse.json(
        { success: false, error: "Se requiere el recordId del CRM" },
        { status: 400 }
      );
    }

    console.log(`[API Solicitar Docs] Solicitud recibida para CRM ID: ${recordId}`);

    // 1. Buscar el contacto local por su crmId
    const contact = await prisma.crmContact.findUnique({
      where: { crmId: recordId },
      include: {
        tokens: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: "No se encontró ningún expediente local para este ID de CRM" },
        { status: 404 }
      );
    }

    const latestToken = contact.tokens[0];
    if (!latestToken) {
      return NextResponse.json(
        { success: false, error: "No se ha generado ningún enlace para este expediente" },
        { status: 404 }
      );
    }

    // 2. Reactivar el token (utilizando la función de tokenService que también sincroniza vigencia y estado en Zoho)
    const reactivation = await reactivateToken(latestToken.token, 30);
    if (!reactivation.success) {
      return NextResponse.json(
        { success: false, error: reactivation.error || "Error al reactivar el enlace" },
        { status: 500 }
      );
    }

    // 3. Resetear el estado del borrador asociado a este token
    const draft = await prisma.draft.findUnique({
      where: { token: latestToken.token },
    });

    if (draft) {
      const draftData = (draft.data || {}) as Record<string, any>;
      
      // Cambiar completed a false para que el formulario vuelva a ser editable y permita reenvío
      draftData.completed = false;
      delete draftData.submittedFormId;

      await prisma.draft.update({
        where: { id: draft.id },
        data: {
          data: draftData,
          updatedAt: new Date(),
        },
      });
      console.log(`[API Solicitar Docs] Borrador ${draft.id} restablecido a estado no completado.`);
    }

    // 4. Crear una nota en Zoho CRM notificando la reactivación por documentos faltantes
    try {
      const crmData = await zoho.service.getContact(contact.crmId);
      const resolvedModule = crmData.module || "Contacts";
      
      await zoho.service.createNote(
        contact.crmId,
        "Solicitud de Documentos Faltantes",
        `Se ha iniciado una solicitud de documentos faltantes desde Zoho CRM.\n\n` +
        `El enlace de acceso del cliente ha sido reactivado por 30 días adicionales.\n` +
        `Vigencia nueva: ${reactivation.newExpiresAt?.toLocaleString()}\n` +
        `Estado del enlace en CRM: Activo\n` +
        `Timestamp: ${new Date().toLocaleString()}`
      );
      console.log(`[API Solicitar Docs] Nota creada en Zoho CRM para el registro ${recordId}.`);
    } catch (crmErr) {
      console.error(`[API Solicitar Docs Warning] Error al registrar nota en Zoho CRM:`, crmErr);
    }

    // 5. Registrar evento de auditoría
    await logAuditEvent({
      action: "DRAFT_RESET",
      entityName: "Draft",
      entityId: draft?.id || "N/A",
      details: {
        crmId: recordId,
        tokenUuid: latestToken.token,
      },
    });

    const isNatural = draft ? draft.type === "NATURAL" : true;
    const formPath = isNatural ? "persona-natural" : "persona-juridica";
    const host = request.headers.get("host") || "localhost:3000";
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
    
    // Construct signed or short token URL
    const signedToken = latestToken.token.length === 14 
      ? latestToken.token 
      : `${latestToken.token}.${signUuid(latestToken.token)}`;
    const clientUrl = `${appUrl}/${formPath}?token=${signedToken}`;

    return NextResponse.json({
      success: true,
      message: "Solicitud procesada con éxito. Enlace reactivado y borrador abierto para edición.",
      clientUrl,
    });

  } catch (error: any) {
    console.error("[API Solicitar Docs Error] Error procesando solicitud:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}
