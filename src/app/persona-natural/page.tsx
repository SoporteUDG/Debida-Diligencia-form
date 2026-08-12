"use client";

import Link from "next/link";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useEffect, useState } from "react";
import { FormState, INITIAL_FORM_STATE } from "@/types/persona-natural";

import Header from "@/components/persona-natural/Header";
import PoliciesScreen from "@/components/persona-natural/PoliciesScreen";
import FormStepper from "@/components/persona-natural/FormStepper";
import Step1DatosPersonales from "@/components/persona-natural/Step1DatosPersonales";
import Step2PerfilFinanciero from "@/components/persona-natural/Step2PerfilFinanciero";
import Step3PerfilFinanciero from "@/components/persona-natural/Step3PerfilFinanciero";
import Step3Documentos from "@/components/persona-natural/Step3Documentos";
import Step4FirmaDeclaracion from "@/components/persona-natural/Step4FirmaDeclaracion";
import NavigationButtons from "@/components/persona-natural/NavigationButtons";
import { generatePDF } from "@/lib/pdfGenerator";
import { 
  naturalStep1Schema, 
  naturalStep2Schema, 
  naturalStep3Schema, 
  naturalStep4Schema, 
  naturalStep5Schema, 
  naturalFormSchema 
} from "@/lib/validation";

import { useAutosave } from "@/hooks/useAutosave";

const normalizeFormData = (dbData: any): FormState => {
  const normalized = { ...INITIAL_FORM_STATE, ...dbData };
  for (const key of Object.keys(normalized)) {
    if ((normalized as any)[key] === null || (normalized as any)[key] === undefined) {
      (normalized as any)[key] = (INITIAL_FORM_STATE as any)[key] ?? "";
    }
  }
  return normalized;
};

