import { NextRequest, NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/auditService";
import { limitadorCreaciones, limitadorGlobal, limitadorEnvios } from "@/lib/registroLimites";
import { sanitizeInput } from "@/lib/sanitizer";
import { validarPasoTemporal, datosDelTemporal } from "@/lib/temporalFields";
import { buscarClienteEnZoho, type CoincidenciaZoho } from "@/lib/temporalValidation";
import { crearRegistroEstandalone } from "@/lib/registroService";
import type { ClientFormType } from "@/lib/tokenAccess";

export const dynamic = "force-dynamic";
// Crear el expediente y su enlace en Zoho toma varios segundos
export const maxDuration = 60;

/** Tamaño máximo del cuerpo (los formularios con listas de personas no pasan de unos KB). */
const MAX_BODY_BYTES = 200_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TIPOS: Record<string, ClientFormType> = { NATURAL: "NATURAL", JURIDICA: "JURIDICA" };

const limitado = (retryAfter: number, code = "RATE_LIMIT") =>
  NextResponse.json({ success: false, code }, { status: 429, headers: { "Retry-After": String(retryAfter) } });

function ipDe(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "desconocida";
}

/** El navegador envía Origin en los POST: debe ser este mismo portal (no un sitio ajeno). */
function origenValido(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // clientes que no son navegadores: los frenan los límites
  try {
    const host = new URL(origin).host;
    const propios = [request.headers.get("host"), process.env.NEXT_PUBLIC_APP_URL && new URL(process.env.NEXT_PUBLIC_APP_URL).host];
    return propios.includes(host);
  } catch {
    return false;
  }
}

function appUrlDe(request: NextRequest): string {
  const host = request.headers.get("host") || "debida-diligencia.duckdns.org";
  const protocol = request.headers.get("x-forwarded-proto") || "https";
  return process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
}

/**
 * Formularios independientes (/registro/persona-natural y /persona-juridica):
 * ruta pública, sin token. Valida las secciones I a III, busca el RUC / ID
 * tributaria en Zoho y crea el expediente de Debida_Diligencia SIN Socio de
 * Negocio, Contacto ni Unidad (ver registroService), con el enlace del
 * formulario normal.
 *
 * Body: { type: "NATURAL" | "JURIDICA", data, submissionId (UUID), confirmarExistente?: boolean, website?: "" }
 * submissionId lo genera el navegador una vez por envío y lo repite en cada
 * reintento: así un reintento tras una falla a medias no duplica el expediente.
 *   200 { url }:        enlace normal (abre en Documentos).
 *   409 CLIENTE_EXISTENTE: el identificador ya está en Zoho; reenviar con confirmarExistente: true.
 *   422 VALIDATION:     { errors } por campo.
 *   429 RATE_LIMIT:     Retry-After en segundos.
 *   503 VERIFICACION:   no se pudo consultar Zoho.
 *   500 CREACION:       falló la creación.
 *
 * Seguridad: Origin del mismo portal, tamaño máximo, trampa para bots (website),
 * solo los campos del paso (TEMPORAL_FIELDS), HTML eliminado, límites por IP y
 * global (ver constantes) y sin devolver datos de Zoho al cliente.
 */
export async function POST(request: NextRequest) {
  if (!origenValido(request)) {
    return NextResponse.json({ success: false, code: "ORIGEN" }, { status: 403 });
  }

  const ip = ipDe(request);
  const envio = limitadorEnvios.consumir(ip);
  if (!envio.ok) return limitado(envio.retryAfter);

  const crudo = await request.text().catch(() => "");
  if (!crudo || crudo.length > MAX_BODY_BYTES) {
    return NextResponse.json({ success: false, code: "BODY" }, { status: crudo ? 413 : 400 });
  }
  let body: any;
  try {
    body = JSON.parse(crudo);
  } catch {
    return NextResponse.json({ success: false, code: "BODY" }, { status: 400 });
  }

  // Trampa para bots: el campo está oculto en el formulario; si trae algo, se
  // responde como si todo hubiera salido bien, sin crear nada.
  if (typeof body?.website === "string" && body.website.trim()) {
    console.warn(`[API Registro] Honeypot activado desde ${ip}.`);
    return NextResponse.json({ success: true });
  }

  const type = TIPOS[String(body?.type)];
  const entrada = body?.data;
  const submissionId = String(body?.submissionId ?? "");
  if (!type || !UUID.test(submissionId) || !entrada || typeof entrada !== "object" || Array.isArray(entrada)) {
    return NextResponse.json({ success: false, code: "BODY" }, { status: 400 });
  }
  const data = datosDelTemporal(type, sanitizeInput(entrada));

  const errors = validarPasoTemporal(type, data);
  if (Object.keys(errors).length) {
    return NextResponse.json({ success: false, code: "VALIDATION", errors }, { status: 422 });
  }

  // ¿Ya compró aquí? Su RUC / ID tributaria en Zoho: debe confirmar sus datos
  let coincidencias: CoincidenciaZoho[];
  try {
    coincidencias = await buscarClienteEnZoho(type, data);
  } catch (err) {
    console.error("[API Registro] No se pudo verificar el cliente en Zoho:", err);
    return NextResponse.json({ success: false, code: "VERIFICACION" }, { status: 503 });
  }
  if (coincidencias.length && body?.confirmarExistente !== true) {
    // No se devuelven datos de Zoho al cliente
    return NextResponse.json({ success: false, code: "CLIENTE_EXISTENTE" }, { status: 409 });
  }

  // Cupo de creación: por IP y global (el global solo se cuenta si el de la IP pasó)
  const porIp = limitadorCreaciones.consumir(ip);
  if (!porIp.ok) return limitado(porIp.retryAfter);
  const global = limitadorGlobal.consumir("global");
  if (!global.ok) return limitado(global.retryAfter, "RATE_LIMIT_GLOBAL");

  try {
    const registro = await crearRegistroEstandalone({
      type,
      data,
      submissionId: submissionId.toLowerCase(),
      appUrl: appUrlDe(request),
      coincidencias,
      ipAddress: ip,
      userAgent: request.headers.get("user-agent") || undefined,
    });
    return NextResponse.json({ success: true, url: registro.url });
  } catch (err: any) {
    console.error("[API Registro] Falló la creación del expediente:", err);
    await logAuditEvent({
      action: "REGISTRO_ESTANDALONE_FAILED",
      entityName: "CrmContact",
      ipAddress: ip,
      details: { type, error: String(err?.message ?? err) },
    });
    return NextResponse.json({ success: false, code: "CREACION" }, { status: 500 });
  }
}
