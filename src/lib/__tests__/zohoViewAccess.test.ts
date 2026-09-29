import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verificarAccesoZoho, registrarTraspaso, reclamarTraspaso } from "../zohoViewAccess";

const SECRET = "secreto-de-prueba";
const firmar = (msg: string, formato: "hex" | "base64") =>
  crypto.createHmac("sha256", SECRET).update(msg).digest(formato);

describe("verificarAccesoZoho", () => {
  beforeEach(() => {
    process.env.ZOHO_VIEW_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.ZOHO_VIEW_SECRET;
  });

  it("acepta la firma en base64 (formato por defecto de Deluge) y en hex", () => {
    const ts = String(Date.now());
    for (const formato of ["base64", "hex"] as const) {
      const sig = firmar(`4876000000123.${ts}`, formato);
      expect(verificarAccesoZoho({ recordId: "4876000000123", ts, sig }).ok).toBe(true);
    }
  });

  it("rechaza una firma de otro registro", () => {
    const ts = String(Date.now());
    const sig = firmar(`111.${ts}`, "base64");
    expect(verificarAccesoZoho({ recordId: "222", ts, sig }).ok).toBe(false);
  });

  it("rechaza una firma vencida", () => {
    const ts = String(Date.now() - 11 * 60 * 1000);
    const sig = firmar(`111.${ts}`, "base64");
    expect(verificarAccesoZoho({ recordId: "111", ts, sig }).ok).toBe(false);
  });

  it("queda deshabilitado sin ZOHO_VIEW_SECRET", () => {
    delete process.env.ZOHO_VIEW_SECRET;
    const ts = String(Date.now());
    const sig = firmar(`111.${ts}`, "base64");
    expect(verificarAccesoZoho({ recordId: "111", ts, sig }).ok).toBe(false);
  });
});

describe("traspaso botón -> Web Tab", () => {
  it("se reclama una sola vez y sin distinguir mayúsculas en el usuario", () => {
    registrarTraspaso("Ana@CSCaballero.com", "999");
    expect(reclamarTraspaso("ana@cscaballero.com")).toBe("999");
    expect(reclamarTraspaso("ana@cscaballero.com")).toBeNull();
  });

  it("reconoce un correo con '+' que el Web Tab entregó como espacio", () => {
    registrarTraspaso("ana+crm@cscaballero.com", "777");
    expect(reclamarTraspaso("ana crm@cscaballero.com")).toBe("777");
  });
});
