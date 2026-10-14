import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { prismaMock, zohoMock, enlaceMock, linkMock, contactoMock } = vi.hoisted(() => ({
  prismaMock: {
    crmContact: { upsert: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  },
  zohoMock: {
    service: {
      createDebidaDiligenciaRecord: vi.fn(),
      getAccountRecord: vi.fn(),
      getDDRecord: vi.fn(),
      updateClientFormLink: vi.fn(),
      createNote: vi.fn(),
    },
  },
  enlaceMock: { crearEnlaceConBorrador: vi.fn() },
  linkMock: {
    crearEnlaceRelacionado: vi.fn(),
    crearEnlaceRepresentante: vi.fn(),
    contactosConEnlaceRelacionado: vi.fn(),
    tieneEnlaceRepresentante: vi.fn(),
    vincularContactosAlExpediente: vi.fn(),
  },
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
vi.mock("@/lib/contactLinkService", () => linkMock);
vi.mock("@/lib/ddRetireService", () => ({
  MENSAJE_RETIRADO: "retirado",
  expedienteRetirado: (r: any, c: any) => !!c?.retiredAt || r?.Estado === "Anulado",
}));
// contactoPrincipal y ContactoEstandarError son los reales: se prueba la regla del contacto estándar
vi.mock("@/lib/accountContactService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/accountContactService")>()),
  ...contactoMock,
}));

import { POST } from "@/app/api/generar-expediente/route";

const ana = { id: "ac1", crmId: "zc1", accountCrmId: "s1", firstName: "Ana", lastName: "Paz", isStandard: true };
const luis = { id: "ac2", crmId: "zc2", accountCrmId: "s1", firstName: "Luis", lastName: "Mora", isStandard: false };
const eva = { id: "ac3", crmId: "zc3", accountCrmId: "s1", firstName: "Eva", lastName: "Ríos", isStandard: false };
const dd = (id: string, tipo: string, relatedCrmId = "") => ({ id, name: id, estado: "", contactCrmId: "", tipo, retirado: false, relatedCrmId });
const sinJuridica = { juridica: null, natural: null, duplicados: false, juridicas: [], naturales: [], retirados: [] };
const conJuridica = { ...sinJuridica, juridica: dd("jur1", "Jurídica"), juridicas: [dd("jur1", "Jurídica")] };
const clasif = (existentes: any[] = []) => ({ faltantes: [], existentes, eliminadosEnZoho: [] });

const post = (body: any) =>
  POST(new NextRequest("http://localhost/api/generar-expediente", { method: "POST", body: JSON.stringify(body) }));
const natural = (extra: any = {}) => post({ name: "Socio", type: "natural", socioId: "s1", ...extra });
const juridica = (extra: any = {}) => post({ name: "ACME", type: "juridica", socioId: "s1", ...extra });

beforeEach(() => {
  vi.clearAllMocks();
  contactoMock.obtenerContactosDeCuenta.mockResolvedValue([ana, luis]);
  contactoMock.clasificarContactosNaturales.mockResolvedValue(clasif());
  contactoMock.clasificarExpedientesJuridica.mockResolvedValue(sinJuridica);
  zohoMock.service.getAccountRecord.mockResolvedValue({ Nombre_Extranjero_No_en_Peachtree: "Carlos Gómez Ruiz", Unidad_Vendida1: "U1" });
  zohoMock.service.getDDRecord.mockResolvedValue({ Estado: "En borrador" });
  let n = 0;
  zohoMock.service.createDebidaDiligenciaRecord.mockImplementation(async () => ({ success: true, debidaId: `new${++n}` }));
  prismaMock.crmContact.upsert.mockImplementation(async ({ where }: any) => ({ id: `cc-${where.crmId}`, crmId: where.crmId }));
  prismaMock.crmContact.findUnique.mockImplementation(async ({ where }: any) => ({ id: `cc-${where.crmId}`, crmId: where.crmId, retiredAt: null }));
  prismaMock.crmContact.create.mockImplementation(async ({ data }: any) => ({ id: `cc-${data.crmId}`, crmId: data.crmId }));
  enlaceMock.crearEnlaceConBorrador.mockResolvedValue({ tokenUuid: "tk", clientUrl: "https://x/f?token=tk", expiresAt: new Date() });
  linkMock.crearEnlaceRelacionado.mockImplementation(async ({ accountContact }: any) => ({
    tokenUuid: `tk-${accountContact.crmId}`,
    clientUrl: `https://x/rel?token=${accountContact.crmId}`,
    expiresAt: new Date(),
  }));
  linkMock.crearEnlaceRepresentante.mockResolvedValue({ tokenUuid: "tk-rl", clientUrl: "https://x/rl", expiresAt: new Date() });
  linkMock.contactosConEnlaceRelacionado.mockResolvedValue(new Set());
  linkMock.tieneEnlaceRepresentante.mockResolvedValue(false);
  linkMock.vincularContactosAlExpediente.mockImplementation(async (_dd: string, ids: string[]) => [...ids]);
});

