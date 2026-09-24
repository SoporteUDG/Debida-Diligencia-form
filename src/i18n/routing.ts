import { defineRouting } from "next-intl/routing";

// Idiomas disponibles. El idioma activo se guarda en la cookie NEXT_LOCALE
// (sin prefijo en la URL), así los enlaces con token y /view no cambian.
export const routing = defineRouting({
  locales: ["en", "es"],
  defaultLocale: "es",
});

export type Locale = (typeof routing.locales)[number];

export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: unknown): value is Locale {
  return routing.locales.includes(value as Locale);
}
