import { describe, it, expect } from "vitest";
import { resolveFormType, tieneDatosPersona, soloPersonasConDatos } from "../formTypeResolution";

describe("resolveFormType", () => {
  const natural = { firstName: "Carlos", lastName: "Mendoza", idNumber: "8-888-888" };
  const juridica = { razonSocial: "Inversiones S.A.", rlNombre: "Ana Pérez" };

  it("respeta la etiqueta cuando el contenido la acompaña", () => {
    expect(resolveFormType("natural", natural).type).toBe("natural");
    expect(resolveFormType("natural", natural).mismatch).toBe(false);
    expect(resolveFormType("juridica", juridica).type).toBe("juridica");
    expect(resolveFormType("juridica", juridica).mismatch).toBe(false);
  });

  it("corrige un expediente natural etiquetado como jurídico", () => {
    // Caso real del borrador 6d4f3f0cc33329: type=JURIDICA con datos naturales.
    const r = resolveFormType("juridica", { ...natural, gjcMembers: [], bfMembers: [] });
    expect(r.type).toBe("natural");
    expect(r.declared).toBe("juridica");
    expect(r.mismatch).toBe(true);
  });

  it("corrige un expediente jurídico etiquetado como natural", () => {
    const r = resolveFormType("natural", juridica);
    expect(r.type).toBe("juridica");
    expect(r.mismatch).toBe(true);
  });

  it("no cuenta arreglos vacíos ni cadenas en blanco como contenido", () => {
    const r = resolveFormType("juridica", { razonSocial: "  ", gjcMembers: [], bfMembers: [], firstName: "Ana" });
    expect(r.juridicaMarkers).toBe(0);
    expect(r.type).toBe("natural");
  });

  it("conserva la etiqueta en un expediente vacío o recién abierto", () => {
    expect(resolveFormType("juridica", {}).type).toBe("juridica");
    expect(resolveFormType("natural", {}).type).toBe("natural");
    expect(resolveFormType("juridica", {}).mismatch).toBe(false);
  });

  it("conserva la etiqueta si hay contenido de ambos tipos", () => {
    // Ambigüedad: no hay evidencia limpia, no se toca la etiqueta.
    const r = resolveFormType("juridica", { ...natural, ...juridica });
    expect(r.type).toBe("juridica");
    expect(r.mismatch).toBe(false);
  });

  it("tolera data nula", () => {
    expect(resolveFormType("natural", null as never).type).toBe("natural");
  });
});

describe("filas de relleno", () => {
  // Estado inicial del formulario jurídico: filas con id pero sin datos.
  const gjcRelleno = [{ id: "gjc-initial-1", cargo: "", nroId: "", nombre: "", apellidos: "", direccion: "", nacionalidad: "", fechaNacimiento: "" }];
  const bfRelleno = [
    { id: "bf-initial-1", nombreCompleto: "", noIdentificacion: "", nacionalidad: "" },
    { id: "bf-initial-2", nombreCompleto: "", noIdentificacion: "", nacionalidad: "" },
  ];

  it("no las cuenta como contenido jurídico", () => {
    expect(tieneDatosPersona(gjcRelleno[0])).toBe(false);
    expect(soloPersonasConDatos(bfRelleno)).toHaveLength(0);
  });

  it("sí cuenta una fila con datos reales", () => {
    const real = { id: "gjc-1", nombre: "Luis", apellidos: "Gómez", cargo: "Tesorero" };
    expect(tieneDatosPersona(real)).toBe(true);
    expect(soloPersonasConDatos([...gjcRelleno, real])).toEqual([real]);
  });

  it("corrige el borrador real 6d4f3f0cc33329", () => {
    // Datos tal como están en la base: naturales llenos, jurídicos en blanco
    // y las filas de personas sin tocar desde el estado inicial.
    const r = resolveFormType("juridica", {
      firstName: "Juan", lastName: "Pérez", idNumber: "8-123-456", profession: "Ingeniero",
      razonSocial: "", rlNombre: "", tipoSociedad: "", numeroDocumento: "",
      gjcMembers: gjcRelleno, bfMembers: bfRelleno,
    });
    expect(r.juridicaMarkers).toBe(0);
    expect(r.naturalMarkers).toBe(4);
    expect(r.type).toBe("natural");
    expect(r.mismatch).toBe(true);
  });
});