describe("/api/generar-expediente — Persona Natural", () => {
  it("crea UN expediente para el contacto estándar y un enlace relacionado para cada otro contacto", async () => {
    const res = await natural();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(zohoMock.service.createDebidaDiligenciaRecord).toHaveBeenCalledTimes(1);
    expect(zohoMock.service.createDebidaDiligenciaRecord).toHaveBeenCalledWith(
      expect.objectContaining({ clientType: "NATURAL", contactCrmId: "zc1", name: "Ana Paz" })
    );
    // Enlace principal: vinculado al contacto estándar
    expect(enlaceMock.crearEnlaceConBorrador.mock.calls[0][0]).toMatchObject({ crmId: "new1", contactCrmId: "zc1" });
    expect(enlaceMock.crearEnlaceConBorrador.mock.calls[0][0].draftData).toMatchObject({ Nombre_de_contacto: "zc1" });
    // Relacionado solo para Luis, sobre el mismo expediente
    expect(linkMock.crearEnlaceRelacionado).toHaveBeenCalledTimes(1);
    expect(linkMock.crearEnlaceRelacionado.mock.calls[0][0]).toMatchObject({ crmContact: { crmId: "new1" }, accountContact: luis });
    expect(linkMock.crearEnlaceRepresentante).not.toHaveBeenCalled();
    // Ambos contactos atados al expediente
    expect(linkMock.vincularContactosAlExpediente).toHaveBeenCalledWith("new1", ["zc1", "zc2"]);
    expect(json).toMatchObject({ crmId: "new1", contactId: "zc1", principalContactId: "zc1", relacionados: [{ contactId: "zc2" }] });
  });

  it("sin contacto estándar responde 422 CONTACTO_ESTANDAR y no crea nada", async () => {
    contactoMock.obtenerContactosDeCuenta.mockResolvedValue([{ ...ana, isStandard: false }, luis]);
    const res = await natural();
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("CONTACTO_ESTANDAR");
    expect(zohoMock.service.createDebidaDiligenciaRecord).not.toHaveBeenCalled();
    expect(linkMock.crearEnlaceRelacionado).not.toHaveBeenCalled();
  });

  it("con más de un contacto estándar responde 422 con los contactos marcados", async () => {
    contactoMock.obtenerContactosDeCuenta.mockResolvedValue([ana, { ...luis, isStandard: true }]);
    const res = await natural();
    const json = await res.json();
    expect(res.status).toBe(422);
    expect(json).toMatchObject({ code: "CONTACTO_ESTANDAR", estandares: ["zc1", "zc2"] });
    expect(zohoMock.service.createDebidaDiligenciaRecord).not.toHaveBeenCalled();
  });

  it("con el expediente principal y todos los enlaces creados no crea nada, pero ata los contactos", async () => {
    contactoMock.clasificarContactosNaturales.mockResolvedValue(clasif([{ contact: ana, ddCrmId: "dd1", fuente: "zoho" }]));
    linkMock.contactosConEnlaceRelacionado.mockResolvedValue(new Set(["ac2"]));
    const json = await (await natural()).json();
    expect(json).toMatchObject({ status: "already_exists", crmId: "dd1" });
    expect(zohoMock.service.createDebidaDiligenciaRecord).not.toHaveBeenCalled();
    expect(linkMock.crearEnlaceRelacionado).not.toHaveBeenCalled();
    expect(linkMock.vincularContactosAlExpediente).toHaveBeenCalledWith("dd1", ["zc1", "zc2"]);
  });

  it("con el expediente principal existente solo crea los enlaces que faltan, sin escribir en Zoho", async () => {
    contactoMock.obtenerContactosDeCuenta.mockResolvedValue([ana, luis, eva]);
    contactoMock.clasificarContactosNaturales.mockResolvedValue(clasif([{ contact: ana, ddCrmId: "dd1", fuente: "zoho" }]));
    linkMock.contactosConEnlaceRelacionado.mockResolvedValue(new Set(["ac2"]));
    const json = await (await natural()).json();
    expect(zohoMock.service.createDebidaDiligenciaRecord).not.toHaveBeenCalled();
    expect(enlaceMock.crearEnlaceConBorrador).not.toHaveBeenCalled();
    expect(linkMock.crearEnlaceRelacionado).toHaveBeenCalledTimes(1);
    expect(linkMock.crearEnlaceRelacionado.mock.calls[0][0]).toMatchObject({ crmContact: { crmId: "dd1" }, accountContact: eva });
    expect(json).toMatchObject({ status: "success", crmId: "dd1", relacionados: [{ contactId: "zc3" }] });
  });

  it("solo crea los enlaces de los contactos marcados", async () => {
    contactoMock.obtenerContactosDeCuenta.mockResolvedValue([ana, luis, eva]);
    const json = await (await natural({ contactos: ["zc3", "zc1", "otro"] })).json();
    expect(linkMock.crearEnlaceRelacionado).toHaveBeenCalledTimes(1);
    expect(linkMock.crearEnlaceRelacionado.mock.calls[0][0].accountContact).toBe(eva);
    // El estándar no se reporta como omitido: su expediente se crea siempre
    expect(json.contactosOmitidos).toEqual(["otro"]);
  });

  it("con contactos pendientes pero ninguno marcado responde 400", async () => {
    contactoMock.clasificarContactosNaturales.mockResolvedValue(clasif([{ contact: ana, ddCrmId: "dd1", fuente: "zoho" }]));
    const res = await natural({ contactos: [] });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("SIN_SELECCION");
    expect(linkMock.crearEnlaceRelacionado).not.toHaveBeenCalled();
  });

  it("un contacto con su propio expediente anterior se respeta y se ata a ese expediente", async () => {
    contactoMock.obtenerContactosDeCuenta.mockResolvedValue([ana, luis, eva]);
    contactoMock.clasificarContactosNaturales.mockResolvedValue(
      clasif([
        { contact: ana, ddCrmId: "dd1", fuente: "zoho" },
        { contact: eva, ddCrmId: "dd-eva", fuente: "zoho" },
      ])
    );
    const json = await (await natural()).json();
    expect(linkMock.crearEnlaceRelacionado).toHaveBeenCalledTimes(1);
    expect(linkMock.crearEnlaceRelacionado.mock.calls[0][0].accountContact).toBe(luis);
    expect(linkMock.vincularContactosAlExpediente).toHaveBeenCalledWith("dd1", ["zc1", "zc2"]);
    expect(linkMock.vincularContactosAlExpediente).toHaveBeenCalledWith("dd-eva", ["zc3"]);
    expect(json.existentes).toEqual([{ contactId: "zc3", crmId: "dd-eva", fuente: "zoho" }]);
  });

  it("con el expediente principal anulado y enlaces por crear responde 409 RETIRADO", async () => {
    contactoMock.clasificarContactosNaturales.mockResolvedValue(clasif([{ contact: ana, ddCrmId: "dd1", fuente: "zoho" }]));
    zohoMock.service.getDDRecord.mockResolvedValue({ Estado: "Anulado" });
    const res = await natural();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("RETIRADO");
    expect(linkMock.crearEnlaceRelacionado).not.toHaveBeenCalled();
  });

  it("expediente en Zoho que nunca pasó por el portal: se registra para colgarle los enlaces", async () => {
    contactoMock.clasificarContactosNaturales.mockResolvedValue(clasif([{ contact: ana, ddCrmId: "dd1", fuente: "zoho" }]));
    prismaMock.crmContact.findUnique.mockResolvedValue(null);
    await natural();
    expect(prismaMock.crmContact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ crmId: "dd1", accountContactId: "ac1", accountCrmId: "s1" }),
    });
    expect(linkMock.crearEnlaceRelacionado.mock.calls[0][0].crmContact).toMatchObject({ crmId: "dd1" });
  });
});

