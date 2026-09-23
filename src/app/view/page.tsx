"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Eye, Link2, Search, AlertCircle, Download, ArrowLeft, Lock, RefreshCw } from "lucide-react";
import FormReadOnlyView, { ViewData, ViewDocument, ViewSignature } from "@/components/view/FormReadOnlyView";
import { generatePDF } from "@/lib/pdfGenerator";
import { resolveFormType } from "@/lib/formTypeResolution";

interface ViewResult {
  type: "natural" | "juridica";
  status: string;
  step: number | null;
  formId: string | null;
  clientName: string;
  projectName: string;
  submittedAt: string | null;
  updatedAt: string;
  data: ViewData;
  documents: ViewDocument[];
  signature: ViewSignature | null;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador (sin enviar)",
  SUBMITTED: "Enviado",
  REVIEWED: "Revisado",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
};

function Header() {
  return (
    <header className="border-b border-zinc-800/40 bg-[#002b49]/95 backdrop-blur-md sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative w-24 h-16 flex items-center justify-center">
            <Image
              src="/Logo UDG V2.png"
              alt="Logo UDG"
              width={110}
              height={80}
              className="object-contain"
              style={{ height: "auto", mixBlendMode: "screen" }}
              priority
            />
          </div>
          <div>
            <span className="font-serif text-xl font-medium tracking-[0.15em] bg-gradient-to-r from-zinc-100 via-amber-100 to-[#c8a788] bg-clip-text text-transparent">
              UDG
            </span>
            <span className="block text-[10px] tracking-[0.3em] text-[#c8a788] uppercase font-semibold">
              Consulta de Expediente
            </span>
          </div>
        </div>
        <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#c8a788]/10 border border-[#c8a788]/20 text-[#c8a788] text-[10px] tracking-widest uppercase font-semibold">
          <Eye className="w-3.5 h-3.5" />
          Solo lectura
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-zinc-800/40 bg-black/30 py-6 text-center text-xs text-zinc-400">
      <p className="font-sans text-[11px] tracking-wider text-zinc-400">
        © {new Date().getFullYear()} UDG Group. Todos los derechos reservados de conformidad con la ley de protección de datos.
      </p>
    </footer>
  );
}

