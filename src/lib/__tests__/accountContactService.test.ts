import { vi, describe, it, expect, beforeEach } from "vitest";

const { prismaMock, zohoMock } = vi.hoisted(() => ({
  prismaMock: {
    accountContact: { count: vi.fn(), findFirst: vi.fn(), upsert: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    crmContact: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    token: { findMany: vi.fn() },
    form: { findFirst: vi.fn() },
  },
  zohoMock: { service: { searchAccountContacts: vi.fn(), searchDDsByAccount: vi.fn(), updateClientFormLink: vi.fn(), createNote: vi.fn() } },
}));
vi.mock("@/lib/tokenService", () => ({ revokeToken: vi.fn(async () => ({ success: true })) }));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/zohoService", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  zoho: zohoMock,
}));

import { createAccountContact, obtenerContactosDeCuenta, clasificarContactosNaturales, SinContactosError } from "../accountContactService";

const contacto = (id: string, createdTime: string) => ({
  id, firstName: `N${id}`, lastName: `A${id}`, email: "", phone: "", createdTime,
});

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.accountContact.upsert.mockImplementation(async ({ create }: any) => ({ id: `row-${create.crmId}`, ...create }));
});

describe("createAccountContact", () => {
  it("juridica: rechaza un segundo contacto distinto en la misma cuenta", async () => {
    prismaMock.accountContact.count.mockResolvedValue(1);
    await expect(
      createAccountContact({ accountCrmId: "acc1", clientType: "JURIDICA", contact: contacto("c2", "2026-02-01") })
    ).rejects.toThrow(/solo se admite uno/);
    expect(prismaMock.accountContact.upsert).not.toHaveBeenCalled();
  });

  it("juridica: el primer contacto (o el mismo de nuevo) se guarda", async () => {
    prismaMock.accountContact.count.mockResolvedValue(0);
    await createAccountContact({ accountCrmId: "acc1", clientType: "JURIDICA", contact: contacto("c1", "2026-01-01") });
    expect(prismaMock.accountContact.upsert).toHaveBeenCalledOnce();
  });

  it("natural: admite varios sin consultar el limite", async () => {
    await createAccountContact({ accountCrmId: "acc1", clientType: "NATURAL", contact: contacto("c1", "2026-01-01") });
    await createAccountContact({ accountCrmId: "acc1", clientType: "NATURAL", contact: contacto("c2", "2026-02-01") });
    expect(prismaMock.accountContact.count).not.toHaveBeenCalled();
    expect(prismaMock.accountContact.upsert).toHaveBeenCalledTimes(2);
  });
});

describe("obtenerContactosDeCuenta", () => {
  const todos = [contacto("c1", "2026-01-01"), contacto("c2", "2026-02-01"), contacto("c3", "2026-03-01")];

  it("natural: guarda todos los contactos", async () => {
    zohoMock.service.searchAccountContacts.mockResolvedValue(todos);
    const filas = await obtenerContactosDeCuenta("acc1", "NATURAL");
    expect(filas.map((f) => f.crmId)).toEqual(["c1", "c2", "c3"]);
  });

  it("juridica: guarda solo el mas antiguo", async () => {
    prismaMock.accountContact.findFirst.mockResolvedValue(null);
    prismaMock.accountContact.count.mockResolvedValue(0);
    zohoMock.service.searchAccountContacts.mockResolvedValue(todos);
    const filas = await obtenerContactosDeCuenta("acc1", "JURIDICA");
    expect(filas.map((f) => f.crmId)).toEqual(["c1"]);
  });

  it("juridica: reutiliza el contacto ya guardado sin volver a Zoho", async () => {
    prismaMock.accountContact.findFirst.mockResolvedValue({ id: "row-c1", crmId: "c1" });
    const filas = await obtenerContactosDeCuenta("acc1", "JURIDICA");
    expect(filas).toHaveLength(1);
    expect(zohoMock.service.searchAccountContacts).not.toHaveBeenCalled();
  });

  it("natural: sin contactos lanza SinContactosError", async () => {
    zohoMock.service.searchAccountContacts.mockResolvedValue([]);
    await expect(obtenerContactosDeCuenta("acc1", "NATURAL")).rejects.toBeInstanceOf(SinContactosError);
  });

  it("natural: si Zoho falla propaga el error", async () => {
    zohoMock.service.searchAccountContacts.mockRejectedValue(new Error("boom"));
    await expect(obtenerContactosDeCuenta("acc1", "NATURAL")).rejects.toThrow("boom");
  });

  it("juridica: si Zoho falla devuelve [] para generar el expediente sin contacto", async () => {
    prismaMock.accountContact.findFirst.mockResolvedValue(null);
    zohoMock.service.searchAccountContacts.mockRejectedValue(new Error("boom"));
    expect(await obtenerContactosDeCuenta("acc1", "JURIDICA")).toEqual([]);
  });
});

