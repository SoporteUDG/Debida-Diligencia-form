import { NextRequest, NextResponse } from "next/server";
import { procesarCambioZoho } from "@/lib/zohoChangeService";

export const dynamic = "force-dynamic";

/**
 * Webhook del workflow de Zoho CRM "al editar Debida_Diligencia".
 *
 * Parámetros (JSON, form-urlencoded o query string):
 *  - recordId: ID del registro de Debida_Diligencia (requerido)
 *  - usuario:  usuario de Zoho que hizo el cambio, p. ej. ${Debida_Diligencia.Modified By}
 *              (también se acepta `responsable` / `modifiedBy`)
 *  - secret:   si ZOHO_WEBHOOK_SECRET está definido, debe coincidir (o enviarse
 *              en la cabecera x-webhook-secret)
 */
export async function GET() {
  return NextResponse.json({ message: "El endpoint de cambios de Zoho CRM está activo y listo." });
}

async function leerParametros(request: NextRequest): Promise<Record<string, string>> {
  const params: Record<string, string> = Object.fromEntries(request.nextUrl.searchParams.entries());
  const contentType = request.headers.get("content-type") || "";
  const texto = await request.text();
  if (!texto) return params;

  if (contentType.includes("application/x-www-form-urlencoded")) {
    return { ...params, ...Object.fromEntries(new URLSearchParams(texto).entries()) };
  }
  try {
    const body = JSON.parse(texto);
    return body && typeof body === "object" ? { ...params, ...body } : params;
  } catch {
    return params;
  }
}

export async function POST(request: NextRequest) {
  try {
    const params = await leerParametros(request);

    const secreto = process.env.ZOHO_WEBHOOK_SECRET;
    if (secreto && (request.headers.get("x-webhook-secret") || params.secret) !== secreto) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    const recordId = String(params.recordId || params.id || "").trim();
    if (!recordId) {
      return NextResponse.json(
        { success: false, error: "El recordId de Zoho CRM es requerido" },
        { status: 400 }
      );
    }
    const usuario = String(params.usuario || params.responsable || params.modifiedBy || "").trim() || null;

    const resultado = await procesarCambioZoho(recordId, usuario);
    console.log(`[API Zoho Cambios] ${recordId}: ${resultado.estado}${resultado.motivo ? ` (${resultado.motivo})` : ""}`);

    return NextResponse.json({ success: true, ...resultado });
  } catch (error: any) {
    console.error("[API Zoho Cambios Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}
