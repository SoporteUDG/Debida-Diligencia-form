"use client";

import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

interface NavigationButtonsProps {
  currentStep: number;
  lastSaved: string | null;
  isStepValid: (stepNum: number) => boolean;
  onPrevStep: () => void;
  onNextStep: () => void;
  onClearDraft: () => void;
  onSubmit: () => void;
  /** Hay cambios que aún no llegaron al borrador: el envío espera. */
  submitBlocked?: boolean;
}

export default function NavigationButtons({
  currentStep,
  lastSaved,
  isStepValid,
  onPrevStep,
  onNextStep,
  onClearDraft,
  onSubmit,
  submitBlocked = false,
}: NavigationButtonsProps) {
  const t = useTranslations("JuridicaForm.Navigation");
  return (
    <div className="flex items-center justify-between pt-6 mt-8 font-sans border-t border-zinc-800/40 text-white">
      <div>
        {lastSaved && (
          <button
            type="button"
            onClick={onClearDraft}
            className="text-xs text-red-400 hover:text-red-300 font-medium tracking-wide underline cursor-pointer"
          >
            {t("ClearDraft")}
          </button>
        )}
      </div>
      
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onPrevStep}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 hover:bg-zinc-900/20 text-xs font-semibold uppercase tracking-wider transition cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("Back")}
        </button>

        {currentStep < 3 ? (
          <button
            type="button"
            onClick={onNextStep}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-xs uppercase tracking-wider transition bg-[#DAB38D] text-zinc-950 hover:shadow-lg hover:shadow-[#c8a788]/20 cursor-pointer active:scale-95"
          >
            {t("Next")}
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitBlocked}
            aria-busy={submitBlocked}
            className="disabled:opacity-60 disabled:cursor-wait disabled:active:scale-100 flex items-center gap-2 px-8 py-3 rounded-lg font-bold text-xs uppercase tracking-wider transition bg-[#DAB38D] text-zinc-950 hover:shadow-lg hover:shadow-[#c8a788]/35 cursor-pointer active:scale-95"
          >
            {submitBlocked ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("SavingBeforeSubmit")}
              </>
            ) : (
              t("Submit")
            )}
          </button>
        )}
      </div>
    </div>
  );
}
