import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, isLocale, routing } from "./routing";

type Messages = Record<string, unknown>;

/** Copia `base` y sobrescribe con `override`; los objetos anidados se combinan. */
function deepMerge(base: Messages, override: Messages): Messages {
  const result: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = result[key];
    result[key] =
      value && typeof value === "object" && current && typeof current === "object"
        ? deepMerge(current as Messages, value as Messages)
        : value;
  }
  return result;
}

/**
 * Resuelve el idioma de cada request desde la cookie NEXT_LOCALE
 * (la escribe el selector de idioma del header) y carga sus mensajes.
 * Las claves que aún no existen en en.json se muestran en español.
 */
export default getRequestConfig(async () => {
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(stored) ? stored : routing.defaultLocale;

  const fallback = (await import(`../messages/${routing.defaultLocale}.json`)).default;
  const messages =
    locale === routing.defaultLocale
      ? fallback
      : deepMerge(fallback, (await import(`../messages/${locale}.json`)).default);

  return { locale, messages };
});
