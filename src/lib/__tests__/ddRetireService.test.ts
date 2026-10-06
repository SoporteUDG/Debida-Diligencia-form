import { vi, describe, it, expect, beforeEach } from "vitest";

const { prismaMock, zohoMock, wd } = vi.hoisted(() => ({
  prismaMock: {
    crmContact: { findUnique: vi.fn(), findFirst: vi.fn(), delete: vi.fn(), update: vi.fn() },
    token: { updateMany: vi.fn(), deleteMany: vi.fn() },
    draft: { update: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
    form: { update: vi.fn() },
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
    getOrCreateCarpetaRetirados: vi.fn(), moveFolder: vi.fn(), findFolderAdicional: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/zohoService", () => ({ zoho: zohoMock }));
vi.mock("@/lib/zohoAuthService", () => ({ getAccessToken: vi.fn(async () => "tok") }));
vi.mock("@/lib/auditService", () => ({ logAuditEvent: vi.fn() }));
vi.mock("@/lib/tokenService", () => ({ reactivateToken: vi.fn(async () => ({ success: true, newExpiresAt: new Date() })) }));
vi.mock("@/lib/workdriveService", () => wd);

import { eliminarDDNoEnviado, anularDD, reactivarDD, expedienteRetirado } from "../ddRetireService";

describe("expedienteRetirado", () => {
  it("true si el portal lo archivó o Zoho lo marca (retirado / Estado Anulado)", () => {
    expect(expedienteRetirado(null, { retiredAt: new Date() })).toBe(true);
    expect(expedienteRetirado({ retirado: true })).toBe(true);
    expect(expedienteRetirado({ retirado: "true" })).toBe(true);
    expect(expedienteRetirado({ Estado: "Anulado" })).toBe(true);
  });

  it("false si no hay marca (o se quitó al reactivar)", () => {
    expect(expedienteRetirado(null, null)).toBe(false);
    expect(expedienteRetirado({ retirado: false, Estado: "En borrador" }, { retiredAt: null })).toBe(false);
    expect(expedienteRetirado({})).toBe(false);
  });
});

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

  it.each(["Gerente Gestión Inmobiliaria", "gerente gestion inmobiliaria", "Administrador", "Administrator"])(
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

  it("si ya se envio un formulario, anula en vez de eliminar", async () => {
    prismaMock.crmContact.findUnique.mockResolvedValue({ ...base, forms: [{ id: "f", type: "NATURAL" }] });
    const r = await eliminarDDNoEnviado(params);
    expect(r).toMatchObject({ success: true, action: "retired", crmId: "dd1" });
    // anulado: carpeta a _Retirados y Estado = Anulado; nada se borra
    expect(wd.moveFolder).toHaveBeenCalledWith("cf", "ret", "tok");
    expect(zohoMock.service.setDDEstado).toHaveBeenCalledWith("dd1", "Anulado", true);
    expect(prismaMock.crmContact.update.mock.calls[0][0].data).toMatchObject({ retiredBy: "u1" });
    expect(wd.deleteFileFromWorkDrive).not.toHaveBeenCalled();
    expect(zohoMock.service.deleteDDRecord).not.toHaveBeenCalled();
    expect(prismaMock.crmContact.delete).not.toHaveBeenCalled();
  });

  it("anula aunque en Zoho este en revision (ya enviado)", async () => {
    prismaMock.crmContact.findUnique.mockResolvedValue({ ...base, forms: [{ id: "f", type: "NATURAL" }] });
    zohoMock.service.getDDRecord.mockResolvedValue({ Estado: "En revisión" });
    await expect(eliminarDDNoEnviado(params)).resolves.toMatchObject({ action: "retired" });
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

  it("rechaza si Zoho lo marca retirado (aunque el portal no)", async () => {
    prismaMock.crmContact.findUnique.mockResolvedValue(base);
    zohoMock.service.getDDRecord.mockResolvedValue({ Estado: "En borrador", retirado: true });
    await expect(eliminarDDNoEnviado(params)).rejects.toThrow(/retirado/);
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
    expect(zohoMock.service.setDDEstado).toHaveBeenCalledWith("dd1", "Anulado", true);
    const data = prismaMock.crmContact.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ retiredFolderId: "cf", retiredOriginFolderId: "dd", retiredBy: "a1" });
    expect(data.retiredAt).toBeInstanceOf(Date);
    expect(prismaMock.token.updateMany).toHaveBeenCalled();
    expect(prismaMock.draft.update.mock.calls[0][0].data.data).toMatchObject({ retired: true });
  });

  it("con adicionales: elimina el borrador adicional y anula el enviado sin mover su carpeta aparte", async () => {
    wd.findFolderAdicional.mockResolvedValue("cf-adic");
    prismaMock.crmContact.findUnique.mockResolvedValue({
      ...base,
      forms: [
        { id: "f", type: "NATURAL", isAditional: false, tokenUuid: "tm", retiredAt: null },
        { id: "fa", type: "JURIDICA", isAditional: true, tokenUuid: "t-enviado", retiredAt: null },
        { id: "fr", type: "NATURAL", isAditional: true, tokenUuid: "t-ya-anulado", retiredAt: new Date() },
      ],
      drafts: [
        { id: "dm", type: "NATURAL", data: {}, isAditional: false, token: "tm" },
        { id: "da", type: "JURIDICA", data: {}, isAditional: true, token: "t-enviado" },
        { id: "db", type: "NATURAL", data: {}, isAditional: true, token: "t-borrador" },
      ],
    });
    const r = await anularDD({ crmContactId: "c1", reason: "cliente desistio", actor });
    expect(wd.findFolderAdicional).toHaveBeenCalledWith("cf", "t-borrador", "tok");
    expect(wd.deleteFileFromWorkDrive).toHaveBeenCalledWith("cf-adic", "tok");
    expect(wd.moveFolder).toHaveBeenCalledTimes(1);
    expect(prismaMock.draft.delete).toHaveBeenCalledWith({ where: { id: "db" } });
    expect(prismaMock.token.deleteMany).toHaveBeenCalledWith({ where: { token: "t-borrador" } });
    // solo el adicional enviado y aun no anulado se anula
    expect(prismaMock.form.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.form.update.mock.calls[0][0]).toMatchObject({ where: { id: "fa" } });
    expect(prismaMock.form.update.mock.calls[0][0].data.retiredFolderId).toBeUndefined();
    // los borradores restantes (principal + adicional enviado) se cierran; el eliminado no
    expect(prismaMock.draft.update).toHaveBeenCalledTimes(2);
    expect(r).toMatchObject({ adicionalesEliminados: 1, adicionalesAnulados: 1 });
  });

  it("el tipo del principal sale del formulario principal, no de un adicional", async () => {
    prismaMock.crmContact.findUnique.mockResolvedValue({
      ...base,
      forms: [
        { id: "fa", type: "JURIDICA", isAditional: true, tokenUuid: "ta", retiredAt: null },
        { id: "f", type: "NATURAL", isAditional: false, tokenUuid: "tm", retiredAt: null },
      ],
      drafts: [],
    });
    await anularDD({ crmContactId: "c1", reason: "cliente desistio", actor });
    expect(wd.localizarCarpetaExpediente).toHaveBeenCalledWith("dd1", "NATURAL", "tok");
  });

  it("eliminar con solo un formulario adicional enviado: anula (no manda sus archivos a la papelera)", async () => {
    prismaMock.crmContact.findFirst.mockResolvedValue({ id: "c1" });
    prismaMock.crmContact.findUnique.mockResolvedValue({
      ...base,
      forms: [{ id: "fa", type: "NATURAL", isAditional: true, tokenUuid: "ta", retiredAt: null }],
    });
    const r = await eliminarDDNoEnviado({
      crmId: "dd1",
      actor: { id: "u1", email: "g@x.com", name: "G", profile: "Administrador" },
    });
    expect(r).toMatchObject({ action: "retired", adicionalesAnulados: 1 });
    expect(wd.deleteFileFromWorkDrive).not.toHaveBeenCalled();
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
    expect(zohoMock.service.setDDEstado).toHaveBeenCalledWith("dd1", "En borrador", false);
    expect(prismaMock.crmContact.update.mock.calls[0][0].data).toMatchObject({ retiredAt: null, deletedAt: null });
  });

  it("rechaza si no esta anulado", async () => {
    prismaMock.crmContact.findUnique.mockResolvedValue(base);
    await expect(reactivarDD({ crmContactId: "c1", actor })).rejects.toThrow(/no está anulado/);
  });
});
