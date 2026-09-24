"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale } from "./routing";

/** Guarda el idioma elegido. Next vuelve a renderizar la ruta con los nuevos mensajes. */
export async function setUserLocale(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
