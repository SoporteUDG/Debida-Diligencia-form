import { NextRequest, NextResponse } from "next/server";
import type { Temporal } from "@prisma/client";
import prisma from "@/lib/prisma";
import { logAuditEvent } from "@/lib/auditService";
import { sanitizeInput } from "@/lib/sanitizer";
import { validarPasoTemporal, datosDelTemporal } from "@/lib/temporalFields";
import { verificarTemporal, tokenDeSolicitud } from "@/lib/temporalService";
import { manageTemporal } from "@/lib/manageTemporal";
import { buscarClienteEnZoho, type CoincidenciaZoho } from "@/lib/temporalValidation";

export const dynamic = "force-dynamic";
// Crear contacto, socio, expediente y enlace en Zoho toma varios segundos
export const maxDuration = 60;

/**
 * API de la vista /temporal. Todas las llamadas llevan el token del enlace en
 * Authorization: Bearer <token>.
 * - GET:  tipo y datos guardados del temporal.
 * - PUT:  guarda el progreso (como un borrador). Body: { data }
 * - POST: valida los pasos, busca el RUC / ID tributaria en Zoho, bloquea el
 *         temporal y llama a manageTemporal, que crea todo y el enlace normal.
 *         Body: { data, confirmarExistente?: boolean }
 *         200 { url }: enlace normal del formulario (abre en Documentos); sin
 *         url si el cliente ya existía.
 *         409 CLIENTE_EXISTENTE: el identificador ya está en Zoho; el cliente
 *         confirma sus datos reenviando con confirmarExistente: true.
 *         503 VERIFICACION: no se pudo consultar Zoho.
 *         500 CREACION: falló la creación; el temporal se libera para reintentar
 *         (conserva los ids de Zoho ya creados: el reintento continúa desde ahí).
 * Un temporal completado o vencido rechaza todo (403 con `reason`).
 */
async function autorizar(request: NextRequest) {
  const resultado = await verificarTemporal(tokenDeSolicitud(request.headers));
  if (!resultado.success) {
    return {
      error: NextResponse.json({ success: false, reason: resultado.reason }, { status: 403 }),
    } as const;
  }
  return { temporal: resultado.temporal } as const;
}

/**
 * Datos del body fusionados sobre los guardados. Solo se aceptan los campos del
 * paso (TEMPORAL_FIELDS); lo precargado desde Zoho para otros campos se conserva.
 */
function leerData(body: any, temporal: Temporal): Record<string, any> | null {
  const data = body?.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const guardados = (temporal.data as Record<string, any>) ?? {};
  return { ...guardados, ...datosDelTemporal(temporal.type, sanitizeInput(data)) };
}

export async function GET(request: NextRequest) {
  const auth = await autorizar(request);
  if ("error" in auth) return auth.error;
  const { temporal } = auth;
  return NextResponse.json({
    success: true,
    type: temporal.type,
    data: temporal.data,
    expiresAt: temporal.expiresAt,
    updatedAt: temporal.updatedAt,
  });
}

export async function PUT(request: NextRequest) {
  const auth = await autorizar(request);
  if ("error" in auth) return auth.error;
  const data = leerData(await request.json().catch(() => null), auth.temporal);
  if (!data) return NextResponse.json({ success: false, error: "data es requerido" }, { status: 400 });

  const actualizado = await prisma.temporal.update({
    where: { id: auth.temporal.id },
    data: { data },
  });
  return NextResponse.json({ success: true, updatedAt: actualizado.updatedAt });
}

export async function POST(request: NextRequest) {
  const auth = await autorizar(request);
  if ("error" in auth) return auth.error;
  const { temporal } = auth;
  const body = await request.json().catch(() => null);
  const data = leerData(body, temporal);
  if (!data) return NextResponse.json({ success: false, error: "data es requerido" }, { status: 400 });

  const errors = validarPasoTemporal(temporal.type, data);
  if (Object.keys(errors).length) {
    return NextResponse.json({ success: false, code: "VALIDATION", errors }, { status: 422 });
  }

  // ¿Ya compró aquí? Su RUC / ID tributaria en Zoho. Si aparece, el cliente
  // debe confirmar sus datos (reenvía con confirmarExistente: true).
  let coincidencias: CoincidenciaZoho[];
  try {
    // Un reintento tras una creación a medias no cuenta lo que este mismo temporal ya creó
    const propios = new Set([temporal.contactCrmId, temporal.accountCrmId, temporal.ddCrmId].filter(Boolean));
    coincidencias = (await buscarClienteEnZoho(temporal.type, data)).filter((c) => !propios.has(c.id));
  } catch (err) {
    console.error(`[API Temporal] No se pudo verificar el cliente del temporal ${temporal.id} en Zoho:`, err);
    return NextResponse.json({ success: false, code: "VERIFICACION" }, { status: 503 });
  }
  const confirmado = body?.confirmarExistente === true;
  if (coincidencias.length && !confirmado) {
    // Se guarda el progreso; al cliente no se le muestran datos de Zoho
    await prisma.temporal.update({ where: { id: temporal.id }, data: { data } });
    return NextResponse.json({ success: false, code: "CLIENTE_EXISTENTE" }, { status: 409 });
  }

  // Bloquea el enlace antes de crear nada: desde aquí todo GET/PUT/POST con este
  // token responde 403 USED (también un doble envío concurrente).
  const bloqueadoEn = new Date();
  const { count } = await prisma.temporal.updateMany({
    where: { id: temporal.id, completedAt: null },
    data: { data, completedAt: bloqueadoEn },
  });
  if (!count) return NextResponse.json({ success: false, reason: "USED" }, { status: 403 });

  const auditoria = {
    entityName: "Temporal",
    entityId: temporal.id,
    ipAddress: request.headers.get("x-forwarded-for") || undefined,
    userAgent: request.headers.get("user-agent") || undefined,
  };

  let enlace: Awaited<ReturnType<typeof manageTemporal>>;
  try {
    enlace = await manageTemporal({ ...temporal, data, completedAt: bloqueadoEn }, { coincidencias, appUrl: appUrlDe(request) });
  } catch (err: any) {
    // Se libera el enlace para que el cliente pueda reintentar
    console.error(`[API Temporal] manageTemporal falló para ${temporal.id}:`, err);
    await prisma.temporal.updateMany({
      where: { id: temporal.id, completedAt: bloqueadoEn },
      data: { completedAt: null },
    });
    await logAuditEvent({ ...auditoria, action: "TEMPORAL_COMPLETE_FAILED", details: { error: String(err?.message ?? err) } });
    return NextResponse.json({ success: false, code: "CREACION" }, { status: 500 });
  }

  await logAuditEvent({
    ...auditoria,
    action: "TEMPORAL_COMPLETE",
    details: {
      crmRecordId: temporal.crmRecordId,
      crmModule: temporal.crmModule,
      type: temporal.type,
      clienteExistente: coincidencias.length > 0,
      ddCrmId: enlace?.ddCrmId ?? null,
    },
  });

  // url: enlace normal del formulario (abre en Documentos). Sin url (cliente
  // existente) la vista muestra el mensaje final.
  return NextResponse.json({ success: true, ...(enlace ? { url: enlace.url } : {}) });
}

/** URL base del portal (como en generar-temporal). */
function appUrlDe(request: NextRequest): string {
  const host = request.headers.get("host") || "debida-diligencia.duckdns.org";
  const protocol = request.headers.get("x-forwarded-proto") || "https";
  return process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
}
