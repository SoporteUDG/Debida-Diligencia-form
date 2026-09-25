"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import AccessRestricted from "@/components/AccessRestricted";
import type { TokenFailureReason } from "@/lib/tokenAccess";

interface BlockedAccessProps {
  reason: TokenFailureReason;
  /** Header de la página (el mismo que usa la pantalla de envío exitoso). */
  header: ReactNode;
}

/**
 * Pantalla que reemplaza al formulario cuando el enlace no da acceso:
 * - USED: el enlace ya se usó para enviar el formulario o fue revocado → "Formulario ya completado".
 * - WRONG_FORM / EXPIRED / resto → acceso restringido con el motivo.
 */
export default function BlockedAccess({ reason, header }: BlockedAccessProps) {
  const t = useTranslations("FormAccess");

  if (reason === "WRONG_FORM") return <AccessRestricted customMessage={t("WrongForm")} />;
  if (reason === "EXPIRED") return <AccessRestricted customMessage={t("Expired")} />;
  if (reason !== "USED") return <AccessRestricted />;

  return (
    <div className="min-h-screen bg-[#052B48] text-white flex flex-col justify-between selection:bg-[#DAB38D]/30 font-sans">
      {header}
      <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-16 flex flex-col justify-center">
        <div className="bg-[#faf9f6] rounded-3xl p-8 md:p-12 shadow-2xl border-t-4 border-[#DAB38D] text-zinc-900 text-center space-y-6 animate-scaleIn">
          <div className="mx-auto w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-md">
            <svg className="w-9 h-9" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <div className="space-y-3">
            <h2 className="text-3xl md:text-4xl font-serif font-light text-[#052B48] tracking-wide">
              {t("AlreadyCompletedTitle")}
            </h2>
            <p className="text-xs md:text-sm text-zinc-600 max-w-lg mx-auto leading-relaxed">
              {t("AlreadyCompletedMessage")}
            </p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-2xl p-6 text-left text-xs text-zinc-700 font-sans max-w-md mx-auto shadow-sm leading-relaxed">
            {t("AlreadyCompletedHelp")}
          </div>
        </div>
      </main>
      <footer className="border-t border-zinc-800/40 bg-black/30 py-6 text-center text-xs text-zinc-400">
        <p className="font-sans text-[11px] font-normal tracking-wider text-zinc-400">
          {t("Copyright", { year: new Date().getFullYear() })}
        </p>
      </footer>
    </div>
  );
}
