"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import es from "@/messages/es.json";

/**
 * Traduce, solo al mostrarlos, los mensajes de error de validación.
 *
 * Los mensajes de src/lib/validation.ts se generan siempre en español (también
 * se usan en el servidor). Aquí se reconoce cada mensaje comparándolo con las
 * plantillas en español de es.json → Validation.Messages (p. ej.
 * "{field} es requerido(a)"), se traduce el nombre del campo capturado con
 * Validation.Fields y se devuelve el mensaje en el idioma activo. Un mensaje
 * que no coincide con ninguna plantilla se devuelve sin cambios.
 */

export interface ValidationMessages {
  Messages: Record<string, string>;
  Fields: Record<string, string>;
}

export type ValidationTranslator = (key: string, values?: Record<string, string>) => string;

interface CompiledTemplate {
  key: string;
  regex: RegExp;
  placeholders: string[];
  literalLength: number;
}

const PLACEHOLDER = /\{\s*([A-Za-z0-9_]+)\s*\}/g;

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compileTemplate(key: string, template: string): CompiledTemplate {
  const placeholders: string[] = [];
  let pattern = "";
  let literal = "";
  let lastIndex = 0;
  PLACEHOLDER.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PLACEHOLDER.exec(template))) {
    // ICU: "''" es un apóstrofo literal.
    const chunk = template.slice(lastIndex, match.index).replace(/''/g, "'");
    pattern += escapeRegex(chunk) + "(.+?)";
    literal += chunk;
    placeholders.push(match[1]);
    lastIndex = match.index + match[0].length;
  }
  const tail = template.slice(lastIndex).replace(/''/g, "'");
  pattern += escapeRegex(tail);
  literal += tail;
  return { key, regex: new RegExp(`^${pattern}$`), placeholders, literalLength: literal.length };
}

/**
 * Núcleo puro (testeable). `esValidation` es el objeto `Validation` de es.json
 * y `t` un traductor del namespace "Validation".
 */
export function createErrorTranslator(
  esValidation: ValidationMessages | undefined | null,
  t: ValidationTranslator
): (message: string) => string {
  const messages = esValidation?.Messages ?? {};
  const fields = esValidation?.Fields ?? {};

  // Las plantillas más específicas (más texto fijo) se prueban primero.
  const templates = Object.entries(messages)
    .filter(([, template]) => typeof template === "string" && template)
    .map(([key, template]) => compileTemplate(key, template))
    .sort((a, b) => b.literalLength - a.literalLength);

  const fieldKeyByValue = new Map<string, string>();
  for (const [key, value] of Object.entries(fields)) {
    if (value) fieldKeyByValue.set(value, key);
  }

  const cache = new Map<string, string>();

  return (message: string) => {
    if (typeof message !== "string" || !message) return message;
    const cached = cache.get(message);
    if (cached !== undefined) return cached;

    let result = message;
    for (const tpl of templates) {
      const match = tpl.regex.exec(message);
      if (!match) continue;
      const values: Record<string, string> = {};
      tpl.placeholders.forEach((name, i) => {
        const captured = match[i + 1];
        const fieldKey = fieldKeyByValue.get(captured);
        values[name] = fieldKey ? t(`Fields.${fieldKey}`) : captured;
      });
      result = t(`Messages.${tpl.key}`, values);
      break;
    }
    cache.set(message, result);
    return result;
  };
}

/** Hook: devuelve `(mensajeEnEspañol) => mensajeEnIdiomaActivo`. */
export function useErrorTranslator(): (message: string) => string {
  const t = useTranslations("Validation" as any);
  return useMemo(
    () =>
      createErrorTranslator(
        (es as any).Validation as ValidationMessages | undefined,
        (key, values) => (t as any)(key as any, values as any) as string
      ),
    [t]
  );
}

/** Hook: devuelve una copia memoizada de `errors` con todos los mensajes traducidos. */
export function useTranslatedErrors(errors: Record<string, string>): Record<string, string> {
  const translate = useErrorTranslator();
  return useMemo(() => {
    const out: Record<string, string> = {};
    for (const [field, message] of Object.entries(errors ?? {})) {
      out[field] = translate(message);
    }
    return out;
  }, [errors, translate]);
}
