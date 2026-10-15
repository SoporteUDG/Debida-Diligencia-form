import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { zoho } from "@/lib/zohoService";
import { datosFormularioDesdeZoho } from "@/lib/zohoChangeService";
import { crearTemporal } from "@/lib/temporalService";

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

/** Valor de texto de un campo de Zoho (los lookups/picklists pueden venir como objeto). */
const texto = (v: any): string =>
  String((v && typeof v === "object" ? v.name ?? v.display_value ?? v.value : v) ?? "").trim();

/** unidad_vendida del botón: lookup { id, name } (o solo el id). null sin id. */
function unidadVendidaDe(v: any): { id: string; nombre: string } | null {
  const id = String((v && typeof v === "object" ? v.id : v) ?? "").trim();
  if (!id) return null;
  return { id, nombre: v && typeof v === "object" ? texto(v) : "" };
}

/**
 * Botón "Generar temporal" del Canvas de Zoho CRM: crea un enlace temporal
 * (tabla Temporal) que solo muestra el primer paso del formulario
 * (Identificación personal / Identificación de empresa) y devuelve su URL.
 * Al completarse el paso, /api/temporal llama a manageTemporal.
 *
 * Seguridad: la llamada debe traer ZOHO_BUTTON_API_KEY (el botón la envía por
 * la Conexión "dd_portal", así la llave no queda en el navegador). El enlace
 * lleva un token aleatorio de 256 bits del que solo se guarda el hash; vence a
 * los TEMPORAL_EXPIRES_DAYS días y generar otro invalida el anterior del mismo registro.
 *
 * Body: { recordId: string, modulo?: string, tipo?: "natural" | "juridica", userId?: string,
 *         unidad_vendida?: { id: string, name: string }, proyecto?: string }
 * unidad_vendida y proyecto dan el Name "nombre-unidad-proyecto" del Socio de
 * Negocio y la Debida Diligencia que se crean al completarse (manageTemporal).
 * Si no llega `tipo` se lee Tipo_de_Persona del registro de Debida_Diligencia.
 */
export async function POST(request: NextRequest) {
  console.log(`[API Generar Temporal] Solicitud recibida (x-api-key ${request.headers.get("x-api-key") ? "presente" : "ausente"}).`);
  const llave = llaveValida(request);
  if (llave === "sin-configurar") {
    console.error("[API Generar Temporal] Falta ZOHO_BUTTON_API_KEY: solicitud rechazada.");
    return NextResponse.json({ success: false, error: "Servicio no configurado" }, { status: 503 });
  }
  if (!llave) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const recordId = typeof body.recordId === "string" ? body.recordId.trim() : "";
    const modulo = typeof body.modulo === "string" && body.modulo.trim() ? body.modulo.trim() : "Debida_Diligencia";
    const userId = typeof body.userId === "string" ? body.userId : null;
    const unidadVendida = unidadVendidaDe(body.unidad_vendida);
    const proyecto = texto(body.proyecto);
    if (!recordId) {
      return NextResponse.json({ success: false, error: "recordId es requerido" }, { status: 400 });
    }

    // Registro de Debida_Diligencia: da el tipo (si no llegó) y precarga el paso
    let ddRecord: any = null;
    if (modulo === "Debida_Diligencia") {
      try {
        ddRecord = await zoho.service.getDDRecord(recordId);
      } catch (err) {
        console.warn(`[API Generar Temporal] No se pudo leer el registro ${recordId} de Zoho:`, err);
      }
    }

    const tipoTexto = texto(body.tipo) || texto(ddRecord?.Tipo_de_Persona);
    if (!tipoTexto) {
      return NextResponse.json(
        { success: false, code: "SIN_TIPO", error: "No se pudo determinar el tipo de persona (natural o jurídica) del registro." },
        { status: 422 }
      );
    }
    const type = /jur/i.test(tipoTexto) ? "JURIDICA" : "NATURAL";

    let data: Record<string, any> = {};
    if (ddRecord) {
      try {
        data = datosFormularioDesdeZoho(type, ddRecord);
      } catch (err) {
        console.warn(`[API Generar Temporal] No se pudo precargar el temporal desde ${recordId}:`, err);
      }
    }
    // El proyecto del botón precarga el del formulario
    if (proyecto && !data.nombreProyecto) data.nombreProyecto = proyecto;

    const host = request.headers.get("host") || "debida-diligencia.duckdns.org";
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

    const { temporal, url } = await crearTemporal({
      type,
      crmRecordId: recordId,
      crmModule: modulo,
      createdBy: userId,
      data,
      appUrl,
      unidadVendida,
      proyecto: proyecto || null,
    });

    return NextResponse.json({
      success: true,
      message: "Enlace temporal generado.",
      url,
      tipo: type,
      expiresAt: temporal.expiresAt,
      temporalId: temporal.id,
    });
  } catch (error: any) {
    console.error("[API Generar Temporal Error]:", error);
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 });
  }
}
