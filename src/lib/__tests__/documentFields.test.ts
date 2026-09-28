import { describe, it, expect } from "vitest";
import {
  buildDocumentFileName,
  isMultiFileField,
  nextDocumentFileIndex,
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

  describe("buildDocumentFileName", () => {
    it("arma Etiqueta_Titular_file_N_sufijo sin tildes ni símbolos", () => {
      expect(
        buildDocumentFileName({
          documentType: "origenFondosFile",
          ext: "pdf",
          ownerName: "Inversiones ABC, S.A.",
          index: 2,
          suffix: "a3f9",
        })
      ).toBe("Origen_de_Fondos_Inversiones_ABC_S_A_file_2_a3f9.pdf");
    });

    it("documentos por persona llevan Tipo-N en lugar de file_N", () => {
      expect(
        buildDocumentFileName({
          documentType: "copiaIdFile",
          ext: "pdf",
          ownerName: "Ana Ruiz",
          person: { type: "BF", index: 2 },
        })
      ).toBe("Copia_del_Documento_de_Identidad_Ana_Ruiz_BF-2.pdf");
      expect(
        buildDocumentFileName({ documentType: "copiaIdFile", ext: "jpg", ownerName: "Carlos Gómez", person: { type: "RL", index: 1 } })
      ).toBe("Copia_del_Documento_de_Identidad_Carlos_Gomez_RL-1.jpg");
    });

    it("sin número ni sufijo (campos de un solo archivo) queda Etiqueta_Titular", () => {
      expect(buildDocumentFileName({ documentType: "idFile", ext: "jpg", ownerName: "José Pérez" })).toBe(
        "Copia_del_Documento_de_Identidad_Jose_Perez.jpg"
      );
    });

    it("omite el titular si está vacío", () => {
      expect(buildDocumentFileName({ documentType: "idFile", ext: "pdf", ownerName: " ", index: 1, suffix: "b2e4" })).toBe(
        "Copia_del_Documento_de_Identidad_file_1_b2e4.pdf"
      );
    });
  });

  describe("nextDocumentFileIndex", () => {
    it("empieza en 1 sin archivos previos", () => {
      expect(nextDocumentFileIndex([])).toBe(1);
    });

    it("toma el mayor file_N + 1 aunque haya huecos o nombres heredados", () => {
      expect(
        nextDocumentFileIndex([
          "Origen_de_Fondos_Juan_Perez_file_1_7c01.pdf",
          "Origen_de_Fondos_Juan_Perez_file_3_a3f9.pdf",
          "Origen_de_Fondos_1727000000000.pdf",
        ])
      ).toBe(4);
    });
  });
});
