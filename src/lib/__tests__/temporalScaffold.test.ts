import { vi, describe, it, expect, beforeEach } from "vitest";

const { prismaMock, serviceMock, enlaceMock } = vi.hoisted(() => ({
  prismaMock: {
    temporal: { update: vi.fn() },
    accountContact: { upsert: vi.fn() },
    crmContact: { upsert: vi.fn() },
  },
  serviceMock: {
    createRecord: vi.fn(),
    updateRecord: vi.fn(),
    createDebidaDiligenciaRecord: vi.fn(),
    vincularContactoADD: vi.fn(),
    updateClientFormLink: vi.fn(),
    createNote: vi.fn(),
  },
  enlaceMock: { crearEnlaceConBorrador: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/auditService", () => ({ logAuditEvent: vi.fn() }));
vi.mock("@/lib/enlaceService", () => enlaceMock);
// Mapeos y formatDDName reales; solo se simulan las llamadas a Zoho
vi.mock("@/lib/zohoService", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/zohoService")>();
  return { ...real, zoho: { service: serviceMock } };
});

import { crearEstructuraDelTemporal, registrarClienteExistente, PASO_DOCUMENTOS } from "../temporalScaffold";

const datosJuridica = {
  razonSocial: "ACME S.A.",
  numeroIdTributaria: "155-1-2026",
  formaContacto: "Broker",
  contactoNombre: "Ana",
  contactoApellido: "Paz",
  contactoEmail: "ana@acme.com",
  contactoTelefono: "+507 6000-0000",
  empresaEmail: "info@acme.com",
  empresaTelefonoCodigo: "+507",
  empresaTelefono: "300-0000",
  empresaDireccion: "Calle 50",
  rlNombre: "Carlos Gómez",
  gjcMembers: [{ id: "g1", nombre: "Eva" }],
};

const datosNatural = {
  firstName: "Luis",
  lastName: "Mora",
  idNumber: "8-2-2",
  email: "l@m.com",
  celularCodigo: "+507",
  celular: "6111",
  direccionResidencial: "Av. Balboa",
  employer: "Banco X",
  fechaNacimiento: "1990-01-02",
  nationality: "Panamá",
  profession: "Otros",
  profesionOtros: "Piloto",
  formaContacto: "Otros",
  formaContactoDetalle: "Feria de vivienda",
};

const temporal = (extra: any = {}): any => ({
  id: "t1",
  type: "JURIDICA",
  unidadVendidaId: "u1",
  unidadVendidaNombre: "A-12",
  proyecto: "The Hub",
  contactCrmId: null,
  accountCrmId: null,
  ddCrmId: null,
  data: datosJuridica,
  ...extra,
});
const natural = (extra: any = {}) => temporal({ type: "NATURAL", data: datosNatural, ...extra });

const orden: string[] = [];
const idsGuardados = () => prismaMock.temporal.update.mock.calls.map((c) => c[0].data);

beforeEach(() => {
  vi.clearAllMocks();
  orden.length = 0;
  serviceMock.createRecord.mockImplementation(async (module: string) => {
    orden.push(`create:${module}`);
    return { id: module === "Accounts" ? "acc1" : "con1" };
  });
  serviceMock.updateRecord.mockImplementation(async (module: string) => {
    orden.push(`update:${module}`);
    return { success: true };
  });
  serviceMock.createDebidaDiligenciaRecord.mockImplementation(async () => {
    orden.push("create:Debida_Diligencia");
    return { success: true, debidaId: "dd1" };
  });
  serviceMock.vincularContactoADD.mockResolvedValue({ success: true });
  serviceMock.updateClientFormLink.mockResolvedValue({ success: true });
  serviceMock.createNote.mockResolvedValue({ success: true });
  prismaMock.accountContact.upsert.mockResolvedValue({ id: "ac1" });
  prismaMock.crmContact.upsert.mockResolvedValue({ id: "cc1" });
  enlaceMock.crearEnlaceConBorrador.mockResolvedValue({
    tokenUuid: "tok1",
    clientUrl: "https://x/persona-juridica?token=tok1",
    expiresAt: new Date("2026-11-14T00:00:00Z"),
  });
});

describe("crearEstructuraDelTemporal - Jurídica", () => {
  it("no crea Contact: solo Socio de Negocio (con workflows) y Debida Diligencia", async () => {
    await crearEstructuraDelTemporal(temporal(), "https://x");
    expect(orden).toEqual(["create:Accounts", "create:Debida_Diligencia"]);
    expect(serviceMock.createRecord).toHaveBeenCalledTimes(1);
    expect(serviceMock.createRecord.mock.calls[0][2]).toEqual({ dispararWorkflows: true });
    expect(serviceMock.updateRecord).not.toHaveBeenCalled();
    expect(serviceMock.vincularContactoADD).not.toHaveBeenCalled();
    expect(prismaMock.accountContact.upsert).not.toHaveBeenCalled();
    expect(idsGuardados()).toEqual([{ accountCrmId: "acc1" }, { ddCrmId: "dd1" }]);
  });

  it("socio y expediente con el Name nombre-unidad-proyecto", async () => {
    await crearEstructuraDelTemporal(temporal(), "https://x");

    expect(serviceMock.createRecord.mock.calls[0][1]).toMatchObject({
      Account_Name: "ACME S.A.-A-12-The Hub",
      Persona_de_Tipo: "Jurídica",
      Proyecto: "The Hub",
      Unidad_Vendida1: { id: "u1" },
      RUC: "155-1-2026",
      Nombre_Extranjero_No_en_Peachtree: "Carlos Gómez",
      Phone: "+507 300-0000",
      Billing_Street: "Calle 50",
      Replicar_SAP1: "No",
    });
    const dd = serviceMock.createDebidaDiligenciaRecord.mock.calls[0][0];
    expect(dd).toMatchObject({
      accountCrmId: "acc1",
      clientType: "JURIDICA",
      overRideName: "ACME S.A.",
      razonSocial: "ACME S.A.",
      nombreNatural: "Carlos Gómez",
      unidad: { id: "u1" },
      unidadNombre: "A-12",
      projectName: "The Hub",
      contactCrmId: undefined,
    });
    // Forma de contacto va al expediente
    expect(dd.camposExtra).toEqual({ Forma_de_contacto: "Broker" });
  });

  it("los datos del temporal pasan al borrador del enlace normal, abierto en Documentos", async () => {
    const r = await crearEstructuraDelTemporal(temporal(), "https://x");

    const params = enlaceMock.crearEnlaceConBorrador.mock.calls[0][0];
    expect(params).toMatchObject({
      contactId: "cc1",
      crmId: "dd1",
      isNatural: false,
      appUrl: "https://x",
      contactCrmId: undefined,
      datosCliente: datosJuridica,
      step: PASO_DOCUMENTOS,
    });
    expect(params.draftData).toEqual({ crmContactId: "dd1", nombreProyecto: "The Hub" });
    expect(PASO_DOCUMENTOS).toBe(2);

    expect(serviceMock.updateClientFormLink).toHaveBeenCalledWith(
      "dd1", "Debida_Diligencia", "https://x/persona-juridica?token=tok1", expect.any(Date), "Activo"
    );
    expect(r).toEqual({ url: "https://x/persona-juridica?token=tok1", expiresAt: expect.any(Date), ddCrmId: "dd1" });

    // Copia local del expediente sin Contact; correo de la empresa
    expect(prismaMock.crmContact.upsert.mock.calls[0][0].create).toMatchObject({
      crmId: "dd1",
      firstName: "ACME S.A.",
      email: "info@acme.com",
      accountCrmId: "acc1",
      accountContactId: null,
    });
    expect(serviceMock.createNote.mock.calls.map((c) => c[3])).toEqual(["Accounts", "Debida_Diligencia"]);
  });

  it("reintento con el socio guardado: solo crea el expediente", async () => {
    await crearEstructuraDelTemporal(temporal({ accountCrmId: "acc1" }), "https://x");
    expect(orden).toEqual(["create:Debida_Diligencia"]);
    expect(serviceMock.createDebidaDiligenciaRecord).toHaveBeenCalledWith(expect.objectContaining({ accountCrmId: "acc1" }));
  });

  it("una opción fuera del picklist no se envía", async () => {
    await crearEstructuraDelTemporal(temporal({ proyecto: "Proyecto Nuevo" }), "https://x");
    expect(serviceMock.createRecord.mock.calls[0][1]).not.toHaveProperty("Proyecto");
  });
});

describe("crearEstructuraDelTemporal - Natural", () => {
  it("crea primero el Contact, luego el socio (con workflows), lo ata y después el expediente", async () => {
    await crearEstructuraDelTemporal(natural(), "https://x");
    expect(orden).toEqual(["create:Contacts", "create:Accounts", "update:Contacts", "create:Debida_Diligencia"]);
    expect(serviceMock.createRecord.mock.calls[0][1]).not.toHaveProperty("Account_Name");
    expect(serviceMock.createRecord.mock.calls[0][2]).toBeUndefined();
    expect(serviceMock.createRecord.mock.calls[1][2]).toEqual({ dispararWorkflows: true });
    expect(serviceMock.updateRecord).toHaveBeenCalledWith("Contacts", "con1", { Account_Name: { id: "acc1" } });
    expect(serviceMock.vincularContactoADD).toHaveBeenCalledWith("con1", "dd1");
    expect(idsGuardados()).toEqual([{ contactCrmId: "con1" }, { accountCrmId: "acc1" }, { ddCrmId: "dd1" }]);
  });

  it("Contact con los campos requeridos al crear", async () => {
    await crearEstructuraDelTemporal(natural(), "https://x");
    const contacto = serviceMock.createRecord.mock.calls[0][1];
    expect(contacto).toMatchObject({
      First_Name: "Luis",
      Last_Name: "Mora",
      Email: "l@m.com",
      C_I_P_Pasaporte: "8-2-2",
      Contacto_est_ndar: true,
      Proyecto: "The Hub",
      Celular: "+507 6111",
      Direcci_n_F_sica: "Av. Balboa",
      Empresa: "Banco X",
      Fecha_Nacimiento: "1990-01-02",
      Nacionalidad_2: "Panamá",
      Profesi_n: "Piloto",
    });
    for (const campo of ["Mobile", "Lead_Source"]) expect(contacto).not.toHaveProperty(campo);

    expect(serviceMock.createRecord.mock.calls[1][1]).toMatchObject({
      Account_Name: "Luis Mora-A-12-The Hub",
      Persona_de_Tipo: "Natural",
      Replicar_SAP1: "No",
    });
    // "Otros" -> su detalle
    expect(serviceMock.createDebidaDiligenciaRecord.mock.calls[0][0]).toMatchObject({
      contactCrmId: "con1",
      camposExtra: { Forma_de_contacto: "Feria de vivienda" },
    });
  });

  it("el expediente, la copia local y el borrador apuntan a su Contact", async () => {
    await crearEstructuraDelTemporal(natural(), "https://x");
    const params = enlaceMock.crearEnlaceConBorrador.mock.calls[0][0];
    expect(params).toMatchObject({ isNatural: true, contactCrmId: "con1", datosCliente: datosNatural, step: 2 });
    expect(params.draftData).toMatchObject({ Nombre_de_contacto: "con1" });
    expect(prismaMock.accountContact.upsert.mock.calls[0][0].create).toMatchObject({ crmId: "con1", accountCrmId: "acc1", isStandard: true });
    expect(prismaMock.crmContact.upsert.mock.calls[0][0].create).toMatchObject({ accountContactId: "ac1" });
    expect(serviceMock.createNote.mock.calls.map((c) => c[3])).toEqual(["Contacts", "Accounts", "Debida_Diligencia"]);
  });

  it("si Zoho falla a medias no se genera el enlace y quedan guardados los ids creados", async () => {
    serviceMock.createDebidaDiligenciaRecord.mockRejectedValue(new Error("Zoho caído"));
    await expect(crearEstructuraDelTemporal(natural(), "https://x")).rejects.toThrow("Zoho caído");
    expect(enlaceMock.crearEnlaceConBorrador).not.toHaveBeenCalled();
    expect(idsGuardados()).toEqual([{ contactCrmId: "con1" }, { accountCrmId: "acc1" }]);
  });

  it("el reintento continúa desde lo guardado: no repite contacto ni socio", async () => {
    await crearEstructuraDelTemporal(natural({ contactCrmId: "con1", accountCrmId: "acc1" }), "https://x");
    expect(serviceMock.createRecord).not.toHaveBeenCalled();
    expect(orden).toEqual(["update:Contacts", "create:Debida_Diligencia"]);
    expect(enlaceMock.crearEnlaceConBorrador).toHaveBeenCalledTimes(1);
  });

  it("con los tres ids guardados solo recrea lo local y el enlace", async () => {
    const r = await crearEstructuraDelTemporal(
      natural({ contactCrmId: "con1", accountCrmId: "acc1", ddCrmId: "dd1" }),
      "https://x"
    );
    expect(serviceMock.createRecord).not.toHaveBeenCalled();
    expect(serviceMock.createDebidaDiligenciaRecord).not.toHaveBeenCalled();
    expect(prismaMock.temporal.update).not.toHaveBeenCalled();
    expect(prismaMock.crmContact.upsert.mock.calls[0][0].where).toEqual({ crmId: "dd1" });
    expect(r.ddCrmId).toBe("dd1");
  });
});

describe("registrarClienteExistente", () => {
  it("no crea nada y deja una nota en cada registro coincidente", async () => {
    await registrarClienteExistente(temporal(), [
      { module: "Accounts", id: "accX", field: "RUC", name: "ACME" },
      { module: "Debida_Diligencia", id: "ddX", field: "ID_tributaria", name: "ACME-1-P" },
    ]);
    expect(serviceMock.createRecord).not.toHaveBeenCalled();
    expect(enlaceMock.crearEnlaceConBorrador).not.toHaveBeenCalled();
    expect(serviceMock.createNote.mock.calls.map((c) => [c[0], c[3]])).toEqual([
      ["accX", "Accounts"],
      ["ddX", "Debida_Diligencia"],
    ]);
  });
});
