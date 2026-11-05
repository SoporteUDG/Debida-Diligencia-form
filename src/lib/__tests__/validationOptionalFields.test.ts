import { describe, expect, it } from "vitest";
import { juridicaFormSchema, juridicaStep1Schema, juridicaStep2Schema, naturalStep1Schema } from "../validation";
import { getExpectedDocuments } from "../expectedDocuments";
import { requisitosDocumentales } from "../serverPdfGenerator";
import { INITIAL_FORM_STATE as INITIAL_JURIDICA } from "@/types/persona-juridica";

const erroresDe = (schema: typeof naturalStep1Schema | typeof juridicaStep1Schema, data: Record<string, unknown>, campo: string) => {
  const resultado = schema.safeParse(data);
  return resultado.success ? [] : resultado.error.issues.filter((i) => i.path[0] === campo).map((i) => i.message);
};

describe("documento constitutivo según tipoSociedad", () => {
  const juridica = (data: Record<string, unknown>) => ({ ...INITIAL_JURIDICA, ...data });
  const AVISO = "Copia de Certificado de Aviso de Operaciones es requerido(a)";
  const ACTA = "Copia de Acta Fundacional es requerido(a)";

  describe.each([
    ["paso 2", juridicaStep2Schema],
    ["formulario completo", juridicaFormSchema],
  ] as const)("%s", (_nombre, schema) => {
    const errores = (data: Record<string, unknown>, campo: string) => {
      const resultado = schema.safeParse(juridica(data));
      return resultado.success ? [] : resultado.error.issues.filter((i) => i.path[0] === campo).map((i) => i.message);
    };

    it("una fundación debe adjuntar el acta, no el aviso", () => {
      expect(errores({ tipoSociedad: "Fundación" }, "actaFundacionalFile")).toEqual([ACTA]);
      expect(errores({ tipoSociedad: "Fundación" }, "avisoOperacionesFile")).toEqual([]);
      expect(errores({ tipoSociedad: "Fundación", actaFundacionalFile: "a.pdf" }, "actaFundacionalFile")).toEqual([]);
    });

    it("el aviso de una sociedad no cumple por una fundación y viceversa", () => {
      expect(errores({ tipoSociedad: "Fundación", avisoOperacionesFile: "a.pdf" }, "actaFundacionalFile")).toEqual([ACTA]);
      expect(errores({ tipoSociedad: "Sociedad Anónima", actaFundacionalFile: "a.pdf" }, "avisoOperacionesFile")).toEqual([AVISO]);
    });

    it("una sociedad debe adjuntar el aviso, no el acta", () => {
      expect(errores({ tipoSociedad: "Sociedad Anónima" }, "avisoOperacionesFile")).toEqual([AVISO]);
      expect(errores({ tipoSociedad: "Sociedad Anónima" }, "actaFundacionalFile")).toEqual([]);
    });
  });

  it("el formulario completo declara el acta (Zod descarta lo no declarado) y sigue exigiendo tipoSociedad", () => {
    expect(Object.keys(juridicaFormSchema.shape)).toContain("actaFundacionalFile");
    const resultado = juridicaFormSchema.safeParse(juridica({ tipoSociedad: "" }));
    expect(resultado.success ? [] : resultado.error.issues.map((i) => i.path[0])).toContain("tipoSociedad");
  });

  it("/view y el PDF piden solo el documento que aplica", () => {
    const claves = (tipoSociedad: string) => getExpectedDocuments("juridica", { tipoSociedad }).map((d) => d.key);
    expect(claves("Fundación")).toContain("actaFundacionalFile");
    expect(claves("Fundación")).not.toContain("avisoOperacionesFile");
    expect(claves("Sociedad Civil")).toContain("avisoOperacionesFile");
    expect(claves("Sociedad Civil")).not.toContain("actaFundacionalFile");

    const titulos = (data: Record<string, unknown>) => requisitosDocumentales("JURIDICA", data, []);
    expect(titulos({ tipoSociedad: "Fundación", actaFundacionalFile: "a.pdf" })).toContainEqual(
      expect.objectContaining({ titulo: "Acta Fundacional", archivos: ["a.pdf"] })
    );
    expect(titulos({ tipoSociedad: "Sociedad Civil" }).map((r) => r.titulo)).not.toContain("Acta Fundacional");
  });
});

