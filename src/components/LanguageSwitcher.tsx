"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { setUserLocale } from "@/i18n/actions";
import { routing, type Locale } from "@/i18n/routing";

/**
 * Selector ES / EN. Guarda el idioma en la cookie y Next vuelve a renderizar
 * la página: el estado del formulario en curso se conserva.
 */
export default function LanguageSwitcher() {
  const t = useTranslations("LanguageSwitcher");
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  const change = (next: Locale) => {
    if (next === locale) return;
    startTransition(() => setUserLocale(next));
  };

  return (
    <div
      role="group"
      aria-label={t("label")}
      className={`flex items-center bg-[#081f33] border border-[#DAB38D]/20 rounded-full p-0.5 text-[11px] font-semibold shadow-sm transition-opacity ${
        isPending ? "opacity-60" : ""
      }`}
    >
      {routing.locales.map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            onClick={() => change(l)}
            disabled={isPending}
            aria-pressed={active}
            title={t(l)}
            className={`px-2.5 py-1 rounded-full uppercase tracking-wider transition-colors ${
              active ? "bg-[#DAB38D] text-[#052B48]" : "text-zinc-300 hover:text-white"
            }`}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}
