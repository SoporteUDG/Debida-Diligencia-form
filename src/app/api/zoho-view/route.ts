import { NextRequest, NextResponse } from "next/server";
import { verificarAccesoZoho, registrarTraspaso } from "@/lib/zohoViewAccess";

export const dynamic = "force-dynamic";

/**
 * Lo invoca el botón del Canvas (Deluge) justo antes de abrir el Web Tab de
 * consulta: deja preparado qué registro debe mostrar /view para ese usuario.
 *
 * Cuerpo: { recordId, user, ts, sig }  con sig = HMAC-SHA256(`${recordId}.${ts}`)
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(await request.text());
  } catch {
    // Deluge puede enviar el cuerpo como texto; si no es JSON se valida abajo.
  }

  const recordId = String(body.recordId || "").trim();
  const user = String(body.user || "").trim();
  const ts = String(body.ts || "").trim();
  const sig = String(body.sig || "").trim();

  if (!user) {
    return NextResponse.json({ success: false, error: "El campo 'user' es requerido" }, { status: 400 });
  }

  const acceso = verificarAccesoZoho({ recordId, ts, sig });
  if (!acceso.ok) {
    return NextResponse.json({ success: false, error: acceso.error }, { status: 401 });
  }

  registrarTraspaso(user, recordId);
  return NextResponse.json({ success: true });
}
