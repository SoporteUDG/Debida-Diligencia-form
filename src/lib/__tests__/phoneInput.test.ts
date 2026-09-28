import { describe, it, expect } from "vitest";
import { PHONE_INPUT_FIELDS, sanitizePhoneInput } from "../phoneInput";

describe("sanitizePhoneInput", () => {
  it("quita letras y símbolos, conserva dígitos y separadores", () => {
    expect(sanitizePhoneInput("6a0b0c0-0000")).toBe("6000-0000");
    expect(sanitizePhoneInput("+507 (6) 000-0000 ext. 12")).toBe("+507 (6) 000-0000  12");
    expect(sanitizePhoneInput("abc")).toBe("");
  });

  it("cubre los teléfonos de ambos formularios", () => {
    for (const campo of ["telefono", "celular", "contactoTelefono", "empresaTelefono", "empresaCelular", "rlTelefono"]) {
      expect(PHONE_INPUT_FIELDS.has(campo)).toBe(true);
    }
    expect(PHONE_INPUT_FIELDS.has("telefonoCodigo")).toBe(false);
  });
});
