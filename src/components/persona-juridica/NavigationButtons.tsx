"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";

interface NavigationButtonsProps {
  currentStep: number;
  lastSaved: string | null;
  isStepValid: (stepNum: number) => boolean;
  onPrevStep: () => void;
  onNextStep: () => void;
  onClearDraft: () => void;
  onSubmit: () => void;
}

export default function NavigationButtons({
  currentStep,
  lastSaved,
  isStepValid,
  onPrevStep,
  onNextStep,
  onClearDraft,
  onSubmit,
}: NavigationButtonsProps) {
  return (
    <div className="flex items-center justify-between pt-6 mt-8 font-sans border-t border-zinc-800/40 text-white">
      <div>
        {lastSaved && (
          <button
            type="button"
            onClick={onClearDraft}
            className="text-xs text-red-400 hover:text-red-300 font-medium tracking-wide underline cursor-pointer"
          >
            Vaciar Borrador
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
          Atrás
        </button>

        {currentStep < 5 ? (
          <button
            type="button"
            onClick={onNextStep}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-xs uppercase tracking-wider transition bg-gradient-to-r from-[#c8a788] to-yellow-600 text-zinc-950 hover:shadow-lg hover:shadow-[#c8a788]/20 cursor-pointer active:scale-95"
          >
            Siguiente
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onSubmit}
            className="flex items-center gap-2 px-8 py-3 rounded-lg font-bold text-xs uppercase tracking-wider transition bg-gradient-to-r from-[#c8a788] via-[#bf9e7e] to-yellow-600 text-zinc-950 hover:shadow-lg hover:shadow-[#c8a788]/35 cursor-pointer active:scale-95"
          >
            Enviar Expediente UDG
          </button>
        )}
      </div>
    </div>
  );
}
