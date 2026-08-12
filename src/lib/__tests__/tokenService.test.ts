import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { 
  signUuid, 
  verifySignature, 
  generateToken, 
  verifyToken, 
  reactivateToken, 
  revokeToken 
} from "../tokenService";
import prisma from "../prisma";

// Mock the prisma client to isolate unit tests from database
vi.mock("../prisma", () => {
  return {
    default: {
      token: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({} as any),
      },
    },
  };
});

describe("TokenService Unit Tests", () => {
  const mockCrmContactId = "test-crm-contact-id";
  const mockUuid = "12345678-abcd-ef01-2345-6789abcdef01";
  const testSecret = "default_token_secret_key_udg_2026";

  beforeEach(() => {
    // Set system time to a fixed date to ensure stable date arithmetic
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("signUuid & verifySignature (HMAC-SHA256)", () => {
    it("should compute signature and successfully verify it", () => {
      const signature = signUuid(mockUuid);
      expect(signature).toBeDefined();
      expect(typeof signature).toBe("string");

      const isValid = verifySignature(mockUuid, signature);
      expect(isValid).toBe(true);
    });

    it("should fail validation if signature is altered", () => {
      const signature = signUuid(mockUuid);
      
      // 1. Test altered contents but correct length (64 characters)
      const alteredContent = signature.substring(0, 63) + (signature[63] === "0" ? "1" : "0");
      const isValid1 = verifySignature(mockUuid, alteredContent);
      expect(isValid1).toBe(false);

      // 2. Test altered length (65 characters)
      const alteredLength = signature + "x";
      const isValid2 = verifySignature(mockUuid, alteredLength);
      expect(isValid2).toBe(false);
    });

    it("should fail validation if signature length is incorrect", () => {
      const isValid = verifySignature(mockUuid, "shortsignature");
      expect(isValid).toBe(false);
    });
  });

  describe("generateToken", () => {
    it("should generate a token in the format uuid.signature and persist metadata in DB", async () => {
      const spyCreate = vi.spyOn(prisma.token, "create").mockResolvedValue({} as any);

      const token = await generateToken(mockCrmContactId, "ACCESS", 30);
      expect(token).toBeDefined();
      expect(token).toContain(".");

      const [uuid, signature] = token.split(".");
      expect(uuid).toBeDefined();
      expect(signature).toBeDefined();

      // Check DB persistence call
      expect(spyCreate).toHaveBeenCalledTimes(1);
      const callArgs = spyCreate.mock.calls[0][0];
      expect(callArgs.data.token).toBe(uuid);
      expect(callArgs.data.type).toBe("ACCESS");
      expect(callArgs.data.crmContactId).toBe(mockCrmContactId);
      expect(callArgs.data.used).toBe(false);

      // Verify expiration date (30 days from 2026-08-01 is 2026-08-31)
      const expectedExpiresAt = new Date("2026-08-31T12:00:00.000Z");
      expect(callArgs.data.expiresAt).toBeDefined();
      expect(new Date(callArgs.data.expiresAt as any).getTime()).toBe(expectedExpiresAt.getTime());
    });
  });

  describe("verifyToken", () => {
    it("should bypass cryptographic verification for local draft-jur- tokens", async () => {
      const localToken = "draft-jur-1234567890";
      const result = await verifyToken(localToken);
      
      expect(result.success).toBe(true);
      expect(result.crmContactId).toBeUndefined();
      expect(result.type).toBe("JURIDICA");
      expect(result.uuid).toBe(localToken);
    });

    it("should bypass cryptographic verification for local draft-nat- tokens", async () => {
      const localToken = "draft-nat-abcdef";
      const result = await verifyToken(localToken);
      
      expect(result.success).toBe(true);
      expect(result.crmContactId).toBeUndefined();
      expect(result.type).toBe("NATURAL");
      expect(result.uuid).toBe(localToken);
    });

    it("should fail validation if token is null or not a string", async () => {
      const result1 = await verifyToken(null as any);
      expect(result1.success).toBe(false);
      expect(result1.error).toContain("no provisto");

      const result2 = await verifyToken(12345 as any);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain("no provisto");
    });

    it("should fail validation if token format does not contain a single dot separator", async () => {
      const result1 = await verifyToken("uuid-without-dot-signature");
      expect(result1.success).toBe(false);
      expect(result1.error).toContain("Formato de token alterado o inválido");

      const result2 = await verifyToken("uuid.signature.extra");
      expect(result2.success).toBe(false);
      expect(result2.error).toContain("Formato de token alterado o inválido");
    });

    it("should fail validation if signature integrity check fails", async () => {
      const invalidSignatureToken = `${mockUuid}.invalid_sig_here_1234`;
      const result = await verifyToken(invalidSignatureToken);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain("Firma de token alterada o inválida");
    });

    it("should fail validation if token does not exist in DB", async () => {
      const signature = signUuid(mockUuid);
      const signedToken = `${mockUuid}.${signature}`;

      // Mock database returning null (token not found)
      vi.spyOn(prisma.token, "findUnique").mockResolvedValue(null);

      const result = await verifyToken(signedToken);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Token no encontrado");
    });

    it("should fail validation if token has already been marked as used", async () => {
      const signature = signUuid(mockUuid);
      const signedToken = `${mockUuid}.${signature}`;

      // Mock DB token as used
      vi.spyOn(prisma.token, "findUnique").mockResolvedValue({
        token: mockUuid,
        used: true,
        expiresAt: new Date("2026-08-31T12:00:00.000Z"),
        crmContactId: mockCrmContactId,
        type: "ACCESS",
      } as any);

      const result = await verifyToken(signedToken);
      expect(result.success).toBe(false);
      expect(result.error).toContain("ya ha sido utilizado o se encuentra revocado");
    });

    it("should fail validation if token is expired", async () => {
      const signature = signUuid(mockUuid);
      const signedToken = `${mockUuid}.${signature}`;

      // Mock DB token with expiration date in the past
      vi.spyOn(prisma.token, "findUnique").mockResolvedValue({
        token: mockUuid,
        used: false,
        expiresAt: new Date("2026-07-31T12:00:00.000Z"), // Expired 1 day ago relative to 2026-08-01
        crmContactId: mockCrmContactId,
        type: "ACCESS",
      } as any);

      const result = await verifyToken(signedToken);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Token expirado");
    });

    it("should succeed validation for a valid, un-used, and active cryptographic token", async () => {
      const signature = signUuid(mockUuid);
      const signedToken = `${mockUuid}.${signature}`;

      vi.spyOn(prisma.token, "findUnique").mockResolvedValue({
        token: mockUuid,
        used: false,
        expiresAt: new Date("2026-08-31T12:00:00.000Z"),
        crmContactId: mockCrmContactId,
        type: "ACCESS",
      } as any);

      const result = await verifyToken(signedToken);
      expect(result.success).toBe(true);
      expect(result.crmContactId).toBe(mockCrmContactId);
      expect(result.type).toBe("ACCESS");
      expect(result.uuid).toBe(mockUuid);
    });
  });

  describe("reactivateToken", () => {
    it("should return success: false if token does not exist in DB", async () => {
      vi.spyOn(prisma.token, "findUnique").mockResolvedValue(null);

      const result = await reactivateToken(mockUuid, 15);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Token no encontrado");
    });

    it("should update DB token status, reset used flag, and extend expiration date on success", async () => {
      vi.spyOn(prisma.token, "findUnique").mockResolvedValue({
        token: mockUuid,
        used: true,
        expiresAt: new Date("2026-07-31T12:00:00.000Z"),
      } as any);

      const spyUpdate = vi.spyOn(prisma.token, "update").mockResolvedValue({} as any);

      const result = await reactivateToken(mockUuid, 15);
      expect(result.success).toBe(true);
      expect(result.newExpiresAt).toBeDefined();

      // Extended 15 days from system time 2026-08-01 is 2026-08-16
      const expectedNewExpiresAt = new Date("2026-08-16T12:00:00.000Z");
      expect(result.newExpiresAt?.getTime()).toBe(expectedNewExpiresAt.getTime());

      expect(spyUpdate).toHaveBeenCalledTimes(1);
      const callArgs = spyUpdate.mock.calls[0][0];
      expect(callArgs.where.token).toBe(mockUuid);
      expect(callArgs.data.used).toBe(false);
      expect(callArgs.data.expiresAt).toBeDefined();
      expect(new Date(callArgs.data.expiresAt as any).getTime()).toBe(expectedNewExpiresAt.getTime());
    });
  });

  describe("revokeToken", () => {
    it("should return success: false if token does not exist in DB", async () => {
      vi.spyOn(prisma.token, "findUnique").mockResolvedValue(null);

      const result = await revokeToken(mockUuid);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Token no encontrado");
    });

    it("should update DB token 'used' flag to true on success", async () => {
      vi.spyOn(prisma.token, "findUnique").mockResolvedValue({
        token: mockUuid,
        used: false,
      } as any);

      const spyUpdate = vi.spyOn(prisma.token, "update").mockResolvedValue({} as any);

      const result = await revokeToken(mockUuid);
      expect(result.success).toBe(true);

      expect(spyUpdate).toHaveBeenCalledTimes(1);
      const callArgs = spyUpdate.mock.calls[0][0];
      expect(callArgs.where.token).toBe(mockUuid);
      expect(callArgs.data.used).toBe(true);
    });
  });
});
