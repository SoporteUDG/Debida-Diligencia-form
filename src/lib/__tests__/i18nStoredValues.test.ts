import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import es from "@/messages/es.json";
import en from "@/messages/en.json";
import { optionLabeler } from "@/i18n/optionLabel";

/**
 * Garantiza que el formulario siempre guarda los valores en español ("es"),
 * sin importar el idioma activo: los textos en inglés solo se muestran.
 */

type Tree = { [key: string]: string | Tree };

const FORM_DIRS = [
  "src/components/persona-natural",
  "src/components/persona-juridica",
  "src/components/ui",
  "src/app/persona-natural",
  "src/app/persona-juridica",
];

function readSources(): string {
  const root = path.resolve(__dirname, "../../..");
  return FORM_DIRS.flatMap((dir) =>
    fs
      .readdirSync(path.join(root, dir))
      .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
      .map((f) => fs.readFileSync(path.join(root, dir, f), "utf8"))
  ).join("\n");
}

/** Hojas del árbol de mensajes como [ruta, valor]. */
function leaves(tree: Tree, prefix = ""): [string, string][] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === "string" ? [[`${prefix}${k}`, v] as [string, string]] : leaves(v, `${prefix}${k}.`)
  );
}

/** Grupos de opciones: sus valores en español son los que se guardan. */
function optionGroups(tree: Tree, prefix = ""): [string, Record<string, string>][] {
  return Object.entries(tree).flatMap(([k, v]) => {
    if (typeof v === "string") return [];
    const here = `${prefix}${k}`;
    const isGroup = /Options?$/.test(k) && Object.values(v).every((x) => typeof x === "string");
    return isGroup ? [[here, v as Record<string, string>]] : optionGroups(v, `${here}.`);
  });
}

function get(tree: Tree, dotted: string): string | undefined {
  let node: string | Tree | undefined = tree;
  for (const part of dotted.split(".")) {
    if (!node || typeof node === "string") return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

/** Placeholders ICU ({name}) y etiquetas rich-text (<strong>) de un mensaje. */
function tokens(msg: string): string[] {
  const vars = [...msg.matchAll(/\{\s*([A-Za-z0-9_]+)/g)].map((m) => `{${m[1]}}`);
  const tags = [...msg.matchAll(/<\/?([A-Za-z0-9_]+)>/g)].map((m) => `<${m[1]}>`);
  return [...new Set([...vars, ...tags])].sort();
}

const sources = readSources();
const quoted = (s: string) => sources.includes(`"${s}"`) || sources.includes(`'${s}'`) || sources.includes(`\`${s}\``);
const groups = optionGroups(es as unknown as Tree);

describe("i18n: los valores guardados son siempre los de es.json", () => {
  it("hay grupos de opciones que revisar", () => {
    expect(groups.length).toBeGreaterThan(10);
  });

  it.each(groups)("%s: cada valor en español existe como literal en el formulario", (_group, options) => {
    const missing = Object.entries(options)
      .filter(([k, v]) => v && k !== "placeholder" && !quoted(v))
      .map(([k, v]) => `${k}="${v}"`);
    expect(missing).toEqual([]);
  });

  it("ninguna etiqueta en inglés aparece como literal en el formulario", () => {
    const leaked: string[] = [];
    for (const [group, options] of groups) {
      for (const [key, esValue] of Object.entries(options)) {
        const enValue = get(en as unknown as Tree, `${group}.${key}`);
        if (key === "placeholder" || !enValue || enValue === esValue) continue;
        if (quoted(enValue)) leaked.push(`${group}.${key}="${enValue}"`);
      }
    }
    expect(leaked).toEqual([]);
  });

  it("optionLabeler traduce solo el texto visible", () => {
    const civil = es.NaturalForm.NaturalFormStep1OptionFields.civilOptions;
    const enCivil = en.NaturalForm.NaturalFormStep1OptionFields.civilOptions as Record<string, string>;
    const label = optionLabeler(civil, (key: string) => enCivil[key]);
    expect(label("Casado")).toBe(enCivil.civil1);
    // Un valor que no pertenece al grupo se muestra tal cual
    expect(label("Valor libre")).toBe("Valor libre");
  });
});

describe("i18n: en.json es consistente con es.json", () => {
  const esLeaves = new Map(leaves(es as unknown as Tree));
  const enLeaves = leaves(en as unknown as Tree);

  it("en.json no tiene claves que no existan en es.json", () => {
    const extra = enLeaves.map(([k]) => k).filter((k) => !esLeaves.has(k));
    expect(extra).toEqual([]);
  });

  it("cada traducción conserva los mismos placeholders y etiquetas", () => {
    const mismatched = enLeaves
      .filter(([k]) => esLeaves.has(k))
      .filter(([k, v]) => JSON.stringify(tokens(v)) !== JSON.stringify(tokens(esLeaves.get(k)!)))
      .map(([k, v]) => `${k}: es ${tokens(esLeaves.get(k)!).join(" ")} / en ${tokens(v).join(" ")}`);
    expect(mismatched).toEqual([]);
  });
});
