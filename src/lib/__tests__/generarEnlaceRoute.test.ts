import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { prismaMock, zohoMock, enlaceMock, contactoMock, SinContactoErr } = vi.hoisted(() => {
  class SinContactoErr extends Error {
    constructor(public ddCrmId: string) {
      super("sin contacto");
    }
  }
  return {
    SinContactoErr,
    prismaMock: {
      crmContact: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
      draft: { findFirst: vi.fn() },
    },
    zohoMock: {
      service: {
        getDDRecord: vi.fn(),
        getContact: vi.fn(),
        updateClientFormLink: vi.fn(),
        createNote: vi.fn(),
      },
    },
    enlaceMock: { crearEnlaceConBorrador: vi.fn(), prepararExpedienteRelacionado: vi.fn() },
    contactoMock: { resolverContactoDeExpediente: vi.fn() },
  };
});

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/zohoService", () => ({ zoho: zohoMock, DD_CONTACT_FIELD: "Nombre_de_contacto" }));
vi.mock("@/lib/auditService", () => ({ logAuditEvent: vi.fn() }));
vi.mock("@/lib/enlaceService", () => enlaceMock);
vi.mock("@/lib/accountContactService", () => ({
  resolverContactoDeExpediente: contactoMock.resolverContactoDeExpediente,
  SinContactoExpedienteError: SinContactoErr,
}));

import { POST } from "@/app/api/generar-enlace/route";

const contacto = { id: "ac1", crmId: "zc1", accountCrmId: "s1", firstName: "Ana", lastName: "Paz" };
const local = { id: "cc1", crmId: "dd1", accountContactId: "ac1", accountCrmId: "s1" };

const post = (body: any) =>
  POST(new NextRequest("http://localhost/api/generar-enlace", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));

beforeEach(() => {
  vi.clearAllMocks();
  zohoMock.service.getDDRecord.mockResolvedValue({ Socio_de_Negocios: { id: "s1" } });
  zohoMock.service.getContact.mockResolvedValue({});
  contactoMock.resolverContactoDeExpediente.mockResolvedValue(contacto);
  prismaMock.crmContact.findUnique.mockImplementation(async ({ where }: any) => (where.crmId === "dd1" ? local : null));
  prismaMock.draft.findFirst.mockResolvedValue(null);
  enlaceMock.crearEnlaceConBorrador.mockResolvedValue({ tokenUuid: "tk", clientUrl: "https://x/persona-natural?token=tk", expiresAt: new Date() });
  enlaceMock.prepararExpedienteRelacionado.mockResolvedValue({ crmId: "nat1", clientUrl: "https://x/rel" });
});

