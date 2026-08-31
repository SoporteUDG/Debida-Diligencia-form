"use client";

import Image from "next/image";
import Link from "next/link";

interface HeaderProps {
  isSaving: boolean;
  lastSaved: string | null;
  saveStatus?: "idle" | "saving" | "saved" | "error";
}

export default function Header({ isSaving, lastSaved, saveStatus }: HeaderProps) {
  return (
    <header className="border-b border-zinc-800/40 bg-[#052B48]/95 backdrop-blur-md sticky top-0 z-50 text-white">
      <div className="max-w-6xl mx-auto px-6 h-20 md:h-24 flex items-center justify-between">
        {/* Left: UDG Brand Logo */}
        <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition cursor-pointer select-none">
          <Image
            src="/UDG_LOGO.png"
            alt="Logo UDG"
            width={120}
            height={50}
            className="object-contain h-8 md:h-12 w-auto"
            priority
          />
        </Link>

        {/* Right: Save Status & 20 Años Slogan Banner */}
        <div className="flex items-center gap-4 md:gap-6">
          {/* Real-time Draft Saving Status */}
          <div className="flex items-center gap-2.5 bg-[#081f33] border border-[#DAB38D]/20 px-3.5 py-1.5 rounded-full text-[11px] text-white shadow-sm">
            {saveStatus === "saving" || (saveStatus === undefined && isSaving) ? (
              <>
                <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping"></div>
                <span className="text-zinc-300 font-medium">Guardando borrador...</span>
              </>
            ) : saveStatus === "error" ? (
              <>
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400"></div>
                <span className="text-zinc-200 font-medium">Borrador autoguardado</span>
              </>
            ) : lastSaved ? (
              <>
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400"></div>
                <span className="text-zinc-200 font-medium">Borrador autoguardado ({lastSaved})</span>
              </>
            ) : (
              <>
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400"></div>
                <span className="text-zinc-200 font-medium">Borrador autoguardado</span>
              </>
            )}
          </div>

          {/* Right: Slogan Lema "20 Años Construyendo tu futuro" */}
          <div className="relative h-9 md:h-12 w-auto hidden sm:flex items-center justify-end">
            <Image
              src="/SLOGAN_LEMA.png"
              alt="20 Años Construyendo tu futuro"
              width={240}
              height={50}
              className="object-contain h-8 md:h-11 w-auto"
              priority
            />
          </div>
        </div>
      </div>
    </header>
  );
}
