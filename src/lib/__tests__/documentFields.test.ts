import { describe, it, expect } from "vitest";
import {
  isMultiFileField,
  normalizeMultiFileValue,
  MULTI_FILE_FIELDS_JURIDICA,
  MULTI_FILE_FIELDS_NATURAL,
} from "../documentFields";

describe("documentFields", () => {
  it("reconoce los campos multi-archivo de ambos formularios", () => {
    expect(isMultiFileField("origenFondosFile")).toBe(true);
    expect(isMultiFileField("pactoSocialFile")).toBe(true);
    expect(isMultiFileField("hasEstadoCuenta")).toBe(true);
    expect(isMultiFileField("avisoOperacionesFile")).toBe(false);
    expect(isMultiFileField("idFile")).toBe(false);
  });

  it("incluye origenFondosFile y pactoSocialFile en persona juridica", () => {
    expect(MULTI_FILE_FIELDS_JURIDICA).toContain("origenFondosFile");
    expect(MULTI_FILE_FIELDS_JURIDICA).toContain("pactoSocialFile");
    expect(MULTI_FILE_FIELDS_NATURAL).toContain("origenFondosFile");
  });

  describe("normalizeMultiFileValue", () => {
    it("conserva un arreglo ya valido", () => {
      expect(normalizeMultiFileValue(["a.pdf", "b.pdf"])).toEqual(["a.pdf", "b.pdf"]);
    });

    it('repara borradores que guardaron "" (el caso de pactoSocialFile)', () => {
      expect(normalizeMultiFileValue("")).toEqual([]);
    });

    it('repara borradores que guardaron [""]', () => {
      expect(normalizeMultiFileValue([""])).toEqual([]);
    });

    it("convierte un nombre suelto en arreglo de un elemento", () => {
      expect(normalizeMultiFileValue("unico.pdf")).toEqual(["unico.pdf"]);
    });

    it("descarta null, undefined y entradas no string", () => {
      expect(normalizeMultiFileValue(null)).toEqual([]);
      expect(normalizeMultiFileValue(undefined)).toEqual([]);
      expect(normalizeMultiFileValue(["a.pdf", null, 5, "  ", "b.pdf"])).toEqual(["a.pdf", "b.pdf"]);
    });
  });
});
