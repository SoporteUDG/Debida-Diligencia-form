import { describe, it, expect } from "vitest";
import { getExpectedDocuments, getMissingDocuments } from "../expectedDocuments";

describe("expectedDocuments", () => {
  describe("persona natural", () => {
    const data = { tipoIdentificacion: "Cédula" };

    it("toma el tipo de identificación declarado para nombrar el documento", () => {
      const [primero] = getExpectedDocuments("natural", data);
      expect(primero.label).toBe("Documento de Cédula");
      expect(primero.required).toBe(true);
    });

    it("usa una etiqueta genérica si aún no se eligió el tipo", () => {
      const [primero] = getExpectedDocuments("natural", {});
      expect(primero.label).toBe("Documento de identidad");
    });

    it("lista por nombre lo que falta cuando no hay ningún adjunto", () => {
      const faltantes = getMissingDocuments("natural", data, []);
      expect(faltantes.map((f) => f.key)).toEqual([
        "idFile",
        "hasCertificacionBancaria",
        "hasEstadoCuenta",
        "origenFondosFile",
      ]);
    });

    it("descuenta los documentos ya cargados", () => {
      const faltantes = getMissingDocuments("natural", data, [
        { documentType: "idFile" },
        { documentType: "origenFondosFile" },
      ]);
      expect(faltantes.map((f) => f.key)).toEqual(["hasCertificacionBancaria", "hasEstadoCuenta"]);
      expect(faltantes.every((f) => !f.required)).toBe(true);
    });
  });

  describe("persona jurídica", () => {
    const data = {
      rlNombre: "Ana Pérez",
      gjcMembers: [{ id: "g1", nombre: "Luis", apellidos: "Gómez", cargo: "Tesorero" }],
      bfMembers: [{ id: "b1", nombreCompleto: "Marta Ruiz" }],
    };

    it("pide cédula o pasaporte por cada persona vinculada", () => {
      const faltantes = getMissingDocuments("juridica", data, []);
      const porPersona = faltantes.filter((f) => f.documentType === "copiaIdFile");
      expect(porPersona.map((f) => f.key)).toEqual([
        "RL-rl-copiaIdFile",
        "GJC-g1-copiaIdFile",
        "BF-b1-copiaIdFile",
      ]);
      expect(porPersona.map((f) => f.detail)).toEqual([
        "Representante Legal · Ana Pérez",
        "Tesorero · Luis Gómez",
        "Beneficiario Final · Marta Ruiz",
      ]);
    });

    it("no da por cubierta a una persona con la cédula de otra", () => {
      // Todas las cédulas comparten documentType: el cotejo debe mirar persona y rol.
      const faltantes = getMissingDocuments("juridica", data, [
        { documentType: "copiaIdFile", personType: "GJC", personId: "g1" },
      ]);
      const claves = faltantes.map((f) => f.key);
      expect(claves).toContain("RL-rl-copiaIdFile");
      expect(claves).toContain("BF-b1-copiaIdFile");
      expect(claves).not.toContain("GJC-g1-copiaIdFile");
    });

    it("marca obligatorias sólo las cédulas, no los documentos societarios", () => {
      const faltantes = getMissingDocuments("juridica", data, []);
      const obligatorios = faltantes.filter((f) => f.required);
      expect(obligatorios.every((f) => f.documentType === "copiaIdFile")).toBe(true);
      expect(faltantes.find((f) => f.key === "pactoSocialFile")?.required).toBe(false);
    });

    it("tolera un expediente sin dignatarios ni beneficiarios cargados", () => {
      const faltantes = getMissingDocuments("juridica", { rlNombre: "" }, []);
      expect(faltantes.find((f) => f.key === "RL-rl-copiaIdFile")?.detail).toBe(
        "Representante Legal · sin nombre registrado"
      );
      expect(faltantes.filter((f) => f.personType === "GJC")).toHaveLength(0);
    });
  });
});
