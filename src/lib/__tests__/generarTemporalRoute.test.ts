import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { temporal: { create: vi.fn(), updateMany: vi.fn() } },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/auditService", () => ({ logAuditEvent: vi.fn() }));

import { POST } from "@/app/api/generar-temporal/route";

const LLAVE = "llave-de-prueba";
const req = (body: any, llave = LLAVE) =>
  new NextRequest("http://portal.test/api/generar-temporal", {
    method: "POST",
    headers: { "x-api-key": llave, host: "portal.test", "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ZOHO_BUTTON_API_KEY = LLAVE;
  delete process.env.NEXT_PUBLIC_APP_URL;
  prismaMock.temporal.create.mockImplementation(async ({ data }: any) => ({ id: "t1", ...data }));
});

describe("POST /api/generar-temporal", () => {
  it("crea un temporal nuevo sin recordId con los datos del formulario emergente", async () => {
    const res = await POST(
      req({ persona_de_tipo: "Jurídica", modulo: "Accounts", userId: "u1", proyecto: "The Hub", unidad_vendida: { id: "u-12", name: "A-12" } })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.tipo).toBe("JURIDICA");
    expect(json.url).toMatch(/^https:\/\/portal\.test\/temporal\?token=[A-Za-z0-9_-]{43}$/);

    const { data } = prismaMock.temporal.create.mock.calls[0][0];
    expect(data).toMatchObject({
      type: "JURIDICA",
      crmModule: "Accounts",
      createdBy: "u1",
      data: { nombreProyecto: "The Hub" },
      unidadVendidaId: "u-12",
      unidadVendidaNombre: "A-12",
      proyecto: "The Hub",
    });
    expect(data).not.toHaveProperty("crmRecordId");
    // No está atado a un registro: no invalida otros temporales
    expect(prismaMock.temporal.updateMany).not.toHaveBeenCalled();
  });

  it("acepta Natural y la unidad con id", async () => {
    const res = await POST(req({ persona_de_tipo: "Natural", unidad_vendida: { id: "99", name: "B-1" } }));
    expect((await res.json()).tipo).toBe("NATURAL");
    const { data } = prismaMock.temporal.create.mock.calls[0][0];
    expect(data).toMatchObject({ crmModule: "Accounts", unidadVendidaId: "99", unidadVendidaNombre: "B-1", data: {} });
  });

  it("rechaza la solicitud sin Persona de Tipo", async () => {
    const res = await POST(req({ proyecto: "The Hub" }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("SIN_TIPO");
    expect(prismaMock.temporal.create).not.toHaveBeenCalled();
  });

  it("rechaza la solicitud sin la unidad (o con la unidad sin id)", async () => {
    for (const unidad_vendida of [undefined, { name: "A-12" }]) {
      const res = await POST(req({ persona_de_tipo: "Natural", unidad_vendida }));
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe("SIN_UNIDAD");
    }
    expect(prismaMock.temporal.create).not.toHaveBeenCalled();
  });

  it("rechaza la llave incorrecta", async () => {
    const res = await POST(req({ persona_de_tipo: "Natural" }, "otra"));
    expect(res.status).toBe(401);
  });
});
