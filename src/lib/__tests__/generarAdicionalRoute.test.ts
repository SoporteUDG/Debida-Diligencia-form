import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { prismaMock, zohoMock, enlaceMock } = vi.hoisted(() => ({
  prismaMock: { crmContact: { findUnique: vi.fn() } },
  zohoMock: { service: { getDDRecord: vi.fn() } },
  enlaceMock: { crearEnlaceConBorrador: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/zohoService", () => ({ zoho: zohoMock }));
vi.mock("@/lib/auditService", () => ({ logAuditEvent: vi.fn() }));
vi.mock("@/lib/enlaceService", () => enlaceMock);

import { POST } from "@/app/api/generar-adicional/route";

const post = (body: any) =>
  POST(new NextRequest("http://localhost/api/generar-adicional", { method: "POST", body: JSON.stringify(body) }));
const body = { crmId: "dd1", name: "Extra SA", type: "juridica" };

beforeEach(() => {
  vi.clearAllMocks();
  zohoMock.service.getDDRecord.mockResolvedValue({});
  prismaMock.crmContact.findUnique.mockResolvedValue({ id: "cc1", crmId: "dd1", deletedAt: null, retiredAt: null });
  enlaceMock.crearEnlaceConBorrador.mockResolvedValue({ tokenUuid: "tk", clientUrl: "https://x", expiresAt: new Date() });
});

describe("POST /api/generar-adicional con expediente retirado", () => {
  it("crea el adicional si el expediente esta activo", async () => {
    expect((await post(body)).status).toBe(200);
    expect(enlaceMock.crearEnlaceConBorrador).toHaveBeenCalledWith(expect.objectContaining({ isAditional: true }));
  });

  it("archivado en el portal (retiredAt y deletedAt): 409 RETIRADO, no 404", async () => {
    prismaMock.crmContact.findUnique.mockResolvedValue({ id: "cc1", crmId: "dd1", deletedAt: new Date(), retiredAt: new Date() });
    const res = await post(body);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("RETIRADO");
    expect(enlaceMock.crearEnlaceConBorrador).not.toHaveBeenCalled();
  });

  it("marcado retirado en Zoho: 409 RETIRADO", async () => {
    zohoMock.service.getDDRecord.mockResolvedValue({ retirado: true });
    const res = await post(body);
    expect(res.status).toBe(409);
    expect(enlaceMock.crearEnlaceConBorrador).not.toHaveBeenCalled();
  });

  it("si Zoho no responde se usa solo el estado del portal", async () => {
    zohoMock.service.getDDRecord.mockRejectedValue(new Error("zoho caido"));
    expect((await post(body)).status).toBe(200);
  });
});
