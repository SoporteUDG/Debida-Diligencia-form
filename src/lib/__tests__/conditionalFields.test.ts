import { describe, it, expect } from "vitest";
import {
  isFieldVisible,
  camposVisibles,
  muestraBloqueTercero,
  muestraBloquePep,
} from "../conditionalFields";

describe("conditionalFields", () => {
  describe("paso 1, igual en ambos formularios", () => {
    it("sólo muestra 'Referido Por' cuando el contacto fue por referido", () => {
      for (const t of ["natural", "juridica"] as const) {
        expect(isFieldVisible(t, "referidoPor", { formaContacto: "Referido" })).toBe(true);
        expect(isFieldVisible(t, "referidoPor", { formaContacto: "Redes Sociales" })).toBe(false);
        expect(isFieldVisible(t, "referidoPor", {})).toBe(false);
      }
    });

    it("sólo muestra el detalle del contacto cuando se eligió 'Otros'", () => {
      for (const t of ["natural", "juridica"] as const) {
        expect(isFieldVisible(t, "formaContactoDetalle", { formaContacto: "Otros" })).toBe(true);
        expect(isFieldVisible(t, "formaContactoDetalle", { formaContacto: "Otro" })).toBe(true);
        expect(isFieldVisible(t, "formaContactoDetalle", { formaContacto: "Referido" })).toBe(false);
      }
    });
  });

  describe("persona natural", () => {
    it("oculta la cantidad de servicios si no se declararon", () => {
      expect(isFieldVisible("natural", "cantidadServiciosAnuales", { montoServiciosAnuales: "Sí" })).toBe(true);
      expect(isFieldVisible("natural", "cantidadServiciosAnuales", { montoServiciosAnuales: "No" })).toBe(false);
    });

    it("oculta el nombre del tercero si no adquiere a nombre de otro", () => {
      expect(isFieldVisible("natural", "nombreTercero", { adquiereNombreTercero: "Sí" })).toBe(true);
      expect(isFieldVisible("natural", "nombreTercero", { adquiereNombreTercero: "No" })).toBe(false);
    });

    it("acepta 'Si' sin tilde, como lo guardan algunas pantallas", () => {
      expect(isFieldVisible("natural", "nombreTercero", { adquiereNombreTercero: "Si" })).toBe(true);
    });

    it("conserva el !== 'No' del formulario para usaFondos", () => {
      expect(isFieldVisible("natural", "usaFondos", { esPropietario: "Sí" })).toBe(true);
      expect(isFieldVisible("natural", "usaFondos", {})).toBe(true);
      expect(isFieldVisible("natural", "usaFondos", { esPropietario: "No" })).toBe(false);
    });

    it("abre los campos de tercero según la fuente de fondos", () => {
      const con = { fuenteFondosInmueble: "Fondos de Terceros" };
      const sin = { fuenteFondosInmueble: "Ahorros propios" };
      expect(muestraBloqueTercero("natural", con)).toBe(true);
      expect(muestraBloqueTercero("natural", sin)).toBe(false);
      expect(isFieldVisible("natural", "ifTerceroRelacion", con)).toBe(true);
      expect(isFieldVisible("natural", "ifOtroNombre", { fuenteFondosInmueble: "Otros" })).toBe(true);
    });
  });

  describe("persona jurídica", () => {
    it("oculta el cargo del contacto si no es parte de la empresa", () => {
      expect(isFieldVisible("juridica", "contactoCargo", { ifContacto: "Sí" })).toBe(true);
      expect(isFieldVisible("juridica", "contactoCargo", { ifContacto: "No" })).toBe(false);
    });

    it("oculta la cantidad de unidades si no adquiere más de una", () => {
      expect(isFieldVisible("juridica", "cantidadUnidadesInmobiliarias", { adquiereMasUnidades: "Sí" })).toBe(true);
      expect(isFieldVisible("juridica", "cantidadUnidadesInmobiliarias", { adquiereMasUnidades: "No" })).toBe(false);
    });

    it("abre el bloque de tercero con la misma condición que el natural", () => {
      expect(muestraBloqueTercero("juridica", { fuenteFondosInmueble: "Aporte de Terceros" })).toBe(true);
      expect(muestraBloqueTercero("juridica", { fuenteFondosInmueble: "Capital propio" })).toBe(false);
    });
  });

  it("muestra el bloque PEP sólo cuando se declaró", () => {
    expect(muestraBloquePep({ esPep: "Sí" })).toBe(true);
    expect(muestraBloquePep({ esPep: "Si" })).toBe(true);
    expect(muestraBloquePep({ esPep: "No" })).toBe(false);
    expect(muestraBloquePep({})).toBe(false);
  });

  describe("camposVisibles", () => {
    it("deja pasar los campos incondicionales y filtra los ocultos", () => {
      const campos = [
        { label: "Nombre del Proyecto", value: "Altos del Parque" },
        { label: "Referido Por", value: "", field: "referidoPor" },
      ];
      expect(camposVisibles("natural", { formaContacto: "Redes Sociales" }, campos)).toHaveLength(1);
      expect(camposVisibles("natural", { formaContacto: "Referido" }, campos)).toHaveLength(2);
    });

    it("un campo sin regla nunca se filtra", () => {
      const campos = [{ label: "Ciudad", value: "Panamá", field: "ciudad" }];
      expect(camposVisibles("juridica", {}, campos)).toHaveLength(1);
    });
  });
});
