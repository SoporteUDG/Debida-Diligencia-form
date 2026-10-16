import crypto from "crypto";
import type { FormType, Temporal } from "@prisma/client";
import prisma from "./prisma";
import { logAuditEvent } from "./auditService";
import type { TokenFailureReason } from "./tokenAccess";

/** Vigencia del enlace temporal. */
export const TEMPORAL_EXPIRES_DAYS = 7;

/**
 * Hash con el que se busca el token. El token en claro también se guarda
 * (Temporal.token) para volver a mostrar el enlace en el widget de Zoho.
 */
export function hashTemporalToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// 32 bytes aleatorios en base64url: 43 caracteres
const TOKEN_REGEX = /^[A-Za-z0-9_-]{43}$/;

/**
 * Crea un enlace temporal nuevo. No está atado a ningún registro de Zoho (lo
 * que se crea al completarse es nuevo), así que no invalida otros temporales.
 */
export async function crearTemporal(params: {
  type: FormType;
  /** Módulo de Zoho desde cuya vista de lista se generó. */
  crmModule: string;
  createdBy?: string | null;
  data?: Record<string, any>;
  appUrl: string;
  /** Unidad vendida y proyecto que envía el botón de Zoho (Name de lo que se crea). */
  unidadVendida?: { id: string; nombre: string } | null;
  proyecto?: string | null;
}): Promise<{ temporal: Temporal; url: string }> {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TEMPORAL_EXPIRES_DAYS);

  const temporal = await prisma.temporal.create({
    data: {
      type: params.type,
      data: params.data ?? {},
      tokenHash: hashTemporalToken(token),
      token,
      crmModule: params.crmModule,
      createdBy: params.createdBy ?? null,
      expiresAt,
      unidadVendidaId: params.unidadVendida?.id || null,
      unidadVendidaNombre: params.unidadVendida?.nombre || null,
      proyecto: params.proyecto || null,
    },
  });

  await logAuditEvent({
    action: "TEMPORAL_GENERATE",
    entityName: "Temporal",
    entityId: temporal.id,
    details: {
      crmModule: params.crmModule,
      type: params.type,
      createdBy: params.createdBy ?? null,
      expiresAt,
      unidadVendida: params.unidadVendida ?? null,
      proyecto: params.proyecto ?? null,
    },
  });

  return { temporal, url: urlDelTemporal(params.appUrl, token) };
}

function urlDelTemporal(appUrl: string, token: string): string {
  return `${appUrl}/temporal?token=${token}`;
}

/** Enlace temporal activo, como lo muestra el widget de Zoho. */
export interface TemporalActivo {
  id: string;
  tipo: FormType;
  /** null en los temporales anteriores a la columna `token` (no se puede rearmar). */
  url: string | null;
  proyecto: string | null;
  unidad: string | null;
  createdBy: string | null;
  createdAt: Date;
  expiresAt: Date;
}

/** Enlaces temporales sin completar y sin vencer, del más reciente al más antiguo. */
export async function listarTemporalesActivos(appUrl: string): Promise<TemporalActivo[]> {
  const temporales = await prisma.temporal.findMany({
    where: { completedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      token: true,
      proyecto: true,
      unidadVendidaNombre: true,
      createdBy: true,
      createdAt: true,
      expiresAt: true,
    },
  });
  return temporales.map((t) => ({
    id: t.id,
    tipo: t.type,
    url: t.token ? urlDelTemporal(appUrl, t.token) : null,
    proyecto: t.proyecto,
    unidad: t.unidadVendidaNombre,
    createdBy: t.createdBy,
    createdAt: t.createdAt,
    expiresAt: t.expiresAt,
  }));
}

/**
 * Busca el temporal de un token y confirma que sigue abierto.
 * USED = ya se completó el paso; EXPIRED = venció o lo reemplazó otro enlace.
 */
export async function verificarTemporal(
  token: string | null | undefined
): Promise<{ success: true; temporal: Temporal } | { success: false; reason: TokenFailureReason }> {
  if (!token || !TOKEN_REGEX.test(token)) return { success: false, reason: "INVALID" };

  const temporal = await prisma.temporal.findUnique({ where: { tokenHash: hashTemporalToken(token) } });
  if (!temporal) return { success: false, reason: "NOT_FOUND" };
  if (temporal.completedAt) return { success: false, reason: "USED" };
  if (temporal.expiresAt < new Date()) return { success: false, reason: "EXPIRED" };
  return { success: true, temporal };
}

/** Token de la cabecera Authorization: Bearer <token>. */
export function tokenDeSolicitud(headers: Headers): string | null {
  return headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || null;
}
