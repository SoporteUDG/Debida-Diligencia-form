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
      getAccountRecord: vi.fn(),
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
const nuevo = { id: "ac2", crmId: "zc2", accountCrmId: "s1", firstName: "Luis", lastName: "Mora" };
const dd = (id: string, tipo: string, relatedCrmId = "") => ({ id, name: id, estado: "", contactCrmId: "", tipo, retirado: false, relatedCrmId });
const sinExpedientes = { juridica: null, natural: null, duplicados: false, juridicas: [], naturales: [], retirados: [] };
const ambos = {
  ...sinExpedientes,
  juridica: dd("jur1", "Jurídica", "nat1"),
  natural: dd("nat1", "Natural", "jur1"),
  juridicas: [dd("jur1", "Jurídica", "nat1")],
  naturales: [dd("nat1", "Natural", "jur1")],
};

const post = (body: any) =>
  POST(new NextRequest("http://localhost/api/generar-expediente", { method: "POST", body: JSON.stringify(body) }));
const juridica = (extra: any = {}) => post({ name: "ACME", type: "juridica", socioId: "s1", ...extra });

beforeEach(() => {
  vi.clearAllMocks();
  contactoMock.obtenerContactosDeCuenta.mockResolvedValue([contacto, nuevo]);
  contactoMock.clasificarContactosNaturales.mockResolvedValue({
    faltantes: [nuevo],
    existentes: [{ contact: contacto, ddCrmId: "natc1", fuente: "zoho" }],
    eliminadosEnZoho: [],
  });
  contactoMock.clasificarExpedientesJuridica.mockResolvedValue(sinExpedientes);
  zohoMock.service.getAccountRecord.mockResolvedValue({ Representante_legal: "Carlos Gómez Ruiz" });
  let n = 0;
  zohoMock.service.createDebidaDiligenciaRecord.mockImplementation(async () => ({ success: true, debidaId: `new${++n}` }));
  prismaMock.crmContact.upsert.mockResolvedValue({ id: "cc1" });
  enlaceMock.crearEnlaceConBorrador.mockResolvedValue({ tokenUuid: "tk", clientUrl: "https://x/f?token=tk", expiresAt: new Date() });
  enlaceMock.prepararExpedienteRelacionado.mockResolvedValue({ crmId: "nat-new", clientUrl: "https://x/rel" });
});

