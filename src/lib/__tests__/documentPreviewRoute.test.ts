import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { prismaMock, verifyTokenMock } = vi.hoisted(() => ({
  prismaMock: {
    draft: { findUnique: vi.fn() },
    document: { findFirst: vi.fn() },
  },
  verifyTokenMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/tokenService", () => ({ verifyToken: verifyTokenMock }));
vi.mock("@/lib/zohoAuthService", () => ({ getAccessToken: vi.fn().mockResolvedValue("zoho-token") }));

import { GET } from "@/app/api/documents/preview/route";

const pedir = (query = "name=Aviso.pdf&token=t") => GET(new NextRequest(`https://portal.test/api/documents/preview?${query}`));
const documento = {
  name: "Aviso.pdf",
  originalName: "mi aviso ñ.pdf",
  fileType: "application/pdf",
  zohoFileId: "z1",
};

beforeEach(() => {
  vi.clearAllMocks();
  verifyTokenMock.mockResolvedValue({ success: true, uuid: "uuid-1" });
  prismaMock.draft.findUnique.mockResolvedValue({ id: "draft-1" });
  prismaMock.document.findFirst.mockResolvedValue(documento);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("pdf-bytes", { status: 200 })));
});

describe("GET /api/documents/preview", () => {
  it("sirve el documento en línea con el nombre del cliente y sin caché", async () => {
    const res = await pedir();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toBe(`inline; filename*=UTF-8''${encodeURIComponent("mi aviso ñ.pdf")}`);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await res.text()).toBe("pdf-bytes");
  });

  it("solo busca el documento dentro del borrador del token", async () => {
    await pedir();
    expect(prismaMock.draft.findUnique.mock.calls[0][0].where).toEqual({ token: "uuid-1" });
    expect(prismaMock.document.findFirst.mock.calls[0][0].where).toEqual({ draftId: "draft-1", name: "Aviso.pdf", deletedAt: null });
  });

  it("rechaza un token inválido sin consultar documentos ni Zoho", async () => {
    verifyTokenMock.mockResolvedValue({ success: false, reason: "EXPIRED" });
    expect((await pedir()).status).toBe(401);
    expect(prismaMock.document.findFirst).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("exige nombre y token", async () => {
    expect((await pedir("name=Aviso.pdf")).status).toBe(400);
    expect((await pedir("token=t")).status).toBe(400);
  });

  it("responde 404 si el documento no está en ese borrador", async () => {
    prismaMock.document.findFirst.mockResolvedValue(null);
    expect((await pedir()).status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("responde 404 si el archivo nunca llegó a WorkDrive", async () => {
    prismaMock.document.findFirst.mockResolvedValue({ ...documento, zohoFileId: "PENDING_SYNC" });
    expect((await pedir()).status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("responde 502 si Zoho falla", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("error", { status: 500 })));
    expect((await pedir()).status).toBe(502);
  });
});
