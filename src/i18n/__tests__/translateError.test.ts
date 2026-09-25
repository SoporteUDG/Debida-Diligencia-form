import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import es from "@/messages/es.json";
import { createErrorTranslator, type ValidationMessages } from "../translateError";
import {
  naturalStep1Schema,
  naturalStep2Schema,
  naturalStep3Schema,
  naturalFormSchema,
  juridicaStep1Schema,
  juridicaStep2Schema,
  juridicaStep3Schema,
  juridicaFormSchema,
  gjcMemberSchema,
  bfMemberSchema,
} from "@/lib/validation";

// Fuente de las plantillas: es.json → Validation
const V: ValidationMessages = es.Validation;

function lookup(dict: any, key: string): string | undefined {
  return key.split(".").reduce((node, part) => (node == null ? undefined : node[part]), dict);
}
function format(template: string, values?: Record<string, string>): string {
  return template.replace(/\{\s*(\w+)\s*\}/g, (_, name) => values?.[name] ?? `{${name}}`);
}
/** Traductor falso con el comportamiento básico de next-intl (sustitución de {placeholders}). */
function makeT(dict: any) {
  return (key: string, values?: Record<string, string>) => {
    const template = lookup(dict, key);
    return typeof template === "string" ? format(template, values) : key;
  };
}

/** Recolecta todos los mensajes de error que produce un schema para una entrada. */
function collect(schema: any, input: unknown, out: Set<string>) {
  const res = schema.safeParse(input);
  if (!res.success) for (const issue of res.error.issues) out.add(issue.message);
}

