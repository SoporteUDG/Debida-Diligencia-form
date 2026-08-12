import prisma from "./prisma";

// Sensitive keys to be redacted from audit details
const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "pass",
  "token",
  "tokenuuid",
  "secret",
  "clientsecret",
  "client_secret",
  "refreshtoken",
  "refresh_token",
  "access_token",
  "accesstoken",
  "firmaimage",
  "signature",
  "signaturedata",
  "filedata",
  "binary",
  "base64",
]);

/**
 * Recursively sanitizes keys in a given JSON object to prevent writing
 * sensitive data like passwords, signatures, or access tokens to audit logs.
 */
export function sanitizeDetails(data: any): any {
  if (data === null || data === undefined) return data;
  
  if (Array.isArray(data)) {
    return data.map(sanitizeDetails);
  }
  
  if (typeof data === "object") {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      
      // If key matches sensitive properties or is too large (like raw base64 data URLs)
      if (
        SENSITIVE_KEYS.has(normalizedKey) || 
        (typeof value === "string" && value.startsWith("data:image/"))
      ) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = sanitizeDetails(value);
      }
    }
    return sanitized;
  }
  
  return data;
}

interface AuditLogOptions {
  action: string;       // e.g., "PORTAL_ACCESS", "DRAFT_SAVE", "FORM_SUBMIT", "ZOHO_CRM_SYNC"
  entityName: string;   // e.g., "Form", "Draft", "Document", "Token"
  entityId?: string | null;
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: any;
}

/**
 * Reusable service function to write audit logs to the database.
 * Ensures metadata details are fully sanitized before saving.
 */
export async function logAuditEvent({
  action,
  entityName,
  entityId = null,
  userId = null,
  ipAddress = null,
  userAgent = null,
  details = null,
}: AuditLogOptions) {
  try {
    const sanitizedDetails = details ? sanitizeDetails(details) : null;

    const auditRecord = await prisma.auditLog.create({
      data: {
        action,
        entityName,
        entityId,
        userId,
        ipAddress,
        userAgent,
        details: sanitizedDetails as any,
      },
    });

    return auditRecord;
  } catch (error) {
    console.error("[Audit Service Error] No se pudo escribir el registro de auditoría:", error);
    return null;
  }
}

interface DiffResult {
  added: Record<string, any>;
  updated: Record<string, { old: any; new: any }>;
  deleted: string[];
}

/**
 * Computes difference (diff) between two objects, excluding identical fields.
 * Returns lists of added, updated, and deleted keys.
 */
export function computeDiff(oldObj: any, newObj: any): DiffResult {
  const result: DiffResult = {
    added: {},
    updated: {},
    deleted: [],
  };

  const oldData = oldObj && typeof oldObj === "object" ? oldObj : {};
  const newData = newObj && typeof newObj === "object" ? newObj : {};

  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

  for (const key of allKeys) {
    const hasOld = key in oldData;
    const hasNew = key in newData;

    if (!hasOld && hasNew) {
      result.added[key] = newData[key];
    } else if (hasOld && !hasNew) {
      result.deleted.push(key);
    } else if (hasOld && hasNew) {
      const valOld = oldData[key];
      const valNew = newData[key];

      // Compare using JSON stringification for nested objects/arrays or standard comparison
      const isDifferent = typeof valOld === "object" || typeof valNew === "object"
        ? JSON.stringify(valOld) !== JSON.stringify(valNew)
        : valOld !== valNew;

      if (isDifferent) {
        result.updated[key] = {
          old: valOld,
          new: valNew,
        };
      }
    }
  }

  return result;
}
