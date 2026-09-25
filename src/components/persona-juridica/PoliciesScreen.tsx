"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";

interface PoliciesScreenProps {
  lastSaved: string | null;
  onClearDraft: () => void;
  onContinue: () => void;
}

export default function PoliciesScreen({ lastSaved, onClearDraft, onContinue }: PoliciesScreenProps) {
  const t = useTranslations("JuridicaForm.Policies");
  return (
    <div className="max-w-3xl mx-auto w-full animate-fadeIn text-center text-white">
      {/* Title & Subtitle */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-5xl font-serif font-light tracking-wide text-white mb-2">
          {t("Title")}
        </h1>
        <p className="text-sm md:text-lg text-zinc-300 font-sans tracking-wider font-light">
          {t("SubtitleDueDiligence")} <span className="mx-2 text-zinc-500">|</span> <span className="text-zinc-200">{t("SubtitlePersonType")}</span>
        </p>
      </div>

      {/* Premium Ivory White Card for Legal Policies */}
      <div className="bg-[#faf9f6] text-[#1a1c1a] rounded-2xl p-8 md:p-10 shadow-2xl border-t-4 border-[#DAB38D] text-left mb-8 max-w-2xl mx-auto font-sans">
        <div className="space-y-6">
          <section>
            <h2 className="text-xs md:text-sm font-bold tracking-wider uppercase text-[#052B48] mb-2 border-b border-zinc-200 pb-2 font-sans">
              {t("LawHeading")}
            </h2>
            <p className="text-xs md:text-sm leading-relaxed text-zinc-700 font-sans">
              {t("LawText")}
            </p>
            <p className="text-xs md:text-sm italic font-medium text-[#DAB38D] mt-3">
              {t("RequiredNote")}
            </p>
          </section>

          <section>
            <h2 className="text-xs md:text-sm font-bold tracking-wider uppercase text-[#052B48] mb-2 border-b border-zinc-200 pb-2 font-sans">
              {t("BeforeContinueHeading")}
            </h2>
            <ul className="list-disc pl-5 text-xs md:text-sm leading-relaxed text-zinc-700 space-y-2.5">
              <li>{t("Bullet1")}</li>
              <li>{t("Bullet2")}</li>
              <li>{t("Bullet3")}</li>
            </ul>
          </section>
        </div>
      </div>

      {/* Action Area */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
        {lastSaved && (
          <button
            type="button"
            onClick={onClearDraft}
            className="text-xs text-red-400 hover:text-red-300 font-medium tracking-wide underline decoration-dotted transition cursor-pointer"
          >
            {t("ClearSavedDraft")}
          </button>
        )}
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex items-center gap-3 bg-[#DAB38D] hover:bg-[#c9a27c] text-zinc-950 font-semibold px-8 py-3.5 rounded-xl shadow-lg transition-all duration-300 active:scale-[0.98] cursor-pointer text-sm font-sans"
        >
          {t("AcceptAndContinue")}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
