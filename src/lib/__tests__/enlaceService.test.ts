import { vi, describe, it, expect, beforeEach } from "vitest";

const { prismaMock, zohoMock } = vi.hoisted(() => ({
  prismaMock: {
    crmContact: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    form: { findFirst: vi.fn() },
    draft: { upsert: vi.fn() },
  },
  zohoMock: {
    service: {
      getRelatedDDId: vi.fn(),
      createDebidaDiligenciaRecord: vi.fn(),
      setRelatedDD: vi.fn(),
      getDDRecord: vi.fn(),
      getAccountContactRecord: vi.fn(),
      updateClientFormLink: vi.fn(),
      createNote: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/tokenService", () => ({ generateToken: vi.fn(async () => "tok-uuid") }));
vi.mock("@/lib/zohoChangeService", () => ({ datosFormularioDesdeZoho: vi.fn(() => ({})) }));
vi.mock("@/lib/zohoService", () => ({
  zoho: zohoMock,
  contactRecordToFormData: vi.fn(() => ({})),
  DD_CONTACT_FIELD: "Nombre_de_contacto",
}));

import { prepararExpedienteRelacionado } from "../enlaceService";

beforeEach(() => {
  vi.clearAllMocks();
  zohoMock.service.getRelatedDDId.mockResolvedValue(null);
  zohoMock.service.createDebidaDiligenciaRecord.mockResolvedValue({ debidaId: "nat1" });
  zohoMock.service.getDDRecord.mockResolvedValue(null);
  zohoMock.service.getAccountContactRecord.mockResolvedValue(null);
  prismaMock.crmContact.findUnique.mockResolvedValue(null);
  prismaMock.crmContact.create.mockResolvedValue({ id: "cc1", crmId: "nat1" });
  prismaMock.form.findFirst.mockResolvedValue(null);
});

describe("prepararExpedienteRelacionado", () => {
  const base = { juridicaCrmId: "jur1", clientName: "ACME", appUrl: "https://x", socioId: "s1" };

  it("vincula el Contact de la cuenta al expediente natural relacionado (registro, Prisma y borrador)", async () => {
    await prepararExpedienteRelacionado({ ...base, accountContact: { id: "ac1", crmId: "zc1" } });

    expect(zohoMock.service.createDebidaDiligenciaRecord).toHaveBeenCalledWith(
      expect.objectContaining({ clientType: "NATURAL", relatedDDId: "jur1", contactCrmId: "zc1" })
    );
    expect(prismaMock.crmContact.create.mock.calls[0][0].data).toMatchObject({ accountContactId: "ac1" });
    expect(prismaMock.draft.upsert.mock.calls[0][0].create.data).toMatchObject({ Nombre_de_contacto: "zc1" });
  });

  it("sin contacto de cuenta no envía el lookup", async () => {
    await prepararExpedienteRelacionado(base);

    expect(zohoMock.service.createDebidaDiligenciaRecord.mock.calls[0][0].contactCrmId).toBeUndefined();
    expect(prismaMock.draft.upsert.mock.calls[0][0].create.data).not.toHaveProperty("Nombre_de_contacto");
  });
});
