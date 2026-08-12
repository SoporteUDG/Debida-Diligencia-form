"use client";

import { Building2, Users, Coins, UploadCloud, PenTool, Check } from "lucide-react";

interface FormStepperProps {
  currentStep: number;
  onStepClick: (stepNum: number) => void;
  isStepValid: (stepNum: number) => boolean;
}

export default function FormStepper({ currentStep, onStepClick, isStepValid }: FormStepperProps) {
  const steps = [
    { num: 1, label: "Identificación", icon: Building2 },
    { num: 2, label: "Gobierno y RL", icon: Users },
    { num: 3, label: "Beneficiarios y Finanzas", icon: Coins },
    { num: 4, label: "Documentos", icon: UploadCloud },
    { num: 5, label: "Declaración", icon: PenTool },
  ];

  return (
    <div className="mb-10 text-white">
      <div className="flex justify-between items-center max-w-4xl mx-auto relative">
        {/* Visual Line */}
        <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-zinc-800 -translate-y-1/2 z-0"></div>
        <div 
          className="absolute top-1/2 left-0 h-[1px] bg-[#c8a788] -translate-y-1/2 transition-all duration-500 ease-out z-0"
          style={{ width: `${((currentStep - 1) / 4) * 100}%` }}
        ></div>

        {steps.map((step) => {
          const Icon = step.icon;
          const isCompleted = currentStep > step.num;
          const isActive = currentStep === step.num;
          return (
            <div key={step.num} className="relative z-10 flex flex-col items-center">
              <button
                type="button"
                onClick={() => {
                  if (step.num < currentStep || isStepValid(step.num - 1)) {
                    onStepClick(step.num);
                  }
                }}
                disabled={step.num > currentStep && !isStepValid(currentStep)}
                className={`h-10 w-10 rounded-full flex items-center justify-center border transition-all duration-300 cursor-pointer ${
                  isCompleted
                    ? "bg-[#c8a788] border-transparent text-zinc-950 shadow-md shadow-[#c8a788]/20"
                    : isActive
                    ? "bg-[#002b49] border-[#c8a788] text-[#c8a788] shadow-md shadow-[#c8a788]/10 ring-4 ring-[#c8a788]/15"
                    : "bg-[#002b49] border-zinc-800 text-zinc-500 hover:border-zinc-700 cursor-not-allowed"
                }`}
              >
                {isCompleted ? <Check className="h-4.5 w-4.5 stroke-[2.5]" /> : <Icon className="h-4.5 w-4.5" />}
              </button>
              <span className={`mt-2.5 text-[10px] tracking-widest uppercase font-semibold transition-colors duration-300 hidden md:block ${
                isActive ? "text-[#c8a788]" : isCompleted ? "text-zinc-200" : "text-zinc-500"
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
