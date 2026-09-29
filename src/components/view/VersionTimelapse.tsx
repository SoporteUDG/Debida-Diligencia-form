"use client";

import { useEffect, useMemo } from "react";
import { History, Play, Pause, ChevronLeft, ChevronRight, UserCheck, MessageSquareText, ArrowRight } from "lucide-react";
import type { ViewData } from "./FormReadOnlyView";

export interface ViewVersion {
  version: number;
  status: string;
  submittedAt: string;
  authorizedBy: string | null;
  reason: string | null;
  changedFields: string[];
  data: ViewData;
}

interface Props {
  versions: ViewVersion[];
  selected: number;
  onSelect: (version: number) => void;
  playing: boolean;
  onPlayingChange: (playing: boolean) => void;
}

const INTERVALO_MS = 2500;

// "nombreProyecto" -> "Nombre proyecto": las llaves del FormState son legibles
// una vez separadas, y así no hace falta mantener un catálogo aparte.
const etiquetaCampo = (clave: string) => {
  const texto = clave
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .trim();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

const resumirValor = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (Array.isArray(v)) return v.length === 0 ? "—" : `${v.length} registro${v.length === 1 ? "" : "s"}`;
  if (typeof v === "object") return "(datos estructurados)";
  const s = String(v).trim();
  if (s.startsWith("data:")) return "(imagen)";
  return s.length > 80 ? `${s.slice(0, 77)}…` : s;
};

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-PA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export default function VersionTimelapse({ versions, selected, onSelect, playing, onPlayingChange }: Props) {
  const indice = Math.max(0, versions.findIndex((v) => v.version === selected));
  const actual = versions[indice];
  const anterior = indice > 0 ? versions[indice - 1] : null;
  const ultima = versions.length - 1;

  useEffect(() => {
    if (!playing) return;
    if (indice >= ultima) {
      onPlayingChange(false);
      return;
    }
    const t = setTimeout(() => onSelect(versions[indice + 1].version), INTERVALO_MS);
    return () => clearTimeout(t);
  }, [playing, indice, ultima, versions, onSelect, onPlayingChange]);

  const togglePlay = () => {
    if (playing) return onPlayingChange(false);
    // Desde la última versión, reproducir vuelve a empezar por el envío original.
    if (indice >= ultima) onSelect(versions[0].version);
    onPlayingChange(true);
  };

  const irA = (i: number) => {
    onPlayingChange(false);
    onSelect(versions[Math.min(ultima, Math.max(0, i))].version);
  };

  const cambios = useMemo(() => {
    if (!actual || !anterior) return [];
    return actual.changedFields.map((campo) => ({
      campo,
      antes: resumirValor(anterior.data[campo]),
      despues: resumirValor(actual.data[campo]),
    }));
  }, [actual, anterior]);

  if (!actual) return null;
  const progreso = ultima === 0 ? 100 : (indice / ultima) * 100;

  return (
    <section className="bg-[#081827] border border-zinc-800/90 rounded-2xl p-6 md:p-8 shadow-xl text-zinc-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#c8a788]/10 border border-[#c8a788]/30 flex items-center justify-center">
            <History className="w-4 h-4 text-[#c8a788]" />
          </div>
          <div>
            <h3 className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#c8a788]">Historial de versiones</h3>
            <p className="text-xs text-zinc-400">
              {versions.length === 1
                ? "El expediente no ha tenido modificaciones desde su envío."
                : `${versions.length} versiones · recorra la evolución del expediente`}
            </p>
          </div>
        </div>

        {versions.length > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => irA(indice - 1)}
              disabled={indice === 0}
              aria-label="Versión anterior"
              className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-zinc-700 hover:border-zinc-500 disabled:opacity-40 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={togglePlay}
              className="inline-flex items-center gap-2 bg-[#c8a788] hover:bg-[#b08e6f] text-[#002b49] text-xs font-bold px-4 py-2.5 rounded-lg transition tracking-wider uppercase shadow-md cursor-pointer"
            >
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {playing ? "Pausar" : "Reproducir"}
            </button>
            <button
              type="button"
              onClick={() => irA(indice + 1)}
              disabled={indice === ultima}
              aria-label="Versión siguiente"
              className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-zinc-700 hover:border-zinc-500 disabled:opacity-40 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Línea de tiempo */}
      <div className="overflow-x-auto pb-2">
        <div className="relative min-w-max px-4">
          <div className="absolute left-8 right-8 top-4 h-0.5 bg-zinc-800" />
          <div
            className="absolute left-8 top-4 h-0.5 bg-[#c8a788] transition-all duration-700"
            style={{ width: `calc((100% - 4rem) * ${progreso / 100})` }}
          />
          <ol className="relative flex justify-between gap-10">
            {versions.map((v, i) => {
              const activa = i === indice;
              const pasada = i <= indice;
              return (
                <li key={v.version} className="flex flex-col items-center w-24">
                  <button
                    type="button"
                    onClick={() => irA(i)}
                    aria-current={activa ? "step" : undefined}
                    className={`w-8 h-8 rounded-full border-2 text-[11px] font-bold flex items-center justify-center transition-all cursor-pointer ${
                      activa
                        ? "bg-[#c8a788] border-[#c8a788] text-[#002b49] scale-110 shadow-[0_0_0_4px_rgba(200,167,136,0.2)]"
                        : pasada
                          ? "bg-[#002b49] border-[#c8a788] text-[#c8a788]"
                          : "bg-[#002b49] border-zinc-700 text-zinc-500 hover:border-zinc-500"
                    }`}
                  >
                    v{v.version}
                  </button>
                  <span className={`mt-2 text-[10px] text-center leading-tight ${activa ? "text-zinc-200" : "text-zinc-500"}`}>
                    {new Date(v.submittedAt).toLocaleDateString("es-PA", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {/* Detalle de la versión seleccionada */}
      <div key={actual.version} className="animate-fadeIn mt-6 pt-6 border-t border-zinc-800/80 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">Versión</dt>
            <dd className="text-white">
              {actual.version} de {versions.length}
              {indice === ultima && <span className="ml-2 text-[10px] uppercase tracking-widest text-emerald-300">Vigente</span>}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold tracking-wider uppercase text-zinc-500">Enviada</dt>
            <dd className="text-zinc-200">{fechaHora(actual.submittedAt)}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold tracking-wider uppercase text-zinc-500 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5" /> Responsable
            </dt>
            <dd className="text-zinc-200 break-words">
              {actual.authorizedBy || (actual.version === 1 ? "Envío original del cliente" : "—")}
            </dd>
          </div>
          {actual.reason && (
            <div>
              <dt className="text-[10px] font-bold tracking-wider uppercase text-zinc-500 flex items-center gap-1.5">
                <MessageSquareText className="w-3.5 h-3.5" /> Motivo
              </dt>
              <dd className="text-zinc-200 break-words">{actual.reason}</dd>
            </div>
          )}
        </dl>

        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-wider uppercase text-zinc-500 mb-3">
            {anterior ? `Cambios respecto de la v${anterior.version}` : "Cambios"}
          </p>
          {!anterior ? (
            <p className="text-sm text-zinc-400 italic">Versión inicial: es el expediente tal como lo envió el cliente.</p>
          ) : cambios.length === 0 ? (
            <p className="text-sm text-zinc-400 italic">Se reenvió sin modificar ningún campo.</p>
          ) : (
            <ul className="divide-y divide-zinc-800/80 rounded-xl border border-zinc-800/80 max-h-72 overflow-y-auto">
              {cambios.map((c) => (
                <li key={c.campo} className="px-4 py-2.5 text-xs">
                  <p className="font-semibold text-zinc-200 mb-1">{etiquetaCampo(c.campo)}</p>
                  <p className="flex flex-wrap items-center gap-2 text-zinc-400">
                    <span className="line-through decoration-red-400/60 break-all">{c.antes}</span>
                    <ArrowRight className="w-3 h-3 shrink-0 text-[#c8a788]" />
                    <span className="text-emerald-300 break-all">{c.despues}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
