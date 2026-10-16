import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { listarTemporalesActivos } from "@/lib/temporalService";

export const dynamic = "force-dynamic";

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
 * Enlaces temporales activos (sin completar y sin vencer) para la lista del
 * widget "Generar temporal" (zoho_widget/generar-temporal).
 *
 * Seguridad: ZOHO_BUTTON_API_KEY, enviada por la Conexión "dd_portal".
 *
 * Respuesta: { success, temporales: [{ id, tipo, url, proyecto, unidad, createdBy, createdAt, expiresAt }] }
 * `url` es null en los temporales creados antes de guardarse el token.
 */
export async function POST(request: NextRequest) {
  const llave = llaveValida(request);
  if (llave === "sin-configurar") {
    console.error("[API Temporales] Falta ZOHO_BUTTON_API_KEY: solicitud rechazada.");
    return NextResponse.json({ success: false, error: "Servicio no configurado" }, { status: 503 });
  }
  if (!llave) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  try {
    const host = request.headers.get("host") || "debida-diligencia.duckdns.org";
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

    const temporales = await listarTemporalesActivos(appUrl);
    return NextResponse.json({ success: true, temporales });
  } catch (error: any) {
    console.error("[API Temporales Error]:", error);
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 });
  }
}
