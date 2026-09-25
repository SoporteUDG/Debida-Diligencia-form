import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "../../server/routers/_app";
import { verifyToken } from "../tokenService";
import { FORM_TYPE_HEADER, tokenReasonFromResponse } from "../tokenAccess";

vi.mock("../zohoService", () => ({
  zoho: { service: { getContact: vi.fn(), createNote: vi.fn(), updateClientFormLink: vi.fn() } },
  mergeCrmAndDraft: vi.fn((crm, draft) => ({ ...crm, ...draft })),
}));

vi.mock("../tokenService", () => ({
  verifyToken: vi.fn(),
  verifySignature: vi.fn(),
  generateToken: vi.fn(),
  reactivateToken: vi.fn(),
  revokeToken: vi.fn(),
  signUuid: vi.fn(),
}));

vi.mock("../auditService", () => ({
  logAuditEvent: vi.fn().mockResolvedValue({}),
  computeDiff: vi.fn().mockReturnValue({}),
  sanitizeDetails: vi.fn((x) => x),
}));

/** Borrador registrado al generar el enlace: su tipo define el formulario del enlace. */
function mockPrisma(draftType: "NATURAL" | "JURIDICA") {
  const draft = { id: "draft-1", token: "uuid-1", type: draftType, data: {}, step: 0, updatedAt: new Date("2026-09-25T12:00:00Z") };
  return {
    draft: {
      findUnique: vi.fn().mockResolvedValue(draft),
      update: vi.fn().mockResolvedValue(draft),
      create: vi.fn(),
    },
    crmContact: { findUnique: vi.fn().mockResolvedValue(null) },
  };
}

/** Llama a getDraft por HTTP, igual que el navegador, y devuelve estado + JSON. */
async function callGetDraft(prisma: unknown, headers: Record<string, string>) {
  const req = new Request("http://localhost/api/trpc/getDraft", {
    headers: { Authorization: "Bearer uuid-1.signature", ...headers },
  });
  const res = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ({ req: req as any, prisma: prisma as any, ip: "127.0.0.1", userAgent: "vitest" }),
  });
  return { status: res.status, body: await res.json() };
}

describe("Acceso al formulario con el enlace del cliente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("un enlace ya utilizado o revocado responde 401 con motivo USED", async () => {
    vi.mocked(verifyToken).mockResolvedValue({
      success: false,
      error: "Token ya ha sido utilizado o se encuentra revocado",
      reason: "USED",
    });
    const prisma = mockPrisma("NATURAL");

    const { status, body } = await callGetDraft(prisma, { [FORM_TYPE_HEADER]: "NATURAL" });

    expect(status).toBe(401);
    expect(tokenReasonFromResponse(body)).toBe("USED");
    expect(prisma.draft.update).not.toHaveBeenCalled();
  });

  it("un enlace de persona natural no abre el formulario de persona jurídica", async () => {
    vi.mocked(verifyToken).mockResolvedValue({ success: true, type: "ACCESS", uuid: "uuid-1", crmContactId: "c-1" });
    const prisma = mockPrisma("NATURAL");

    const { status, body } = await callGetDraft(prisma, { [FORM_TYPE_HEADER]: "JURIDICA" });

    expect(status).toBe(403);
    expect(tokenReasonFromResponse(body)).toBe("WRONG_FORM");
    expect(prisma.draft.update).not.toHaveBeenCalled();
  });

  it("un enlace de persona jurídica no abre el formulario de persona natural", async () => {
    vi.mocked(verifyToken).mockResolvedValue({ success: true, type: "ACCESS", uuid: "uuid-1", crmContactId: "c-1" });

    const { status, body } = await callGetDraft(mockPrisma("JURIDICA"), { [FORM_TYPE_HEADER]: "NATURAL" });

    expect(status).toBe(403);
    expect(tokenReasonFromResponse(body)).toBe("WRONG_FORM");
  });

  it("el enlace correcto en su formulario da acceso", async () => {
    vi.mocked(verifyToken).mockResolvedValue({ success: true, type: "ACCESS", uuid: "uuid-1", crmContactId: "c-1" });

    const { status, body } = await callGetDraft(mockPrisma("JURIDICA"), { [FORM_TYPE_HEADER]: "JURIDICA" });

    expect(status).toBe(200);
    expect(tokenReasonFromResponse(body)).toBeNull();
    expect(body.result.data.exists).toBe(true);
  });

  it("sin cabecera de formulario se mantiene el comportamiento anterior", async () => {
    vi.mocked(verifyToken).mockResolvedValue({ success: true, type: "ACCESS", uuid: "uuid-1", crmContactId: "c-1" });

    const { status } = await callGetDraft(mockPrisma("NATURAL"), {});

    expect(status).toBe(200);
  });

  it("un enlace vencido informa el motivo EXPIRED", async () => {
    vi.mocked(verifyToken).mockResolvedValue({ success: false, error: "Token expirado", reason: "EXPIRED" });

    const { status, body } = await callGetDraft(mockPrisma("NATURAL"), { [FORM_TYPE_HEADER]: "NATURAL" });

    expect(status).toBe(401);
    expect(tokenReasonFromResponse(body)).toBe("EXPIRED");
  });
});
