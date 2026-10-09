import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ default: {} }));
vi.mock("@/lib/workdriveSyncService", () => ({ syncFormToWorkDrive: vi.fn() }));

import { calcularCambiosDesdeZoho, tomarCopia, datosFormularioDesdeZoho, esCampoNoPrecargable } from "../zohoChangeService";

describe("calcularCambiosDesdeZoho", () => {
  const natural = {
    nombreProyecto: "Altos del Parque",
    firstName: "Juan",
    lastName: "Pérez Ruiz",
    ciudad: "Panamá",
    telefonoCodigo: "+507",
    telefono: "6000-0000",
    esPep: "No",
    profession: "Abogado",
    medioPago: "Efectivo, Cheque",
  };

  it("aplica solo los campos que cambiaron en Zoho respecto de la copia anterior", () => {
    const anterior = { Ciudad: "Panamá", Tel_fono: "+507 6000-0000", Nombre_natural: "Juan Pérez Ruiz" };
    const registro = {
      Ciudad: "Colón",
      Tel_fono: "+1 555-1234",
      Nombre_natural: "Juan Pérez Ruiz",
      Campo_Propio_De_Zoho: "cualquier cosa",
    };

    const { cambios, detalle } = calcularCambiosDesdeZoho("NATURAL", registro, anterior, natural);

    expect(cambios).toEqual({ ciudad: "Colón", telefonoCodigo: "+1", telefono: "555-1234" });
    expect(detalle.map((c) => c.campoZoho)).toEqual(["Ciudad", "Tel_fono"]);
    expect(detalle[0]).toMatchObject({ anterior: "Panamá", nuevo: "Colón" });
  });

  it("no hace nada si el valor nuevo ya coincide con el portal (eco de la propia sincronización)", () => {
    const { detalle } = calcularCambiosDesdeZoho(
      "NATURAL",
      { Ciudad: "Panamá", Nombre_natural: "Juan Pérez Ruiz" },
      { Ciudad: "", Nombre_natural: "" },
      natural
    );
    expect(detalle).toEqual([]);
  });

  it("sin copia anterior no borra datos del borrador por campos vacíos o casillas desmarcadas", () => {
    const { detalle } = calcularCambiosDesdeZoho(
      "NATURAL",
      { Ciudad: null, Es_PEP: false, Proyecto: "Altos del Parque" },
      null,
      { ...natural, esPep: "Sí" }
    );
    expect(detalle).toEqual([]);
  });

  it("sin copia anterior aplica valores nuevos que difieren del portal", () => {
    const { cambios } = calcularCambiosDesdeZoho("NATURAL", { Es_PEP: true, Ciudad: "David" }, null, natural);
    expect(cambios).toEqual({ esPep: "Sí", ciudad: "David" });
  });

  it("traduce selectores con 'Otros' y listas", () => {
    const { cambios } = calcularCambiosDesdeZoho(
      "NATURAL",
      { Profesi_n: "Astronauta", Medios_de_Pago: ["Transferencia", "Efectivo"] },
      { Profesi_n: "Abogado", Medios_de_Pago: "Cheque, Efectivo" },
      natural
    );
    expect(cambios).toEqual({
      profession: "Otros",
      profesionOtros: "Astronauta",
      medioPago: "Transferencia, Efectivo",
    });
  });

  it("ignora valores sin equivalente en el formulario", () => {
    const { cambios, ignorados } = calcularCambiosDesdeZoho(
      "NATURAL",
      { Fuente_de_Fondos: "Herencia" },
      { Fuente_de_Fondos: "Propios" },
      { ...natural, fuenteFondosInmueble: "Propios" }
    );
    expect(cambios).toEqual({});
    expect(ignorados).toEqual(["Fuente_de_Fondos"]);
  });

  it("Jurídica: los campos del Representante Legal van a rl*", () => {
    const { cambios } = calcularCambiosDesdeZoho(
      "JURIDICA",
      { Nombre_natural: "Ana Gómez", Raz_n_social: "Nueva S.A." },
      { Nombre_natural: "Carlos Gómez", Raz_n_social: "Vieja S.A." },
      { rlNombre: "Carlos Gómez", razonSocial: "Vieja S.A." }
    );
    expect(cambios).toEqual({ rlNombre: "Ana Gómez", razonSocial: "Nueva S.A." });
  });

  it("la copia solo guarda campos mapeados, normalizados", () => {
    const copia = tomarCopia("NATURAL", { Ciudad: " Colón ", Es_PEP: true, Otro_Campo: "x", Proyecto: { name: "P1", id: "9" } });
    expect(copia.Ciudad).toBe("Colón");
    expect(copia.Es_PEP).toBe("true");
    expect(copia.Proyecto).toBe("P1");
    expect(copia).not.toHaveProperty("Otro_Campo");
  });
});

describe("datosFormularioDesdeZoho", () => {
  it("precarga los campos con valor del registro de Zoho", () => {
    const datos = datosFormularioDesdeZoho("NATURAL", {
      Proyecto: "Altos del Parque",
      Nombre_natural: "Juan Pérez",
      Celular: "+507 6000-0000",
      Es_PEP: true,
      Ciudad: "",
      Mas_unidades_inmobiliarias: false,
      Otro_Campo: "x",
    });
    expect(datos).toEqual({
      nombreProyecto: "Altos del Parque",
      firstName: "Juan",
      lastName: "Pérez",
      celularCodigo: "+507",
      celular: "6000-0000",
      esPep: "Sí",
    });
  });

  it("mapea los campos de persona jurídica", () => {
    const datos = datosFormularioDesdeZoho("JURIDICA", { Raz_n_social: "ACME S.A.", Nombre_natural: "Ana Díaz" });
    expect(datos).toEqual({ razonSocial: "ACME S.A.", rlNombre: "Ana Díaz" });
  });

  it("ID tributaria: solo la jurídica la toma (numeroIdTributaria); RUC_NIT no llena numeroDocumento", () => {
    const registro = { ID_tributaria: "155-1-2026", RUC_NIT: "8-1-1", Numero_Identificacion: "8-2-2" };
    const juridica = datosFormularioDesdeZoho("JURIDICA", registro);
    expect(juridica.numeroIdTributaria).toBe("155-1-2026");
    expect(juridica).not.toHaveProperty("numeroDocumento");
    // Natural: su documento es idNumber; no tiene ID tributaria
    const natural = datosFormularioDesdeZoho("NATURAL", registro);
    expect(natural).not.toHaveProperty("idTributaria");
    expect(natural).not.toHaveProperty("numeroIdTributaria");
  });

  it("excluye documentos, sus casillas, términos y firma", () => {
    for (const campo of [
      "idFile", "origenFondosFile", "hasEstadoCuenta", "hasCertificacionBancaria", "checkedPactoSocial",
      "personDocuments", "termsAccepted", "signatureConfirmed", "signerName", "signatureDate", "firmaImage",
    ]) {
      expect(esCampoNoPrecargable(campo)).toBe(true);
    }
    expect(esCampoNoPrecargable("razonSocial")).toBe(false);
    expect(esCampoNoPrecargable("esPep")).toBe(false);
  });
});