describe("POST /api/generar-enlace", () => {
  it("exige un Contact de Zoho (422) y no crea nada", async () => {
    contactoMock.resolverContactoDeExpediente.mockRejectedValue(new SinContactoErr("dd1"));
    const res = await post({ recordId: "dd1", tipo: "natural" });
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("SIN_CONTACTO");
    expect(enlaceMock.crearEnlaceConBorrador).not.toHaveBeenCalled();
    expect(enlaceMock.prepararExpedienteRelacionado).not.toHaveBeenCalled();
  });

  it.each([
    ["marca retirado en Zoho", { Socio_de_Negocios: { id: "s1" }, retirado: true }, local],
    ["Estado Anulado en Zoho", { Socio_de_Negocios: { id: "s1" }, Estado: "Anulado" }, local],
    ["archivado en el portal", { Socio_de_Negocios: { id: "s1" } }, { ...local, retiredAt: new Date() }],
  ])("expediente retirado (%s): 409 RETIRADO y no crea nada", async (_caso, ddRecord, contactoLocal) => {
    zohoMock.service.getDDRecord.mockResolvedValue(ddRecord);
    prismaMock.crmContact.findUnique.mockResolvedValue(contactoLocal);
    const res = await post({ recordId: "dd1", tipo: "juridica" });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("RETIRADO");
    expect(contactoMock.resolverContactoDeExpediente).not.toHaveBeenCalled();
    expect(enlaceMock.crearEnlaceConBorrador).not.toHaveBeenCalled();
    expect(enlaceMock.prepararExpedienteRelacionado).not.toHaveBeenCalled();
  });

  it("404 si el expediente no existe en Zoho", async () => {
    zohoMock.service.getDDRecord.mockResolvedValue(null);
    expect((await post({ recordId: "dd1", tipo: "natural" })).status).toBe(404);
  });

  it("natural: crea el enlace con el Contact vinculado", async () => {
    const res = await post({ recordId: "dd1", tipo: "natural" });
    expect(res.status).toBe(200);
    expect(enlaceMock.crearEnlaceConBorrador).toHaveBeenCalledWith(
      expect.objectContaining({ isNatural: true, contactCrmId: "zc1", draftData: expect.objectContaining({ Nombre_de_contacto: "zc1" }) })
    );
    expect(enlaceMock.prepararExpedienteRelacionado).not.toHaveBeenCalled();
  });

  it("natural con enlace ya creado: 409 ALREADY_EXISTS", async () => {
    prismaMock.draft.findFirst.mockResolvedValue({ id: "d1" });
    const res = await post({ recordId: "dd1", tipo: "natural" });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("ALREADY_EXISTS");
    expect(enlaceMock.crearEnlaceConBorrador).not.toHaveBeenCalled();
  });

  it("juridica sin relacionado: lo crea con el Contact y genera el enlace", async () => {
    const res = await post({ recordId: "dd1", tipo: "juridica" });
    expect(res.status).toBe(200);
    expect(enlaceMock.prepararExpedienteRelacionado).toHaveBeenCalledWith(
      expect.objectContaining({ juridicaCrmId: "dd1", accountContact: contacto })
    );
    expect(enlaceMock.crearEnlaceConBorrador).toHaveBeenCalled();
    expect((await res.json()).relatedCrmId).toBe("nat1");
  });

  it("juridica con enlace y relacionado ya completos (Zoho y Prisma): 409 y no crea nada", async () => {
    zohoMock.service.getDDRecord.mockResolvedValue({ Socio_de_Negocios: { id: "s1" }, DD_relacionado: { id: "nat1" } });
    prismaMock.draft.findFirst.mockResolvedValue({ id: "d1" });
    prismaMock.crmContact.findUnique.mockImplementation(async ({ where }: any) =>
      where.crmId === "dd1" ? local : where.crmId === "nat1" ? { _count: { drafts: 1, forms: 0 } } : null
    );
    const res = await post({ recordId: "dd1", tipo: "juridica" });
    expect(res.status).toBe(409);
    expect(enlaceMock.prepararExpedienteRelacionado).not.toHaveBeenCalled();
    expect(enlaceMock.crearEnlaceConBorrador).not.toHaveBeenCalled();
  });

  it("juridica: relacionado en Zoho pero no en Prisma -> se completa (reutiliza el de Zoho)", async () => {
    zohoMock.service.getDDRecord.mockResolvedValue({ Socio_de_Negocios: { id: "s1" }, DD_relacionado: { id: "nat1" } });
    prismaMock.draft.findFirst.mockResolvedValue({ id: "d1" });
    const res = await post({ recordId: "dd1", tipo: "juridica" });
    expect(res.status).toBe(200);
    expect(enlaceMock.prepararExpedienteRelacionado).toHaveBeenCalled();
    // el enlace principal ya existía: no se genera otro
    expect(enlaceMock.crearEnlaceConBorrador).not.toHaveBeenCalled();
    expect((await res.json()).clientUrl).toBeNull();
  });

  it("juridica con relacionado completo pero sin enlace principal: solo genera el enlace", async () => {
    zohoMock.service.getDDRecord.mockResolvedValue({ Socio_de_Negocios: { id: "s1" }, DD_relacionado: { id: "nat1" } });
    prismaMock.crmContact.findUnique.mockImplementation(async ({ where }: any) =>
      where.crmId === "dd1" ? local : where.crmId === "nat1" ? { _count: { drafts: 0, forms: 1 } } : null
    );
    const res = await post({ recordId: "dd1", tipo: "juridica" });
    expect(res.status).toBe(200);
    expect(enlaceMock.prepararExpedienteRelacionado).not.toHaveBeenCalled();
    expect(enlaceMock.crearEnlaceConBorrador).toHaveBeenCalled();
  });
});
