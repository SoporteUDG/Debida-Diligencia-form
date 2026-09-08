"use client";

import Image from "next/image";
import { ShieldAlert, Mail, Lock } from "lucide-react";

interface AccessRestrictedProps {
  customMessage?: string;
}

export default function AccessRestricted({ customMessage }: AccessRestrictedProps) {
  return (
    <div className="min-h-screen bg-[#002b49] text-zinc-100 flex flex-col justify-between selection:bg-[#c8a788]/30 selection:text-white font-sans">
      {/* Editorial Header */}
      <header className="border-b border-zinc-800/40 bg-[#002b49]/95 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-24 flex items-center justify-between">
          <div className="flex items-center gap-4">
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

      {/* Main Restricted Access Card */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-16 flex flex-col justify-center items-center text-center">
        <div className="w-full bg-[#081827] border border-zinc-800/90 rounded-2xl p-8 md:p-12 shadow-2xl relative overflow-hidden text-center">
          {/* Subtle gold accent corner */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#c8a788]/15 to-transparent rounded-bl-full pointer-events-none"></div>

          {/* Badge icon */}
          <div className="mx-auto w-16 h-16 rounded-2xl bg-[#c8a788]/10 border border-[#c8a788]/30 flex items-center justify-center mb-6 shadow-inner">
            <Lock className="h-8 w-8 text-[#c8a788]" />
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#c8a788]/10 border border-[#c8a788]/20 text-[#c8a788] text-[11px] tracking-widest uppercase font-semibold mb-4">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Acceso Privado & Confidencial</span>
          </div>

          <h1 className="text-2xl md:text-3xl font-serif font-light tracking-wide text-white mb-4">
            Enlace de Invitación Requerido
          </h1>

          <p className="text-zinc-300 text-sm leading-relaxed mb-6">
            {customMessage ||
              "El formulario digital de Debida Diligencia de Urban Development Group (UDG) es de acceso exclusivo para clientes autorizados mediante un enlace seguro y personalizado emitido por nuestro departamento legal o su asesor comercial."}
          </p>

          <div className="bg-[#00223a]/80 border border-zinc-800 rounded-xl p-5 mb-8 text-left">
            <h4 className="text-xs font-semibold text-[#c8a788] uppercase tracking-wider mb-2 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              ¿Cómo obtener su acceso?
            </h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Si usted es cliente de UDG y no ha recibido su enlace o el mismo ha expirado, por favor póngase en contacto con su asesor comercial o solicite la reemisión de su enlace directamente al equipo de Cumplimiento.
            </p>
          </div>

          <div className="pt-2 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-center gap-4 text-xs text-zinc-400">
            <span className="text-zinc-500">Urban Development Group • Cumplimiento Normativo</span>
          </div>
        </div>
      </main>

      {/* Brand Footer */}
      <footer className="border-t border-zinc-900/60 bg-black/30 py-8 text-center text-xs text-zinc-500">
        <div className="max-w-6xl mx-auto px-6 flex flex-col items-center justify-center text-center gap-2">
          <p className="font-serif text-[11px] font-medium tracking-[0.1em] text-zinc-300">
            URBAN DEVELOPMENT GROUP (UDG)
          </p>
          <p className="text-[10px] text-zinc-500">
            © {new Date().getFullYear()} UDG Group. Todos los derechos reservados de conformidad con la ley de protección de datos.
          </p>
        </div>
      </footer>
    </div>
  );
}
