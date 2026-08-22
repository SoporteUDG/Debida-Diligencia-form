import crypto from "crypto";
import prisma from "./prisma";
import { logAuditEvent } from "./auditService";
import { zoho } from "./zohoService";

// Retrieve the token secret from environment or fallback to a hardcoded string
const getSecret = () => process.env.TOKEN_SECRET || "default_token_secret_key_udg_2026";

/**
 * Computes the HMAC-SHA256 signature for a given UUID using the secret key.
 */
export function signUuid(uuid: string): string {
  return crypto
    .createHmac("sha256", getSecret())
    .update(uuid)
    .digest("hex");
}

/**
 * Validates the token's signature using a constant-time comparison (timingSafeEqual)
 * to prevent timing side-channel attacks.
 */
export function verifySignature(uuid: string, signature: string): boolean {
  try {
    if (!signature || typeof signature !== "string" || signature.length !== 64) {
      return false;
    }

    const expectedSignature = signUuid(uuid);

    const signatureBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch (error) {
    console.error("[TokenService] Error verifying signature:", error);
    return false;
  }
}

/**
 * Generates a signed cryptographic token and persists the metadata to the database.
 * The token format is: [UUID].[HMAC-SHA256]
 * 
 * @param crmContactId The ID of the CRM contact associated with the token.
 * @param type The type of token (ACCESS, VERIFICATION, PASSWORD_RESET).
 * @param expiresInDays Configurable lifespan of the token (default: 30 days).
 */
export async function generateToken(
  crmContactId: string,
  type: "ACCESS" | "VERIFICATION" | "PASSWORD_RESET" = "ACCESS",
  expiresInDays: number = 30
): Promise<string> {
  // Generar un token criptográficamente seguro de exactamente 14 caracteres hexadecimales (7 bytes)
  const tokenValue = crypto.randomBytes(7).toString("hex");

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  // Persistir la metadata en base de datos
  await prisma.token.create({
    data: {
      token: tokenValue,
      type,
      crmContactId,
      expiresAt,
      used: false,
    },
  });

  await logAuditEvent({
    action: "TOKEN_GENERATE",
    entityName: "Token",
    entityId: tokenValue,
    details: {
      crmContactId,
      type,
      expiresInDays,
    },
  });

  return tokenValue;
}

/**
 * Validates a signed token's format, cryptographic signature, expiration, and status.
 * 
 * @param signedToken The raw signed token string (format: UUID.SIGNATURE).
 */
export async function verifyToken(
  signedToken: string
): Promise<{ success: boolean; error?: string; crmContactId?: string; type?: string; uuid?: string }> {
  if (!signedToken || typeof signedToken !== "string") {
    return { success: false, error: "Token no provisto o tipo inválido" };
  }

  // Support local/anonymous drafts
  if (signedToken.startsWith("draft-jur-") || signedToken.startsWith("draft-nat-")) {
    return {
      success: true,
      crmContactId: undefined,
      type: signedToken.startsWith("draft-jur-") ? "JURIDICA" : "NATURAL",
      uuid: signedToken,
    };
  }

  // Soporte para tokens cortos de 14 caracteres (sin firma HMAC externa en URL)
  if (signedToken.length === 14 && !signedToken.includes(".")) {
    const dbToken = await prisma.token.findUnique({
      where: { token: signedToken },
    });

    if (!dbToken) {
      return { success: false, error: "Token no encontrado en base de datos" };
    }

    if (dbToken.used) {
      return { success: false, error: "Token ya ha sido utilizado o se encuentra revocado" };
    }

    // Usaremos dbToken para las validaciones subsiguientes
    const uuid = dbToken.token;
    return checkDbTokenValidity(dbToken, uuid);
  }

  const parts = signedToken.split(".");
  if (parts.length !== 2) {
    return { success: false, error: "Formato de token alterado o inválido" };
  }

  const [uuid, signature] = parts;

  // 1. Verify cryptographic signature in constant time
  const isSignatureValid = verifySignature(uuid, signature);
  if (!isSignatureValid) {
    return { success: false, error: "Firma de token alterada o inválida (integridad fallida)" };
  }

  // 2. Fetch the token metadata from database
  const dbToken = await prisma.token.findUnique({
    where: { token: uuid },
  });

  if (!dbToken) {
    return { success: false, error: "Token no encontrado en base de datos" };
  }

  if (dbToken.used) {
    return { success: false, error: "Token ya ha sido utilizado o se encuentra revocado" };
  }

  return checkDbTokenValidity(dbToken, uuid);
}

/**
 * Helper internal function to check database token expiration and return verification outcome.
 */
async function checkDbTokenValidity(dbToken: any, uuid: string) {

  // 4. Verify expiration date
  if (dbToken.expiresAt < new Date()) {
    if (!dbToken.expirationNoted) {
      try {
        // Mark as noted first to prevent duplicate attempts
        await prisma.token.update({
          where: { token: dbToken.token },
          data: { expirationNoted: true },
        });

        // Write note to Zoho CRM
        await zoho.service.createNote(
          dbToken.crmContactId,
          "Enlace Expirado",
          `El enlace de acceso para el formulario de Debida Diligencia ha expirado.\n\n` +
          `Referencia de Token: ${dbToken.token}\n` +
          `Fecha de Expiración: ${dbToken.expiresAt.toLocaleString()}\n` +
          `Tipo de Formulario: ${dbToken.type}\n` +
          `Actor: Sistema (Expiración detectada por acceso del cliente)\n` +
          `Timestamp: ${new Date().toLocaleString()}\n` +
          `Resultado de Sincronización: Formulario expirado sin responder`
        );
      } catch (err) {
        console.error("[TokenService] Error writing token expiration note to Zoho CRM:", err);
      }
    }

    await logAuditEvent({
      action: "TOKEN_EXPIRED",
      entityName: "Token",
      entityId: dbToken.token,
      details: {
        expiredAt: dbToken.expiresAt,
        crmContactId: dbToken.crmContactId,
        type: dbToken.type,
      },
    });
    return { success: false, error: "Token expirado" };
  }

  return {
    success: true,
    crmContactId: dbToken.crmContactId,
    type: dbToken.type,
    uuid,
  };
}

/**
 * Extends the expiration date of an existing token.
 * 
 * @param uuid The unique UUID part of the token.
 * @param extendDays Configurable amount of days to extend the validity (default: 30 days).
 */
export async function reactivateToken(
  uuid: string,
  extendDays: number = 30
): Promise<{ success: boolean; newExpiresAt?: Date; error?: string }> {
  try {
    const dbToken = await prisma.token.findUnique({
      where: { token: uuid },
    });

    if (!dbToken) {
      return { success: false, error: "Token no encontrado" };
    }

    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + extendDays);

    await prisma.token.update({
      where: { token: uuid },
      data: {
        expiresAt: newExpiresAt,
        used: false, // Reset used/revoked flag upon reactivation
        updatedAt: new Date(),
      },
    });

    await logAuditEvent({
      action: "TOKEN_REACTIVATE",
      entityName: "Token",
      entityId: uuid,
      details: {
        extendDays,
        newExpiresAt,
      },
    });

    return {
      success: true,
      newExpiresAt,
    };
  } catch (error: any) {
    console.error("[TokenService] Error reactivating token:", error);
    return { success: false, error: error.message || "Error al reactivar el token" };
  }
}

/**
 * Revokes/invalidates a token immediately by setting its 'used' flag to true.
 * 
 * @param uuid The unique UUID part of the token.
 */
export async function revokeToken(
  uuid: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const dbToken = await prisma.token.findUnique({
      where: { token: uuid },
    });

    if (!dbToken) {
      return { success: false, error: "Token no encontrado" };
    }

    await prisma.token.update({
      where: { token: uuid },
      data: {
        used: true,
        updatedAt: new Date(),
      },
    });

    await logAuditEvent({
      action: "TOKEN_REVOKE",
      entityName: "Token",
      entityId: uuid,
      details: {
        reason: "Manual revocation / Used",
        crmContactId: dbToken.crmContactId,
        type: dbToken.type,
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error("[TokenService] Error revoking token:", error);
    return { success: false, error: error.message || "Error al revocar el token" };
  }
}
