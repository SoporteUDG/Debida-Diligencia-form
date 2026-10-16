import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { temporal: { findMany: vi.fn() } },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/auditService", () => ({ logAuditEvent: vi.fn() }));

import { POST } from "@/app/api/temporales/route";

const LLAVE = "llave-de-prueba";
const req = (llave = LLAVE) =>
  new NextRequest("http://portal.test/api/temporales", {
    method: "POST",
    headers: { "x-api-key": llave, host: "portal.test", "content-type": "application/json" },
    body: "{}",
  });

const creado = new Date("2026-10-15T10:00:00Z");
const vence = new Date("2026-10-22T10:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ZOHO_BUTTON_API_KEY = LLAVE;
  delete process.env.NEXT_PUBLIC_APP_URL;
});

describe("POST /api/temporales", () => {
  it("lista los temporales activos con su enlace (null si no hay token guardado)", async () => {
    prismaMock.temporal.findMany.mockResolvedValue([
      { id: "t2", type: "JURIDICA", token: "abc", proyecto: "The Hub", unidadVendidaNombre: "A-12", createdBy: "u1", createdAt: creado, expiresAt: vence },
      { id: "t1", type: "NATURAL", token: null, proyecto: null, unidadVendidaNombre: null, createdBy: null, createdAt: creado, expiresAt: vence },
    ]);

    const res = await POST(req());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.temporales).toEqual([
      {
        id: "t2", tipo: "JURIDICA", url: "https://portal.test/temporal?token=abc", proyecto: "The Hub",
        unidad: "A-12", createdBy: "u1", createdAt: creado.toISOString(), expiresAt: vence.toISOString(),
      },
      {
        id: "t1", tipo: "NATURAL", url: null, proyecto: null,
        unidad: null, createdBy: null, createdAt: creado.toISOString(), expiresAt: vence.toISOString(),
      },
    ]);

    // Solo los abiertos y sin vencer, del más reciente al más antiguo
    const [consulta] = prismaMock.temporal.findMany.mock.calls[0];
    expect(consulta.where.completedAt).toBeNull();
    expect(consulta.where.expiresAt.gt).toBeInstanceOf(Date);
    expect(consulta.orderBy).toEqual({ createdAt: "desc" });
  });

  it("rechaza la llave incorrecta", async () => {
    const res = await POST(req("otra"));
    expect(res.status).toBe(401);
    expect(prismaMock.temporal.findMany).not.toHaveBeenCalled();
  });
});