describe("/api/generar-expediente — Persona Jurídica", () => {
  it("sin expedientes crea el jurídico y el del Representante Legal, sin contacto y con Nombre_natural", async () => {
    const res = await juridica();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(zohoMock.service.createDebidaDiligenciaRecord).toHaveBeenCalledTimes(1);
    const creado = zohoMock.service.createDebidaDiligenciaRecord.mock.calls[0][0];
    expect(creado).toMatchObject({ clientType: "JURIDICA", nombreNatural: "Carlos Gómez Ruiz", contactCrmId: undefined });
    expect(creado).not.toHaveProperty("relatedDDId");
    expect(enlaceMock.prepararExpedienteRelacionado).toHaveBeenCalledWith(
      expect.objectContaining({ juridicaCrmId: "new1", representanteLegal: "Carlos Gómez Ruiz", overRideName: "Representante Legal (Carlos Gómez Ruiz)" })
    );
    expect(enlaceMock.prepararExpedienteRelacionado.mock.calls[0][0].accountContact).toBeUndefined();
    expect(enlaceMock.crearEnlaceConBorrador.mock.calls[0][0].draftData).toMatchObject({ rlNombre: "Carlos Gómez Ruiz" });
    expect(enlaceMock.crearEnlaceConBorrador.mock.calls[0][0].draftData).not.toHaveProperty("Nombre_de_contacto");
    // Sin contactos marcados no se buscan contactos
    expect(contactoMock.obtenerContactosDeCuenta).not.toHaveBeenCalled();
    expect(json).toMatchObject({ crmId: "new1", relatedCrmId: "nat-new" });
  });

  it("sin Representante_legal en el socio responde 422 y no crea nada", async () => {
    zohoMock.service.getAccountRecord.mockResolvedValue({ Representante_legal: "  " });
    const res = await juridica({ contactos: ["zc2"] });
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("SIN_REPRESENTANTE_LEGAL");
    expect(zohoMock.service.createDebidaDiligenciaRecord).not.toHaveBeenCalled();
    expect(enlaceMock.prepararExpedienteRelacionado).not.toHaveBeenCalled();
  });

  it("con el jurídico vigente solo crea el del Representante Legal", async () => {
    contactoMock.clasificarExpedientesJuridica.mockResolvedValue({ ...sinExpedientes, juridica: dd("jur1", "Jurídica"), juridicas: [dd("jur1", "Jurídica")] });
    const json = await (await juridica()).json();
    expect(zohoMock.service.createDebidaDiligenciaRecord).not.toHaveBeenCalled();
    expect(enlaceMock.prepararExpedienteRelacionado).toHaveBeenCalledWith(
      expect.objectContaining({ juridicaCrmId: "jur1", representanteLegal: "Carlos Gómez Ruiz", crearNuevo: false })
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

  it("con el Representante Legal vigente solo crea el jurídico, relacionado en ambos sentidos", async () => {
    contactoMock.clasificarExpedientesJuridica.mockResolvedValue({ ...sinExpedientes, natural: dd("nat1", "Natural"), naturales: [dd("nat1", "Natural")] });
    const json = await (await juridica()).json();
    expect(zohoMock.service.createDebidaDiligenciaRecord).toHaveBeenCalledWith(expect.objectContaining({ clientType: "JURIDICA", relatedDDId: "nat1" }));
    expect(enlaceMock.prepararExpedienteRelacionado).not.toHaveBeenCalled();
    expect(zohoMock.service.setRelatedDD).toHaveBeenCalledWith("nat1", "new1");
    expect(json).toMatchObject({ crmId: "new1", relatedCrmId: "nat1" });
  });

  it("con ambos vigentes y sin contactos marcados no crea nada (no exige Representante_legal)", async () => {
    contactoMock.clasificarExpedientesJuridica.mockResolvedValue(ambos);
    zohoMock.service.getAccountRecord.mockResolvedValue({});
    const json = await (await juridica()).json();
    expect(json).toMatchObject({ status: "already_exists", crmId: "jur1", relatedCrmId: "nat1" });
    expect(zohoMock.service.createDebidaDiligenciaRecord).not.toHaveBeenCalled();
    expect(zohoMock.service.setRelatedDD).not.toHaveBeenCalled();
  });

  it("con ambos vigentes crea solo los contactos marcados que faltan, como Persona Natural con contacto", async () => {
    contactoMock.clasificarExpedientesJuridica.mockResolvedValue(ambos);
    const json = await (await juridica({ contactos: ["zc1", "zc2", "otro"] })).json();
    expect(contactoMock.obtenerContactosDeCuenta).toHaveBeenCalledWith("s1", "JURIDICA", { todos: true });
    expect(zohoMock.service.createDebidaDiligenciaRecord).toHaveBeenCalledTimes(1);
    expect(zohoMock.service.createDebidaDiligenciaRecord).toHaveBeenCalledWith(
      expect.objectContaining({ clientType: "NATURAL", contactCrmId: "zc2", name: "Luis Mora" })
    );
    expect(json).toMatchObject({ status: "success", contactId: "zc2", contactosOmitidos: ["zc1", "otro"], principales: { crmId: "jur1" } });
  });

  it("sin expedientes y con un contacto marcado crea los principales y el del contacto", async () => {
    const json = await (await juridica({ contactos: ["zc2"] })).json();
    expect(zohoMock.service.createDebidaDiligenciaRecord).toHaveBeenCalledTimes(2);
    expect(json.expedientes.map((e: any) => [e.tipo, e.crmId])).toEqual([["JURIDICA", "new1"], ["NATURAL", "new2"]]);
    expect(json.crmId).toBe("new1");
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
  const natural = (extra: any = {}) => post({ name: "Socio", type: "natural", socioId: "s1", ...extra });

  it("sin lista de contactos crea los que faltan", async () => {
    const json = await (await natural()).json();
    expect(zohoMock.service.createDebidaDiligenciaRecord).toHaveBeenCalledTimes(1);
    expect(zohoMock.service.createDebidaDiligenciaRecord).toHaveBeenCalledWith(expect.objectContaining({ contactCrmId: "zc2" }));
    expect(contactoMock.clasificarExpedientesJuridica).not.toHaveBeenCalled();
    expect(zohoMock.service.getAccountRecord).not.toHaveBeenCalled();
    expect(json).toMatchObject({ contactId: "zc2", existentes: [{ contactId: "zc1", crmId: "natc1" }] });
  });

  it("solo crea los contactos marcados", async () => {
    const otro = { ...nuevo, id: "ac3", crmId: "zc3", firstName: "Eva" };
    contactoMock.clasificarContactosNaturales.mockResolvedValue({ faltantes: [nuevo, otro], existentes: [], eliminadosEnZoho: [] });
    await natural({ contactos: ["zc3"] });
    expect(zohoMock.service.createDebidaDiligenciaRecord).toHaveBeenCalledTimes(1);
    expect(zohoMock.service.createDebidaDiligenciaRecord).toHaveBeenCalledWith(expect.objectContaining({ contactCrmId: "zc3" }));
  });

  it("con contactos pendientes pero ninguno marcado responde 400", async () => {
    const res = await natural({ contactos: [] });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("SIN_SELECCION");
    expect(zohoMock.service.createDebidaDiligenciaRecord).not.toHaveBeenCalled();
  });
});
