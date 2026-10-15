import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { prismaMock, manageMock, validacionMock, camposMock } = vi.hoisted(() => ({
  prismaMock: {
    temporal: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  },
  manageMock: { manageTemporal: vi.fn() },
  validacionMock: { buscarClienteEnZoho: vi.fn() },
  camposMock: { validarPasoTemporal: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/auditService", () => ({ logAuditEvent: vi.fn() }));
vi.mock("@/lib/manageTemporal", () => manageMock);
vi.mock("@/lib/temporalValidation", () => validacionMock);
// datosDelTemporal real (filtra los campos); la validación de campos se simula
vi.mock("@/lib/temporalFields", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/temporalFields")>()),
  ...camposMock,
}));

import { GET, PUT, POST } from "@/app/api/temporal/route";

const TOKEN = "a".repeat(43);
const futuro = new Date(Date.now() + 86_400_000);
const temporal = (extra: any = {}) => ({
  id: "t1",
  type: "NATURAL",
  data: { nombreProyecto: "The Hub" },
  tokenHash: "x",
  crmRecordId: "r1",
  crmModule: "Debida_Diligencia",
  expiresAt: futuro,
  completedAt: null,
  updatedAt: new Date(),
  ...extra,
});

const req = (method: string, body?: any, token = TOKEN) =>
  new NextRequest("http://portal.test/api/temporal", {
    method,
    headers: { authorization: `Bearer ${token}`, host: "portal.test", "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

/** Los handlers se tipan como posiblemente undefined: en estas rutas siempre responden. */
const r = async (p: Promise<Response | undefined>) => (await p)!;
const enviar = (data: any = { firstName: "Luis" }, extra: any = {}) => r(POST(req("POST", { data, ...extra })));

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.NEXT_PUBLIC_APP_URL;
  prismaMock.temporal.findUnique.mockResolvedValue(temporal());
  prismaMock.temporal.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.temporal.update.mockResolvedValue(temporal());
  camposMock.validarPasoTemporal.mockReturnValue({});
  validacionMock.buscarClienteEnZoho.mockResolvedValue([]);
  manageMock.manageTemporal.mockResolvedValue({ url: "https://x/persona-natural?token=nuevo", expiresAt: futuro, ddCrmId: "dd1" });
});

describe("POST /api/temporal", () => {
  it("bloquea el temporal, crea todo y devuelve la URL del enlace normal", async () => {
    const res = await enviar();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, url: "https://x/persona-natural?token=nuevo" });

    // Bloqueo atómico: solo si nadie lo completó antes
    const [bloqueo] = prismaMock.temporal.updateMany.mock.calls[0];
    expect(bloqueo.where).toEqual({ id: "t1", completedAt: null });
    expect(bloqueo.data.completedAt).toBeInstanceOf(Date);
    // manageTemporal corre con el temporal ya bloqueado
    expect(manageMock.manageTemporal.mock.calls[0][0].completedAt).toEqual(bloqueo.data.completedAt);
    expect(manageMock.manageTemporal.mock.calls[0][1]).toEqual({ coincidencias: [], appUrl: "https://portal.test" });
  });

  it("pasa los datos guardados más los enviados, sin campos ajenos al temporal", async () => {
    await enviar({ firstName: "Luis", ingresosMensuales: "5000", idFile: "x.pdf", firmaImage: "data:" });
    const datos = manageMock.manageTemporal.mock.calls[0][0].data;
    expect(datos).toEqual({ nombreProyecto: "The Hub", firstName: "Luis", ingresosMensuales: "5000" });
    expect(prismaMock.temporal.updateMany.mock.calls[0][0].data.data).toEqual(datos);
  });

  it("si la creación falla, libera el temporal para reintentar y responde 500 CREACION", async () => {
    manageMock.manageTemporal.mockRejectedValue(new Error("Zoho caído"));
    const res = await enviar();
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ code: "CREACION" });

    const bloqueadoEn = prismaMock.temporal.updateMany.mock.calls[0][0].data.completedAt;
    expect(prismaMock.temporal.updateMany).toHaveBeenLastCalledWith({
      where: { id: "t1", completedAt: bloqueadoEn },
      data: { completedAt: null },
    });
  });

  it("doble envío concurrente: el segundo no crea nada (403 USED)", async () => {
    prismaMock.temporal.updateMany.mockResolvedValue({ count: 0 });
    const res = await enviar();
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ reason: "USED" });
    expect(manageMock.manageTemporal).not.toHaveBeenCalled();
  });

  it("cliente existente sin confirmar: 409 sin bloquear; confirmado: sin enlace nuevo", async () => {
    const coincidencias = [{ module: "Accounts", id: "accX", field: "RUC", name: "ACME" }];
    validacionMock.buscarClienteEnZoho.mockResolvedValue(coincidencias);

    const res = await enviar();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ success: false, code: "CLIENTE_EXISTENTE" });
    expect(prismaMock.temporal.updateMany).not.toHaveBeenCalled();

    manageMock.manageTemporal.mockResolvedValue(null);
    const confirmado = await enviar(undefined, { confirmarExistente: true });
    expect(await confirmado.json()).toEqual({ success: true });
    expect(manageMock.manageTemporal.mock.calls[0][1].coincidencias).toEqual(coincidencias);
  });

  it("reintento tras creación a medias: lo que creó este temporal no cuenta como cliente existente", async () => {
    prismaMock.temporal.findUnique.mockResolvedValue(temporal({ contactCrmId: "con1", accountCrmId: "acc1" }));
    validacionMock.buscarClienteEnZoho.mockResolvedValue([
      { module: "Accounts", id: "acc1", field: "RUC", name: "Luis Mora-A-12-The Hub" },
      { module: "Contacts", id: "con1", field: "C_I_P_Pasaporte", name: "Luis Mora" },
    ]);
    const res = await enviar();
    expect(res.status).toBe(200);
    expect(manageMock.manageTemporal.mock.calls[0][1].coincidencias).toEqual([]);
    // El temporal con sus ids pasa a manageTemporal para continuar desde ahí
    expect(manageMock.manageTemporal.mock.calls[0][0]).toMatchObject({ contactCrmId: "con1", accountCrmId: "acc1" });
  });

  it("si no se puede verificar en Zoho no bloquea ni crea (503)", async () => {
    validacionMock.buscarClienteEnZoho.mockRejectedValue(new Error("caído"));
    const res = await enviar();
    expect(res.status).toBe(503);
    expect(prismaMock.temporal.updateMany).not.toHaveBeenCalled();
  });

  it("errores de campos: 422 sin bloquear", async () => {
    camposMock.validarPasoTemporal.mockReturnValue({ firstName: "requerido" });
    const res = await enviar();
    expect(res.status).toBe(422);
    expect(prismaMock.temporal.updateMany).not.toHaveBeenCalled();
  });
});

describe("enlace temporal bloqueado", () => {
  it("completado: GET, PUT y POST responden 403 USED", async () => {
    prismaMock.temporal.findUnique.mockResolvedValue(temporal({ completedAt: new Date() }));
    for (const res of [await r(GET(req("GET"))), await r(PUT(req("PUT", { data: { firstName: "x" } }))), await enviar()]) {
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ reason: "USED" });
    }
    expect(prismaMock.temporal.update).not.toHaveBeenCalled();
    expect(manageMock.manageTemporal).not.toHaveBeenCalled();
  });

  it("vencido: 403 EXPIRED; token inválido: 403 INVALID", async () => {
    prismaMock.temporal.findUnique.mockResolvedValue(temporal({ expiresAt: new Date(Date.now() - 1000) }));
    expect(await (await r(GET(req("GET")))).json()).toMatchObject({ reason: "EXPIRED" });
    expect(await (await r(GET(req("GET", undefined, "corto")))).json()).toMatchObject({ reason: "INVALID" });
  });
});
