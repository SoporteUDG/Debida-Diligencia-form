import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { servicioMock, validacionMock, camposMock } = vi.hoisted(() => ({
  servicioMock: { crearRegistroEstandalone: vi.fn() },
  validacionMock: { buscarClienteEnZoho: vi.fn() },
  camposMock: { validarPasoTemporal: vi.fn() },
}));

vi.mock("@/lib/auditService", () => ({ logAuditEvent: vi.fn() }));
vi.mock("@/lib/registroService", () => servicioMock);
vi.mock("@/lib/temporalValidation", () => validacionMock);
vi.mock("@/lib/temporalFields", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/temporalFields")>()),
  ...camposMock,
}));

import { POST } from "@/app/api/registro/route";
import {
  limitadorCreaciones,
  limitadorGlobal,
  limitadorEnvios,
  MAX_CREACIONES_POR_IP,
  MAX_CREACIONES_GLOBAL,
  MAX_ENVIOS_POR_IP,
} from "@/lib/registroLimites";

let ipSeq = 0;
const SUB = "3f2b7c1e-8a44-4d3b-9a55-0c1d2e3f4a5b";
const req = (body: any, headers: Record<string, string> = {}, ip = "1.1.1.1") =>
  new NextRequest("http://portal.test/api/registro", {
    method: "POST",
    headers: { host: "portal.test", "content-type": "application/json", "x-forwarded-for": ip, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const r = async (p: Promise<Response | undefined>) => (await p)!;
const enviar = (extra: any = {}, headers: Record<string, string> = {}, ip?: string) =>
  r(POST(req({ type: "NATURAL", submissionId: SUB, data: { firstName: "Luis", nombreProyecto: "The Hub" }, ...extra }, headers, ip)));

beforeEach(() => {
  vi.clearAllMocks();
  limitadorCreaciones.reiniciar();
  limitadorGlobal.reiniciar();
  limitadorEnvios.reiniciar();
  delete process.env.NEXT_PUBLIC_APP_URL;
  camposMock.validarPasoTemporal.mockReturnValue({});
  validacionMock.buscarClienteEnZoho.mockResolvedValue([]);
  servicioMock.crearRegistroEstandalone.mockResolvedValue({ url: "https://portal.test/persona-natural?token=t", ddCrmId: "dd1" });
});

describe("POST /api/registro", () => {
  it("crea el expediente y devuelve el enlace del formulario normal", async () => {
    const res = await enviar();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, url: "https://portal.test/persona-natural?token=t" });
    expect(servicioMock.crearRegistroEstandalone).toHaveBeenCalledWith(
      expect.objectContaining({ type: "NATURAL", submissionId: SUB, appUrl: "https://portal.test", coincidencias: [] })
    );
  });

  it("solo pasa los campos del paso y quita el HTML", async () => {
    await enviar({ data: { firstName: "<b>Luis</b>", campoAjeno: "x" } });
    const { data } = servicioMock.crearRegistroEstandalone.mock.calls[0][0];
    expect(data).toEqual({ firstName: "Luis" });
  });

  it("rechaza un Origin ajeno y acepta el del propio portal", async () => {
    const ajeno = await enviar({}, { origin: "https://otro-sitio.test" });
    expect(ajeno.status).toBe(403);
    expect(servicioMock.crearRegistroEstandalone).not.toHaveBeenCalled();
    expect((await enviar({}, { origin: "http://portal.test" })).status).toBe(200);
  });

  it("rechaza cuerpos inválidos, sin tipo o demasiado grandes", async () => {
    expect((await r(POST(req("no es json")))).status).toBe(400);
    expect((await enviar({ type: "OTRO" })).status).toBe(400);
    expect((await enviar({ data: "texto" })).status).toBe(400);
    // El submissionId debe ser un UUID
    expect((await enviar({ submissionId: undefined })).status).toBe(400);
    expect((await enviar({ submissionId: "../../etc/passwd" })).status).toBe(400);
    const enorme = await r(POST(req({ type: "NATURAL", data: { firstName: "x".repeat(250_000) } })));
    expect(enorme.status).toBe(413);
    expect(servicioMock.crearRegistroEstandalone).not.toHaveBeenCalled();
  });

  it("la trampa para bots responde éxito sin crear nada", async () => {
    const res = await enviar({ website: "http://spam.test" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(servicioMock.crearRegistroEstandalone).not.toHaveBeenCalled();
    expect(validacionMock.buscarClienteEnZoho).not.toHaveBeenCalled();
  });

  it("devuelve los errores de validación (422) sin tocar Zoho", async () => {
    camposMock.validarPasoTemporal.mockReturnValue({ firstName: "Requerido" });
    const res = await enviar();
    expect(res.status).toBe(422);
    expect((await res.json()).errors).toEqual({ firstName: "Requerido" });
    expect(validacionMock.buscarClienteEnZoho).not.toHaveBeenCalled();
  });

  it("pide confirmar si el identificador ya existe y no devuelve datos de Zoho", async () => {
    validacionMock.buscarClienteEnZoho.mockResolvedValue([{ module: "Accounts", field: "RUC", id: "a1", name: "Secreto" }]);
    const res = await enviar();
    expect(res.status).toBe(409);
    expect(JSON.stringify(await res.json())).not.toContain("Secreto");
    expect(servicioMock.crearRegistroEstandalone).not.toHaveBeenCalled();
  });

  it("con confirmarExistente crea el expediente y pasa las coincidencias para dejar nota", async () => {
    const coincidencias = [{ module: "Accounts", field: "RUC", id: "a1", name: "Luis" }];
    validacionMock.buscarClienteEnZoho.mockResolvedValue(coincidencias);
    const res = await enviar({ confirmarExistente: true });
    expect(res.status).toBe(200);
    expect(servicioMock.crearRegistroEstandalone).toHaveBeenCalledWith(expect.objectContaining({ coincidencias }));
  });

  it("503 si no se puede consultar Zoho", async () => {
    validacionMock.buscarClienteEnZoho.mockRejectedValue(new Error("zoho caído"));
    const res = await enviar();
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("VERIFICACION");
  });

  it("500 CREACION si falla la creación", async () => {
    servicioMock.crearRegistroEstandalone.mockRejectedValue(new Error("boom"));
    const res = await enviar();
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("CREACION");
  });

  it(`limita a ${MAX_CREACIONES_POR_IP} expedientes por IP cada 10 minutos`, async () => {
    for (let i = 0; i < MAX_CREACIONES_POR_IP; i++) expect((await enviar({}, {}, "9.9.9.9")).status).toBe(200);
    const res = await enviar({}, {}, "9.9.9.9");
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(servicioMock.crearRegistroEstandalone).toHaveBeenCalledTimes(MAX_CREACIONES_POR_IP);
    // Otra IP no se ve afectada
    expect((await enviar({}, {}, "8.8.8.8")).status).toBe(200);
  });

  it("el límite global protege a Zoho aunque las IPs sean distintas", async () => {
    for (let i = 0; i < MAX_CREACIONES_GLOBAL; i++) expect((await enviar({}, {}, `10.0.0.${++ipSeq}`)).status).toBe(200);
    const res = await enviar({}, {}, `10.0.0.${++ipSeq}`);
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("RATE_LIMIT_GLOBAL");
  });

  it("un envío con errores de validación no gasta cupo de creación", async () => {
    camposMock.validarPasoTemporal.mockReturnValue({ firstName: "Requerido" });
    for (let i = 0; i < 10; i++) await enviar({}, {}, "7.7.7.7");
    camposMock.validarPasoTemporal.mockReturnValue({});
    for (let i = 0; i < MAX_CREACIONES_POR_IP; i++) expect((await enviar({}, {}, "7.7.7.7")).status).toBe(200);
  });

  it(`acota los envíos (válidos o no) a ${MAX_ENVIOS_POR_IP} por IP cada hora`, async () => {
    camposMock.validarPasoTemporal.mockReturnValue({ firstName: "Requerido" });
    for (let i = 0; i < MAX_ENVIOS_POR_IP; i++) expect((await enviar({}, {}, "6.6.6.6")).status).toBe(422);
    expect((await enviar({}, {}, "6.6.6.6")).status).toBe(429);
  });
});
