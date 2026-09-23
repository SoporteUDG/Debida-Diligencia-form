import { describe, it, expect, vi, afterEach } from "vitest";
import { generateCompleteDossierPDF, esExpedienteConsolidado } from "../completeDossierService";

describe("esExpedienteConsolidado", () => {
  it("reconoce el PDF consolidado de cualquier versión", () => {
    expect(esExpedienteConsolidado({ name: "Expediente_Debida_Diligencia_Herrera_Luc_a_mock-1_v1.pdf" })).toBe(true);
    expect(esExpedienteConsolidado({ name: "Expediente_Debida_Diligencia_Herrera_Luc_a_mock-1_v12.pdf" })).toBe(true);
  });

  it("no confunde los anexos del cliente con el consolidado", () => {
    expect(esExpedienteConsolidado({ name: "Herrera_Luc_a_idFile_1790117868503.pdf" })).toBe(false);
    expect(esExpedienteConsolidado({ name: null })).toBe(false);
  });
});

describe("generateCompleteDossierPDF · versiones anteriores", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("no descarga ni anexa los consolidados de versiones anteriores", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    await generateCompleteDossierPDF(
      "NATURAL",
      { firstName: "Lucía", lastName: "Herrera" },
      "form-v3",
      new Date("2026-09-22"),
      [
        { name: "Expediente_Debida_Diligencia_Herrera_Luc_a_mock-1_v1.pdf", fileType: "application/pdf", zohoFileId: "consolidado-v1" },
        { name: "Expediente_Debida_Diligencia_Herrera_Luc_a_mock-1_v2.pdf", fileType: "application/pdf", zohoFileId: "consolidado-v2" },
        { name: "Herrera_Luc_a_idFile.pdf", fileType: "application/pdf", zohoFileId: "anexo-cliente", documentType: "idFile" },
      ],
      "token-de-prueba",
      3
    );

    const pedidos = fetchMock.mock.calls.map((c) => String((c as unknown[])[0]));
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]).toContain("anexo-cliente");
  }, 30000);
});
