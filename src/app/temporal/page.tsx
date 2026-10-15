"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useTranslatedErrors } from "@/i18n/translateError";
import NaturalHeader from "@/components/persona-natural/Header";
import JuridicaHeader from "@/components/persona-juridica/Header";
import BlockedAccess from "@/components/BlockedAccess";
import BrandFooter from "@/components/BrandFooter";
import type { ClientFormType, TokenFailureReason } from "@/lib/tokenAccess";
import { validarPasoTemporal } from "@/lib/temporalFields";
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

/** Inactividad tras el último cambio antes de guardar el progreso. */
const AUTOSAVE_DELAY_MS = 2000;

type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Enlace temporal (botón "Generar temporal" de Zoho): las secciones I a III del
 * formulario (sin documentos ni firma) según el tipo. El token del enlace
 * autoriza cada llamada a /api/temporal. Si su RUC / ID tributaria ya está en
 * Zoho, el cliente debe confirmar sus datos antes de enviar.
 */
export default function TemporalPage() {
  const t = useTranslations("Temporal");
  const tn = useTranslations("NaturalForm");
  const tj = useTranslations("JuridicaForm");

  const [token, setToken] = useState<string | null>(null);
  const [access, setAccess] = useState<"checking" | "granted" | "done" | TokenFailureReason>("checking");
  const [type, setType] = useState<ClientFormType>("NATURAL");
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // El RUC / ID tributaria ya está en Zoho: falta que el cliente confirme sus datos
  const [existingClient, setExistingClient] = useState(false);
  // Enlace normal creado: se mantiene el cargador mientras el navegador cambia de página
  const [redirecting, setRedirecting] = useState(false);
  // Envío en curso: un autoguardado tardío (403 al quedar bloqueado el temporal) no cambia la vista
  const submittingRef = useRef(false);
  const shownErrors = useTranslatedErrors(errors);

  const dirtyRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const api = useCallback(
    (method: "GET" | "PUT" | "POST", body?: unknown) =>
      fetch("/api/temporal", {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    [token]
  );

  // Token del enlace y carga del temporal
  useEffect(() => {
    const tk = new URLSearchParams(window.location.search).get("token");
    if (!tk) {
      setAccess("INVALID");
      return;
    }
    setToken(tk);
  }, []);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await api("GET");
        const json = await res.json();
        if (!res.ok) {
          setAccess((json.reason as TokenFailureReason) || "INVALID");
          return;
        }
        const tipo: ClientFormType = json.type === "JURIDICA" ? "JURIDICA" : "NATURAL";
        setType(tipo);
        setFormData({ ...(tipo === "NATURAL" ? INITIAL_NATURAL : INITIAL_JURIDICA), ...(json.data ?? {}) });
        setLastSaved(json.updatedAt ?? null);
        setAccess("granted");
      } catch {
        setAccess("INVALID");
      }
    })();
  }, [token, api]);

  const save = useCallback(
    async (data: Record<string, any>) => {
      setSaveStatus("saving");
      try {
        const res = await api("PUT", { data });
        const json = await res.json();
        if (res.status === 403) {
          // Durante el envío el temporal queda bloqueado a propósito: lo resuelve handleSubmit
          if (!submittingRef.current) setAccess((json.reason as TokenFailureReason) || "INVALID");
          return;
        }
        if (!res.ok) throw new Error(json.error);
        dirtyRef.current = false;
        setLastSaved(json.updatedAt);
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    },
    [api]
  );

  // Autoguardado con espera de inactividad
  useEffect(() => {
    if (access !== "granted" || !dirtyRef.current || submittingRef.current) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => save(formData), AUTOSAVE_DELAY_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [formData, access, save]);

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

  // Listas de Gobierno Corporativo (gjcMembers) y Beneficiarios Finales (bfMembers).
  // El temporal no tiene documentos: quitar una persona no borra archivos.
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
    submittingRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    try {
      const res = await api("POST", { data: formData, ...(confirmarExistente ? { confirmarExistente: true } : {}) });
      const json = await res.json();
      if (res.ok && json.url) {
        // Enlace normal creado: se reemplaza esta página (el temporal ya quedó bloqueado)
        setRedirecting(true);
        window.location.replace(json.url);
      } else if (res.ok) {
        setAccess("done");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (res.status === 422 && json.errors) {
        setErrors(json.errors);
        setSubmitError(t("FixErrors"));
        scrollToFirstError();
      } else if (res.status === 409 && json.code === "CLIENTE_EXISTENTE") {
        setExistingClient(true);
      } else if (res.status === 403) {
        setAccess((json.reason as TokenFailureReason) || "INVALID");
      } else if (res.status === 503 && json.code === "VERIFICACION") {
        setSubmitError(t("VerifyError"));
      } else if (res.status === 500 && json.code === "CREACION") {
        setSubmitError(t("CreateError"));
      } else {
        setSubmitError(t("SubmitError"));
      }
    } catch {
      setSubmitError(t("SubmitError"));
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const Header = type === "JURIDICA" ? JuridicaHeader : NaturalHeader;
  const header = <Header isSaving={saveStatus === "saving"} lastSaved={lastSaved} saveStatus={saveStatus} />;

  if (access === "checking") {
    return (
      <div className="min-h-screen bg-[#052B48] text-white flex items-center justify-center font-sans">
        <span className="text-sm text-zinc-300 animate-pulse">{t("Loading")}</span>
      </div>
    );
  }

  if (access !== "granted" && access !== "done") return <BlockedAccess reason={access} header={header} />;

  return (
    <div className="min-h-screen bg-[#052B48] text-white flex flex-col selection:bg-[#DAB38D]/30 font-sans">
      {header}

      {(isSubmitting || redirecting) && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-50 bg-[#052B48]/95 backdrop-blur-sm flex flex-col items-center justify-center gap-6 px-6 text-center"
        >
          <div className="h-16 w-16 rounded-full border-4 border-[#DAB38D]/30 border-t-[#DAB38D] animate-spin" />
          <div className="space-y-2 max-w-md">
            <h2 className="text-2xl font-serif text-[#DAB38D]">
              {redirecting ? t("RedirectingTitle") : t("CreatingTitle")}
            </h2>
            <p className="text-sm text-zinc-300">{redirecting ? t("RedirectingMessage") : t("CreatingMessage")}</p>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 md:px-6 py-10">
        {access === "done" ? (
          <div className="max-w-2xl mx-auto py-16 text-center space-y-4 animate-fadeIn">
            <h1 className="text-3xl font-serif text-[#DAB38D]">{t("DoneTitle")}</h1>
            <p className="text-zinc-300">{t("DoneMessage")}</p>
          </div>
        ) : (
          <div className="space-y-6 animate-fadeIn">
            <div className="space-y-1">
              <h1 className="text-2xl md:text-3xl font-serif text-[#DAB38D]">{t("Title")}</h1>
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
