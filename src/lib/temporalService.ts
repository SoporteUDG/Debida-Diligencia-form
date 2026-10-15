import crypto from "crypto";
import type { FormType, Temporal } from "@prisma/client";
import prisma from "./prisma";
import { logAuditEvent } from "./auditService";
import type { TokenFailureReason } from "./tokenAccess";

/** Vigencia del enlace temporal. */
export const TEMPORAL_EXPIRES_DAYS = 7;

/** Hash con el que se guarda y busca el token (el token en claro nunca se persiste). */
export function hashTemporalToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// 32 bytes aleatorios en base64url: 43 caracteres
const TOKEN_REGEX = /^[A-Za-z0-9_-]{43}$/;

/**
 * Crea el enlace temporal de un registro de Zoho. Los enlaces pendientes
 * anteriores del mismo registro se invalidan: solo uno vive a la vez.
 */
export async function crearTemporal(params: {
  type: FormType;
  crmRecordId: string;
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

  const ahora = new Date();
  const [invalidados, temporal] = await prisma.$transaction([
    prisma.temporal.updateMany({
      where: { crmRecordId: params.crmRecordId, completedAt: null, expiresAt: { gt: ahora } },
      data: { expiresAt: ahora },
    }),
    prisma.temporal.create({
      data: {
        type: params.type,
        data: params.data ?? {},
        tokenHash: hashTemporalToken(token),
        crmRecordId: params.crmRecordId,
        crmModule: params.crmModule,
        createdBy: params.createdBy ?? null,
        expiresAt,
        unidadVendidaId: params.unidadVendida?.id || null,
        unidadVendidaNombre: params.unidadVendida?.nombre || null,
        proyecto: params.proyecto || null,
      },
    }),
  ]);

  await logAuditEvent({
    action: "TEMPORAL_GENERATE",
    entityName: "Temporal",
    entityId: temporal.id,
    details: {
      crmRecordId: params.crmRecordId,
      crmModule: params.crmModule,
      type: params.type,
      createdBy: params.createdBy ?? null,
      expiresAt,
      unidadVendida: params.unidadVendida ?? null,
      proyecto: params.proyecto ?? null,
      invalidatedPrevious: invalidados.count,
    },
  });

  return { temporal, url: `${params.appUrl}/temporal?token=${token}` };
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
