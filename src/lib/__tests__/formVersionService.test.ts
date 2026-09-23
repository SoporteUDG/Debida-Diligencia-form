import { describe, it, expect } from "vitest";
import { calcularCamposCambiados } from "../formVersionService";

describe("calcularCamposCambiados", () => {
  it("no reporta cambios entre snapshots idénticos", () => {
    const a = { firstName: "Ana", idNumber: "8-123-456" };
    expect(calcularCamposCambiados(a, { ...a })).toEqual([]);
  });

  it("detecta un campo modificado", () => {
    expect(
      calcularCamposCambiados({ direccion: "Calle 1" }, { direccion: "Calle 2" })
    ).toEqual(["direccion"]);
  });

  it("detecta campos agregados y eliminados", () => {
    expect(calcularCamposCambiados({ a: "1" }, { b: "2" })).toEqual(["a", "b"]);
  });

  it("compara arreglos por contenido (documentos multi-archivo)", () => {
    expect(
      calcularCamposCambiados(
        { origenFondosFile: ["a.pdf"] },
        { origenFondosFile: ["a.pdf", "b.pdf"] }
      )
    ).toEqual(["origenFondosFile"]);

    expect(
      calcularCamposCambiados(
        { origenFondosFile: ["a.pdf"] },
        { origenFondosFile: ["a.pdf"] }
      )
    ).toEqual([]);
  });

  it("ignora los campos internos de control del borrador", () => {
    expect(
      calcularCamposCambiados(
        { firstName: "Ana", completed: false, submittedFormId: null },
        { firstName: "Ana", completed: true, submittedFormId: "form-1" }
      )
    ).toEqual([]);
  });

  it("devuelve los campos ordenados alfabéticamente", () => {
    const cambios = calcularCamposCambiados(
      { zeta: 1, alfa: 1, medio: 1 },
      { zeta: 2, alfa: 2, medio: 2 }
    );
    expect(cambios).toEqual(["alfa", "medio", "zeta"]);
  });

  it("tolera snapshots nulos o indefinidos", () => {
    expect(calcularCamposCambiados(null, { a: "1" })).toEqual(["a"]);
    expect(calcularCamposCambiados(undefined, undefined)).toEqual([]);
  });
});
