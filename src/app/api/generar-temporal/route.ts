import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
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

/** Persona_de_Tipo ("Natural" / "Jurídica") → FormType; null si no se reconoce. */
function tipoDe(v: any): "NATURAL" | "JURIDICA" | null {
  const t = texto(v);
  if (/jur/i.test(t)) return "JURIDICA";
  if (/nat/i.test(t)) return "NATURAL";
  return null;
}

/**
 * Botón "Generar temporal" de la vista de lista de Zoho CRM: crea un enlace
 * temporal nuevo (tabla Temporal), sin atarlo a ningún registro existente, que
 * solo muestra las secciones I a III del formulario, y devuelve su URL. Al
 * completarse, /api/temporal llama a manageTemporal, que crea el Socio de
 * Negocio y la Debida Diligencia.
 *
 * Seguridad: la llamada debe traer ZOHO_BUTTON_API_KEY (el botón la envía por
 * la Conexión "dd_portal", así la llave no queda en el navegador). El enlace
 * lleva un token aleatorio de 256 bits del que solo se guarda el hash; vence a
 * los TEMPORAL_EXPIRES_DAYS días.
 *
 * Body (del formulario emergente del botón):
 *   { persona_de_tipo: "Natural" | "Jurídica", unidad_vendida: { id: string, name: string },
 *     modulo?: string, userId?: string, proyecto?: string }
 * persona_de_tipo es el Persona_de_Tipo del Socio de Negocio que se creará
 * (se acepta `tipo` como alias). unidad_vendida (requerida) es el lookup
 * Unidad_Vendida1 del socio: el botón la busca por su ID_SAP y envía el id del
 * registro. Con ella y el proyecto se forma el Name "nombre-unidad-proyecto"
 * del Socio de Negocio y la DD.
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
    const modulo = typeof body.modulo === "string" && body.modulo.trim() ? body.modulo.trim() : "Accounts";
    const userId = typeof body.userId === "string" ? body.userId : null;
    const unidadVendida = unidadVendidaDe(body.unidad_vendida);
    const proyecto = texto(body.proyecto);

    const type = tipoDe(body.persona_de_tipo ?? body.tipo);
    if (!type) {
      return NextResponse.json(
        { success: false, code: "SIN_TIPO", error: "Indique la Persona de Tipo (Natural o Jurídica)." },
        { status: 400 }
      );
    }
    if (!unidadVendida) {
      return NextResponse.json(
        { success: false, code: "SIN_UNIDAD", error: "Seleccione la unidad vendida." },
        { status: 400 }
      );
    }

    // El proyecto del botón precarga el del formulario
    const data: Record<string, any> = proyecto ? { nombreProyecto: proyecto } : {};

    const host = request.headers.get("host") || "debida-diligencia.duckdns.org";
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

    const { temporal, url } = await crearTemporal({
      type,
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