describe("/api/generar-expediente — Persona Jurídica", () => {
  it("sin contactos: crea UN expediente jurídico sin contacto y el enlace del Representante Legal", async () => {
    contactoMock.obtenerContactosDeCuenta.mockResolvedValue([]);
    const res = await juridica();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(zohoMock.service.createDebidaDiligenciaRecord).toHaveBeenCalledTimes(1);
    const creado = zohoMock.service.createDebidaDiligenciaRecord.mock.calls[0][0];
    expect(creado).toMatchObject({ clientType: "JURIDICA", nombreNatural: "Carlos Gómez Ruiz", contactCrmId: undefined, razonSocial: "ACME" });
    expect(creado).not.toHaveProperty("relatedDDId");
    expect(enlaceMock.crearEnlaceConBorrador.mock.calls[0][0].draftData).toMatchObject({ rlNombre: "Carlos Gómez Ruiz" });
    expect(enlaceMock.crearEnlaceConBorrador.mock.calls[0][0].draftData).not.toHaveProperty("Nombre_de_contacto");
    // Representante Legal: enlace relacionado sin contacto sobre el mismo expediente
    expect(linkMock.crearEnlaceRepresentante).toHaveBeenCalledWith(
      expect.objectContaining({ crmContact: expect.objectContaining({ crmId: "new1" }), representanteLegal: "Carlos Gómez Ruiz" })
    );
    expect(linkMock.crearEnlaceRelacionado).not.toHaveBeenCalled();
    expect(json).toMatchObject({ crmId: "new1", tipo: "JURIDICA", representante: { nombre: "Carlos Gómez Ruiz" } });
  });

  it("no exige contacto estándar: cada contacto recibe su enlace relacionado", async () => {
    contactoMock.obtenerContactosDeCuenta.mockResolvedValue([
      { ...ana, isStandard: false },
      luis,
    ]);
    const json = await (await juridica()).json();
    expect(zohoMock.service.createDebidaDiligenciaRecord).toHaveBeenCalledTimes(1);
    expect(linkMock.crearEnlaceRelacionado).toHaveBeenCalledTimes(2);
    expect(linkMock.crearEnlaceRelacionado.mock.calls.map((c: any) => c[0].accountContact.crmId)).toEqual(["zc1", "zc2"]);
    expect(linkMock.vincularContactosAlExpediente).toHaveBeenCalledWith("new1", ["zc1", "zc2"]);
    expect(json.relacionados.map((r: any) => r.contactId)).toEqual(["zc1", "zc2"]);
  });

  it("varios contactos estándar tampoco bloquean a la jurídica", async () => {
    contactoMock.obtenerContactosDeCuenta.mockResolvedValue([ana, { ...luis, isStandard: true }]);
    const res = await juridica();
    expect(res.status).toBe(200);
  });

  it("sin Representante_legal en el socio responde 422 y no crea nada", async () => {
    zohoMock.service.getAccountRecord.mockResolvedValue({ Nombre_Extranjero_No_en_Peachtree: "  " });
    const res = await juridica();
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("SIN_REPRESENTANTE_LEGAL");
    expect(zohoMock.service.createDebidaDiligenciaRecord).not.toHaveBeenCalled();
    expect(linkMock.crearEnlaceRepresentante).not.toHaveBeenCalled();
  });

  it("con el jurídico vigente sin Representante Legal solo crea su enlace (no otro registro en Zoho)", async () => {
    contactoMock.clasificarExpedientesJuridica.mockResolvedValue(conJuridica);
    linkMock.contactosConEnlaceRelacionado.mockResolvedValue(new Set(["ac1", "ac2"]));
    const json = await (await juridica()).json();
    expect(zohoMock.service.createDebidaDiligenciaRecord).not.toHaveBeenCalled();
    expect(enlaceMock.crearEnlaceConBorrador).not.toHaveBeenCalled();
    expect(linkMock.crearEnlaceRepresentante).toHaveBeenCalledWith(expect.objectContaining({ crmContact: expect.objectContaining({ crmId: "jur1" }) }));
    expect(json).toMatchObject({ status: "success", crmId: "jur1", representante: { nombre: "Carlos Gómez Ruiz" } });
  });

  it("con el jurídico, su Representante Legal y los contactos listos no crea nada (no exige Representante_legal)", async () => {
    contactoMock.clasificarExpedientesJuridica.mockResolvedValue(conJuridica);
    linkMock.tieneEnlaceRepresentante.mockResolvedValue(true);
    linkMock.contactosConEnlaceRelacionado.mockResolvedValue(new Set(["ac1", "ac2"]));
    zohoMock.service.getAccountRecord.mockResolvedValue({});
    const json = await (await juridica()).json();
    expect(json).toMatchObject({ status: "already_exists", crmId: "jur1" });
    expect(linkMock.crearEnlaceRepresentante).not.toHaveBeenCalled();
    expect(linkMock.vincularContactosAlExpediente).toHaveBeenCalledWith("jur1", ["zc1", "zc2"]);
  });

  it("socio anterior con expediente natural del Representante Legal: se respeta, no se crea su enlace", async () => {
    contactoMock.clasificarExpedientesJuridica.mockResolvedValue({ ...conJuridica, natural: dd("nat1", "Natural", "jur1"), naturales: [dd("nat1", "Natural", "jur1")] });
    linkMock.contactosConEnlaceRelacionado.mockResolvedValue(new Set(["ac1"]));
    await juridica();
    expect(linkMock.crearEnlaceRepresentante).not.toHaveBeenCalled();
    expect(linkMock.crearEnlaceRelacionado).toHaveBeenCalledTimes(1);
  });

  it("contacto que el esquema anterior ligó al expediente natural del Representante Legal: recibe su enlace en el jurídico", async () => {
    contactoMock.clasificarExpedientesJuridica.mockResolvedValue({ ...conJuridica, natural: dd("nat1", "Natural", "jur1"), naturales: [dd("nat1", "Natural", "jur1")] });
    // Su lookup apuntaba al natural del Representante Legal
    contactoMock.clasificarContactosNaturales.mockResolvedValue(clasif([{ contact: luis, ddCrmId: "nat1", fuente: "zoho" }]));
    linkMock.contactosConEnlaceRelacionado.mockResolvedValue(new Set(["ac1"]));
    const json = await (await juridica()).json();
    expect(linkMock.crearEnlaceRelacionado).toHaveBeenCalledTimes(1);
    expect(linkMock.crearEnlaceRelacionado.mock.calls[0][0]).toMatchObject({ crmContact: { crmId: "jur1" }, accountContact: luis });
    expect(linkMock.vincularContactosAlExpediente).toHaveBeenCalledWith("jur1", ["zc1", "zc2"]);
    expect(linkMock.vincularContactosAlExpediente).not.toHaveBeenCalledWith("nat1", expect.anything());
    expect(json.existentes).toBeUndefined();
  });

  it("el contacto ya vinculado al expediente jurídico no recibe además un enlace relacionado (pero queda atado)", async () => {
    contactoMock.clasificarExpedientesJuridica.mockResolvedValue(conJuridica);
    linkMock.tieneEnlaceRepresentante.mockResolvedValue(true);
    prismaMock.crmContact.findUnique.mockResolvedValue({ id: "cc-jur1", crmId: "jur1", retiredAt: null, accountContactId: "ac1" });
    // Su lookup también lo devuelve como "expediente propio" (el jurídico)
    contactoMock.clasificarContactosNaturales.mockResolvedValue(clasif([{ contact: ana, ddCrmId: "jur1", fuente: "zoho" }]));
    await juridica();
    expect(linkMock.crearEnlaceRelacionado).toHaveBeenCalledTimes(1);
    expect(linkMock.crearEnlaceRelacionado.mock.calls[0][0].accountContact).toBe(luis);
    expect(linkMock.vincularContactosAlExpediente).toHaveBeenCalledWith("jur1", ["zc1", "zc2"]);
  });

  it("con más de un expediente jurídico vigente responde 409", async () => {
    contactoMock.clasificarExpedientesJuridica.mockResolvedValue({
      ...conJuridica,
      juridicas: [dd("jur1", "Jurídica"), dd("jur2", "Jurídica")],
    });
    const res = await juridica();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("DUPLICADOS");
    expect(zohoMock.service.createDebidaDiligenciaRecord).not.toHaveBeenCalled();
  });
});
