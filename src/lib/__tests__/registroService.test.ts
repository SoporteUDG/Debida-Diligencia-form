import { vi, describe, it, expect, beforeEach } from "vitest";

const { prismaMock, zohoMock, enlaceMock } = vi.hoisted(() => ({
  prismaMock: { crmContact: { create: vi.fn(), findUnique: vi.fn() } },
  zohoMock: {
    createDebidaDiligenciaRecord: vi.fn(),
    updateClientFormLink: vi.fn(),
    createNote: vi.fn(),
  },
  enlaceMock: { crearEnlaceConBorrador: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/auditService", () => ({ logAuditEvent: vi.fn() }));
vi.mock("@/lib/enlaceService", () => enlaceMock);
vi.mock("@/lib/zohoService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/zohoService")>()),
  zoho: { service: zohoMock },
}));

import { crearRegistroEstandalone as crear } from "@/lib/registroService";

const SUB = "3f2b7c1e-8a44-4d3b-9a55-0c1d2e3f4a5b";
/** Cada prueba usa su propio envío (las ejecuciones en curso se comparten por id). */
let n = 0;
const crearRegistroEstandalone = (p: any) =>
  crear({ submissionId: `${SUB.slice(0, -4)}${String(++n).padStart(4, "0")}`, ...p });

const natural = {
  firstName: "Luis",
  lastName: "Pérez",
  email: "luis@test.com",
  celularCodigo: "+507",
  celular: "61234567",
  idNumber: "8-123-456",
  nombreProyecto: "The Hub",
  formaContacto: "Referido",
  referidoPor: "Ana",
};

beforeEach(() => {
  vi.clearAllMocks();
  zohoMock.createDebidaDiligenciaRecord.mockResolvedValue({ success: true, debidaId: "dd1" });
  prismaMock.crmContact.findUnique.mockResolvedValue(null);
  prismaMock.crmContact.create.mockResolvedValue({ id: "local-1", crmId: "dd1" });
  enlaceMock.crearEnlaceConBorrador.mockResolvedValue({
    tokenUuid: "tok",
    clientUrl: "https://portal.test/persona-natural?token=tok",
    expiresAt: new Date("2026-12-01"),
  });
});

describe("crearRegistroEstandalone", () => {
  it("crea solo el expediente: sin socio, contacto ni unidad, con todos los campos y el Name nombre-proyecto", async () => {
    const res = await crearRegistroEstandalone({ type: "NATURAL", data: natural, appUrl: "https://portal.test" });

    const params = zohoMock.createDebidaDiligenciaRecord.mock.calls[0][0];
    expect(params).toMatchObject({
      clientType: "NATURAL",
      name: "Luis Pérez",
      overRideName: "Luis Pérez",
      projectName: "The Hub",
      sinSocio: true,
    });
    expect(params).not.toHaveProperty("nameSuffix");
    // Estado inicial propio de este tipo de formulario
    expect(params.estado).toBe("Sin Asociar");
    expect(params).not.toHaveProperty("accountCrmId");
    expect(params).not.toHaveProperty("contactCrmId");
    expect(params).not.toHaveProperty("unidad");
    // Los datos personales van en el propio expediente
    expect(params.camposExtra).toMatchObject({ Proyecto: "The Hub", Forma_de_contacto: "Referido" });

    expect(prismaMock.crmContact.create.mock.calls[0][0].data).toMatchObject({
      crmId: "dd1",
      firstName: "Luis",
      email: "luis@test.com",
      submissionId: expect.stringMatching(/^3f2b7c1e-/),
    });
    expect(prismaMock.crmContact.create.mock.calls[0][0].data).not.toHaveProperty("accountCrmId");

    expect(enlaceMock.crearEnlaceConBorrador).toHaveBeenCalledWith(
      expect.objectContaining({ contactId: "local-1", crmId: "dd1", isNatural: true, datosCliente: natural, step: 2 })
    );
    expect(zohoMock.updateClientFormLink).toHaveBeenCalledWith(
      "dd1",
      "Debida_Diligencia",
      "https://portal.test/persona-natural?token=tok",
      expect.any(Date),
      "Activo"
    );
    expect(res).toMatchObject({ url: "https://portal.test/persona-natural?token=tok", ddCrmId: "dd1" });
  });

  it("jurídica: el Name sale de la razón social", async () => {
    await crearRegistroEstandalone({
      type: "JURIDICA",
      data: { razonSocial: "Inversiones SA", rlNombre: "Ana Gómez", empresaEmail: "info@inv.com", nombreProyecto: "Deici" },
      appUrl: "https://portal.test",
    });
    expect(zohoMock.createDebidaDiligenciaRecord.mock.calls[0][0]).toMatchObject({
      clientType: "JURIDICA",
      name: "Inversiones SA",
      razonSocial: "Inversiones SA",
      nombreNatural: "Ana Gómez",
      sinSocio: true,
    });
  });

  it("deja nota en el expediente y en los registros que ya existían", async () => {
    await crearRegistroEstandalone({
      type: "NATURAL",
      data: natural,
      appUrl: "https://portal.test",
      coincidencias: [{ module: "Accounts", field: "RUC", id: "acc9", name: "Luis" }],
    });
    const destinos = zohoMock.createNote.mock.calls.map(([id, , , modulo]) => `${modulo}:${id}`);
    expect(destinos).toEqual(["Debida_Diligencia:dd1", "Accounts:acc9"]);
  });

  it("una nota que falla no impide devolver el enlace", async () => {
    zohoMock.createNote.mockRejectedValue(new Error("sin permiso"));
    const res = await crearRegistroEstandalone({ type: "NATURAL", data: natural, appUrl: "https://portal.test" });
    expect(res.ddCrmId).toBe("dd1");
  });

  it("un reintento del mismo envío no crea otro expediente en Zoho: retoma desde el enlace", async () => {
    const submissionId = "aaaaaaaa-8a44-4d3b-9a55-0c1d2e3f4a5b";
    // El primer intento creó el expediente y su copia local, pero falló el enlace
    prismaMock.crmContact.findUnique.mockResolvedValue({ id: "local-1", crmId: "dd-previo" });
    const res = await crear({ submissionId, type: "NATURAL", data: natural, appUrl: "https://portal.test" });

    expect(prismaMock.crmContact.findUnique).toHaveBeenCalledWith({ where: { submissionId } });
    expect(zohoMock.createDebidaDiligenciaRecord).not.toHaveBeenCalled();
    expect(prismaMock.crmContact.create).not.toHaveBeenCalled();
    expect(enlaceMock.crearEnlaceConBorrador).toHaveBeenCalledWith(expect.objectContaining({ contactId: "local-1", crmId: "dd-previo" }));
    expect(res.ddCrmId).toBe("dd-previo");
  });

  it("dos envíos simultáneos del mismo id comparten una sola creación", async () => {
    const submissionId = "bbbbbbbb-8a44-4d3b-9a55-0c1d2e3f4a5b";
    const params = { submissionId, type: "NATURAL" as const, data: natural, appUrl: "https://portal.test" };
    const [a, b] = await Promise.all([crear(params), crear(params)]);
    expect(zohoMock.createDebidaDiligenciaRecord).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it("sin nombre de cliente no crea nada en Zoho", async () => {
    await expect(
      crearRegistroEstandalone({ type: "NATURAL", data: { nombreProyecto: "The Hub" }, appUrl: "https://portal.test" })
    ).rejects.toThrow("nombre de cliente");
    expect(zohoMock.createDebidaDiligenciaRecord).not.toHaveBeenCalled();
  });
});
