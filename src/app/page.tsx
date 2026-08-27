import Image from "next/image";
import Link from "next/link";
import { User, Building2, ShieldCheck, ArrowRight } from "lucide-react";

export default function WelcomeHub() {
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

      {/* Main Hub Welcome Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-16 flex flex-col justify-center items-center text-center">

        {/* Editorial Title Block */}
        <div className="mb-12 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#c8a788]/10 border border-[#c8a788]/20 text-[#c8a788] text-[11px] tracking-widest uppercase font-semibold mb-4">
            <span>Servicios Legales & Cumplimiento</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-light tracking-wide text-white mb-4">
            Formulario Debida Diligencia
          </h1>
          <p className="text-zinc-400 text-xs md:text-sm leading-relaxed">
            De conformidad con los estándares de prevención de blanqueo de capitales, rogamos a nuestros clientes completar el formulario correspondiente para formalizar el expediente de adquisición en UDG Group.
          </p>
        </div>

        {/* Form Selector Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl mt-4">

          {/* Card 1: Persona Natural */}
          <Link
            href="/persona-natural"
            prefetch={false}
            className="group block bg-[#081827] border border-zinc-800/80 hover:border-[#c8a788]/40 rounded-2xl p-8 shadow-xl text-left transition-all duration-300 hover:shadow-2xl hover:shadow-[#c8a788]/5 hover:-translate-y-1 relative overflow-hidden cursor-pointer"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#c8a788]/10 to-transparent rounded-bl-full opacity-50 group-hover:scale-110 transition-transform"></div>

            <div className="p-3 bg-zinc-950/30 rounded-xl w-fit mb-6 text-[#c8a788] group-hover:bg-[#c8a788] group-hover:text-zinc-950 transition-all duration-300">
              <User className="h-6 w-6" />
            </div>

            <h3 className="text-lg font-serif font-medium text-white tracking-wide mb-2 group-hover:text-[#c8a788] transition-colors">
              Persona Natural
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-8">
              Para compradores individuales que realizan la adquisición a título personal, requiriendo documentación de identidad y origen de fondos personales.
            </p>

            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#c8a788] group-hover:translate-x-1.5 transition-transform">
              Iniciar Formulario
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>

          {/* Card 2: Persona Jurídica */}
          <Link
            href="/persona-juridica"
            prefetch={false}
            className="group block bg-[#081827] border border-zinc-800/80 hover:border-[#c8a788]/40 rounded-2xl p-8 shadow-xl text-left transition-all duration-300 hover:shadow-2xl hover:shadow-[#c8a788]/5 hover:-translate-y-1 relative overflow-hidden cursor-pointer"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#c8a788]/10 to-transparent rounded-bl-full opacity-50 group-hover:scale-110 transition-transform"></div>

            <div className="p-3 bg-zinc-950/30 rounded-xl w-fit mb-6 text-[#c8a788] group-hover:bg-[#c8a788] group-hover:text-zinc-950 transition-all duration-300">
              <Building2 className="h-6 w-6" />
            </div>

            <h3 className="text-lg font-serif font-medium text-white tracking-wide mb-2 group-hover:text-[#c8a788] transition-colors">
              Persona Jurídica
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-8">
              Para empresas, corporaciones, fundaciones de interés privado o sociedades comerciales que formalizarán la adquisición mediante su personería legal.
            </p>

            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#c8a788] group-hover:translate-x-1.5 transition-transform">
              Iniciar Formulario
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>

        </div>

      </main>

      {/* Luxury Brand Footer */}
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
