import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { prismaMock, zohoMock, enlaceMock, linkMock, contactoMock } = vi.hoisted(() => ({
  prismaMock: {
    crmContact: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    draft: { findFirst: vi.fn(), update: vi.fn() },
    form: { count: vi.fn() },
  },
  zohoMock: {
    service: {
      getDDRecord: vi.fn(),
      getContact: vi.fn(),
      getAccountRecord: vi.fn(),
      updateClientFormLink: vi.fn(),
      createNote: vi.fn(),
      createDebidaDiligenciaRecord: vi.fn(),
      setDDContacto: vi.fn(),
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
    contactoDelLookupZoho: vi.fn(),
    obtenerContactosDeDD: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/zohoService", () => ({ zoho: zohoMock, DD_CONTACT_FIELD: "Nombre_de_contacto" }));
vi.mock("@/lib/auditService", () => ({ logAuditEvent: vi.fn() }));
vi.mock("@/lib/enlaceService", () => enlaceMock);
vi.mock("@/lib/contactLinkService", () => linkMock);
vi.mock("@/lib/ddRetireService", () => ({
  MENSAJE_RETIRADO: "retirado",
  expedienteRetirado: (r: any, c: any) => !!c?.retiredAt || r?.retirado === true || r?.Estado === "Anulado",
}));
// contactoPrincipal y los errores son los reales (misma regla que generar-expediente)
vi.mock("@/lib/accountContactService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/accountContactService")>()),
  ...contactoMock,
}));

import { POST } from "@/app/api/generar-enlace/route";

const ana = { id: "ac1", crmId: "zc1", accountCrmId: "s1", firstName: "Ana", lastName: "Paz", isStandard: true, deletedAt: null };
const luis = { id: "ac2", crmId: "zc2", accountCrmId: "s1", firstName: "Luis", lastName: "Mora", isStandard: false, deletedAt: null };
const ddNatural = { Tipo_de_Persona: "Persona Natural", Socio_de_Negocios: { id: "s1" }, Nombre_de_contacto: { id: "zc1" } };
const ddJuridica = { Tipo_de_Persona: "Persona Jurídica", Socio_de_Negocios: { id: "s1" } };
const local = (extra: any = {}) => ({ id: "cc1", crmId: "dd1", accountContactId: "ac1", accountCrmId: "s1", accountContact: ana, retiredAt: null, ...extra });
const clasif = (existentes: any[] = []) => ({ faltantes: [], existentes, eliminadosEnZoho: [] });

const post = (body: any) =>
  POST(new NextRequest("http://localhost/api/generar-enlace", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));
const boton = (tipo = "natural") => post({ recordId: "dd1", tipo });

beforeEach(() => {
  vi.clearAllMocks();
  zohoMock.service.getDDRecord.mockResolvedValue(ddNatural);
  zohoMock.service.getContact.mockResolvedValue({ firstName: "Ana", lastName: "Paz", razonSocial: "ACME", nombreProyecto: "Torre" });
  zohoMock.service.getAccountRecord.mockResolvedValue({ Nombre_Extranjero_No_en_Peachtree: "Carlos Gómez" });
  contactoMock.contactoDelLookupZoho.mockResolvedValue(ana);
  contactoMock.obtenerContactosDeCuenta.mockResolvedValue([ana, luis]);
  contactoMock.clasificarContactosNaturales.mockResolvedValue(clasif([{ contact: ana, ddCrmId: "dd1", fuente: "zoho" }]));
  prismaMock.crmContact.findUnique.mockImplementation(async ({ where }: any) => (where.crmId === "dd1" ? local() : null));
  prismaMock.crmContact.create.mockImplementation(async ({ data }: any) => ({ id: "cc-new", accountContact: null, ...data }));
  prismaMock.crmContact.update.mockImplementation(async ({ data }: any) => ({ ...local(), ...data }));
  prismaMock.draft.findFirst.mockResolvedValue(null);
  prismaMock.form.count.mockResolvedValue(0);
  enlaceMock.crearEnlaceConBorrador.mockResolvedValue({ tokenUuid: "tk", clientUrl: "https://x/f?token=tk", expiresAt: new Date() });
  linkMock.crearEnlaceRelacionado.mockImplementation(async ({ accountContact }: any) => ({
    tokenUuid: `tk-${accountContact.crmId}`, clientUrl: `https://x/rel/${accountContact.crmId}`, expiresAt: new Date(),
  }));
  linkMock.crearEnlaceRepresentante.mockResolvedValue({ tokenUuid: "tk-rl", clientUrl: "https://x/rl", expiresAt: new Date() });
  linkMock.contactosConEnlaceRelacionado.mockResolvedValue(new Set());
  linkMock.tieneEnlaceRepresentante.mockResolvedValue(false);
  linkMock.vincularContactosAlExpediente.mockImplementation(async (_dd: string, ids: string[]) => [...ids]);
});

describe("POST /api/generar-enlace — general", () => {
  it("404 si el expediente no existe en Zoho", async () => {
    zohoMock.service.getDDRecord.mockResolvedValue(null);
    expect((await boton()).status).toBe(404);
  });

  it.each([
    ["marca retirado en Zoho", { ...ddNatural, retirado: true }, local()],
    ["Estado Anulado en Zoho", { ...ddNatural, Estado: "Anulado" }, local()],
    ["archivado en el portal", ddNatural, local({ retiredAt: new Date() })],
  ])("expediente retirado (%s): 409 RETIRADO y no crea nada", async (_caso, ddRecord, contactoLocal) => {
    zohoMock.service.getDDRecord.mockResolvedValue(ddRecord);
    prismaMock.crmContact.findUnique.mockResolvedValue(contactoLocal);
    const res = await boton();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("RETIRADO");
    expect(enlaceMock.crearEnlaceConBorrador).not.toHaveBeenCalled();
    expect(linkMock.crearEnlaceRelacionado).not.toHaveBeenCalled();
  });

  it("el tipo sale del expediente (Tipo_de_Persona), no del body", async () => {
    zohoMock.service.getDDRecord.mockResolvedValue({ ...ddJuridica });
    contactoMock.contactoDelLookupZoho.mockResolvedValue(null);
    prismaMock.crmContact.findUnique.mockResolvedValue(null);
    await post({ recordId: "dd1", tipo: "natural" });
    expect(enlaceMock.crearEnlaceConBorrador.mock.calls[0][0].isNatural).toBe(false);
    expect(linkMock.crearEnlaceRepresentante).toHaveBeenCalled();
  });

  it("nunca crea un registro de Debida Diligencia en Zoho", async () => {
    await boton();
    zohoMock.service.getDDRecord.mockResolvedValue(ddJuridica);
    await boton("juridica");
    expect(zohoMock.service.createDebidaDiligenciaRecord).not.toHaveBeenCalled();
  });
});

describe("POST /api/generar-enlace — Persona Natural", () => {
  it("sin contactos en el socio ni en el expediente: 422 SIN_CONTACTO y no crea nada", async () => {
    contactoMock.obtenerContactosDeCuenta.mockResolvedValue([]);
    contactoMock.obtenerContactosDeDD.mockResolvedValue([]);
    const res = await boton();
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("SIN_CONTACTO");
    expect(enlaceMock.crearEnlaceConBorrador).not.toHaveBeenCalled();
    expect(linkMock.crearEnlaceRelacionado).not.toHaveBeenCalled();
  });

  it("con el contacto estándar: enlace principal + relacionado para cada otro contacto, todos atados al expediente", async () => {
    const res = await boton();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(enlaceMock.crearEnlaceConBorrador).toHaveBeenCalledWith(
      expect.objectContaining({ crmId: "dd1", isNatural: true, contactCrmId: "zc1", draftData: expect.objectContaining({ Nombre_de_contacto: "zc1" }) })
    );
    expect(linkMock.crearEnlaceRelacionado).toHaveBeenCalledTimes(1);
    expect(linkMock.crearEnlaceRelacionado.mock.calls[0][0]).toMatchObject({ crmContact: { crmId: "dd1" }, accountContact: luis });
    expect(linkMock.crearEnlaceRepresentante).not.toHaveBeenCalled();
    expect(linkMock.vincularContactosAlExpediente).toHaveBeenCalledWith("dd1", ["zc1", "zc2"]);
    expect(zohoMock.service.updateClientFormLink).toHaveBeenCalledWith("dd1", "Debida_Diligencia", "https://x/f?token=tk", expect.any(Date), "Activo");
    expect(json).toMatchObject({ crmId: "dd1", contactId: "zc1", clientUrl: "https://x/f?token=tk", relacionados: [{ contactId: "zc2" }] });
  });

  it("el contacto del expediente es el estándar del socio, sin importar Nombre_de_contacto", async () => {
    zohoMock.service.getDDRecord.mockResolvedValue({ ...ddNatural, Nombre_de_contacto: { id: "zc2" } });
    const res = await boton();
    expect(res.status).toBe(200);
    expect(enlaceMock.crearEnlaceConBorrador).toHaveBeenCalledWith(expect.objectContaining({ contactCrmId: "zc1" }));
    expect(zohoMock.service.setDDContacto).toHaveBeenCalledWith("dd1", "zc1");
  });

  it("si Nombre_de_contacto ya es el estándar no lo reescribe", async () => {
    await boton();
    expect(zohoMock.service.setDDContacto).not.toHaveBeenCalled();
  });

  it("socio sin contactos: el estándar sale de los contactos atados al expediente", async () => {
    const { SinContactosError } = await import("@/lib/accountContactService");
    contactoMock.obtenerContactosDeCuenta.mockRejectedValue(new SinContactosError("s1"));
    contactoMock.obtenerContactosDeDD.mockResolvedValue([ana, luis]);
    const res = await boton();
    expect(res.status).toBe(200);
    expect(contactoMock.obtenerContactosDeDD).toHaveBeenCalledWith("dd1", "s1");
    expect(enlaceMock.crearEnlaceConBorrador).toHaveBeenCalledWith(expect.objectContaining({ contactCrmId: "zc1" }));
  });

  it("socio sin contacto estándar (o con varios): 422 CONTACTO_ESTANDAR", async () => {
    contactoMock.obtenerContactosDeCuenta.mockResolvedValue([{ ...ana, isStandard: false }, luis]);
    let res = await boton();
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("CONTACTO_ESTANDAR");
    contactoMock.obtenerContactosDeCuenta.mockResolvedValue([ana, { ...luis, isStandard: true }]);
    res = await boton();
    expect((await res.json()).code).toBe("CONTACTO_ESTANDAR");
    expect(enlaceMock.crearEnlaceConBorrador).not.toHaveBeenCalled();
  });

  it("con el enlace principal ya creado solo crea los relacionados que faltan", async () => {
    prismaMock.draft.findFirst.mockResolvedValue({ id: "d1", data: {} });
    const json = await (await boton()).json();
    expect(enlaceMock.crearEnlaceConBorrador).not.toHaveBeenCalled();
    expect(linkMock.crearEnlaceRelacionado).toHaveBeenCalledTimes(1);
    expect(json).toMatchObject({ success: true, clientUrl: null, relacionados: [{ contactId: "zc2" }] });
  });

  it("todo creado: 409 ALREADY_EXISTS, pero ata los contactos", async () => {
    prismaMock.draft.findFirst.mockResolvedValue({ id: "d1", data: {} });
    linkMock.contactosConEnlaceRelacionado.mockResolvedValue(new Set(["ac2"]));
    const res = await boton();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("ALREADY_EXISTS");
    expect(linkMock.vincularContactosAlExpediente).toHaveBeenCalledWith("dd1", ["zc1", "zc2"]);
  });


  describe("el Contact del expediente cambió en Zoho", () => {
    const luisEstandar = { ...luis, isStandard: true };
    beforeEach(() => {
      contactoMock.contactoDelLookupZoho.mockResolvedValue(luisEstandar);
      contactoMock.obtenerContactosDeCuenta.mockResolvedValue([{ ...ana, isStandard: false }, luisEstandar]);
      prismaMock.draft.findFirst.mockResolvedValue({ id: "d1", data: { firstName: "Ana", Nombre_de_contacto: "zc1" } });
      linkMock.contactosConEnlaceRelacionado.mockResolvedValue(new Set(["ac1"]));
    });

    it("formulario en borrador: actualiza el vínculo y responde CONTACT_UPDATED", async () => {
      const res = await boton();
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json).toMatchObject({ code: "CONTACT_UPDATED", contactId: "zc2", previousContactId: "zc1" });
      expect(prismaMock.crmContact.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "cc1" }, data: expect.objectContaining({ accountContactId: "ac2" }) }));
      expect(prismaMock.draft.update).toHaveBeenCalledWith({ where: { id: "d1" }, data: { data: { firstName: "Ana", Nombre_de_contacto: "zc2" } } });
      expect(enlaceMock.crearEnlaceConBorrador).not.toHaveBeenCalled();
    });

    it("formulario ya enviado: 409 CONTACTO_CAMBIADO y no cambia nada", async () => {
      prismaMock.form.count.mockResolvedValue(1);
      const res = await boton();
      expect(res.status).toBe(409);
      expect((await res.json()).code).toBe("CONTACTO_CAMBIADO");
      expect(prismaMock.crmContact.update).not.toHaveBeenCalled();
      expect(prismaMock.draft.update).not.toHaveBeenCalled();
    });
  });
});

