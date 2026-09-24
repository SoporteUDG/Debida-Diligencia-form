import type { Locale } from "./routing";
import type messages from "../messages/es.json";

// es.json es la referencia: t("...") autocompleta sus claves y marca error
// en TypeScript si una clave no existe.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
