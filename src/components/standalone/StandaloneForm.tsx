"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useTranslatedErrors } from "@/i18n/translateError";
import NaturalHeader from "@/components/persona-natural/Header";
import JuridicaHeader from "@/components/persona-juridica/Header";
import NaturalPolicies from "@/components/persona-natural/PoliciesScreen";
import JuridicaPolicies from "@/components/persona-juridica/PoliciesScreen";
import BrandFooter from "@/components/BrandFooter";
import type { ClientFormType } from "@/lib/tokenAccess";
import { datosDelTemporal, validarPasoTemporal } from "@/lib/temporalFields";
import { procesarRegistroEstandalone } from "@/lib/registroEstandalone";
import { PHONE_INPUT_FIELDS, sanitizePhoneInput } from "@/lib/phoneInput";
import { INITIAL_FORM_STATE as INITIAL_NATURAL } from "@/types/persona-natural";
import { INITIAL_FORM_STATE as INITIAL_JURIDICA } from "@/types/persona-juridica";
import type { BfMember, GjcMember } from "@/types/persona-juridica";

const Step1DatosPersonales = dynamic(() => import("@/components/persona-natural/Step1DatosPersonales"), { ssr: false });
const Step2PerfilFinanciero = dynamic(() => import("@/components/persona-natural/Step2PerfilFinanciero"), { ssr: false });
const Step3PerfilFinanciero = dynamic(() => import("@/components/persona-natural/Step3PerfilFinanciero"), { ssr: false });
const Step1Identificacion = dynamic(() => import("@/components/persona-juridica/Step1Identificacion"), { ssr: false });
const Step2GobiernoRL = dynamic(() => import("@/components/persona-juridica/Step2GobiernoRL"), { ssr: false });
const Step3Finanzas = dynamic(() => import("@/components/persona-juridica/Step3Finanzas"), { ssr: false });

const NUEVO_GJC: Omit<GjcMember, "id"> = {
  cargo: "", nombre: "", apellidos: "", nacionalidad: "", fechaNacimiento: "", nroId: "", direccion: "",
};
const NUEVO_BF: Omit<BfMember, "id"> = {
  nombreCompleto: "", noIdentificacion: "", nacionalidad: "", fechaAdquisicion: "",
  porcentajeParticipacion: "", paisNacimiento: "", direccion: "",
};

/** Inactividad tras el último cambio antes de guardar en el navegador. */
const AUTOSAVE_DELAY_MS = 800;

const cacheKey = (type: ClientFormType) => `udg_registro_${type.toLowerCase()}_cache`;
const submissionKey = (type: ClientFormType) => `udg_registro_${type.toLowerCase()}_submission`;
const savedAtKey = (type: ClientFormType) => `udg_registro_${type.toLowerCase()}_saved_at`;

/**
 * Identificador del envío en curso: se crea la primera vez y se conserva hasta
 * que el expediente queda creado, así un reintento (o recargar la página tras
 * una falla) no duplica el expediente en Zoho.
 */
