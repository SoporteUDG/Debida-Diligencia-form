import crypto from "crypto";
import { signUuid, verifySignature } from "./tokenService";

/**
 * Hashes a plain text password using PBKDF2 (SHA-512) with a random 16-byte salt.
 * Returns the hash in format: salt:hash
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verifies a plain text password against a stored hash string.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    if (!storedHash || !storedHash.includes(":")) {
      return false;
    }
    const [salt, hash] = storedHash.split(":");
    const testHash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
    
    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(testHash, "hex"));
  } catch (error) {
    console.error("[AuthService] Error verifying password:", error);
    return false;
  }
}

/**
 * Generates a signed administrator session token: adminUserId.signature
 */
export function signSessionToken(adminUserId: string): string {
  const signature = signUuid(adminUserId);
  return `${adminUserId}.${signature}`;
}

/**
 * Cryptographically verifies a signed administrator session token.
 */
export function verifySessionToken(token: string): boolean {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [adminUserId, signature] = parts;
  return verifySignature(adminUserId, signature);
}
