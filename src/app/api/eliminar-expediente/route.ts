import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { zoho } from "@/lib/zohoService";
import { eliminarDDNoEnviado, BajaDDError } from "@/lib/ddRetireService";

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
 * Solicitud de eliminación de un expediente desde el botón personalizado de
 * Zoho CRM (Debida_Diligencia). Un expediente sin formularios enviados se
 * ELIMINA; si ya tiene alguno enviado (principal o adicional) se ANULA
 * (reversible, `action: "retired"`; el motivo por defecto lo arma el servicio).
 *
 * Seguridad:
 * 1. La llamada debe traer ZOHO_BUTTON_API_KEY. El botón la envía por una
 *    Conexión de Zoho, de modo que la llave no queda visible en el navegador.
 * 2. El perfil del usuario se lee de Zoho con su ID, no se acepta lo que diga el
 *    cliente: debe ser "Gerente Gestión Inmobiliaria" o "Administrador".
 *
 * Body: { crmId: string, userId: string, reason?: string }
 */
export async function POST(request: NextRequest) {
  // Primer registro, antes de validar nada: confirma que la solicitud de Zoho llega
  console.log(`[API Eliminar Expediente] Solicitud recibida (x-api-key ${request.headers.get("x-api-key") ? "presente" : "ausente"}).`);
  const llave = llaveValida(request);
  if (llave === "sin-configurar") {
    console.error("[API Eliminar Expediente] Falta ZOHO_BUTTON_API_KEY: solicitud rechazada.");
    return NextResponse.json({ success: false, error: "Servicio no configurado" }, { status: 503 });
  }
  if (!llave) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  try {
    const { crmId, userId, reason } = await request.json().catch(() => ({}));
    if (!crmId || typeof crmId !== "string" || !userId || typeof userId !== "string") {
      return NextResponse.json({ success: false, error: "crmId y userId son requeridos" }, { status: 400 });
    }

    let user;
    try {
      user = await zoho.service.getUserProfile(userId);
    } catch (err) {
      console.error("[API Eliminar Expediente] No se pudo verificar el perfil del usuario en Zoho:", err);
      return NextResponse.json(
        { success: false, code: "PERFIL_NO_VERIFICABLE", error: "No se pudo verificar su perfil en Zoho. No se eliminó nada; avise a soporte." },
        { status: 502 }
      );
    }
    if (!user) {
      return NextResponse.json({ success: false, error: "Usuario de Zoho no encontrado o inactivo" }, { status: 403 });
    }

    const result = await eliminarDDNoEnviado({
      crmId,
      reason: typeof reason === "string" ? reason : undefined,
      actor: user,
      ip: request.headers.get("x-forwarded-for"),
    });
    return NextResponse.json({
      ...result,
      message: result.action === "retired" ? "Expediente anulado." : "Expediente eliminado.",
    });
  } catch (error: any) {
    if (error instanceof BajaDDError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: STATUS[error.code] }
      );
    }
    console.error("[API Eliminar Expediente Error]:", error);
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 });
  }
}
