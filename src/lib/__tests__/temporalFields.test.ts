import { describe, it, expect } from "vitest";
import { validarPasoTemporal, datosDelTemporal, identificadorDelTemporal, TEMPORAL_FIELDS } from "../temporalFields";

describe("temporalFields", () => {
  it("solo reporta errores de los campos del paso", () => {
    for (const type of ["NATURAL", "JURIDICA"] as const) {
      const errors = validarPasoTemporal(type, {});
      const campos = Object.keys(errors).map((k) => k.split(".")[0]);
      expect(campos.length).toBeGreaterThan(0);
      for (const c of campos) expect(TEMPORAL_FIELDS[type]).toContain(c);
    }
  });

  it("descarta los campos que no son del paso", () => {
    expect(datosDelTemporal("NATURAL", { firstName: "Ana", idFile: "x.pdf", firmaImage: "data:" })).toEqual({ firstName: "Ana" });
  });

  it("incluye las secciones II y III, sin documentos ni firma", () => {
    expect(TEMPORAL_FIELDS.NATURAL).toEqual(expect.arrayContaining(["direccionResidencial", "ingresosMensuales", "esPep"]));
    expect(TEMPORAL_FIELDS.JURIDICA).toEqual(expect.arrayContaining(["rlNombre", "gjcMembers", "bfMembers", "medioPago"]));
    for (const type of ["NATURAL", "JURIDICA"] as const) {
      for (const campo of ["idFile", "origenFondosFile", "termsAccepted", "firmaImage"]) {
        expect(TEMPORAL_FIELDS[type]).not.toContain(campo);
      }
    }
  });

  it("identificadorDelTemporal: ID tributaria (jurídica) o identificación (natural)", () => {
    expect(identificadorDelTemporal("JURIDICA", { numeroIdTributaria: " 155-1 ", idNumber: "x" })).toBe("155-1");
    expect(identificadorDelTemporal("NATURAL", { idNumber: "8-1-1" })).toBe("8-1-1");
  });
});
