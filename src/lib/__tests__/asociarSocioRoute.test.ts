import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { prismaMock, zohoMock, contactoMock, driveMock } = vi.hoisted(() => ({
  prismaMock: {
    crmContact: { findUnique: vi.fn(), update: vi.fn() },
    draft: { findMany: vi.fn(), update: vi.fn() },
    form: { findFirst: vi.fn() },
  },
  zohoMock: {
    service: { getDDRecord: vi.fn(), resolverNombreDDDeSocio: vi.fn(), updateAccountContact: vi.fn(), updateDDFields: vi.fn() },
  },
  contactoMock: { obtenerContactosDeCuenta: vi.fn(), obtenerContactosDeDD: vi.fn() },
  driveMock: { migrarCarpetasASocio: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/zohoService", () => ({ zoho: zohoMock, DD_CONTACT_FIELD: "Nombre_de_contacto" }));
vi.mock("@/lib/workdriveService", () => {
  class SocioSinCarpetaError extends Error {
    constructor(public socioId: string, public linkDocumentos: string) {
      super("sin carpeta");
    }
  }
  return { ...driveMock, SocioSinCarpetaError };
});
vi.mock("@/lib/enlacesSocioService", () => ({
  nombreDe: (c: any) => `${c.firstName} ${c.lastName}`.trim() || c.crmId,
}));
vi.mock("@/lib/auditService", () => ({ logAuditEvent: vi.fn() }));
vi.mock("@/lib/ddRetireService", () => ({
  MENSAJE_RETIRADO: "retirado",
  expedienteRetirado: (r: any, c: any) => !!c?.retiredAt || r?.retirado === true || r?.Estado === "Anulado",
}));
vi.mock("@/lib/accountContactService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/accountContactService")>()),
  ...contactoMock,
}));

import { POST } from "@/app/api/asociar-socio/route";

const ana = { id: "ac1", crmId: "zc1", accountCrmId: "s1", firstName: "Ana", lastName: "Paz", isStandard: true };
const luis = { id: "ac2", crmId: "zc2", accountCrmId: "s1", firstName: "Luis", lastName: "Mora", isStandard: false };
const ddSinAsociar = { Name: "Ana Paz-Torre", Tipo_de_Persona: "Natural", Estado: "Sin Asociar", Socio_de_Negocios: { id: "s1" } };
const post = () =>
  POST(new NextRequest("http://localhost/api/asociar-socio", { method: "POST", body: JSON.stringify({ recordId: "dd1" }) }));

beforeEach(() => {
  vi.clearAllMocks();
  zohoMock.service.getDDRecord.mockResolvedValue(ddSinAsociar);
  zohoMock.service.resolverNombreDDDeSocio.mockResolvedValue({ name: "Ana Paz-A12-Torre", unidadId: "u1", unidad: "A12" });
  prismaMock.crmContact.findUnique.mockResolvedValue({ id: "cc1", crmId: "dd1", firstName: "Ana", lastName: "Paz", retiredAt: null });
  prismaMock.draft.findMany.mockResolvedValue([
    { id: "d1", role: "PRINCIPAL", token: "tk1", data: { firstName: "Ana" } },
    { id: "d2", role: "RELATED", token: "tk2", data: {} },
  ]);
  prismaMock.form.findFirst.mockResolvedValue(null);
  driveMock.migrarCarpetasASocio.mockResolvedValue({ principal: true, enlaces: 1 });
  contactoMock.obtenerContactosDeCuenta.mockResolvedValue([ana, luis]);
});

describe("POST /api/asociar-socio", () => {
  it("con socio: renombra, mueve carpetas, llena Prisma y pasa a En borrador en una sola actualización", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(driveMock.migrarCarpetasASocio).toHaveBeenCalledWith({
      ddId: "dd1",
      formType: "NATURAL",
      nombreAnterior: "Ana Paz-Torre",
      nombreNuevo: "Ana Paz-A12-Torre",
      tokens: ["tk2"],
    });
    expect(prismaMock.crmContact.update).toHaveBeenCalledWith({
      where: { id: "cc1" },
      data: { accountCrmId: "s1", accountContactId: "ac1" },
    });
    expect(prismaMock.draft.update).toHaveBeenCalledWith({
      where: { id: "d1" },
      data: { data: { firstName: "Ana", Nombre_de_contacto: "zc1" } },
    });
    expect(zohoMock.service.updateDDFields).toHaveBeenCalledWith("dd1", {
      Name: "Ana Paz-A12-Torre",
      Estado: "En borrador",
      Unidad_Vendida: { id: "u1" },
      Unidad: "A12",
      Nombre_de_contacto: { id: "zc1" },
    });
    expect(zohoMock.service.updateAccountContact).not.toHaveBeenCalled();
  });

  it("natural con el formulario ya enviado: sus datos pasan al contacto estándar", async () => {
    prismaMock.form.findFirst.mockResolvedValue({ type: "NATURAL", data: { firstName: "Ana", cedula: "8-1-1" } });
    const json = await (await post()).json();
    expect(zohoMock.service.updateAccountContact).toHaveBeenCalledWith("zc1", "NATURAL", { firstName: "Ana", cedula: "8-1-1" });
    expect(json.datosPasadosAlContacto).toBe(true);
  });

  it("socio sin carpeta de WorkDrive: 422 SIN_CARPETA_SOCIO y no cambia nada", async () => {
    const { SocioSinCarpetaError } = await import("@/lib/workdriveService");
    driveMock.migrarCarpetasASocio.mockRejectedValue(new SocioSinCarpetaError("s1", ""));
    const res = await post();
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("SIN_CARPETA_SOCIO");
    expect(prismaMock.crmContact.update).not.toHaveBeenCalled();
    expect(zohoMock.service.updateDDFields).not.toHaveBeenCalled();
  });

  it("sin socio: 422 SIN_SOCIO y no cambia nada", async () => {
    zohoMock.service.getDDRecord.mockResolvedValue({ ...ddSinAsociar, Socio_de_Negocios: null });
    const res = await post();
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("SIN_SOCIO");
    expect(prismaMock.crmContact.update).not.toHaveBeenCalled();
    expect(zohoMock.service.updateDDFields).not.toHaveBeenCalled();
  });

  it("fuera de Sin Asociar: 409 NO_SIN_ASOCIAR", async () => {
    zohoMock.service.getDDRecord.mockResolvedValue({ ...ddSinAsociar, Estado: "En borrador" });
    const res = await post();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("NO_SIN_ASOCIAR");
  });

  it("jurídica: no escribe contacto ni copia datos", async () => {
    zohoMock.service.getDDRecord.mockResolvedValue({ ...ddSinAsociar, Tipo_de_Persona: "Jurídica" });
    const res = await post();
    expect(res.status).toBe(200);
    expect(prismaMock.crmContact.update).toHaveBeenCalledWith({ where: { id: "cc1" }, data: { accountCrmId: "s1" } });
    expect(zohoMock.service.updateAccountContact).not.toHaveBeenCalled();
    expect(zohoMock.service.updateDDFields).toHaveBeenCalledWith("dd1", expect.not.objectContaining({ Nombre_de_contacto: expect.anything() }));
  });

  it("natural sin contacto estándar: 422 CONTACTO_ESTANDAR y no cambia nada", async () => {
    contactoMock.obtenerContactosDeCuenta.mockResolvedValue([{ ...ana, isStandard: false }, luis]);
    const res = await post();
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("CONTACTO_ESTANDAR");
    expect(prismaMock.crmContact.update).not.toHaveBeenCalled();
  });
});
