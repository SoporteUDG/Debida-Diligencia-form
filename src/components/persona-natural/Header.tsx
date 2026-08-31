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
    <header className="border-b border-zinc-800/40 bg-[#002b49]/95 backdrop-blur-md sticky top-0 z-50 text-white">
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
          {(lastSaved || isSaving || saveStatus) && (
            <div className="hidden sm:flex items-center gap-2.5 bg-[#081f33] border border-[#c8a788]/15 px-3 py-1.5 rounded-full text-[11px] text-white">
              {saveStatus === "saving" || (saveStatus === undefined && isSaving) ? (
                <>
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping"></div>
                  <span className="text-zinc-400 font-medium">Guardando borrador...</span>
                </>
              ) : saveStatus === "error" ? (
                <>
                  <div className="h-1.5 w-1.5 rounded-full bg-red-500"></div>
                  <span className="text-red-400 font-medium">Error al guardar</span>
                </>
              ) : lastSaved ? (
                <>
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500"></div>
                  <span className="text-zinc-300 font-medium">Autoguardado ({lastSaved})</span>
                </>
              ) : (
                <>
                  <div className="h-1.5 w-1.5 rounded-full bg-zinc-600"></div>
                  <span className="text-zinc-500 font-medium">Listo</span>
                </>
              )}
            </div>
          )}

          {/* Right: Slogan Lema "20 Años Construyendo tu futuro" */}
          <div className="relative h-9 md:h-12 w-auto flex items-center justify-end">
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
