import { vi, describe, it, expect, beforeEach } from "vitest";

const { prismaMock, zohoMock, enlaceMock } = vi.hoisted(() => ({
  prismaMock: {
    token: { findMany: vi.fn() },
    form: { findMany: vi.fn() },
    draft: { findMany: vi.fn(), findFirst: vi.fn() },
    crmContact: { findUnique: vi.fn() },
  },
  zohoMock: { service: { vincularContactoADD: vi.fn() } },
  enlaceMock: { crearEnlaceConBorrador: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/zohoService", () => ({ zoho: zohoMock }));
vi.mock("@/lib/enlaceService", () => enlaceMock);

import {
  describirEnlaces,
  enlacesDeContactos,
  tieneEnlaceRepresentante,
  contactosConEnlaceRelacionado,
  crearEnlaceRepresentante,
  crearEnlaceRelacionado,
  vincularContactosAlExpediente,
} from "../contactLinkService";

const futuro = new Date(Date.now() + 86400000);
const pasado = new Date(Date.now() - 86400000);
const draft = (extra: any) => ({
  id: "d", token: "t", type: "NATURAL", step: 1, data: {}, role: "RELATED", accountContactId: null,
  crmContactId: "cc1", createdAt: new Date(), updatedAt: new Date(), expiresAt: null, isAditional: true, ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.form.findMany.mockResolvedValue([]);
  prismaMock.token.findMany.mockResolvedValue([]);
});

describe("describirEnlaces", () => {
  it("estado de cada enlace, nombre, contacto y marca de Representante Legal", async () => {
    prismaMock.token.findMany.mockResolvedValue([
      { token: "t1", used: false, expiresAt: futuro },
      { token: "t2", used: true, expiresAt: futuro },
      { token: "t3", used: false, expiresAt: pasado },
    ]);
    prismaMock.form.findMany.mockResolvedValue([{ id: "f2", tokenUuid: "t2" }]);
    const r = await describirEnlaces(
      [
        draft({ token: "t1", role: "PRINCIPAL", data: { firstName: "Ana", lastName: "Paz" }, accountContact: { crmId: "zc1", firstName: "Ana", lastName: "Paz" } }),
        draft({ token: "t2", accountContactId: "ac2", data: {}, accountContact: { crmId: "zc2", firstName: "Luis", lastName: "Mora" } }),
        draft({ token: "t3", data: { firstName: "Carlos", lastName: "Gómez" } }),
        draft({ token: "t4", type: "JURIDICA", role: "ADITIONAL", data: { retired: true, razonSocial: "ACME" } }),
      ] as any,
      "https://x"
    );
    expect(r.map((e) => [e.token, e.linkStatus, e.name, e.contactId, e.representante])).toEqual([
      ["t1", "Activo", "Ana Paz", "zc1", false],
      ["t2", "Utilizado", "Luis Mora", "zc2", false],
      ["t3", "Vencido", "Carlos Gómez", null, true],
      ["t4", "Anulado", "ACME", null, false],
    ]);
    expect(r[1].formId).toBe("f2");
    expect(r[3].clientUrl).toBe("https://x/persona-juridica?token=t4");
  });
});

describe("enlacesDeContactos", () => {
  it("principal primero, luego el Representante Legal y después los contactos", async () => {
    prismaMock.crmContact.findUnique.mockResolvedValue({ accountContact: { crmId: "zc-std", firstName: "Ana", lastName: "Paz" } });
    prismaMock.draft.findFirst.mockResolvedValue(draft({ token: "tp", role: "PRINCIPAL", accountContact: null }));
    prismaMock.draft.findMany.mockResolvedValue([
      draft({ token: "tc", accountContactId: "ac2", accountContact: { crmId: "zc2", firstName: "Luis", lastName: "Mora" } }),
      draft({ token: "trl" }),
    ]);
    const r = await enlacesDeContactos("cc1", "https://x");
    expect(r.map((e) => e.token)).toEqual(["tp", "trl", "tc"]);
    // El principal toma el contacto del expediente
    expect(r[0].contactId).toBe("zc-std");
  });
});

describe("enlaces existentes", () => {
  it("tieneEnlaceRepresentante: un anulado sin formulario no cuenta; uno anulado con formulario enviado sí (se reactiva, no se duplica)", async () => {
    prismaMock.draft.findMany.mockResolvedValue([{ token: "t1", data: { retired: true } }]);
    expect(await tieneEnlaceRepresentante("cc1")).toBe(false);
    prismaMock.form.findMany.mockResolvedValue([{ tokenUuid: "t1" }]);
    expect(await tieneEnlaceRepresentante("cc1")).toBe(true);
    prismaMock.form.findMany.mockResolvedValue([]);
    prismaMock.draft.findMany.mockResolvedValue([{ token: "t1", data: { retired: true } }, { token: "t2", data: {} }]);
    expect(await tieneEnlaceRepresentante("cc1")).toBe(true);
    expect(prismaMock.draft.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { crmContactId: "cc1", role: "RELATED", accountContactId: null } })
    );
  });

  it("contactosConEnlaceRelacionado devuelve los contactos con enlace vigente", async () => {
    prismaMock.draft.findMany.mockResolvedValue([
      { token: "t2", accountContactId: "ac2", data: {} },
      { token: "t3", accountContactId: "ac3", data: { retired: true } },
      { token: "t4", accountContactId: "ac4", data: { retired: true } },
    ]);
    prismaMock.form.findMany.mockResolvedValue([{ tokenUuid: "t4" }]);
    expect([...(await contactosConEnlaceRelacionado("cc1"))]).toEqual(["ac2", "ac4"]);
  });
});

describe("creación de enlaces", () => {
  it("Representante Legal: RELATED sin contacto, con su nombre partido en nombre y apellido", async () => {
    await crearEnlaceRepresentante({ crmContact: { id: "cc1", crmId: "jur1" }, representanteLegal: "Carlos Gómez Ruiz", appUrl: "https://x", projectName: "Torre" });
    const p = enlaceMock.crearEnlaceConBorrador.mock.calls[0][0];
    expect(p).toMatchObject({ contactId: "cc1", crmId: "jur1", isNatural: true, role: "RELATED" });
    expect(p.accountContactId).toBeUndefined();
    expect(p.contactCrmId).toBeUndefined();
    expect(p.draftData).toMatchObject({ firstName: "Carlos Gómez", lastName: "Ruiz", nombreProyecto: "Torre" });
  });

  it("contacto relacionado: RELATED con su contacto, sin el lookup del expediente en los datos", async () => {
    const c = { id: "ac2", crmId: "zc2", accountCrmId: "s1", firstName: "Luis", lastName: "Mora" };
    await crearEnlaceRelacionado({ crmContact: { id: "cc1", crmId: "dd1" }, accountContact: c, appUrl: "https://x" });
    const p = enlaceMock.crearEnlaceConBorrador.mock.calls[0][0];
    expect(p).toMatchObject({ role: "RELATED", accountContactId: "ac2", contactCrmId: "zc2" });
    expect(p.draftData).not.toHaveProperty("Nombre_de_contacto");
  });

  it("vincularContactosAlExpediente nunca lanza: devuelve solo los vinculados", async () => {
    zohoMock.service.vincularContactoADD.mockImplementation(async (id: string) => {
      if (id === "zc2") throw new Error("INVALID_DATA: campo Debida_Diligencia no existe");
      return { success: true };
    });
    expect(await vincularContactosAlExpediente("dd1", ["zc1", "zc2", "zc3"])).toEqual(["zc1", "zc3"]);
  });
});
