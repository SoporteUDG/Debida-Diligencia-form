import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/zohoAuthService", () => ({
  executeWithRetry: (fn: (token: string) => Promise<unknown>) => fn("tok"),
}));

import { POST } from "@/app/api/unidades/route";

const LLAVE = "llave-de-prueba";
const req = (body: any, llave = LLAVE) =>
  new NextRequest("http://portal.test/api/unidades", {
    method: "POST",
    headers: { "x-api-key": llave, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const json = (body: any, status = 200) => new Response(JSON.stringify(body), { status });
const fetchMock = vi.fn();

beforeEach(() => {
  process.env.ZOHO_BUTTON_API_KEY = LLAVE;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("POST /api/unidades", () => {
  it("lee el módulo del lookup Unidad_Vendida1 y filtra las unidades por proyecto", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("settings/fields?module=Accounts")) {
        return json({ fields: [{ api_name: "Otro" }, { api_name: "Unidad_Vendida1", lookup: { module: { api_name: "Inventario" } } }] });
      }
      if (url.includes("/Inventario?")) {
        return json({
          data: [
            { id: "2", Name: "A-10", Proyecto: { name: "The Hub", id: "p" } },
            { id: "1", Name: "A-9", Proyecto: "The Hub" },
            { id: "3", Name: "B-1", Proyecto: "Paramount" },
            { id: "4", Name: "C-1" },
          ],
          info: { more_records: false },
        });
      }
      throw new Error(`URL inesperada ${url}`);
    });

    const res = await POST(req({ proyecto: "The Hub" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      unidades: [
        { id: "1", name: "A-9" },
        { id: "2", name: "A-10" },
        { id: "4", name: "C-1" },
      ],
    });
  });

  it("acepta el lookup.module como texto (API v2) y sin proyecto devuelve todas", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes("settings/fields")
        ? json({ fields: [{ api_name: "Unidad_Vendida1", lookup: { module: "Unidades" } }] })
        : json({ data: [{ id: "3", Name: "B-1", Proyecto: "Paramount" }] })
    );
    const res = await POST(req({}));
    expect((await res.json()).unidades).toEqual([{ id: "3", name: "B-1" }]);
    expect(fetchMock.mock.calls[1][0]).toContain("/Unidades?");
  });

  it("responde 502 si Zoho falla", async () => {
    fetchMock.mockResolvedValue(json({ code: "x" }, 500));
    const res = await POST(req({}));
    expect(res.status).toBe(502);
  });

  it("rechaza la llave incorrecta", async () => {
    const res = await POST(req({}, "otra"));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