describe("clasificarContactosNaturales", () => {
  const fila = (n: string) => ({ id: `row-${n}`, crmId: n, accountCrmId: "acc1", firstName: `N${n}`, lastName: `A${n}` });
  beforeEach(() => {
    prismaMock.crmContact.findFirst.mockResolvedValue(null);
    prismaMock.form.findFirst.mockResolvedValue(null);
    prismaMock.crmContact.findMany.mockResolvedValue([]);
    prismaMock.token.findMany.mockResolvedValue([]);
    prismaMock.accountContact.findMany.mockResolvedValue([]);
  });

  it("solo faltan los contactos sin expediente en Zoho ni en Prisma", async () => {
    zohoMock.service.searchDDsByAccount.mockResolvedValue([
      { id: "dd1", name: "Nc1 Ac1 - 12 - Proyecto", estado: "", contactCrmId: "" }, // por Name
      { id: "dd2", name: "otro", estado: "", contactCrmId: "c2" }, // por lookup
    ]);
    prismaMock.crmContact.findFirst.mockImplementation(async ({ where }: any) =>
      where.accountContactId === "row-c3" ? { crmId: "dd3" } : null
    );
    const r = await clasificarContactosNaturales("acc1", [fila("c1"), fila("c2"), fila("c3"), fila("c4")]);
    expect(r.existentes.map((e) => [e.contact.crmId, e.ddCrmId, e.fuente])).toEqual([
      ["c1", "dd1", "zoho"], ["c2", "dd2", "zoho"], ["c3", "dd3", "prisma"],
    ]);
    expect(r.faltantes.map((c) => c.crmId)).toEqual(["c4"]);
  });

  it("tambien encuentra el expediente por el contacto guardado en form.data", async () => {
    zohoMock.service.searchDDsByAccount.mockResolvedValue([]);
    prismaMock.form.findFirst.mockResolvedValue({ crmContact: { crmId: "dd9" } });
    const r = await clasificarContactosNaturales("acc1", [fila("c1")]);
    expect(r.existentes).toMatchObject([{ ddCrmId: "dd9", fuente: "prisma" }]);
    expect(prismaMock.form.findFirst.mock.calls[0][0].where.data).toEqual({ path: ["Nombre_de_contacto"], equals: "c1" });
  });

  it("informa los contactos locales que ya no estan en Zoho sin tocarlos", async () => {
    zohoMock.service.searchDDsByAccount.mockResolvedValue([]);
    prismaMock.accountContact.findMany.mockResolvedValue([{ id: "x", crmId: "gone", firstName: "", lastName: "" }]);
    const r = await clasificarContactosNaturales("acc1", [fila("c1")]);
    expect(r.eliminadosEnZoho.map((c) => c.crmId)).toEqual(["gone"]);
    expect(prismaMock.accountContact.findMany.mock.calls[0][0].where.crmId).toEqual({ notIn: ["c1"] });
  });

  it("contacto faltante: revoca el enlace vigente, deja nota y marca el expediente", async () => {
    zohoMock.service.searchDDsByAccount.mockResolvedValue([]);
    prismaMock.accountContact.findMany.mockResolvedValue([{ id: "x", crmId: "gone", firstName: "Ana", lastName: "Paz", missingInZohoAt: null }]);
    prismaMock.crmContact.findMany.mockResolvedValue([{ id: "e1", crmId: "dd7" }]);
    prismaMock.token.findMany.mockResolvedValue([{ token: "t1" }]);
    await clasificarContactosNaturales("acc1", [fila("c1")]);
    expect(prismaMock.crmContact.findMany.mock.calls[0][0].where).toMatchObject({ accountContactId: "x", missingContactAt: null });
    expect(zohoMock.service.updateClientFormLink).toHaveBeenCalledWith("dd7", "Debida_Diligencia", undefined, undefined, "Expirado / Revocado");
    expect(zohoMock.service.createNote.mock.calls[0][2]).toBe(
      "El contacto Ana Paz falta en el Socio de Negocio. Agréguelo nuevamente o archive el registro de Debida Diligencia."
    );
    expect(prismaMock.crmContact.update.mock.calls[0][0]).toMatchObject({ where: { id: "e1" } });
  });

  it("contacto faltante sin enlace vigente: solo nota y marca", async () => {
    zohoMock.service.searchDDsByAccount.mockResolvedValue([]);
    prismaMock.accountContact.findMany.mockResolvedValue([{ id: "x", crmId: "gone", firstName: "", lastName: "", missingInZohoAt: new Date() }]);
    prismaMock.crmContact.findMany.mockResolvedValue([{ id: "e1", crmId: "dd7" }]);
    await clasificarContactosNaturales("acc1", [fila("c1")]);
    expect(zohoMock.service.updateClientFormLink).not.toHaveBeenCalled();
    expect(zohoMock.service.createNote).toHaveBeenCalledOnce();
  });

  it("si Zoho falla propaga el error (no crea a ciegas)", async () => {
    zohoMock.service.searchDDsByAccount.mockRejectedValue(new Error("boom"));
    await expect(clasificarContactosNaturales("acc1", [fila("c1")])).rejects.toThrow("boom");
  });
});
