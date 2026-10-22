"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, LifeBuoy, User } from "lucide-react";
import { useTranslations } from "next-intl";
import BrandFooter from "@/components/BrandFooter";

export default function WelcomeHub() {
  const router = useRouter();
  const t = useTranslations("Home");
  const tr = useTranslations("AccessRestricted");
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Quien ya tiene un formulario con enlace en curso vuelve directo a él
    const naturalToken = localStorage.getItem("udg_due_diligence_natural_token");
    const juridicaToken = localStorage.getItem("udg_due_diligence_juridica_token");

    if (naturalToken && !naturalToken.startsWith("draft-nat-")) {
      router.replace(`/persona-natural?token=${encodeURIComponent(naturalToken)}`);
      return;
    }

    if (juridicaToken && !juridicaToken.startsWith("draft-jur-")) {
      router.replace(`/persona-juridica?token=${encodeURIComponent(juridicaToken)}`);
      return;
    }

    setIsChecking(false);
  }, [router]);

  if (isChecking) {
    return (
      <div className="min-h-screen bg-[#002b49] flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#c8a788] border-t-transparent rounded-full animate-spin"></div>
        </div>
        <BrandFooter />
      </div>
    );
  }

  const options = [
    { href: "/registro/persona-natural", icon: User, title: t("NaturalTitle"), body: t("NaturalBody") },
    { href: "/registro/persona-juridica", icon: Building2, title: t("JuridicaTitle"), body: t("JuridicaBody") },
  ];

  return (
    <div className="min-h-screen bg-[#002b49] text-zinc-100 flex flex-col justify-between selection:bg-[#c8a788]/30 selection:text-white font-sans">
      <header className="border-b border-zinc-800/40 bg-[#002b49]/95 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-24 flex items-center">
          <div className="flex items-center gap-4">
            <div className="relative w-28 h-20 flex items-center justify-center">
              <Image
                src="/Logo UDG V2.png"
                alt={tr("LogoAlt")}
                width={125}
                height={90}
                className="object-contain"
                style={{ height: "auto", mixBlendMode: "screen" }}
                priority
              />
            </div>
            <div>
              <span className="font-serif text-2xl font-medium tracking-[0.15em] bg-gradient-to-r from-zinc-100 via-amber-100 to-[#c8a788] bg-clip-text text-transparent">
                UDG
              </span>
              <span className="block text-[11px] tracking-[0.3em] text-[#c8a788] uppercase font-semibold">
                URBAN DEVELOPMENT GROUP
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-16 flex flex-col justify-center">
        <div className="w-full bg-[#081827] border border-zinc-800/90 rounded-2xl p-8 md:p-12 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#c8a788]/15 to-transparent rounded-bl-full pointer-events-none"></div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#c8a788]/10 border border-[#c8a788]/20 text-[#c8a788] text-[11px] tracking-widest uppercase font-semibold mb-4">
            <span>{t("Badge")}</span>
          </div>

          <h1 className="text-2xl md:text-3xl font-serif font-light tracking-wide text-white mb-4">{t("Title")}</h1>
          <p className="text-zinc-300 text-sm leading-relaxed mb-8">{t("Description")}</p>

          <div className="grid gap-4 sm:grid-cols-2 mb-8">
            {options.map(({ href, icon: Icon, title, body }) => (
              <Link
                key={href}
                href={href}
                className="group bg-[#00223a]/80 border border-zinc-800 hover:border-[#c8a788]/60 rounded-xl p-5 transition flex flex-col gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-[#c8a788]/10 border border-[#c8a788]/30 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-[#c8a788]" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-white font-semibold">{title}</h2>
                  <p className="text-xs text-zinc-400 leading-relaxed">{body}</p>
                </div>
                <span className="mt-auto inline-flex items-center gap-1.5 text-xs font-semibold text-[#c8a788] uppercase tracking-wider">
                  {t("Start")}
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>

          <div className="bg-[#00223a]/80 border border-zinc-800 rounded-xl p-5 text-left">
            <h4 className="text-xs font-semibold text-[#c8a788] uppercase tracking-wider mb-2 flex items-center gap-2">
              <LifeBuoy className="w-4 h-4" />
              {t("GuidanceTitle")}
            </h4>
            <p className="text-xs text-zinc-400 leading-relaxed">{t("GuidanceBody")}</p>
          </div>
        </div>
      </main>

      <BrandFooter />
    </div>
  );
}