describe("createErrorTranslator", () => {
  const validation = V;
  const spanish = createErrorTranslator(validation, makeT(validation));
  const marker = createErrorTranslator(validation, (key) => `[[${key}]]`);
  const fieldTemplates = Object.entries(validation.Messages).filter(([, t]) => t.includes("{field}"));

  it("round-trips every template exactly in Spanish, for every known field", () => {
    for (const [key, template] of Object.entries(validation.Messages)) {
      const names = [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      const samples = names.includes("field") ? Object.values(validation.Fields) : ["x"];
      for (const field of samples) {
        const values: Record<string, string> = {};
        names.forEach((n, i) => (values[n] = n === "field" ? field : String(40 + i * 25)));
        const message = format(template, values);
        expect(marker(message), `${key}: ${message}`).toBe(`[[Messages.${key}]]`);
        expect(spanish(message)).toBe(message);
      }
    }
    expect(fieldTemplates.length).toBeGreaterThan(0);
  });

  it("recognizes every message the real schemas produce", () => {
    const msgs = new Set<string>();
    const future = "2999-01-01";
    const past = "2000-01-01";
    const today = new Date().toISOString().slice(0, 10);
    // Vacíos / ausentes
    for (const s of [naturalStep1Schema, naturalStep2Schema, naturalStep3Schema, juridicaStep1Schema,
      juridicaStep2Schema, juridicaStep3Schema, gjcMemberSchema, bfMemberSchema]) {
      collect(s, {}, msgs);
    }
    // Inválidos
    const natural = {
      formaContacto: "Otros", profession: "Otros", actividadLaboral: "OTROS", esPep: "Sí",
      pctDedicacionPrincipal: "60", pctDedicacionSecundaria: "150", ingresosMensuales: "abc",
      medioPago: " , ", email: "no-email", telefono: "12", celular: "12", fechaNacimiento: today,
      fechaVencimientoId: past, termsAccepted: false, signatureConfirmed: false, signatureDate: future,
    };
    collect(naturalStep1Schema, natural, msgs);
    collect(naturalStep1Schema, { ...natural, formaContacto: "Referido", pctDedicacionSecundaria: "50" }, msgs);
    collect(naturalFormSchema, { ...natural, pctDedicacionSecundaria: "50" }, msgs);
    collect(naturalStep3Schema, natural, msgs);
    collect(naturalStep1Schema, { medioPago: "" }, msgs);
    const juridica = {
      gjcMembers: [], bfMembers: [], fuenteFondosInmueble: "Terceros", adquiereMasUnidades: "Sí",
      esPep: "Sí", fechaConstitucion: future, contactoEmail: "x", contactoTelefono: "1",
      ingresosMensuales: "0", origenFondosFile: [""], pactoSocialFile: [" "],
    };
    collect(juridicaStep1Schema, juridica, msgs);
    collect(juridicaStep2Schema, juridica, msgs);
    collect(juridicaFormSchema, juridica, msgs);
    const bf = { id: "1", porcentajeParticipacion: "70", fechaAdquisicion: future };
    collect(juridicaStep1Schema, { ...juridica, bfMembers: [bf, bf] }, msgs);
    collect(juridicaFormSchema, { ...juridica, bfMembers: [bf, bf] }, msgs);
    collect(bfMemberSchema, { ...bf, porcentajeParticipacion: "0" }, msgs);
    collect(gjcMemberSchema, { fechaNacimiento: today }, msgs);

    const zodDefaults = /^(Required|Invalid|Expected)/; // mensajes propios de zod (p. ej. id faltante)
    const ours = [...msgs].filter((m) => !zodDefaults.test(m));
    expect(ours.length).toBeGreaterThan(40);
    for (const m of ours) {
      expect(marker(m), m).toMatch(/^\[\[Messages\.\w+\]\]$/);
      expect(spanish(m)).toBe(m);
    }
  });

  it("covers every message literal in validation.ts", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../../lib/validation.ts"), "utf8");
    const fieldValues = new Set(Object.values(validation.Fields));
    const literals = [
      ...[...src.matchAll(/`([^`]+)`/g)].map((m) => m[1].replace(/\$\{[^}]+\}/g, "Nombre")),
      ...[...src.matchAll(/"([^"\n]+)"/g)].map((m) => m[1]).filter((s) => s.includes(" ") && !fieldValues.has(s)),
    ];
    expect(literals.length).toBeGreaterThan(30);
    for (const lit of literals) {
      expect(marker(lit), lit).toMatch(/^\[\[Messages\.\w+\]\]$/);
    }
  });

  it("translates to English with the translated field name", () => {
    const en = {
      Messages: {
        Required: "{field} is required",
        FileRequired: "You must attach at least one (1) {field} file",
        SelectAtLeastOne: "You must select at least one {field}",
        DedicationSumExceededDetail:
          "The sum of primary ({primary}%) and secondary ({secondary}%) dedication cannot exceed 100%",
        PepNameRequired: "The PEP's full name is required",
      },
      Fields: { NombreDelProyecto: "Project Name", MedioDePago: "Payment Method", EstadoCivil: "Marital Status" },
    };
    const english = createErrorTranslator(validation, makeT(en));
    expect(english("Nombre del Proyecto es requerido(a)")).toBe("Project Name is required");
    expect(english("Estado Civil es requerido(a)")).toBe("Marital Status is required");
    expect(english("Debe seleccionar al menos un Medio de Pago")).toBe("You must select at least one Payment Method");
    expect(english("La suma de dedicación principal (60%) y secundaria (50%) no puede superar el 100%")).toBe(
      "The sum of primary (60%) and secondary (50%) dedication cannot exceed 100%"
    );
    // Mensaje fijo: no debe confundirse con la plantilla genérica "{field} es requerido"
    expect(english("El nombre completo del PEP es requerido")).toBe("The PEP's full name is required");
    // Campo desconocido: se pasa tal cual dentro del mensaje traducido
    expect(english("Campo Raro es requerido(a)")).toBe("Campo Raro is required");
  });

  it("returns unknown messages unchanged", () => {
    const english = createErrorTranslator(validation, makeT({ Messages: {}, Fields: {} }));
    expect(english("Algo totalmente distinto")).toBe("Algo totalmente distinto");
    expect(spanish("Required")).toBe("Required");
    expect(spanish("")).toBe("");
    expect(createErrorTranslator(undefined, makeT({}))("Nombre es requerido(a)")).toBe("Nombre es requerido(a)");
  });
});
