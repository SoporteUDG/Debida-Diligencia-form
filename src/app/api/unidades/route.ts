import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { zoho } from "@/lib/zohoService";

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
 * Unidades para el lookup "Unidad" del botón "Generar temporal" (vista de
 * lista de Zoho CRM): los registros del módulo al que apunta
 * Accounts.Unidad_Vendida1, filtrados por proyecto.
 *
 * Seguridad: ZOHO_BUTTON_API_KEY, enviada por la Conexión "dd_portal".
 *
 * Body: { proyecto?: string }  →  { success, unidades: [{ id, name }] }
 */
export async function POST(request: NextRequest) {
  const llave = llaveValida(request);
  if (llave === "sin-configurar") {
    console.error("[API Unidades] Falta ZOHO_BUTTON_API_KEY: solicitud rechazada.");
    return NextResponse.json({ success: false, error: "Servicio no configurado" }, { status: 503 });
  }
  if (!llave) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const proyecto = typeof body.proyecto === "string" ? body.proyecto.trim() : "";
    const unidades = await zoho.service.getUnidades(proyecto || undefined);
    return NextResponse.json({ success: true, unidades });
  } catch (error: any) {
    console.error("[API Unidades Error]:", error);
    return NextResponse.json({ success: false, error: "No se pudieron leer las unidades de Zoho" }, { status: 502 });
  }
}
