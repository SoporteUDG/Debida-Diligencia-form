import { describe, it, expect } from "vitest";
import { juridicaStep1Schema, naturalStep1Schema } from "../validation";

/** Campos con error al validar el paso 1 vacío. */
const camposConError = (schema: typeof juridicaStep1Schema | typeof naturalStep1Schema) => {
  const r = schema.safeParse({});
  return new Set(r.success ? [] : r.error.issues.map((i) => String(i.path[0])));
};

describe("ID tributaria / número de documento", () => {
  it("Jurídica: la ID tributaria (numeroIdTributaria) es obligatoria; numeroDocumento ya no existe", () => {
    const errores = camposConError(juridicaStep1Schema);
    expect(errores.has("numeroIdTributaria")).toBe(true);
    expect(errores.has("numeroDocumento")).toBe(false);
  });

  it("Jurídica: con la ID tributaria llena ya no hay error en ese campo", () => {
    const r = juridicaStep1Schema.safeParse({ numeroIdTributaria: "155-1-2026" });
    const campos = r.success ? [] : r.error.issues.map((i) => String(i.path[0]));
    expect(campos).not.toContain("numeroIdTributaria");
  });

  it("Natural: su documento es idNumber; no tiene ID tributaria", () => {
    const errores = camposConError(naturalStep1Schema);
    expect(errores.has("idNumber")).toBe(true);
    expect(errores.has("idTributaria")).toBe(false);
  });
});
