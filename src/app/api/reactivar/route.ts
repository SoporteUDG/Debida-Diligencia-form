import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { reactivateToken } from "@/lib/tokenService";
import { registrarAutorizacionEdicion } from "@/lib/formVersionService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  console.log(`[API Reactivar] GET recibido. Headers:`, Object.fromEntries(request.headers.entries()));
  return NextResponse.json({ message: "El endpoint de reactivación está activo y listo." });
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    console.log(`[API Reactivar] POST recibido. Content-Type: ${contentType}`);
    
    let body: any = {};
    if (contentType.includes("application/json")) {
      body = await request.json();
    } else {
      const text = await request.text();
      console.log(`[API Reactivar] POST body no es JSON (texto): ${text}`);
      try {
        body = JSON.parse(text);
      } catch (e) {
        // Ignorar
      }
    }
    
    // `responsable` identifica a quien autoriza la modificación desde Zoho CRM.
    // Se acepta también `responsible`/`usuario` por comodidad de la integración.
    const { recordId, motivo, reason } = body;
    const responsable = String(body.responsable || body.responsible || body.usuario || "").trim();
    const motivoCambio = String(motivo || reason || "").trim() || null;

    if (!recordId) {
      return NextResponse.json(
        { success: false, error: "El recordId de Zoho CRM es requerido" },
        { status: 400 }
      );
    }

    if (!responsable) {
      return NextResponse.json(
        {
          success: false,
          error:
            "El campo 'responsable' es requerido: identifica a quien autoriza la modificación del expediente.",
        },
        { status: 400 }
      );
    }

    console.log(`[API Reactivar] Solicitud recibida para CRM ID: ${recordId}`);

    // 1. Buscar el contacto local por su crmId y traer su último token
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
        { success: false, error: "No se encontró ningún token asociado para este expediente" },
        { status: 404 }
      );
    }

    // 2. Reactivar/Extender el token por 30 días
    const extension = await reactivateToken(latestToken.token, 30);
    if (!extension.success) {
      return NextResponse.json(
        { success: false, error: extension.error || "No se pudo reactivar el enlace" },
        { status: 500 }
      );
    }

    console.log(`[API Reactivar] Token ${latestToken.token} reactivado con éxito hasta: ${extension.newExpiresAt}`);

    // 3. Registrar el permiso de edición. Sin esta autorización el expediente
    //    enviado sigue bloqueado: reactivar el enlace permite abrirlo, pero es
    //    esta fila la que habilita sellar una versión nueva.
    const autorizacion = await registrarAutorizacionEdicion({
      crmContactId: contact.id,
      authorizedBy: responsable,
      reason: motivoCambio,
      tokenUuid: latestToken.token,
      expiresAt: extension.newExpiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    return NextResponse.json({
      success: true,
      status: "success",
      message: "¡Enlace reactivado exitosamente por 30 días!",
      expiresAt: extension.newExpiresAt,
      authorizationId: autorizacion.id,
      responsable,
      motivo: motivoCambio,
    });
  } catch (err: any) {
    console.error("[API Reactivar Error]:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}
