import { vi, describe, it, expect, beforeEach } from "vitest";

const { prismaMock, zohoMock, wd } = vi.hoisted(() => ({
  prismaMock: {
    crmContact: { findUnique: vi.fn(), findFirst: vi.fn(), delete: vi.fn(), update: vi.fn() },
    token: { updateMany: vi.fn() },
    draft: { update: vi.fn(), findFirst: vi.fn() },
    $transaction: vi.fn(async (ops: any[]) => Promise.all(ops)),
  },
  zohoMock: {
    service: {
      getDDRecord: vi.fn(), getRelatedDDId: vi.fn(), deleteDDRecord: vi.fn(),
      setDDEstado: vi.fn(), updateClientFormLink: vi.fn(),
    },
  },
  wd: {
    localizarCarpetaExpediente: vi.fn(), deleteFileFromWorkDrive: vi.fn(),
    getOrCreateCarpetaRetirados: vi.fn(), moveFolder: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/zohoService", () => ({ zoho: zohoMock }));
vi.mock("@/lib/zohoAuthService", () => ({ getAccessToken: vi.fn(async () => "tok") }));
vi.mock("@/lib/auditService", () => ({ logAuditEvent: vi.fn() }));
vi.mock("@/lib/tokenService", () => ({ reactivateToken: vi.fn(async () => ({ success: true, newExpiresAt: new Date() })) }));
vi.mock("@/lib/workdriveService", () => wd);

import { eliminarDDNoEnviado, anularDD, reactivarDD } from "../ddRetireService";

const actor = { id: "a1", email: "a@x.com" };
const base = { id: "c1", crmId: "dd1", retiredAt: null, forms: [], drafts: [{ id: "d1", type: "NATURAL", data: {} }] };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (ops: any[]) => Promise.all(ops));
  zohoMock.service.getDDRecord.mockResolvedValue({ Estado: "" });
  zohoMock.service.getRelatedDDId.mockResolvedValue(null);
  wd.localizarCarpetaExpediente.mockResolvedValue({ socioFolderId: "s", ddFolderId: "dd", clientFolderId: "cf" });
  wd.getOrCreateCarpetaRetirados.mockResolvedValue("ret");
});

describe("eliminarDDNoEnviado", () => {
  const gerente = { id: "u1", email: "g@x.com", name: "Gerente", profile: "Gerente Gestión Inmobiliaria" };
  const params = { crmId: "dd1", actor: gerente };
  beforeEach(() => {
    prismaMock.crmContact.findFirst.mockResolvedValue({ id: "c1" });
  });

  it("elimina carpeta, Zoho y Prisma, en ese orden", async () => {
    prismaMock.crmContact.findUnique.mockResolvedValue(base);
    await eliminarDDNoEnviado(params);
    expect(wd.deleteFileFromWorkDrive).toHaveBeenCalledWith("cf", "tok");
    expect(zohoMock.service.deleteDDRecord).toHaveBeenCalledWith("dd1");
    expect(prismaMock.crmContact.delete).toHaveBeenCalledWith({ where: { id: "c1" } });
    expect(wd.deleteFileFromWorkDrive.mock.invocationCallOrder[0]).toBeLessThan(zohoMock.service.deleteDDRecord.mock.invocationCallOrder[0]);
  });

  it.each(["Gerente Gestión Inmobiliaria", "gerente gestion inmobiliaria", "Administrador"])(
    "perfil autorizado: %s",
    async (profile) => {
      prismaMock.crmContact.findUnique.mockResolvedValue(base);
      await expect(eliminarDDNoEnviado({ ...params, actor: { ...gerente, profile } })).resolves.toMatchObject({ success: true });
    }
  );

  it.each(["Standard", "Vendedor", "", "Administrador Junior"])("perfil no autorizado (%s): no toca nada", async (profile) => {
    await expect(eliminarDDNoEnviado({ ...params, actor: { ...gerente, profile } })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(prismaMock.crmContact.findFirst).not.toHaveBeenCalled();
    expect(wd.deleteFileFromWorkDrive).not.toHaveBeenCalled();
    expect(zohoMock.service.deleteDDRecord).not.toHaveBeenCalled();
  });

  it("rechaza si ya se envio un formulario", async () => {
    prismaMock.crmContact.findUnique.mockResolvedValue({ ...base, forms: [{ id: "f", type: "NATURAL" }] });
    await expect(eliminarDDNoEnviado(params)).rejects.toThrow(/anularse/);
    expect(zohoMock.service.deleteDDRecord).not.toHaveBeenCalled();
  });

  it("rechaza si no existe en Prisma", async () => {
    prismaMock.crmContact.findFirst.mockResolvedValue(null);
    await expect(eliminarDDNoEnviado(params)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rechaza si en Zoho ya esta en revision", async () => {
    prismaMock.crmContact.findUnique.mockResolvedValue(base);
    zohoMock.service.getDDRecord.mockResolvedValue({ Estado: "En revisión" });
    await expect(eliminarDDNoEnviado(params)).rejects.toThrow(/En revisión/);
    expect(wd.deleteFileFromWorkDrive).not.toHaveBeenCalled();
  });

  it("rechaza si tiene expediente relacionado", async () => {
    prismaMock.crmContact.findUnique.mockResolvedValue(base);
    zohoMock.service.getRelatedDDId.mockResolvedValue("rel");
    await expect(eliminarDDNoEnviado(params)).rejects.toThrow(/relacionado/);
  });
});

describe("anularDD", () => {
  const enviado = { ...base, forms: [{ id: "f", type: "NATURAL" }] };

  it("mueve la carpeta a _Retirados, marca Anulado y archiva en Prisma", async () => {
    prismaMock.crmContact.findUnique.mockResolvedValue(enviado);
    await anularDD({ crmContactId: "c1", reason: "cliente desistio", actor });
    expect(wd.moveFolder).toHaveBeenCalledWith("cf", "ret", "tok");
    expect(zohoMock.service.setDDEstado).toHaveBeenCalledWith("dd1", "Anulado");
    const data = prismaMock.crmContact.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ retiredFolderId: "cf", retiredOriginFolderId: "dd", retiredBy: "a1" });
    expect(data.retiredAt).toBeInstanceOf(Date);
    expect(prismaMock.token.updateMany).toHaveBeenCalled();
    expect(prismaMock.draft.update.mock.calls[0][0].data.data).toMatchObject({ retired: true });
  });

  it("rechaza un expediente nunca enviado", async () => {
    prismaMock.crmContact.findUnique.mockResolvedValue(base);
    await expect(anularDD({ crmContactId: "c1", reason: "cliente desistio", actor })).rejects.toThrow(/eliminarlo/);
  });
});

describe("reactivarDD", () => {
  it("devuelve la carpeta, pone En borrador y limpia el archivo", async () => {
    prismaMock.crmContact.findUnique.mockResolvedValue({
      ...base, forms: [{ id: "f", type: "NATURAL" }], retiredAt: new Date(), retiredFolderId: "cf", retiredOriginFolderId: "dd",
    });
    prismaMock.draft.findFirst.mockResolvedValue({ token: "t" });
    await reactivarDD({ crmContactId: "c1", actor });
    expect(wd.moveFolder).toHaveBeenCalledWith("cf", "dd", "tok");
    expect(zohoMock.service.setDDEstado).toHaveBeenCalledWith("dd1", "En borrador");
    expect(prismaMock.crmContact.update.mock.calls[0][0].data).toMatchObject({ retiredAt: null, deletedAt: null });
  });

  it("rechaza si no esta anulado", async () => {
    prismaMock.crmContact.findUnique.mockResolvedValue(base);
    await expect(reactivarDD({ crmContactId: "c1", actor })).rejects.toThrow(/no está anulado/);
  });
});
