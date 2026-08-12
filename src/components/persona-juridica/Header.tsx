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
      <div className="max-w-6xl mx-auto px-6 h-24 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-4 hover:opacity-90 transition cursor-pointer select-none">
          <div className="relative w-28 h-20 flex items-center justify-center">
            <Image
              src="/Logo UDG V2.png"
              alt="Logo UDG"
              width={125}
              height={90}
              className="object-contain"
              style={{ height: "auto", mixBlendMode: "screen" }}
              priority
            />
          </div>
          <div>
            <span className="font-serif text-2xl font-medium tracking-[0.15em] bg-gradient-to-r from-zinc-100 via-amber-100 to-[#c8a788] bg-clip-text text-transparent font-serif">
              UDG
            </span>
            <span className="block text-[11px] tracking-[0.3em] text-[#c8a788] uppercase font-semibold">
              URBAN DEVELOPMENT GROUP
            </span>
          </div>
        </Link>

        {/* Real-time Draft Saving Status */}
        <div className="flex items-center gap-2.5 bg-[#081f33] border border-[#c8a788]/15 px-4 py-2 rounded-full text-[11px] text-white">
          {saveStatus === "saving" || (saveStatus === undefined && isSaving) ? (
            <>
              <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping"></div>
              <span className="text-zinc-400 font-medium">Guardando borrador...</span>
            </>
          ) : saveStatus === "error" ? (
            <>
              <div className="h-1.5 w-1.5 rounded-full bg-red-500"></div>
              <span className="text-red-400 font-medium">Error al guardar (Borrador local)</span>
            </>
          ) : lastSaved ? (
            <>
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500"></div>
              <span className="text-zinc-300 font-medium">Borrador autoguardado ({lastSaved})</span>
            </>
          ) : (
            <>
              <div className="h-1.5 w-1.5 rounded-full bg-zinc-600"></div>
              <span className="text-zinc-500 font-medium">Listo</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
