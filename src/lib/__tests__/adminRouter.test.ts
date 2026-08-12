import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "../../server/routers/_app";
import { zoho } from "../zohoService";
import { logAuditEvent } from "../auditService";

// Mock zoho service methods
vi.mock("../zohoService", () => {
  return {
    zoho: {
      service: {
        getContact: vi.fn(),
        updateContact: vi.fn(),
        searchContacts: vi.fn(),
        updateClientFormLink: vi.fn(),
      }
    },
    mergeCrmAndDraft: vi.fn((crm, draft) => ({ ...crm, ...draft })),
  };
});

// Mock token service
vi.mock("../tokenService", () => {
  return {
    generateToken: vi.fn().mockResolvedValue("mock-token-uuid.mock-signature"),
    reactivateToken: vi.fn().mockResolvedValue({ success: true }),
    signUuid: vi.fn(),
    verifySignature: vi.fn(),
  };
});

// Mock audit service to isolate database environment during testing
vi.mock("../auditService", () => {
  return {
    logAuditEvent: vi.fn().mockResolvedValue({}),
    computeDiff: vi.fn().mockReturnValue({}),
    sanitizeDetails: vi.fn((x) => x),
  };
});

describe("Admin Router tRPC Procedures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch submissions and drafts via getSubmissions procedure", async () => {
    const mockPrisma = {
      form: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "form-uuid-123",
            type: "NATURAL",
            clientName: "John Doe",
            projectName: "Ocean Reef",
            submittedAt: new Date(),
            status: "SUBMITTED",
            data: {},
            conclusionesVerificacion: "Checked",
          }
        ])
      },
      draft: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "draft-uuid-456",
            type: "JURIDICA",
            token: "mock-draft-token",
            createdAt: new Date(),
            updatedAt: new Date(),
            crmContact: {
              firstName: "Empresa",
              lastName: "Test S.A.",
            },
            data: {
              nombreProyecto: "Costa del Este",
              razonSocial: "Empresa Test S.A.",
            },
            documents: [],
          }
        ])
      }
    };

    const caller = appRouter.createCaller({
      prisma: mockPrisma as any,
      req: {
        headers: new Map([["x-admin-token", "admin-secret-dev"]])
      } as any,
      ip: "127.0.0.1",
      userAgent: "vitest"
    });

    const result = await caller.getSubmissions();
    expect(result).toBeDefined();
    expect(result.length).toBe(2); // 1 form + 1 draft
    
    // Validate form mapping
    const formRecord = result.find(r => r.status === "SUBMITTED");
    expect(formRecord).toBeDefined();
    expect(formRecord?.clientName).toBe("John Doe");

    // Validate draft mapping
    const draftRecord = result.find(r => r.status === "DRAFT");
    expect(draftRecord).toBeDefined();
    expect(draftRecord?.clientName).toBe("Empresa Test S.A.");
    expect(draftRecord?.projectName).toBe("Costa del Este");
  });

  it("should search crm contacts via searchCrmContacts query", async () => {
    const mockContacts = [
      { id: "123", name: "Alice", email: "alice@example.com", phone: "123", module: "Contacts" as const, type: "NATURAL" as const }
    ];
    vi.mocked(zoho.service.searchContacts).mockResolvedValue(mockContacts);

    const caller = appRouter.createCaller({
      prisma: {} as any,
      req: {
        headers: new Map([["x-admin-token", "admin-secret-dev"]])
      } as any,
      ip: "127.0.0.1",
      userAgent: "vitest"
    });

    const result = await caller.searchCrmContacts({ query: "Alice" });
    expect(result).toEqual(mockContacts);
    expect(zoho.service.searchContacts).toHaveBeenCalledWith("Alice");
  });

  it("should generate client link via generateClientLink mutation", async () => {
    // 1. Mock zoho.service.getContact
    vi.mocked(zoho.service.getContact).mockResolvedValue({
      firstName: "Bob",
      lastName: "Smith",
      email: "bob@example.com",
      celular: "5076000000",
      type: "NATURAL",
      nombreProyecto: "Santa Maria Tower"
    });

    vi.mocked(zoho.service.updateClientFormLink).mockResolvedValue({ success: true });

    // 2. Mock prisma upserts and creates
    const mockPrisma = {
      crmContact: {
        upsert: vi.fn().mockResolvedValue({ id: "contact-uuid-789", crmId: "crm-contact-id" })
      },
      draft: {
        create: vi.fn().mockResolvedValue({ id: "draft-uuid-abc", token: "mock-token-uuid" })
      }
    };

    const caller = appRouter.createCaller({
      prisma: mockPrisma as any,
      req: {
        headers: new Map([["x-admin-token", "admin-secret-dev"]])
      } as any,
      ip: "127.0.0.1",
      userAgent: "vitest"
    });

    const result = await caller.generateClientLink({
      crmId: "crm-contact-id",
      clientType: "NATURAL",
      projectName: "Santa Maria Tower",
      advisorName: "Adviser John",
      module: "Contacts"
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.clientUrl).toContain("token=mock-token-uuid.mock-signature");

    expect(zoho.service.getContact).toHaveBeenCalledWith("crm-contact-id");
    expect(mockPrisma.crmContact.upsert).toHaveBeenCalled();
    expect(mockPrisma.draft.create).toHaveBeenCalled();
    expect(logAuditEvent).toHaveBeenCalled();
    expect(zoho.service.updateClientFormLink).toHaveBeenCalled();
  });

  it("should update conclusions via updateConclusions procedure", async () => {
    const mockPrisma = {
      form: {
        update: vi.fn().mockResolvedValue({
          id: "form-uuid-123",
          conclusionesVerificacion: "Aprobado sin novedades",
        })
      }
    };

    const caller = appRouter.createCaller({
      prisma: mockPrisma as any,
      req: {
        headers: new Map([["x-admin-token", "admin-secret-dev"]])
      } as any,
      ip: "127.0.0.1",
      userAgent: "vitest"
    });

    const result = await caller.updateConclusions({
      formId: "123e4567-e89b-12d3-a456-426614174000",
      conclusiones: "Aprobado sin novedades",
    });

    expect(result).toBeDefined();
    expect(result.conclusionesVerificacion).toBe("Aprobado sin novedades");
  });
});