describe("POST /api/generar-enlace — Persona Jurídica", () => {
  beforeEach(() => {
    zohoMock.service.getDDRecord.mockResolvedValue(ddJuridica);
    contactoMock.contactoDelLookupZoho.mockResolvedValue(null);
    contactoMock.obtenerContactosDeCuenta.mockResolvedValue([]);
    contactoMock.clasificarContactosNaturales.mockResolvedValue(clasif());
    prismaMock.crmContact.findUnique.mockResolvedValue(null);
  });

  it("sin contacto ni contactos: no se bloquea; crea su enlace y el del Representante Legal", async () => {
    const res = await boton("juridica");
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(prismaMock.crmContact.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ crmId: "dd1", accountContactId: undefined }) }));
    const enlace = enlaceMock.crearEnlaceConBorrador.mock.calls[0][0];
    expect(enlace).toMatchObject({ isNatural: false, contactCrmId: undefined });
    expect(enlace.draftData).toMatchObject({ razonSocial: "ACME", rlNombre: "Carlos Gómez" });
    expect(enlace.draftData).not.toHaveProperty("Nombre_de_contacto");
    expect(linkMock.crearEnlaceRepresentante).toHaveBeenCalledWith(expect.objectContaining({ representanteLegal: "Carlos Gómez" }));
    expect(json).toMatchObject({ contactId: null, representante: { nombre: "Carlos Gómez" } });
  });

  it("con contactos (sin estándar): un enlace relacionado para cada uno, sin exigir Contacto estándar", async () => {
    contactoMock.obtenerContactosDeCuenta.mockResolvedValue([{ ...ana, isStandard: false }, luis]);
    const res = await boton("juridica");
    expect(res.status).toBe(200);
    expect(linkMock.crearEnlaceRelacionado.mock.calls.map((c: any) => c[0].accountContact.crmId)).toEqual(["zc1", "zc2"]);
    expect(linkMock.vincularContactosAlExpediente).toHaveBeenCalledWith("dd1", ["zc1", "zc2"]);
  });

  it("con un contacto vinculado al expediente: se usa en el enlace principal y no recibe además un relacionado", async () => {
    contactoMock.contactoDelLookupZoho.mockResolvedValue(ana);
    contactoMock.obtenerContactosDeCuenta.mockResolvedValue([{ ...ana, isStandard: false }, luis]);
    prismaMock.crmContact.findUnique.mockResolvedValue(local());
    await boton("juridica");
    expect(enlaceMock.crearEnlaceConBorrador.mock.calls[0][0]).toMatchObject({ contactCrmId: "zc1" });
    expect(linkMock.crearEnlaceRelacionado.mock.calls.map((c: any) => c[0].accountContact.crmId)).toEqual(["zc2"]);
  });

  it("todo creado: 409 ALREADY_EXISTS", async () => {
    prismaMock.crmContact.findUnique.mockResolvedValue(local({ accountContactId: null, accountContact: null }));
    prismaMock.draft.findFirst.mockResolvedValue({ id: "d1", data: {} });
    linkMock.tieneEnlaceRepresentante.mockResolvedValue(true);
    const res = await boton("juridica");
    expect(res.status).toBe(409);
    expect(linkMock.crearEnlaceRepresentante).not.toHaveBeenCalled();
  });

  it("con su enlace pero sin Representante legal (socio ni expediente): 422 y no crea nada", async () => {
    zohoMock.service.getAccountRecord.mockResolvedValue({});
    prismaMock.crmContact.findUnique.mockResolvedValue(local({ accountContactId: null, accountContact: null }));
    prismaMock.draft.findFirst.mockResolvedValue({ id: "d1", data: {} });
    const res = await boton("juridica");
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("SIN_REPRESENTANTE_LEGAL");
    expect(linkMock.crearEnlaceRepresentante).not.toHaveBeenCalled();
  });

  it("sin Representante legal en el socio usa el Nombre_natural del expediente", async () => {
    zohoMock.service.getAccountRecord.mockResolvedValue({});
    zohoMock.service.getDDRecord.mockResolvedValue({ ...ddJuridica, Nombre_natural: "Rita Luna" });
    await boton("juridica");
    expect(linkMock.crearEnlaceRepresentante).toHaveBeenCalledWith(expect.objectContaining({ representanteLegal: "Rita Luna" }));
  });

  it("jurídica anterior con el expediente natural del Representante Legal en uso: no crea su enlace", async () => {
    zohoMock.service.getDDRecord.mockResolvedValue({ ...ddJuridica, DD_relacionado: { id: "nat1" } });
    prismaMock.crmContact.findUnique.mockImplementation(async ({ where }: any) =>
      where.crmId === "nat1" ? { _count: { drafts: 1, forms: 0 } } : null
    );
    await boton("juridica");
    expect(linkMock.crearEnlaceRepresentante).not.toHaveBeenCalled();
    expect(enlaceMock.crearEnlaceConBorrador).toHaveBeenCalled();
  });

  it("expediente sin Socio de Negocio: crea su enlace y el del Representante (Nombre_natural)", async () => {
    zohoMock.service.getDDRecord.mockResolvedValue({ Tipo_de_Persona: "Persona Jurídica", Nombre_natural: "Rita Luna" });
    const res = await boton("juridica");
    expect(res.status).toBe(200);
    expect(contactoMock.obtenerContactosDeCuenta).not.toHaveBeenCalled();
    expect(linkMock.crearEnlaceRepresentante).toHaveBeenCalledWith(expect.objectContaining({ representanteLegal: "Rita Luna" }));
  });
});