function submissionIdDe(type: ClientFormType): string {
  try {
    const guardado = localStorage.getItem(submissionKey(type));
    if (guardado) return guardado;
    const nuevo = crypto.randomUUID();
    localStorage.setItem(submissionKey(type), nuevo);
    return nuevo;
  } catch {
    return crypto.randomUUID();
  }
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

function readSavedAt(type: ClientFormType): string | null {
  try {
    return localStorage.getItem(savedAtKey(type));
  } catch {
    return null;
  }
}

function readCache(type: ClientFormType): Record<string, any> {
  try {
    const raw = localStorage.getItem(cacheKey(type));
    return raw ? datosDelTemporal(type, JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

/**
 * Formulario independiente: secciones I a III de Persona Natural o Jurídica, sin
 * borrador en servidor ni enlace de acceso. El progreso se guarda solo en el
 * navegador (localStorage). Al completarlo se muestra un cargador mientras
 * /api/registro crea el expediente en Zoho; luego se abre el formulario normal
 * (en Documentos) con estos datos.
 *
 * Primero se muestra la pantalla de políticas (la misma de cada formulario
 * normal, que difiere entre natural y jurídica); "Aceptar y continuar" abre las
 * secciones. Se muestra en cada visita, aunque haya progreso guardado.
 */
export default function StandaloneForm({ type }: { type: ClientFormType }) {
  const t = useTranslations("Standalone");
  const tn = useTranslations("NaturalForm");
  const tj = useTranslations("JuridicaForm");
  const tp = useTranslations(type === "JURIDICA" ? "JuridicaForm.Page" : "NaturalForm.Page");

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loaded, setLoaded] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // Pantalla de políticas aceptada: recién entonces se muestran las secciones
  const [accepted, setAccepted] = useState(false);
  // Enlace normal creado: se mantiene el cargador mientras el navegador cambia de página
  const [redirecting, setRedirecting] = useState(false);
  // El RUC / ID tributaria ya está en Zoho: falta que el cliente confirme sus datos
  const [existingClient, setExistingClient] = useState(false);
  // Trampa para bots: campo oculto que una persona nunca llena
  const [website, setWebsite] = useState("");
  const shownErrors = useTranslatedErrors(errors);

  const dirtyRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restaura lo guardado en este navegador
  useEffect(() => {
    setFormData({ ...(type === "NATURAL" ? INITIAL_NATURAL : INITIAL_JURIDICA), ...readCache(type) });
    setLastSaved(readSavedAt(type));
    setLoaded(true);
  }, [type]);

  // Autoguardado en el navegador con espera de inactividad
  useEffect(() => {
    if (!loaded || !dirtyRef.current) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setSaveStatus("saving");
    timeoutRef.current = setTimeout(() => {
      try {
        const guardadoEn = new Date().toLocaleTimeString();
        localStorage.setItem(cacheKey(type), JSON.stringify(datosDelTemporal(type, formData)));
        localStorage.setItem(savedAtKey(type), guardadoEn);
        dirtyRef.current = false;
        setLastSaved(guardadoEn);
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [formData, loaded, type]);

  // "Vaciar borrador" de la pantalla de políticas: borra lo guardado en este navegador
  const handleClearDraft = () => {
    if (!confirm(tp("ConfirmClearDraft"))) return;
    try {
      localStorage.removeItem(cacheKey(type));
      localStorage.removeItem(submissionKey(type));
      localStorage.removeItem(savedAtKey(type));
    } catch {}
    dirtyRef.current = false;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setFormData(type === "NATURAL" ? INITIAL_NATURAL : INITIAL_JURIDICA);
    setLastSaved(null);
    setSaveStatus("idle");
    setErrors({});
    setSubmitError(null);
    setExistingClient(false);
  };

  const clearError = (name: string) => {
    if (errors[name]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, type: inputType } = e.target;
    // Los teléfonos no admiten letras (tampoco al pegar)
    const value = PHONE_INPUT_FIELDS.has(name) ? sanitizePhoneInput(e.target.value) : e.target.value;
    const checked = inputType === "checkbox" ? (e.target as HTMLInputElement).checked : undefined;
    dirtyRef.current = true;
    setFormData((prev) => ({ ...prev, [name]: checked !== undefined ? checked : value }));
    clearError(name);
  };

  const handleSearchableSelectChange = (fieldName: string | number | symbol, value: string) => {
    dirtyRef.current = true;
    setFormData((prev) => ({ ...prev, [String(fieldName)]: value }));
    clearError(String(fieldName));
  };

  // Listas de Gobierno Corporativo (gjcMembers) y Beneficiarios Finales (bfMembers)
  const updateList = (list: "gjcMembers" | "bfMembers", update: (items: any[]) => any[]) => {
    dirtyRef.current = true;
    setFormData((prev) => ({ ...prev, [list]: update(prev[list] || []) }));
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith(list))));
  };

  const memberHandlers = (list: "gjcMembers" | "bfMembers", nuevo: Record<string, string>) => ({
    add: () => updateList(list, (items) => [...items, { id: crypto.randomUUID(), ...nuevo }]),
    remove: (id: string) => updateList(list, (items) => items.filter((m) => m.id !== id)),
    change: (id: string, field: string | number | symbol, value: string) =>
      updateList(list, (items) => items.map((m) => (m.id === id ? { ...m, [String(field)]: value } : m))),
  });
  const gjc = memberHandlers("gjcMembers", NUEVO_GJC);
  const bf = memberHandlers("bfMembers", NUEVO_BF);

  const scrollToFirstError = () =>
    setTimeout(() => {
      const first = Array.from(document.querySelectorAll(".text-red-500")).find((el) => el.textContent?.includes("⚠️"));
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);

  const handleSubmit = async (confirmarExistente = false) => {
    setSubmitError(null);
    setExistingClient(false);
    const stepErrors = validarPasoTemporal(type, formData);
    if (Object.keys(stepErrors).length) {
      setErrors(stepErrors);
      setSubmitError(t("FixErrors"));
      scrollToFirstError();
      return;
    }

    setIsSubmitting(true);
    const result = await procesarRegistroEstandalone(type, datosDelTemporal(type, formData), {
      submissionId: submissionIdDe(type),
      website,
      ...(confirmarExistente ? { confirmarExistente: true } : {}),
    });
    switch (result.status) {
      case "ok":
        // Los datos ya viajan al formulario normal: se libera la copia de este navegador
        try {
          localStorage.removeItem(cacheKey(type));
          localStorage.removeItem(submissionKey(type));
          localStorage.removeItem(savedAtKey(type));
        } catch {}
        setRedirecting(true);
        window.location.replace(result.url);
        return; // el cargador sigue mientras cambia la página
      case "listo":
        setDone(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
        break;
      case "validacion":
        setErrors(result.errors);
        setSubmitError(t("FixErrors"));
        scrollToFirstError();
        break;
      case "existente":
        setExistingClient(true);
        break;
      case "limite":
        setSubmitError(t("RateLimited", { minutes: Math.max(1, Math.ceil(result.retryAfter / 60)) }));
        break;
      case "verificacion":
        setSubmitError(t("VerifyError"));
        break;
      default:
        setSubmitError(t("SubmitError"));
    }
    setIsSubmitting(false);
  };

  const Header = type === "JURIDICA" ? JuridicaHeader : NaturalHeader;

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[#052B48] text-white flex items-center justify-center font-sans">
        <span className="text-sm text-zinc-300 animate-pulse">{t("Loading")}</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#052B48] text-white flex flex-col selection:bg-[#DAB38D]/30 font-sans">
      <Header isSaving={saveStatus === "saving"} lastSaved={lastSaved} saveStatus={saveStatus} />

      {(isSubmitting || redirecting) && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-50 bg-[#052B48]/95 backdrop-blur-sm flex flex-col items-center justify-center gap-6 px-6 text-center"
        >
          <div className="h-16 w-16 rounded-full border-4 border-[#DAB38D]/30 border-t-[#DAB38D] animate-spin" />
          <div className="space-y-2 max-w-md">
            <h2 className="text-2xl font-serif text-[#DAB38D]">
              {redirecting ? t("RedirectingTitle") : t("ProcessingTitle")}
            </h2>
            <p className="text-sm text-zinc-300">{redirecting ? t("RedirectingMessage") : t("ProcessingMessage")}</p>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 md:px-6 py-10">
        {done ? (
          <div className="max-w-2xl mx-auto py-16 text-center space-y-4 animate-fadeIn">
            <h1 className="text-3xl font-serif text-[#DAB38D]">{t("DoneTitle")}</h1>
            <p className="text-zinc-300">{t("DoneMessage")}</p>
          </div>
        ) : !accepted ? (
          type === "JURIDICA" ? (
            <JuridicaPolicies lastSaved={lastSaved} onClearDraft={handleClearDraft} onContinue={() => setAccepted(true)} />
          ) : (
            <NaturalPolicies lastSaved={lastSaved} onClearDraft={handleClearDraft} onContinue={() => setAccepted(true)} />
          )
        ) : (
          <div className="space-y-6 animate-fadeIn">
            <div className="space-y-1">
              <h1 className="text-2xl md:text-3xl font-bold text-[#DAB38D]">
                {type === "JURIDICA" ? t("TitleJuridica") : t("TitleNatural")}
              </h1>
              <p className="text-sm text-zinc-300">{t("Subtitle")}</p>
            </div>

            {type === "JURIDICA" ? (
              <>
                <Section title={tj("BigTitleStep1")}>
                  <Step1Identificacion
                    formData={formData as any}
                    onInputChange={handleInputChange}
                    onSearchableSelectChange={handleSearchableSelectChange}
                    errors={shownErrors}
                  />
                </Section>
                <Section title={tj("BigTitleStep2")}>
                  <Step2GobiernoRL
                    formData={formData as any}
                    onInputChange={handleInputChange}
                    onSearchableSelectChange={handleSearchableSelectChange}
                    onAddGjcMember={gjc.add}
                    onRemoveGjcMember={gjc.remove}
                    onGjcMemberChange={gjc.change}
                    errors={shownErrors}
                  />
                </Section>
                <Section title={tj("BigTitleStep3")}>
                  <Step3Finanzas
                    formData={formData as any}
                    onInputChange={handleInputChange}
                    onAddBfMember={bf.add}
                    onRemoveBfMember={bf.remove}
                    onBfMemberChange={bf.change}
                    errors={shownErrors}
                  />
                </Section>
              </>
            ) : (
              <>
                <Section title={tn("BigTitleStep1")}>
                  <Step1DatosPersonales
                    formData={formData as any}
                    onInputChange={handleInputChange}
                    onSearchableSelectChange={handleSearchableSelectChange}
                    errors={shownErrors}
                  />
                </Section>
                <Section title={tn("BigTitleStep2")}>
                  <Step2PerfilFinanciero
                    formData={formData as any}
                    onInputChange={handleInputChange}
                    onSearchableSelectChange={handleSearchableSelectChange}
                    errors={shownErrors}
                  />
                </Section>
                <Section title={tn("BigTitle3")}>
                  <Step3PerfilFinanciero
                    formData={formData as any}
                    onInputChange={handleInputChange}
                    onSearchableSelectChange={handleSearchableSelectChange}
                    errors={shownErrors}
                  />
                </Section>
              </>
            )}

            {/* Trampa para bots: oculta a personas y a lectores de pantalla */}
            <input
              type="text"
              name="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="hidden"
            />

            {existingClient && (
              <div role="alert" className="bg-[#DAB38D]/10 border border-[#DAB38D]/60 rounded-2xl p-6 space-y-3">
                <h3 className="text-[#DAB38D] font-bold">{t("ExistingClientTitle")}</h3>
                <p className="text-sm text-zinc-200">{t("ExistingClientMessage")}</p>
                <div className="flex flex-wrap gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setExistingClient(false)}
                    className="border border-zinc-500 text-zinc-200 text-sm px-6 py-2 rounded-lg hover:bg-white/5 transition"
                  >
                    {t("ExistingClientReview")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSubmit(true)}
                    disabled={isSubmitting}
                    className="bg-[#DAB38D] text-[#052B48] font-bold text-sm px-6 py-2 rounded-lg hover:bg-[#c8a788] transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {t("ExistingClientConfirm")}
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col items-end gap-2">
              {submitError && <span className="text-sm text-red-400">{submitError}</span>}
              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={isSubmitting || existingClient}
                className="bg-[#DAB38D] text-[#052B48] font-bold text-sm px-8 py-3 rounded-lg hover:bg-[#c8a788] transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? t("Submitting") : t("Submit")}
              </button>
            </div>
          </div>
        )}
      </main>

      <BrandFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/5 p-6 rounded-3xl border border-zinc-800 space-y-4">
      <h2 className="text-[#c8a788] text-sm font-bold uppercase tracking-wider border-b border-zinc-850 pb-2">{title}</h2>
      {children}
    </div>
  );
}
