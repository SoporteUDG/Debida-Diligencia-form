import { vi, describe, it, expect, beforeEach } from "vitest";

const { zohoMock } = vi.hoisted(() => ({
  zohoMock: { service: { searchByField: vi.fn() } },
}));
vi.mock("@/lib/zohoService", () => ({ zoho: zohoMock }));

import { buscarClienteEnZoho, VerificacionZohoError, CAMPOS_IDENTIFICADOR } from "../temporalValidation";

beforeEach(() => {
  vi.clearAllMocks();
  zohoMock.service.searchByField.mockResolvedValue([]);
});

describe("buscarClienteEnZoho", () => {
  it("jurídica: busca la ID tributaria (numeroIdTributaria) en cada campo", async () => {
    await buscarClienteEnZoho("JURIDICA", { numeroIdTributaria: " 155-1-2026 " });
    const llamadas = zohoMock.service.searchByField.mock.calls;
    expect(llamadas).toHaveLength(CAMPOS_IDENTIFICADOR.JURIDICA.length);
    for (const [, , valor] of llamadas) expect(valor).toBe("155-1-2026");
    expect(llamadas.map(([m, f]) => `${m}.${f}`)).toContain("Debida_Diligencia.ID_tributaria");
  });

  it("natural: busca la identificación (idNumber)", async () => {
    await buscarClienteEnZoho("NATURAL", { idNumber: "8-888-8888" });
    expect(zohoMock.service.searchByField).toHaveBeenCalledWith("Contacts", "C_I_P_Pasaporte", "8-888-8888");
  });

  it("sin identificador no consulta Zoho", async () => {
    expect(await buscarClienteEnZoho("NATURAL", {})).toEqual([]);
    expect(zohoMock.service.searchByField).not.toHaveBeenCalled();
  });

  it("devuelve las coincidencias sin repetir el mismo registro", async () => {
    zohoMock.service.searchByField.mockImplementation(async (module: string) =>
      module === "Debida_Diligencia" ? [{ id: "dd1", Name: "ACME-1-P" }] : []
    );
    const r = await buscarClienteEnZoho("JURIDICA", { numeroIdTributaria: "155" });
    expect(r).toEqual([{ module: "Debida_Diligencia", field: "ID_tributaria", id: "dd1", name: "ACME-1-P" }]);
  });

  it("tolera que falle un campo, pero no que fallen todos", async () => {
    zohoMock.service.searchByField
      .mockRejectedValueOnce(new Error("INVALID_QUERY"))
      .mockResolvedValue([{ id: "a1", Account_Name: "ACME" }]);
    expect(await buscarClienteEnZoho("JURIDICA", { numeroIdTributaria: "155" })).not.toHaveLength(0);

    zohoMock.service.searchByField.mockReset().mockRejectedValue(new Error("caído"));
    await expect(buscarClienteEnZoho("JURIDICA", { numeroIdTributaria: "155" })).rejects.toBeInstanceOf(
      VerificacionZohoError
    );
  });
});
