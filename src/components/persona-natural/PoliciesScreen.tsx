"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";

interface PoliciesScreenProps {
  lastSaved: string | null;
  onClearDraft: () => void;
  onContinue: () => void;
}

export default function PoliciesScreen({ lastSaved, onClearDraft, onContinue }: PoliciesScreenProps) {
  return (
    <div className="max-w-3xl mx-auto w-full animate-fadeIn text-center text-white">
      <div className="mb-6 inline-block">
        <Image 
          src="/Logo UDG.png" 
          alt="Logo UDG Grande" 
          width={280} 
          height={120} 
          className="object-contain mx-auto" 
          style={{ height: "auto", mixBlendMode: "screen" }}
        />
      </div>

      <h1 className="text-2xl md:text-3xl font-serif font-light tracking-wide uppercase mb-8">
        Formulario Perfil del Cliente <span className="block text-[#c8a788] font-sans text-lg font-semibold tracking-widest mt-2">PERSONA NATURAL</span>
      </h1>

      {/* Premium Ivory White Card for Legal Policies */}
      <div className="bg-[#faf9f6] text-[#1a1c1a] rounded-2xl p-8 md:p-10 shadow-2xl border-t-4 border-[#c8a788] text-left mb-8 max-w-2xl mx-auto font-sans">
        <div className="space-y-6">
          <section>
            <h2 className="text-xs font-bold tracking-wider uppercase text-zinc-800 mb-2 border-b border-zinc-200 pb-1.5 font-sans">
              EN CUMPLIMIENTO DE LA LEY 23 DEL 27 DE ABRIL 2015
            </h2>
            <p className="text-xs md:text-sm leading-relaxed text-zinc-700 font-sans">
              Este formulario y la documentación que solicitamos adjuntar representan nuestros requerimientos mínimos legales de debida diligencia sobre usted, el abajo declarante y firmante, como nuestro cliente de referencia, y las condiciones bajo las que nuestra empresa, acepta proveer los servicios que usted solicite. Otros servicios podrían requerir información y/o documentos adicionales.
            </p>
            <p className="text-xs font-semibold text-red-600 mt-2">
              **Todos los campos son de carácter obligatorio, si no corresponde algún dato, favor establecer N/A en el campo respectivo según corresponde.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-bold tracking-wider uppercase text-zinc-800 mb-2 border-b border-zinc-200 pb-1.5 font-sans">
              ANTES DE COMPLETAR ESTE FORMULARIO, LEA DETENIDAMENTE LO SIGUIENTE:
            </h2>
            <ul className="list-disc pl-4 text-xs md:text-sm leading-relaxed text-zinc-700 space-y-2">
              <li>La información solicitada debe ser completada con letra imprenta, de manera íntegra, verídica y sin tachones ni enmendaduras, en su defecto colocar sus iniciales en el lugar correspondiente.</li>
              <li>Presentar los documentos originales y certificaciones necesarias, cuando la empresa lo requiera.</li>
              <li>Complete con líneas o rayas los espacios en blanco, que no apliquen o que no contengan información.</li>
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
            Limpiar borrador guardado
          </button>
        )}
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex items-center gap-3 bg-gradient-to-r from-[#c8a788] to-yellow-600 text-zinc-950 font-semibold px-8 py-3.5 rounded-lg shadow-lg shadow-[#c8a788]/10 hover:shadow-[#c8a788]/20 transition-all duration-300 active:scale-[0.98] cursor-pointer text-sm tracking-widest uppercase"
        >
          Aceptar y Continuar
          <ArrowRight className="h-4.5 w-4.5" />
        </button>
      </div>
    </div>
  );
}