export default function PersonaNaturalPage() {
  const [formData, setFormData] = useLocalStorage<FormState>("udg_due_diligence_natural", INITIAL_FORM_STATE);
  const [currentStep, setCurrentStep] = useState(0); // Step 0 is policies screen
  const [isMounted, setIsMounted] = useState(false);
  const [draftToken, setDraftToken] = useState<string | null>(null);

  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadStatus, setUploadStatus] = useState<Record<string, "idle" | "uploading" | "success">>({});

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedData, setSubmittedData] = useState<FormState | null>(null);
  const [submissionId, setSubmissionId] = useState("");
  const [submissionDate, setSubmissionDate] = useState("");
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize draft token and load saved draft timestamp if it exists
  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      let token = searchParams.get("token") || searchParams.get("t");
      
      if (token) {
        localStorage.setItem("udg_due_diligence_natural_token", token);
      } else {
        token = localStorage.getItem("udg_due_diligence_natural_token");
        if (!token) {
          token = "draft-nat-" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
          localStorage.setItem("udg_due_diligence_natural_token", token);
        }
      }
      setDraftToken(token);
    }
  }, []);

  // Hook up custom autosave hook
  const { status: saveStatus, lastSaved, setStatus: setSaveStatus, setLastSaved, lastSavedAtRef } = useAutosave({
    data: formData,
    type: "natural",
    step: currentStep,
    draftToken,
    onConflict: (dbData, dbStep, dbUpdatedAt) => {
      console.warn("[Natural Page] Conflicto de concurrencia detectado. Sincronizando con la versión de base de datos.");
      setFormData(normalizeFormData(dbData));
      setCurrentStep(dbStep);
      if (lastSavedAtRef) {
        lastSavedAtRef.current = dbUpdatedAt;
      }
      setLastSaved(new Date(dbUpdatedAt).toLocaleTimeString());
      setSaveStatus("saved");
    }
  });

  // Load draft from database on mount or when token is loaded
  useEffect(() => {
    if (!draftToken || !isMounted) return;

    const loadDraftFromDb = async () => {
      try {
        const response = await fetch("/api/trpc/getDraft", {
          headers: {
            "Authorization": `Bearer ${draftToken}`,
          },
        });

        if (response.ok) {
          const resJson = await response.json();
          if (resJson.error) {
            console.error("[Natural Page] Error loading draft from tRPC:", resJson.error);
            return;
          }

          const result = resJson.result?.data;
          if (result && result.exists) {
            console.log("[Natural Page] Borrador encontrado y rehidratado desde base de datos:", result);
            setFormData(normalizeFormData(result.data));
            if (result.step) {
              setCurrentStep(result.step);
            }
            if (lastSavedAtRef) {
              lastSavedAtRef.current = result.updatedAt;
            }
            setLastSaved(new Date(result.updatedAt).toLocaleTimeString());
            setSaveStatus("saved");
          }
        }
      } catch (error) {
        console.error("[Natural Page] Error fetching draft:", error);
      }
    };

    loadDraftFromDb();
  }, [draftToken, isMounted]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = type === "checkbox" ? (e.target as HTMLInputElement).checked : undefined;

    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: checked !== undefined ? checked : value
      };

      if (name === "esPep" && value === "No") {
        updated.pepNombre = "";
        updated.pepCargo = "";
        updated.pepInstitucion = "";
        updated.pepRelacion = "";
      }

      return updated;
    });

    if (errors[name]) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  const handleSearchableSelectChange = (fieldName: keyof FormState, value: string) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));

    if (errors[fieldName]) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy[fieldName];
        return copy;
      });
    }
  };

  const handleFileUploadSimulated = (fieldName: keyof FormState, fileName: string) => {
    setUploadStatus(prev => ({ ...prev, [fieldName]: "uploading" }));
    setUploadProgress(prev => ({ ...prev, [fieldName]: 10 }));

    const interval = setInterval(() => {
      setUploadProgress(prev => {
        const nextVal = (prev[fieldName] || 10) + 30;
        if (nextVal >= 100) {
          clearInterval(interval);
          setUploadStatus(prevStatus => ({ ...prevStatus, [fieldName]: "success" }));
          setFormData(prevForm => ({ ...prevForm, [fieldName]: fileName }));
          setErrors(prevErrors => {
            const copy = { ...prevErrors };
            delete copy[fieldName];
            return copy;
          });
          return { ...prev, [fieldName]: 100 };
        }
        return { ...prev, [fieldName]: nextVal };
      });
    }, 300);
  };

  const handleRemoveFile = (fieldName: keyof FormState) => {
    setFormData(prev => ({ ...prev, [fieldName]: "" }));
    setUploadStatus(prev => ({ ...prev, [fieldName]: "idle" }));
    setUploadProgress(prev => ({ ...prev, [fieldName]: 0 }));
  };

  const handleClearDraft = async () => {
    if (confirm("¿Estás seguro de que deseas vaciar todos los campos del borrador?")) {
      if (draftToken) {
        try {
          await fetch(`/api/draft?token=${draftToken}`, { method: "DELETE" });
        } catch (e) {
          console.error("Error deleting draft:", e);
        }
      }
      setFormData(INITIAL_FORM_STATE);
      setLastSaved(null);
      setSaveStatus("idle");
      setCurrentStep(0);
      setUploadStatus({});
      setUploadProgress({});
      setErrors({});
    }
  };

  const isStepValid = (step: number) => {
    if (step === 0) return true;
    let schema;
    if (step === 1) schema = naturalStep1Schema;
    else if (step === 2) schema = naturalStep2Schema;
    else if (step === 3) schema = naturalStep3Schema;
    else if (step === 4) schema = naturalStep4Schema;
    else if (step === 5) schema = naturalStep5Schema;
    else return false;

    return schema.safeParse(formData).success;
  };

  const validateStep = (step: number): boolean => {
    if (step === 0) return true;
    let schema;
    if (step === 1) schema = naturalStep1Schema;
    else if (step === 2) schema = naturalStep2Schema;
    else if (step === 3) schema = naturalStep3Schema;
    else if (step === 4) schema = naturalStep4Schema;
    else if (step === 5) schema = naturalStep5Schema;
    else return true;

    const validation = schema.safeParse(formData);
    if (!validation.success) {
      const stepErrors: Record<string, string> = {};
      validation.error.issues.forEach(err => {
        const path = err.path.join(".");
        stepErrors[path] = err.message;
      });
      setErrors(stepErrors);
      return false;
    }

    setErrors({});
    return true;
  };

  const handleNextStep = () => {
    const isValid = validateStep(currentStep);
    if (isValid) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setTimeout(() => {
        const firstError = document.querySelector(".text-red-500");
        if (firstError) {
          firstError.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    }
  };

  const handleSubmit = async () => {
    const isFinalValid = validateStep(5);
    if (!isFinalValid) {
      setTimeout(() => {
        const firstError = document.querySelector(".text-red-500");
        if (firstError) {
          firstError.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
      return;
    }

    const fullValidation = naturalFormSchema.safeParse(formData);
    if (!fullValidation.success) {
      const allErrors: Record<string, string> = {};
      fullValidation.error.issues.forEach(err => {
        const path = err.path.join(".");
        allErrors[path] = err.message;
      });
      setErrors(allErrors);
      alert("Por favor corrija los errores en el formulario antes de continuar.");
      return;
    }

    setIsSubmitting(true);

    const newId = "NAT-" + Math.floor(100000 + Math.random() * 900000);
    const dateNow = new Date();

    try {
      const response = await fetch("/api/trpc/formDraft.submitForm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${draftToken}`,
        },
        body: JSON.stringify({}),
      });

      const result = await response.json();

      if (!response.ok) {
        const trpcError = result.error || result[0]?.error;
        if (trpcError) {
          const zodError = trpcError.data?.zodError;
          if (zodError && zodError.issues) {
            const allErrors: Record<string, string> = {};
            zodError.issues.forEach((err: any) => {
              const path = err.path.join(".");
              allErrors[path] = err.message;
            });
            setErrors(allErrors);
            alert("El servidor detectó errores de validación. Por favor, revíselos.");
          } else {
            alert(`Error al enviar el expediente: ${trpcError.message}`);
          }
        } else {
          alert("Error al enviar el expediente.");
        }
        setIsSubmitting(false);
        return;
      }

      const data = result.result?.data;
      if (!data || !data.success) {
        throw new Error(data?.message || "Error al procesar el envío en el servidor.");
      }

      const submissionId = data.submissionId || newId;

      const submission = {
        id: submissionId,
        type: "natural",
        clientName: `${formData.firstName || ""} ${formData.lastName || ""}`.trim() || "Cliente Natural",
        projectName: formData.nombreProyecto || "General UDG",
        submittedAt: dateNow.toISOString(),
        status: "Enviado",
        data: { ...formData }
      };

      const existing = JSON.parse(localStorage.getItem("udg_submissions") || "[]");
      existing.push(submission);
      localStorage.setItem("udg_submissions", JSON.stringify(existing));

      setSubmittedData(formData);
      setSubmissionId(submissionId);
      setSubmissionDate(dateNow.toLocaleString());
      setIsSubmitted(true);

      localStorage.removeItem("udg_due_diligence_natural_token");
      localStorage.removeItem("udg_due_diligence_natural");
      setFormData(INITIAL_FORM_STATE);
      setLastSaved(null);
      setSaveStatus("idle");
    } catch (e: any) {
      console.error("Error saving submission:", e);
      alert(e.message || "Error al enviar el formulario a la base de datos.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isMounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#002b49] text-white">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#c8a788] border-t-transparent mx-auto mb-4"></div>
          <p className="text-zinc-400 font-serif tracking-widest text-xs uppercase">Cargando Portal de Debida Diligencia...</p>
        </div>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-[#002b49] text-white flex flex-col justify-between selection:bg-[#c8a788]/30 font-sans">
        <Header isSaving={false} lastSaved={null} />
        <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-16 flex flex-col justify-center">
          <div className="bg-white rounded-3xl p-8 md:p-12 shadow-2xl border border-zinc-200 text-zinc-900 text-center space-y-6 animate-scaleIn">
            <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl md:text-3xl font-serif font-light text-[#002b49] tracking-wide">
                Expediente Enviado
              </h2>
              <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
                Tu registro de Debida Diligencia ha sido formalizado y guardado con éxito. Un oficial de cumplimiento revisará tu documentación a la brevedad.
              </p>
            </div>

            <div className="bg-[#f4f6f8] border border-zinc-250 rounded-2xl p-6 text-left text-xs text-zinc-700 space-y-3 font-sans max-w-md mx-auto">
              <div className="flex justify-between border-b border-zinc-200 pb-2">
                <span className="font-semibold text-zinc-500">ID del Expediente:</span>
                <span className="font-bold text-[#002b49]">{submissionId}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-200 pb-2">
                <span className="font-semibold text-zinc-500">Cliente:</span>
                <span className="font-bold text-[#002b49]">
                  {submittedData?.firstName} {submittedData?.lastName}
                </span>
              </div>
              <div className="flex justify-between border-b border-zinc-200 pb-2">
                <span className="font-semibold text-zinc-500">Proyecto:</span>
                <span className="font-bold text-[#002b49]">{submittedData?.nombreProyecto}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-200 pb-2">
                <span className="font-semibold text-zinc-500">Fecha de Envío:</span>
                <span className="font-bold text-[#002b49]">{submissionDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-zinc-500">Estado de Envío:</span>
                <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold">
                  ENVIADO
                </span>
              </div>
            </div>

            <div className="pt-6 flex flex-col sm:flex-row gap-4 justify-center">
              <button
                type="button"
                onClick={() => {
                  if (submittedData) {
                    generatePDF("natural", submittedData, submissionId, new Date().toLocaleDateString());
                  }
                }}
                className="bg-gradient-to-r from-[#c8a788] to-yellow-600 hover:shadow-lg hover:shadow-[#c8a788]/20 text-zinc-950 px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer active:scale-95 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Descargar Resumen PDF
              </button>

              <Link
                href="/"
                className="border border-zinc-300 hover:border-zinc-400 text-zinc-650 hover:text-zinc-800 px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2"
              >
                Volver al Hub UDG
              </Link>
            </div>
          </div>
        </main>
        <footer className="border-t border-zinc-900/60 bg-black/30 py-8 text-center text-xs text-zinc-500">
          <p className="font-serif text-[11px] font-medium tracking-[0.1em] text-zinc-300">
            URBAN DEVELOPMENT GROUP (UDG)
          </p>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#002b49] text-[#1a1c1a] flex flex-col justify-between selection:bg-[#c8a788]/30 selection:text-white font-sans">
      
      {/* Editorial Header */}
      <Header isSaving={saveStatus === "saving"} lastSaved={lastSaved} saveStatus={saveStatus} />

      {/* Primary Layout Wrapper */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-12 flex flex-col justify-center">
        
        {/* Step 0: POLICIES SCREEN */}
        {currentStep === 0 && (
          <PoliciesScreen 
            lastSaved={lastSaved}
            onClearDraft={handleClearDraft}
            onContinue={() => setCurrentStep(1)}
          />
        )}

        {/* Step 1 to 4: MULTI-STEP NATURAL FORM */}
        {currentStep > 0 && (
          <div className="w-full animate-fadeIn">
            
            {/* Back to welcome hub */}
            <div className="mb-6 flex justify-start">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-xs font-semibold text-[#c8a788] hover:text-white transition tracking-wider uppercase bg-[#081827] border border-[#c8a788]/20 px-4 py-2 rounded-lg shadow-md cursor-pointer hover:shadow-lg hover:shadow-[#c8a788]/5 select-none"
              >
                <span>← Volver a la Selección</span>
              </Link>
            </div>
            
            {/* Section Indicator Breadcrumb */}
            <FormStepper 
              currentStep={currentStep}
              onStepClick={(stepNum) => setCurrentStep(stepNum)}
              isStepValid={isStepValid}
            />

            {/* Main Form Fields Container */}
            <div className="space-y-8">
              {currentStep === 1 && (
                <Step1DatosPersonales 
                  formData={formData}
                  onInputChange={handleInputChange}
                  onSearchableSelectChange={handleSearchableSelectChange}
                  errors={errors}
                />
              )}

              {currentStep === 2 && (
                <Step2PerfilFinanciero 
                  formData={formData}
                  onInputChange={handleInputChange}
                  onSearchableSelectChange={handleSearchableSelectChange}
                  errors={errors}
                />
              )}

              {currentStep === 3 && (
                <Step3PerfilFinanciero 
                  formData={formData}
                  onInputChange={handleInputChange}
                  errors={errors}
                />
              )}

              {currentStep === 4 && (
                <Step3Documentos 
                  formData={formData}
                  uploadStatus={uploadStatus}
                  uploadProgress={uploadProgress}
                  onFileUploadSimulated={handleFileUploadSimulated}
                  onRemoveFile={handleRemoveFile}
                  onInputChange={handleInputChange}
                  errors={errors}
                />
              )}

              {currentStep === 5 && (
                <Step4FirmaDeclaracion 
                  formData={formData}
                  onInputChange={handleInputChange}
                  errors={errors}
                />
              )}

              {/* Form Navigation Controls */}
              <NavigationButtons 
                currentStep={currentStep}
                lastSaved={lastSaved}
                isStepValid={isStepValid}
                onPrevStep={() => setCurrentStep(prev => prev - 1)}
                onNextStep={handleNextStep}
                onClearDraft={handleClearDraft}
                onSubmit={handleSubmit}
              />
            </div>
          </div>
        )}

      </main>

      {/* Luxury Brand Footer */}
      <footer className="border-t border-zinc-900/60 bg-black/30 py-8 text-center text-xs text-zinc-500 font-sans text-white">
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
