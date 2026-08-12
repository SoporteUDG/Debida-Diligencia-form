import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, signSessionToken, verifySessionToken } from "../authService";

describe("AuthService Unit Tests", () => {
  describe("Password Hashing & Verification", () => {
    it("should hash a password and verify it successfully", () => {
      const password = "mySecurePassword123";
      const hashedPassword = hashPassword(password);
      
      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).toContain(":");
      
      const isValid = verifyPassword(password, hashedPassword);
      expect(isValid).toBe(true);
    });

    it("should reject an incorrect password", () => {
      const password = "mySecurePassword123";
      const hashedPassword = hashPassword(password);
      
      const isValid = verifyPassword("wrongPassword", hashedPassword);
      expect(isValid).toBe(false);
    });

    it("should return false if stored hash format is invalid", () => {
      expect(verifyPassword("password", "")).toBe(false);
      expect(verifyPassword("password", "nocolonhash")).toBe(false);
    });
  });

  describe("Session Token Signing & Verification", () => {
    it("should sign a session token and verify it successfully", () => {
      const adminUserId = "admin-user-uuid-123";
      const signedToken = signSessionToken(adminUserId);
      
      expect(signedToken).toBeDefined();
      expect(signedToken.startsWith(adminUserId)).toBe(true);
      expect(signedToken.split(".")).toHaveLength(2);
      
      const isValid = verifySessionToken(signedToken);
      expect(isValid).toBe(true);
    });

    it("should reject a modified session token", () => {
      const adminUserId = "admin-user-uuid-123";
      const signedToken = signSessionToken(adminUserId);
      
      const parts = signedToken.split(".");
      const forgedToken = `${parts[0]}.forgedSignature${"0".repeat(49)}`; // Keep length 64 hex
      
      const isValid = verifySessionToken(forgedToken);
      expect(isValid).toBe(false);
    });

    it("should reject an invalid token format", () => {
      expect(verifySessionToken("")).toBe(false);
      expect(verifySessionToken("notoken.nosignature.extra")).toBe(false);
    });
  });
});