export default function ViewPage() {
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ViewResult | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const lookup = async (value: string, opts: { refresh?: boolean } = {}) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Pegue el enlace del formulario para continuar.");
      return;
    }
    if (opts.refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/trpc/getFormView", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link: trimmed }),
      });
      const json = await res.json();
      const trpcError = json.error || json[0]?.error;
      if (!res.ok || trpcError) {
        throw new Error(trpcError?.message || "No se pudo consultar el expediente.");
      }
      setResult(json.result?.data as ViewResult);
    } catch (e) {
      // Al recargar se conserva lo ya mostrado: un fallo puntual de red no debe
      // devolver al usuario al formulario y obligarle a pegar el enlace otra vez.
      if (!opts.refresh) setResult(null);
      setError(e instanceof Error ? e.message : "No se pudo consultar el expediente.");
    } finally {
      if (opts.refresh) setRefreshing(false);
      else setLoading(false);
    }
  };

  // Allow deep-linking: /view?link=<url-or-token> or /view?token=<token>
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("link") || params.get("token") || params.get("t");
    if (initial) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- URL param is only available client-side after mount
      setLink(initial);
      lookup(initial);
    }
  }, []);

  // getFormView devuelve DRAFT mientras el expediente no se haya enviado; cualquier
  // otro estado (SUBMITTED/REVIEWED/APPROVED/REJECTED) corresponde a un Form cerrado.
  const isSubmitted = !!result && result.status !== "DRAFT";

  // El tipo registrado puede no coincidir con lo que el cliente llenó; la
  // insignia y el PDF deben seguir el mismo criterio que la vista.
  const tipoExpediente = result ? resolveFormType(result.type, result.data).type : "natural";

  const handleDownload = async () => {
    if (!result) return;
    setDownloading(true);
    try {
      await generatePDF(
        tipoExpediente,
        result.data,
        result.formId || "BORRADOR",
        new Date(result.submittedAt || result.updatedAt).toLocaleDateString(),
        result.documents
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleRefresh = () => {
    if (refreshing || loading) return;
    lookup(link, { refresh: true });
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setLink("");
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/view");
    }
  };

  return (
    <div className="min-h-screen bg-[#002b49] flex flex-col justify-between font-sans selection:bg-[#c8a788]/30 selection:text-white">
      <Header />

      <main className="flex-1 w-full mx-auto px-6 py-12 max-w-5xl">
        {!result ? (
          <div className="max-w-2xl mx-auto">
            <div className="bg-[#081827] border border-zinc-800/90 rounded-2xl p-8 md:p-12 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#c8a788]/15 to-transparent rounded-bl-full pointer-events-none"></div>

              <div className="mx-auto w-14 h-14 rounded-2xl bg-[#c8a788]/10 border border-[#c8a788]/30 flex items-center justify-center mb-6">
                <Link2 className="h-7 w-7 text-[#c8a788]" />
              </div>

              <h1 className="text-2xl md:text-3xl font-serif font-light tracking-wide text-white text-center mb-3">
                Consultar Expediente
              </h1>
              <p className="text-zinc-300 text-sm leading-relaxed text-center mb-8">
                Pegue el enlace del formulario de Debida Diligencia que recibió para ver la información registrada.
                Esta vista es de solo lectura: no permite modificar ningún dato.
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  lookup(link);
                }}
                className="space-y-4"
              >
                <label htmlFor="link" className="block text-[11px] font-bold tracking-wider uppercase text-[#c8a788]">
                  Enlace del formulario
                </label>
                <input
                  id="link"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://.../persona-natural?token=..."
                  className="w-full bg-[#00223a] border border-zinc-700 rounded-lg px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#c8a788] focus:ring-1 focus:ring-[#c8a788]/30 transition font-mono"
                />

                {error && (
                  <div className="flex items-start gap-2 text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#c8a788] hover:bg-[#b08e6f] disabled:opacity-60 text-[#002b49] text-xs font-bold px-4 py-3.5 rounded-lg transition tracking-wider uppercase shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-[#002b49] border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  {loading ? "Consultando..." : "Ver expediente"}
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-zinc-800/80 flex items-center justify-center gap-2 text-[11px] text-zinc-500">
                <Lock className="w-3.5 h-3.5" />
                Acceso privado y confidencial · Urban Development Group
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-fadeIn space-y-6">
            {/* Un error aquí sólo puede venir de una recarga fallida: el expediente
                ya cargado sigue en pantalla y se avisa que puede estar desactualizado. */}
            {error && (
              <div className="flex items-start gap-2 text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error} Se muestra la última consulta exitosa.</span>
              </div>
            )}

            {/* Summary bar */}
            <div className="bg-[#081827] border border-zinc-800/90 rounded-2xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#c8a788]/10 border border-[#c8a788]/30 text-[#c8a788] text-[10px] tracking-widest uppercase font-semibold">
                    {tipoExpediente === "natural" ? "Persona Natural" : "Persona Jurídica"}
                  </span>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] tracking-widest uppercase font-semibold border ${
                      result.status === "DRAFT"
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                        : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    }`}
                  >
                    {STATUS_LABEL[result.status] || result.status}
                  </span>
                </div>
                <h2 className="text-2xl font-serif font-light text-white tracking-wide truncate">{result.clientName}</h2>
                <p className="text-sm text-zinc-400 mt-1">
                  Proyecto: <span className="text-zinc-200">{result.projectName}</span>
                  {result.submittedAt && (
                    <>
                      {" · "}Enviado el{" "}
                      <span className="text-zinc-200">{new Date(result.submittedAt).toLocaleString("es-PA")}</span>
                    </>
                  )}
                  {!result.submittedAt && (
                    <>
                      {" · "}Última actualización{" "}
                      <span className="text-zinc-200">{new Date(result.updatedAt).toLocaleString("es-PA")}</span>
                      {result.step !== null && result.step > 0 && (
                        <>
                          {" · "}Paso <span className="text-zinc-200">{result.step}</span>
                        </>
                      )}
                    </>
                  )}
                </p>
                {result.formId && (
                  <p className="text-[11px] text-zinc-500 mt-1 font-mono">ID: {result.formId}</p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center justify-center gap-2 border border-zinc-700 hover:border-zinc-500 text-zinc-200 text-xs font-bold px-4 py-2.5 rounded-lg transition tracking-wider uppercase cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Otro enlace
                </button>
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  title="Volver a consultar el expediente por si hubo cambios"
                  className="inline-flex items-center justify-center gap-2 border border-zinc-700 hover:border-zinc-500 disabled:opacity-60 text-zinc-200 text-xs font-bold px-4 py-2.5 rounded-lg transition tracking-wider uppercase cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                  {refreshing ? "Recargando..." : "Recargar"}
                </button>
                {/* El PDF sólo se emite sobre un expediente ya enviado: un borrador
                    todavía puede cambiar y su descarga se prestaría a confusión. */}
                {isSubmitted && (
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={downloading}
                    className="inline-flex items-center justify-center gap-2 bg-[#c8a788] hover:bg-[#b08e6f] disabled:opacity-60 text-[#002b49] text-xs font-bold px-4 py-2.5 rounded-lg transition tracking-wider uppercase shadow-md cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    {downloading ? "Generando..." : "Descargar PDF"}
                  </button>
                )}
              </div>
            </div>

            <FormReadOnlyView
              type={result.type}
              data={result.data}
              documents={result.documents}
              signature={result.signature}
            />
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