describe("paso 1 natural", () => {
  it.each(["0", "0.00", "$0", "5,000.00"])("ingresosMensuales acepta %s", (valor) => {
    expect(erroresDe(naturalStep1Schema, { ingresosMensuales: valor }, "ingresosMensuales")).toEqual([]);
  });

  it.each(["", "abc", "-1", "1.234"])("ingresosMensuales rechaza %j", (valor) => {
    expect(erroresDe(naturalStep1Schema, { ingresosMensuales: valor }, "ingresosMensuales")).not.toEqual([]);
  });

  it.each([[""], [undefined]])("fechaVencimientoId es opcional (%j)", (valor) => {
    expect(erroresDe(naturalStep1Schema, { fechaVencimientoId: valor }, "fechaVencimientoId")).toEqual([]);
  });

  it("fechaVencimientoId rechaza un documento vencido", () => {
    expect(erroresDe(naturalStep1Schema, { fechaVencimientoId: "2000-01-01" }, "fechaVencimientoId")).not.toEqual([]);
  });
});

describe("paso 1 jurídica según tipoSociedad", () => {
  // El estado inicial tiene todos los campos, como en el formulario real
  const juridica = (data: Record<string, unknown>) => ({ ...INITIAL_JURIDICA, ...data });

  describe.each(["Fundación", "Fundación de Interés Privado"])("%s", (tipoSociedad) => {
    it.each(["0", "0.00", "5000"])("ingresosMensuales acepta %s", (valor) => {
      expect(erroresDe(juridicaStep1Schema, juridica({ tipoSociedad, ingresosMensuales: valor }), "ingresosMensuales")).toEqual([]);
    });

    it("fechaVencimientoId es opcional", () => {
      expect(erroresDe(juridicaStep1Schema, juridica({ tipoSociedad, fechaVencimientoId: "" }), "fechaVencimientoId")).toEqual([]);
    });

    it("fechaVencimientoId rechaza un documento vencido", () => {
      expect(erroresDe(juridicaStep1Schema, juridica({ tipoSociedad, fechaVencimientoId: "2000-01-01" }), "fechaVencimientoId")).not.toEqual([]);
    });
  });

  describe.each(["Sociedad Anónima", "Sociedad Civil", "Otros", ""])("tipo %j", (tipoSociedad) => {
    it.each(["0", "0.00", "$0"])("ingresosMensuales rechaza %s", (valor) => {
      expect(erroresDe(juridicaStep1Schema, juridica({ tipoSociedad, ingresosMensuales: valor }), "ingresosMensuales")).toEqual([
        "Ingresos Mensuales debe ser un monto numérico válido mayor a 0 (ej: 5000 o 5,000.00)",
      ]);
    });

    it("ingresosMensuales acepta un monto positivo", () => {
      expect(erroresDe(juridicaStep1Schema, juridica({ tipoSociedad, ingresosMensuales: "5000" }), "ingresosMensuales")).toEqual([]);
    });

    it("fechaVencimientoId es requerida", () => {
      expect(erroresDe(juridicaStep1Schema, juridica({ tipoSociedad, fechaVencimientoId: "" }), "fechaVencimientoId")).toEqual([
        "Fecha de Vencimiento de Identificación es requerido(a)",
      ]);
    });

    it("fechaVencimientoId acepta una fecha vigente", () => {
      expect(erroresDe(juridicaStep1Schema, juridica({ tipoSociedad, fechaVencimientoId: "2999-01-01" }), "fechaVencimientoId")).toEqual([]);
    });
  });
});
