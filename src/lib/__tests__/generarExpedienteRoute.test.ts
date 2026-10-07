import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { prismaMock, zohoMock, enlaceMock, contactoMock } = vi.hoisted(() => ({
  prismaMock: {
    crmContact: { upsert: vi.fn() },
  },
  zohoMock: {
    service: {
      createDebidaDiligenciaRecord: vi.fn(),
      setRelatedDD: vi.fn(),
      updateClientFormLink: vi.fn(),
      createNote: vi.fn(),
    },
  },
  enlaceMock: { crearEnlaceConBorrador: vi.fn(), prepararExpedienteRelacionado: vi.fn() },
  contactoMock: {
    obtenerContactosDeCuenta: vi.fn(),
    clasificarContactosNaturales: vi.fn(),
    clasificarExpedientesJuridica: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/zohoService", () => ({ zoho: zohoMock, DD_CONTACT_FIELD: "Nombre_de_contacto" }));
vi.mock("@/lib/auditService", () => ({ logAuditEvent: vi.fn() }));
vi.mock("@/lib/enlaceService", () => enlaceMock);
vi.mock("@/lib/accountContactService", () => ({ ...contactoMock, SinContactosError: class extends Error {} }));

import { POST } from "@/app/api/generar-expediente/route";

const contacto = { id: "ac1", crmId: "zc1", accountCrmId: "s1", firstName: "Ana", lastName: "Paz" };
const dd = (id: string, tipo: string, relatedCrmId = "") => ({ id, name: id, estado: "", contactCrmId: "zc1", tipo, retirado: false, relatedCrmId });
const sinExpedientes = { juridica: null, natural: null, duplicados: false, juridicas: [], naturales: [], retirados: [] };

const post = (body: any) =>
  POST(new NextRequest("http://localhost/api/generar-expediente", { method: "POST", body: JSON.stringify(body) }));
const juridica = () => post({ name: "ACME", type: "juridica", socioId: "s1" });

beforeEach(() => {
  vi.clearAllMocks();
  contactoMock.obtenerContactosDeCuenta.mockResolvedValue([contacto]);
  contactoMock.clasificarExpedientesJuridica.mockResolvedValue(sinExpedientes);
  zohoMock.service.createDebidaDiligenciaRecord.mockResolvedValue({ success: true, debidaId: "jur-new" });
  prismaMock.crmContact.upsert.mockResolvedValue({ id: "cc1" });
  enlaceMock.crearEnlaceConBorrador.mockResolvedValue({ tokenUuid: "tk", clientUrl: "https://x/f?token=tk", expiresAt: new Date() });
  enlaceMock.prepararExpedienteRelacionado.mockResolvedValue({ crmId: "nat-new", clientUrl: "https://x/rel" });
});

describe("/api/generar-expediente — Persona Jurídica", () => {
  it("sin expedientes vigentes crea el jurídico y su natural relacionado", async () => {
    const res = await juridica();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(zohoMock.service.createDebidaDiligenciaRecord).toHaveBeenCalledTimes(1);
    expect(zohoMock.service.createDebidaDiligenciaRecord.mock.calls[0][0]).not.toHaveProperty("relatedDDId");
    expect(enlaceMock.prepararExpedienteRelacionado).toHaveBeenCalledWith(expect.objectContaining({ juridicaCrmId: "jur-new" }));
    expect(json).toMatchObject({ crmId: "jur-new", relatedCrmId: "nat-new" });
  });

  it("con el jurídico vigente solo crea el natural y lo relaciona a él", async () => {
    contactoMock.clasificarExpedientesJuridica.mockResolvedValue({ ...sinExpedientes, juridica: dd("jur1", "Jurídica"), juridicas: [dd("jur1", "Jurídica")] });
    const res = await juridica();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(zohoMock.service.createDebidaDiligenciaRecord).not.toHaveBeenCalled();
    expect(enlaceMock.crearEnlaceConBorrador).not.toHaveBeenCalled();
    expect(enlaceMock.prepararExpedienteRelacionado).toHaveBeenCalledWith(
      expect.objectContaining({ juridicaCrmId: "jur1", socioId: "s1", accountContact: contacto, crearNuevo: false })
    );
    expect(json).toMatchObject({ success: true, crmId: "jur1", relatedCrmId: "nat-new" });
  });

  it("si el DD_relacionado del jurídico está retirado crea un natural nuevo", async () => {
    contactoMock.clasificarExpedientesJuridica.mockResolvedValue({
      ...sinExpedientes,
      juridica: dd("jur1", "Jurídica", "nat-old"),
      juridicas: [dd("jur1", "Jurídica", "nat-old")],
      retirados: ["nat-old"],
    });
    await juridica();
    expect(enlaceMock.prepararExpedienteRelacionado).toHaveBeenCalledWith(expect.objectContaining({ crearNuevo: true }));
  });

  it("con el natural vigente solo crea el jurídico, relacionado en ambos sentidos", async () => {
    contactoMock.clasificarExpedientesJuridica.mockResolvedValue({ ...sinExpedientes, natural: dd("nat1", "Natural"), naturales: [dd("nat1", "Natural")] });
    const res = await juridica();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(zohoMock.service.createDebidaDiligenciaRecord).toHaveBeenCalledWith(expect.objectContaining({ clientType: "JURIDICA", relatedDDId: "nat1" }));
    expect(enlaceMock.prepararExpedienteRelacionado).not.toHaveBeenCalled();
    expect(zohoMock.service.setRelatedDD).toHaveBeenCalledWith("nat1", "jur-new");
    expect(json).toMatchObject({ crmId: "jur-new", relatedCrmId: "nat1" });
  });

  it("con ambos vigentes no crea nada y asegura el vínculo", async () => {
    contactoMock.clasificarExpedientesJuridica.mockResolvedValue({
      ...sinExpedientes,
      juridica: dd("jur1", "Jurídica", "nat1"),
      natural: dd("nat1", "Natural"),
      juridicas: [dd("jur1", "Jurídica", "nat1")],
      naturales: [dd("nat1", "Natural")],
    });
    const json = await (await juridica()).json();
    expect(json.status).toBe("already_exists");
    expect(zohoMock.service.createDebidaDiligenciaRecord).not.toHaveBeenCalled();
    expect(enlaceMock.prepararExpedienteRelacionado).not.toHaveBeenCalled();
    expect(zohoMock.service.setRelatedDD).toHaveBeenCalledTimes(1);
    expect(zohoMock.service.setRelatedDD).toHaveBeenCalledWith("nat1", "jur1");
  });

  it("con expedientes duplicados responde 409", async () => {
    contactoMock.clasificarExpedientesJuridica.mockResolvedValue({
      ...sinExpedientes,
      duplicados: true,
      juridica: dd("jur1", "Jurídica"),
      juridicas: [dd("jur1", "Jurídica"), dd("jur2", "Jurídica")],
    });
    const res = await juridica();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("DUPLICADOS");
    expect(zohoMock.service.createDebidaDiligenciaRecord).not.toHaveBeenCalled();
  });
});

describe("/api/generar-expediente — Persona Natural", () => {
  it("solo crea el expediente del contacto nuevo", async () => {
    const nuevo = { ...contacto, id: "ac2", crmId: "zc2", firstName: "Luis" };
    contactoMock.obtenerContactosDeCuenta.mockResolvedValue([contacto, nuevo]);
    contactoMock.clasificarContactosNaturales.mockResolvedValue({
      faltantes: [nuevo],
      existentes: [{ contact: contacto, ddCrmId: "nat1", fuente: "zoho" }],
      eliminadosEnZoho: [],
    });
    const json = await (await post({ name: "Socio", type: "natural", socioId: "s1" })).json();
    expect(zohoMock.service.createDebidaDiligenciaRecord).toHaveBeenCalledTimes(1);
    expect(zohoMock.service.createDebidaDiligenciaRecord).toHaveBeenCalledWith(expect.objectContaining({ contactCrmId: "zc2" }));
    expect(contactoMock.clasificarExpedientesJuridica).not.toHaveBeenCalled();
    expect(json).toMatchObject({ contactId: "zc2", existentes: [{ contactId: "zc1", crmId: "nat1" }] });
  });
});
