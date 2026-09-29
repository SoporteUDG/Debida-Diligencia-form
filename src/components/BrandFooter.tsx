"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

/** Pie de página de marca común a todas las vistas del portal. */
export default function BrandFooter() {
  const t = useTranslations("AccessRestricted");
  return (
    <footer className="border-t border-zinc-900/60 bg-black/30 py-8 text-center text-xs text-zinc-500 font-sans text-white">
      <div className="max-w-6xl mx-auto px-6 flex flex-row items-center justify-center text-center gap-2">
        <Image
          src="/UDG_LOGO.png"
          alt={t("LogoAlt")}
          width={60}
          height={30}
          className="object-contain h-8 md:h-8 w-auto opacity-50"
          priority
        />
        <p className="text-[10px] text-zinc-500">{t("Copyright", { year: new Date().getFullYear() })}</p>
      </div>
    </footer>
  );
}
