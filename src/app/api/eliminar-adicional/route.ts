import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { zoho } from "@/lib/zohoService";
import { BajaDDError } from "@/lib/ddRetireService";
import { bajaAdicional } from "@/lib/adicionalRetireService";

export const dynamic = "force-dynamic";

const STATUS = { NOT_FOUND: 404, BAD_REQUEST: 400, CONFLICT: 409, FORBIDDEN: 403 } as const;

function llaveValida(request: NextRequest): boolean | "sin-configurar" {
  const esperada = process.env.ZOHO_BUTTON_API_KEY;
  if (!esperada) return "sin-configurar";
  const recibida =
    request.headers.get("x-api-key") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const a = Buffer.from(recibida);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Baja de un expediente adicional desde el botón personalizado de Zoho CRM,
 * identificado por su token (el `token` de GET /api/generar-adicional, o la URL del enlace).
 *
 * - Adicional nunca enviado (borrador): se ELIMINA (carpeta, token, borrador y documentos).
 * - Adicional ya enviado: se ANULA (Form archivado, enlace vencido, carpeta a _Retirados);
 *   en ese caso `reason` es obligatorio (mínimo 10 caracteres).
 * El expediente principal y Zoho no se modifican.
 *
 * Misma seguridad que /api/eliminar-expediente: ZOHO_BUTTON_API_KEY + perfil de Zoho del usuario.
 *
 * Body: { token: string, userId: string, reason?: string }
 */
export async function POST(request: NextRequest) {
  console.log(`[API Eliminar Adicional] Solicitud recibida (x-api-key ${request.headers.get("x-api-key") ? "presente" : "ausente"}).`);
  const llave = llaveValida(request);
  if (llave === "sin-configurar") {
    console.error("[API Eliminar Adicional] Falta ZOHO_BUTTON_API_KEY: solicitud rechazada.");
    return NextResponse.json({ success: false, error: "Servicio no configurado" }, { status: 503 });
  }
  if (!llave) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  try {
    const { token, userId, reason } = await request.json().catch(() => ({}));
    if (!token || typeof token !== "string" || !userId || typeof userId !== "string") {
      return NextResponse.json({ success: false, error: "token y userId son requeridos" }, { status: 400 });
    }

    let user;
    try {
      user = await zoho.service.getUserProfile(userId);
    } catch (err) {
      console.error("[API Eliminar Adicional] No se pudo verificar el perfil del usuario en Zoho:", err);
      return NextResponse.json(
        { success: false, code: "PERFIL_NO_VERIFICABLE", error: "No se pudo verificar su perfil en Zoho. No se eliminó nada; avise a soporte." },
        { status: 502 }
      );
    }
    if (!user) {
      return NextResponse.json({ success: false, error: "Usuario de Zoho no encontrado o inactivo" }, { status: 403 });
    }

    const result = await bajaAdicional({
      token,
      reason: typeof reason === "string" ? reason : undefined,
      actor: user,
      ip: request.headers.get("x-forwarded-for"),
    });
    return NextResponse.json({
      ...result,
      message: result.action === "deleted" ? "Expediente adicional eliminado." : "Expediente adicional anulado.",
    });
  } catch (error: any) {
    if (error instanceof BajaDDError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: STATUS[error.code] }
      );
    }
    console.error("[API Eliminar Adicional Error]:", error);
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 });
  }
}
