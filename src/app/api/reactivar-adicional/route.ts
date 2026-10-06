import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { zoho } from "@/lib/zohoService";
import { BajaDDError } from "@/lib/ddRetireService";
import { reactivarAdicional } from "@/lib/adicionalRetireService";

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
 * Reactiva un expediente adicional ANULADO, identificado por su token (el que se
 * usó en /api/eliminar-adicional): devuelve su carpeta a la del expediente
 * principal, reabre el borrador y reactiva el enlace 30 días. No escribe en Zoho.
 * Misma seguridad que /api/eliminar-adicional.
 *
 * Body: { token: string, userId: string }
 */
export async function POST(request: NextRequest) {
  console.log(`[API Reactivar Adicional] Solicitud recibida (x-api-key ${request.headers.get("x-api-key") ? "presente" : "ausente"}).`);
  const llave = llaveValida(request);
  if (llave === "sin-configurar") {
    console.error("[API Reactivar Adicional] Falta ZOHO_BUTTON_API_KEY: solicitud rechazada.");
    return NextResponse.json({ success: false, error: "Servicio no configurado" }, { status: 503 });
  }
  if (!llave) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  try {
    const { token, userId } = await request.json().catch(() => ({}));
    if (!token || typeof token !== "string" || !userId || typeof userId !== "string") {
      return NextResponse.json({ success: false, error: "token y userId son requeridos" }, { status: 400 });
    }

    let user;
    try {
      user = await zoho.service.getUserProfile(userId);
    } catch (err) {
      console.error("[API Reactivar Adicional] No se pudo verificar el perfil del usuario en Zoho:", err);
      return NextResponse.json(
        { success: false, code: "PERFIL_NO_VERIFICABLE", error: "No se pudo verificar su perfil en Zoho. No se modificó nada; avise a soporte." },
        { status: 502 }
      );
    }
    if (!user) {
      return NextResponse.json({ success: false, error: "Usuario de Zoho no encontrado o inactivo" }, { status: 403 });
    }

    const result = await reactivarAdicional({ token, actor: user, ip: request.headers.get("x-forwarded-for") });
    return NextResponse.json({ ...result, message: "Expediente adicional reactivado." });
  } catch (error: any) {
    if (error instanceof BajaDDError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: STATUS[error.code] }
      );
    }
    console.error("[API Reactivar Adicional Error]:", error);
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 });
  }
}
