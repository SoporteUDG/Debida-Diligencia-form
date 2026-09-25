"use client";

import Link from "next/link";
import Image from "next/image";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useErrorTranslator, useTranslatedErrors } from "@/i18n/translateError";
import { FormState, INITIAL_FORM_STATE } from "@/types/persona-natural";

import dynamic from "next/dynamic";
import Header from "@/components/persona-natural/Header";
import PoliciesScreen from "@/components/persona-natural/PoliciesScreen";
import FormStepper from "@/components/persona-natural/FormStepper";
import AccessRestricted from "@/components/AccessRestricted";
import BlockedAccess from "@/components/BlockedAccess";
import { FORM_TYPE_HEADER, tokenReasonFromResponse, type TokenFailureReason } from "@/lib/tokenAccess";

const Step1DatosPersonales = dynamic(() => import("@/components/persona-natural/Step1DatosPersonales"), { ssr: false });
const Step2PerfilFinanciero = dynamic(() => import("@/components/persona-natural/Step2PerfilFinanciero"), { ssr: false });
const Step3PerfilFinanciero = dynamic(() => import("@/components/persona-natural/Step3PerfilFinanciero"), { ssr: false });
const Step3Documentos = dynamic(() => import("@/components/persona-natural/Step3Documentos"), { ssr: false });
const Step4FirmaDeclaracion = dynamic(() => import("@/components/persona-natural/Step4FirmaDeclaracion"), { ssr: false });

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
import { borrarDatosRL, guardarDatosRL, mapearNaturalARL } from "@/lib/datosRepresentanteLegal";

const getStepForField = (field: string): number => {
  const step1Fields = [
    "nombreProyecto", "formaContacto", "firstName", "lastName", "paisNacimiento", "paisResidenciaFiscal", "idTributaria", "nationality", "tipoIdentificacion", "otraNacionalidad", "idNumber", "estatusMigratorio", "fechaNacimiento",
    "direccionResidencial", "ciudad", "provinciaEstado", "paisResidencial", "email", "telefonoCodigo", "telefono", "celularCodigo", "celular", "profession", "profesionOtros", "paisActividadLaboral", "employer", "actividadLaboral", "actividadLaboralOtros", "direccionLaboral", "cargoDesempena", "actEconPrincipal", "pctDedicacionPrincipal", "jurisdiccionPrincipal", "actEconSecundaria", "pctDedicacionSecundaria", "jurisdiccionSecundaria",
    "ingresosMensuales", "medioPago", "fuenteFondosInmueble", "montoServiciosAnuales", "adquiereNombreTercero", "destinoInmueble", "esPep", "pepNombre", "pepCargo", "pepInstitucion", "pepRelacion"
  ];
  const step2Fields = ["idFile", "proofAddressFile", "origenFondosFile", "hasEstadoCuenta", "hasCertificacionBancaria", "otrosAdjuntosFile"];
  const step3Fields = ["termsAccepted", "signatureConfirmed", "signerName", "signatureDate", "firmaImage"];

  if (step1Fields.includes(field)) return 1;
  if (step2Fields.includes(field)) return 2;
  if (step3Fields.includes(field)) return 3;
  return 1;
};

interface ValidationSummaryItem {
  step: number;
  message: string;
}

const groupByStep = (items: ValidationSummaryItem[]) => {
  const groups: Record<number, ValidationSummaryItem[]> = {};
  items.forEach(item => {
    if (!groups[item.step]) {
      groups[item.step] = [];
    }
    groups[item.step].push(item);
  });
  return groups;
};

// Document slots that hold several files (array of file names)
const MULTI_FILE_FIELDS: (keyof FormState)[] = ["origenFondosFile", "hasEstadoCuenta"];

const normalizeFormData = (dbData: any): FormState => {
  const normalized = { ...INITIAL_FORM_STATE, ...dbData };
  for (const key of Object.keys(normalized)) {
    if ((normalized as any)[key] === null || (normalized as any)[key] === undefined) {
      (normalized as any)[key] = (INITIAL_FORM_STATE as any)[key] ?? "";
    }
  }
  // Older drafts stored these as a single string; coerce to array
  for (const key of MULTI_FILE_FIELDS) {
    const val = (normalized as any)[key];
    if (typeof val === "string") (normalized as any)[key] = val ? [val] : [];
  }
  return normalized;
};

export default function PersonaNaturalPage() {
  const t = useTranslations("NaturalForm");
  const tp = useTranslations("NaturalForm.Page");

  const getStepName = (step: number): string => {
    switch (step) {
      case 1: return tp("StepNamePersonalData");
      case 2: return tp("StepNameAddressProfession");
      case 3: return tp("StepNameFinancialPep");
      case 4: return tp("StepNameDocuments");
      case 5: return tp("StepNameSignature");
      default: return tp("StepNameDefault");
    }
  };
  const [formData, setFormData] = useLocalStorage<FormState>("udg_due_diligence_natural", INITIAL_FORM_STATE);
  const [currentStep, setCurrentStep] = useState(0); // Step 0 is policies screen
  const [isMounted, setIsMounted] = useState(false);
  const [draftToken, setDraftToken] = useState<string | null>(null);
  // Acceso del enlace: se confirma con getDraft antes de mostrar el formulario
  const [accessStatus, setAccessStatus] = useState<"checking" | "granted" | TokenFailureReason>("checking");

  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadStatus, setUploadStatus] = useState<Record<string, "idle" | "uploading" | "success">>({});

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedData, setSubmittedData] = useState<FormState | null>(null);
  const [submissionId, setSubmissionId] = useState("");
  const [submissionDate, setSubmissionDate] = useState("");
  const [submittedDocuments, setSubmittedDocuments] = useState<any[]>([]);
  const [pendingOptionalFields, setPendingOptionalFields] = useState<{ key: string; label: string; step: number }[] | null>(null);
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationSummary, setValidationSummary] = useState<{ step: number; message: string }[] | null>(null);
  // Los mensajes de validación se guardan en español; solo se traducen al mostrarlos
  const shownErrors = useTranslatedErrors(errors);
  const translateError = useErrorTranslator();

  // Versión del servidor retenida cuando hay conflicto de concurrencia.
  // El formulario NO se toca hasta que el usuario elija qué conservar.
  const [conflictoBorrador, setConflictoBorrador] = useState<{ data: any; step: number; updatedAt: string } | null>(null);

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
      }

      if (token && !token.startsWith("draft-nat-")) {
        setDraftToken(token);
      } else {
        setDraftToken(null);
      }

      // Lock history so user cannot accidentally navigate back to selection hub
      window.history.pushState(null, "", window.location.href);
      const handlePopState = () => {
        window.history.pushState(null, "", window.location.href);
      };
      window.addEventListener("popstate", handlePopState);
      return () => {
        window.removeEventListener("popstate", handlePopState);
      };
    }
  }, []);

  // Hook up custom autosave hook
  const { status: saveStatus, lastSaved, setStatus: setSaveStatus, setLastSaved, lastSavedAtRef, forceSave } = useAutosave({
    data: formData,
    type: "natural",
    step: currentStep,
    draftToken: accessStatus === "granted" ? draftToken : null,
    onConflict: (dbData, dbStep, dbUpdatedAt) => {
      // Nunca se sobrescribe lo que el usuario tiene en pantalla: se retiene la
      // versión del servidor y se le pide que decida.
      console.warn("[Natural Page] Conflicto de concurrencia detectado. Se conservan los cambios locales.");
      setConflictoBorrador({ data: dbData, step: dbStep, updatedAt: dbUpdatedAt });
    }
  });

  /** Conserva lo que hay en pantalla y lo guarda pisando la versión del servidor. */
  const conservarCambiosLocales = async () => {
    setConflictoBorrador(null);
    await forceSave();
  };

  /** Descarta los cambios locales y carga la versión guardada en el servidor. */
  const usarVersionDelServidor = () => {
    if (!conflictoBorrador) return;
    setFormData(normalizeFormData(conflictoBorrador.data));
    setCurrentStep(conflictoBorrador.step);
    if (lastSavedAtRef) {
      lastSavedAtRef.current = conflictoBorrador.updatedAt;
    }
    setLastSaved(new Date(conflictoBorrador.updatedAt).toLocaleTimeString());
    setSaveStatus("saved");
    setConflictoBorrador(null);
  };

  // Load draft from database on mount or when token is loaded
  useEffect(() => {
    if (!draftToken || !isMounted) return;

    const loadDraftFromDb = async () => {
      try {
        const response = await fetch("/api/trpc/getDraft", {
          headers: {
            "Authorization": `Bearer ${draftToken}`,
            [FORM_TYPE_HEADER]: "NATURAL",
          },
        });

        const resJson = await response.json().catch(() => null);

        // Enlace usado, revocado, vencido o de otro formulario: no se muestra el formulario
        const reason = tokenReasonFromResponse(resJson);
        if (reason) {
          // Un enlace ya utilizado se conserva para seguir mostrando "Formulario ya completado"
          if (reason !== "USED") localStorage.removeItem("udg_due_diligence_natural_token");
          setAccessStatus(reason);
          return;
        }
        setAccessStatus("granted");

        if (response.ok && resJson) {
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
        setAccessStatus("granted");
      }
    };

    loadDraftFromDb();
  }, [draftToken, isMounted]);

  // Guarda (o borra) en este navegador los datos reutilizables como
  // Representante Legal en el formulario de Persona Jurídica.
  const datosRLSerializados = JSON.stringify(mapearNaturalARL(formData));
  useEffect(() => {
    // Tras el envío el formulario se reinicia; no debe borrar lo ya guardado.
    if (!isMounted || isSubmitted) return;
    if (formData.compartirDatosRL) {
      guardarDatosRL(formData);
    } else {
      borrarDatosRL();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, isSubmitted, formData.compartirDatosRL, datosRLSerializados]);

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
    setFormData(prev => {
      const updated = {
        ...prev,
        [fieldName]: value,
      };

      // Especial to Clear selection when hidding fields based on other selections (Es propietario o no)
      if (fieldName === "esPropietario" && value === "No") {
        updated.usaFondos = "No";
      }

      return updated;
    });

    if (errors[fieldName]) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy[fieldName];
        return copy;
      });
    }

  };

  const handleFileUpload = (fieldName: keyof FormState, file: File) => {
    setUploadStatus(prev => ({ ...prev, [fieldName]: "uploading" }));
    setUploadProgress(prev => ({ ...prev, [fieldName]: 10 }));

    // Start a smooth visual progress simulation while upload happens
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        const current = prev[fieldName] || 10;
        if (current >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return { ...prev, [fieldName]: current + 15 };
      });
    }, 200);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const base64Data = (reader.result as string).split(",")[1];
        
        const response = await fetch("/api/trpc/documents.uploadDocument", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${draftToken}`,
            [FORM_TYPE_HEADER]: "NATURAL",
          },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            fileData: base64Data,
            documentType: fieldName,
            draftId: draftToken,
          }),
        });

        const resJson = await response.json();
        clearInterval(progressInterval);

        if (!response.ok) {
          const errMsg = resJson.error?.message || tp("UploadError");
          throw new Error(errMsg);
        }

        const data = resJson.result?.data;
        if (!data || !data.document) {
          throw new Error(tp("InvalidServerResponse"));
        }

        // El servidor ya guardó el nombre en el borrador: sincronizar la marca
        // de tiempo para que el siguiente autoguardado no dé falso conflicto
        // (y descarte los archivos recién subidos).
        if (data.draftUpdatedAt && lastSavedAtRef) {
          lastSavedAtRef.current = data.draftUpdatedAt;
        }

        // Set success states
        setUploadProgress(prev => ({ ...prev, [fieldName]: 100 }));
        if (MULTI_FILE_FIELDS.includes(fieldName)) {
          setFormData(prev => ({
            ...prev,
            [fieldName]: [...((prev[fieldName] as string[]) || []), data.document.name],
          }));
          // Back to idle (skip "success") so the upload button reappears
          // immediately and the user can keep adding files.
          setUploadStatus(prev => ({ ...prev, [fieldName]: "idle" }));
        } else {
          setUploadStatus(prev => ({ ...prev, [fieldName]: "success" }));
          setFormData(prev => ({ ...prev, [fieldName]: data.document.name }));
        }
        setErrors(prev => {
          const copy = { ...prev };
          delete copy[fieldName];
          return copy;
        });

      } catch (error: any) {
        clearInterval(progressInterval);
        console.error("[Natural Page] Error uploading file:", error);
        setUploadStatus(prev => ({ ...prev, [fieldName]: "idle" }));
        setUploadProgress(prev => ({ ...prev, [fieldName]: 0 }));
        setErrors(prev => ({ ...prev, [fieldName]: error.message || tp("UploadFailedField") }));
        alert(error.message || tp("UploadFailed"));
      }
    };
    reader.onerror = () => {
      clearInterval(progressInterval);
      setUploadStatus(prev => ({ ...prev, [fieldName]: "idle" }));
      setUploadProgress(prev => ({ ...prev, [fieldName]: 0 }));
      alert(tp("ReadLocalFileError"));
    };
  };

  const handleRemoveFile = async (fieldName: keyof FormState, fileName?: string) => {
    const isMultiField = MULTI_FILE_FIELDS.includes(fieldName);
    const hadFile = isMultiField && fileName
      ? ((formData[fieldName] as string[]) || []).includes(fileName)
      : !!formData[fieldName];
    if (!hadFile) return;

    if (confirm(tp("ConfirmDeleteDocument"))) {
      try {
        setUploadStatus(prev => ({ ...prev, [fieldName]: "uploading" }));
        setUploadProgress(prev => ({ ...prev, [fieldName]: 50 }));

        const response = await fetch("/api/trpc/documents.deleteDocument", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${draftToken}`,
            [FORM_TYPE_HEADER]: "NATURAL",
          },
          body: JSON.stringify({
            draftId: draftToken,
            fieldName: fieldName,
            ...(isMultiField && fileName ? { fileName } : {}),
          }),
        });

        const resJson = await response.json();
        if (!response.ok) {
          throw new Error(resJson.error?.message || tp("DeleteError"));
        }

        // El borrado también modifica el borrador en el servidor: sin esta
        // sincronización el siguiente autoguardado daría conflicto.
        const deleteData = resJson.result?.data;
        if (deleteData?.draftUpdatedAt && lastSavedAtRef) {
          lastSavedAtRef.current = deleteData.draftUpdatedAt;
        }

        // Reset states on success
        if (isMultiField && fileName) {
          setFormData(prev => ({
            ...prev,
            [fieldName]: ((prev[fieldName] as string[]) || []).filter(f => f !== fileName),
          }));
        } else {
          setFormData(prev => ({ ...prev, [fieldName]: isMultiField ? [] : "" }));
        }
        setUploadStatus(prev => ({ ...prev, [fieldName]: "idle" }));
        setUploadProgress(prev => ({ ...prev, [fieldName]: 0 }));

      } catch (error: any) {
        console.error("[Natural Page] Error deleting file:", error);
        setUploadStatus(prev => ({ ...prev, [fieldName]: "success" }));
        setUploadProgress(prev => ({ ...prev, [fieldName]: 100 }));
        alert(error.message || tp("DeleteFailed"));
      }
    }
  };

  const handleClearDraft = async () => {
    if (confirm(tp("ConfirmClearDraft"))) {
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
    else return false;

    return schema.safeParse(formData).success;
  };

  const validateStep = (step: number): boolean => {
    if (step === 0) return true;
    let schema;
    if (step === 1) schema = naturalStep1Schema;
    else if (step === 2) schema = naturalStep2Schema;
    else if (step === 3) schema = naturalStep3Schema;
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
        const errorElements = document.querySelectorAll(".text-red-500");
        const firstError = Array.from(errorElements).find(element =>
          element.textContent?.includes("⚠️")
        );
        console.log("Scrolling to first error:", firstError, currentStep);
        if (firstError) {
          firstError.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    }
  };

  const handleSubmit = async () => {
    const isFinalValid = validateStep(3);
    if (!isFinalValid) {
      setTimeout(() => {
        const errorElements = document.querySelectorAll(".text-red-500");
        const firstError = Array.from(errorElements).find(element =>
          element.textContent?.includes("⚠️")
        );
        if (firstError) {
          firstError.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
      return;
    }

    const fullValidation = naturalFormSchema.safeParse(formData);
    if (!fullValidation.success) {
      const allErrors: Record<string, string> = {};
      const summaryItems: { step: number; message: string }[] = [];

      fullValidation.error.issues.forEach(err => {
        const path = err.path.join(".");
        allErrors[path] = err.message;
        
        const fieldName = err.path[0] as string;
        const stepNum = getStepForField(fieldName);
        summaryItems.push({
          step: stepNum,
          message: err.message,
        });
      });

      setErrors(allErrors);
      setValidationSummary(summaryItems);
      return;
    }


    // Check for empty optional fields to present warning
    const optionalFieldsToCheck = [
      { key: "formaContacto", label: tp("OptionalFormaContacto"), step: 1 },
      { key: "paisResidenciaFiscal", label: tp("OptionalPaisResidenciaFiscal"), step: 1 },
      { key: "idTributaria", label: tp("OptionalIdTributaria"), step: 1 },
      { key: "otraNacionalidad", label: tp("OptionalOtraNacionalidad"), step: 1 },
      { key: "estatusMigratorio", label: tp("OptionalEstatusMigratorio"), step: 1 },
      { key: "ciudad", label: tp("OptionalCiudad"), step: 1 },
      { key: "provinciaEstado", label: tp("OptionalProvinciaEstado"), step: 1 },
      { key: "telefono", label: tp("OptionalTelefono"), step: 1 },
      { key: "direccionLaboral", label: tp("OptionalDireccionLaboral"), step: 1 },
      { key: "cargoDesempena", label: tp("OptionalCargoDesempena"), step: 1 },
      { key: "actEconPrincipal", label: tp("OptionalActEconPrincipal"), step: 1 },
      { key: "actEconSecundaria", label: tp("OptionalActEconSecundaria"), step: 1 },
      { key: "origenFondosFile", label: tp("OptionalOrigenFondosFile"), step: 2 },
    ];

    if (formData.esPep === "Sí") {
      optionalFieldsToCheck.push(
        { key: "pepNombre", label: tp("OptionalPepNombre"), step: 1 },
        { key: "pepCargo", label: tp("OptionalPepCargo"), step: 1 },
        { key: "pepInstitucion", label: tp("OptionalPepInstitucion"), step: 1 },
        { key: "pepRelacion", label: tp("OptionalPepRelacion"), step: 1 }
      );
    }

    const emptyOptionals = optionalFieldsToCheck.filter(field => {
      const val = formData[field.key as keyof FormState];
      if (Array.isArray(val)) return val.filter(f => typeof f === "string" && f.trim() !== "").length === 0;
      return !val || (typeof val === "string" && val.trim() === "");
    });

    if (emptyOptionals.length > 0) {
      setPendingOptionalFields(emptyOptionals);
      return;
    }

    await executeSubmission();
  };

  const executeSubmission = async () => {
    setPendingOptionalFields(null);
    setIsSubmitting(true);

    const newId = "NAT-" + Math.floor(100000 + Math.random() * 900000);
    const dateNow = new Date();

    try {
      // Fetch documents list for PDF merging before submitting and clearing tokens
      try {
        const docsResponse = await fetch("/api/trpc/documents.getDraftDocuments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${draftToken}`,
            [FORM_TYPE_HEADER]: "NATURAL",
          },
          body: JSON.stringify({ draftId: draftToken }),
        });
        const docsResJson = await docsResponse.json();
        const docsList = docsResJson.result?.data?.documents || [];
        setSubmittedDocuments(docsList);
      } catch (docsErr) {
        console.error("Error fetching documents before submit:", docsErr);
      }

      const response = await fetch("/api/trpc/formDraft.submitForm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${draftToken}`,
          [FORM_TYPE_HEADER]: "NATURAL",
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
            alert(tp("ServerValidationErrors"));
          } else {
            alert(tp("SubmitErrorWithMessage", { message: trpcError.message }));
          }
        } else {
          alert(tp("SubmitError"));
        }
        setIsSubmitting(false);
        return;
      }

      const data = result.result?.data;
      if (!data || !data.success) {
        throw new Error(data?.message || tp("ServerProcessingError"));
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

      // Persistir los datos reutilizables como Representante Legal antes de
      // reiniciar el formulario.
      if (formData.compartirDatosRL) {
        guardarDatosRL(formData);
      }

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
      alert(e.message || tp("DatabaseSubmitError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadingScreen = (
      <div className="flex min-h-screen items-center justify-center bg-[#002b49] text-white">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#c8a788] border-t-transparent mx-auto mb-4"></div>
          <p className="text-zinc-400 font-serif tracking-widest text-xs uppercase">{tp("LoadingPortal")}</p>
        </div>
      </div>
  );

  if (!isMounted) {
    return loadingScreen;
  }

  if (!draftToken) {
    return <AccessRestricted />;
  }

  if (accessStatus === "checking") {
    return loadingScreen;
  }

  if (accessStatus !== "granted") {
    return <BlockedAccess reason={accessStatus} header={<Header isSaving={false} lastSaved={null} />} />;
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-[#052B48] text-white flex flex-col justify-between selection:bg-[#DAB38D]/30 font-sans">
        <Header isSaving={false} lastSaved={null} />
        <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-16 flex flex-col justify-center">
          <div className="bg-[#faf9f6] rounded-3xl p-8 md:p-12 shadow-2xl border-t-4 border-[#DAB38D] text-zinc-900 text-center space-y-6 animate-scaleIn">
            <div className="mx-auto w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-md">
              <svg className="w-9 h-9" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <div className="space-y-3">
              <h2 className="text-3xl md:text-4xl font-serif font-light text-[#052B48] tracking-wide">
                {tp("SuccessTitle")}
              </h2>
              <p className="text-xs md:text-sm text-zinc-600 max-w-lg mx-auto leading-relaxed">
                {tp("SuccessMessage")}
              </p>
            </div>

            <div className="bg-white border border-zinc-200 rounded-2xl p-6 text-left text-xs text-zinc-700 space-y-3.5 font-sans max-w-md mx-auto shadow-sm">
              <div className="flex justify-between border-b border-zinc-150 pb-2.5">
                <span className="font-medium text-zinc-500">{tp("SubmissionIdLabel")}</span>
                <span className="font-bold text-[#052B48] select-all font-mono">{submissionId}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-150 pb-2.5">
                <span className="font-medium text-zinc-500">{tp("ClientLabel")}</span>
                <span className="font-bold text-[#052B48]">
                  {submittedData?.firstName} {submittedData?.lastName}
                </span>
              </div>
              <div className="flex justify-between border-b border-zinc-150 pb-2.5">
                <span className="font-medium text-zinc-500">{tp("ProjectLabel")}</span>
                <span className="font-bold text-[#052B48]">{submittedData?.nombreProyecto || tp("DefaultProject")}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-zinc-500">{tp("SubmissionDateLabel")}</span>
                <span className="font-bold text-[#052B48]">{submissionDate}</span>
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center">
              <button
                type="button"
                onClick={() => {
                  if (submittedData) {
                    generatePDF("natural", submittedData, submissionId, new Date().toLocaleDateString(), submittedDocuments, draftToken);
                  }
                }}
                className="bg-[#DAB38D] hover:bg-[#c9a27c] text-zinc-950 font-semibold px-8 py-3.5 rounded-xl shadow-lg transition-all duration-300 active:scale-[0.98] cursor-pointer text-sm font-sans flex items-center justify-center gap-2.5"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {tp("DownloadPdf")}
              </button>
            </div>
          </div>
        </main>
        <footer className="border-t border-zinc-800/40 bg-black/30 py-6 text-center text-xs text-zinc-400">
          <p className="font-sans text-[11px] font-normal tracking-wider text-zinc-400">
            {tp("Copyright", { year: new Date().getFullYear() })}
          </p>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#002b49] text-[#1a1c1a] flex flex-col justify-between selection:bg-[#c8a788]/30 selection:text-white font-sans">
      
      {/* Editorial Header */}
      <Header isSaving={saveStatus === "saving"} lastSaved={lastSaved} saveStatus={saveStatus} />

      {/* Aviso de conflicto de concurrencia: los datos en pantalla se conservan */}
      {conflictoBorrador && (
        <div className="sticky top-20 md:top-24 z-40 bg-amber-500/15 border-y border-amber-400/40 backdrop-blur-md animate-fadeIn">
          <div className="max-w-5xl mx-auto px-6 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-xs leading-relaxed text-amber-100">
              <p className="font-bold text-amber-200 uppercase tracking-wider text-[11px] mb-1">
                {tp("ConflictTitle")}
              </p>
              <p>
                {tp("ConflictModified")}
                {conflictoBorrador.updatedAt && (
                  <> {tp("ConflictServerVersion", { time: new Date(conflictoBorrador.updatedAt).toLocaleTimeString() })}</>
                )}
                . <span className="font-semibold">{tp("ConflictChangesKept")}</span> {tp("ConflictChooseVersion")}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={usarVersionDelServidor}
                className="rounded-lg border border-amber-300/50 px-3 py-2 text-[11px] font-semibold text-amber-100 transition hover:bg-amber-400/10 cursor-pointer"
              >
                {tp("ConflictUseServer")}
              </button>
              <button
                type="button"
                onClick={conservarCambiosLocales}
                className="rounded-lg bg-[#c8a788] px-3 py-2 text-[11px] font-bold text-[#052B48] transition hover:bg-[#d8bb9f] cursor-pointer"
              >
                {tp("ConflictKeepLocal")}
              </button>
            </div>
          </div>
        </div>
      )}

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
            
            {/* Section Indicator Breadcrumb */}
            <FormStepper 
              currentStep={currentStep}
              onStepClick={(stepNum) => setCurrentStep(stepNum)}
              isStepValid={isStepValid}
            />

            {/* Main Form Fields Container */}
            <div className="space-y-8">
              {currentStep === 1 && (
                <div className="space-y-12">
                  <div className="bg-white/5 p-6 rounded-3xl border border-zinc-800 space-y-4">
                    <h2 className="text-[#c8a788] text-sm font-bold uppercase tracking-wider border-b border-zinc-850 pb-2">
                      {t("BigTitleStep1")}
                    </h2>
                    <Step1DatosPersonales 
                      formData={formData}
                      onInputChange={handleInputChange}
                      onSearchableSelectChange={handleSearchableSelectChange}
                      errors={shownErrors}
                    />
                  </div>
                  
                  <div className="bg-white/5 p-6 rounded-3xl border border-zinc-800 space-y-4">
                    <h2 className="text-[#c8a788] text-sm font-bold uppercase tracking-wider border-b border-zinc-850 pb-2">
                      {t("BigTitleStep2")}
                    </h2>
                    <Step2PerfilFinanciero 
                      formData={formData}
                      onInputChange={handleInputChange}
                      onSearchableSelectChange={handleSearchableSelectChange}
                      errors={shownErrors}
                    />
                  </div>

                  <div className="bg-white/5 p-6 rounded-3xl border border-zinc-800 space-y-4">
                    <h2 className="text-[#c8a788] text-sm font-bold uppercase tracking-wider border-b border-zinc-850 pb-2">
                      {t("BigTitle3")}
                    </h2>
                    <Step3PerfilFinanciero 
                      formData={formData}
                      onInputChange={handleInputChange}
                      errors={shownErrors}
                      onSearchableSelectChange={handleSearchableSelectChange}
                    />
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <Step3Documentos 
                  formData={formData}
                  uploadStatus={uploadStatus}
                  uploadProgress={uploadProgress}
                  onFileUpload={handleFileUpload}
                  onRemoveFile={handleRemoveFile}
                  onInputChange={handleInputChange}
                  errors={shownErrors}
                />
              )}

              {currentStep === 3 && (
                <Step4FirmaDeclaracion 
                  formData={formData}
                  onInputChange={handleInputChange}
                  errors={shownErrors}
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
        <div className="max-w-6xl mx-auto px-6 flex flex-row items-center justify-center text-center gap-2">
          <Image src="/UDG_LOGO.png"
            alt={tp("LogoAlt")}
            width={60}
            height={30}
            className="object-contain h-8 md:h-8 w-auto opacity-50"
            priority
          />
          <p className="text-[10px] text-zinc-500">
            {tp("Copyright", { year: new Date().getFullYear() })}
          </p>
        </div>
      </footer>
      {/* Premium Validation Summary Modal */}
      {validationSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn animate-duration-200">
          <div className="bg-[#081b2a] border border-[#c8a788]/30 rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-sans">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-[#0b243b] to-[#081b2a] border-b border-[#c8a788]/20 flex justify-between items-center">
              <h3 className="text-sm font-semibold tracking-wider text-[#c8a788] uppercase">
                {tp("ValidationSummaryTitle")}
              </h3>
              <button 
                onClick={() => setValidationSummary(null)}
                className="text-zinc-400 hover:text-white transition cursor-pointer select-none text-lg"
              >
                ✕
              </button>
            </div>
            
            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <p className="text-xs text-zinc-300">
                {tp("ValidationSummaryIntro")}
              </p>
              
              {/* Render grouped errors */}
              {Object.entries(groupByStep(validationSummary)).map(([stepNum, items]) => (
                <div key={stepNum} className="bg-[#002b49]/40 border border-[#c8a788]/10 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold tracking-wider text-[#c8a788] uppercase">
                      {tp("StepHeading", { step: stepNum, name: getStepName(parseInt(stepNum)) })}
                    </span>
                    <button
                      onClick={() => {
                        setCurrentStep(parseInt(stepNum));
                        setValidationSummary(null);
                      }}
                      className="text-[10px] font-semibold text-[#c8a788] hover:underline cursor-pointer"
                    >
                      {tp("GoToStep")}
                    </button>
                  </div>
                  <ul className="list-disc pl-5 space-y-1">
                    {items.map((item, idx) => (
                      <li key={idx} className="text-xs text-zinc-300">
                        {translateError(item.message)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 bg-[#05131f] border-t border-[#c8a788]/10 flex justify-end">
              <button
                onClick={() => setValidationSummary(null)}
                className="bg-[#c8a788] hover:bg-[#b08e6f] text-[#002b49] text-xs font-bold px-6 py-3 rounded-lg transition tracking-wider uppercase shadow-md select-none cursor-pointer"
              >
                {tp("ValidationSummaryConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}
      {pendingOptionalFields && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn animate-duration-200">
          <div className="bg-[#081b2a] border border-[#c8a788]/30 rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-sans">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-[#0b243b] to-[#081b2a] border-b border-[#c8a788]/20 flex justify-between items-center">
              <h3 className="text-sm font-semibold tracking-wider text-[#c8a788] uppercase">
                {tp("OptionalFieldsTitle")}
              </h3>
              <button 
                onClick={() => setPendingOptionalFields(null)}
                className="text-zinc-400 hover:text-white transition cursor-pointer select-none text-lg"
              >
                ✕
              </button>
            </div>
            
            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <p className="text-xs text-zinc-300 leading-relaxed">
                {tp("OptionalFieldsIntro")}
              </p>
              
              {/* Render grouped optional fields */}
              {[1, 2, 3, 4].map(stepNum => {
                const stepItems = pendingOptionalFields.filter(f => f.step === stepNum);
                if (stepItems.length === 0) return null;
                return (
                  <div key={stepNum} className="bg-[#002b49]/40 border border-[#c8a788]/10 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold tracking-wider text-[#c8a788] uppercase">
                        {tp("StepHeading", { step: stepNum, name: getStepName(stepNum) })}
                      </span>
                      <button
                        onClick={() => {
                          setCurrentStep(stepNum);
                          setPendingOptionalFields(null);
                        }}
                        className="text-[10px] font-semibold text-[#c8a788] hover:underline cursor-pointer"
                      >
                        {tp("GoToStep")}
                      </button>
                    </div>
                    <ul className="list-disc pl-5 space-y-1">
                      {stepItems.map((item, idx) => (
                        <li key={idx} className="text-xs text-zinc-400">
                          {item.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 bg-[#05131f] border-t border-[#c8a788]/10 flex gap-4 justify-end">
              <button
                onClick={() => setPendingOptionalFields(null)}
                className="border border-zinc-500 hover:border-zinc-400 text-zinc-300 hover:text-white text-xs font-bold px-4 py-2.5 rounded-lg transition tracking-wider uppercase select-none cursor-pointer"
              >
                {tp("CompleteData")}
              </button>
              <button
                disabled={isSubmitting}
                onClick={() => {
                  executeSubmission();
                }}
                className="bg-[#c8a788] hover:bg-[#b08e6f] text-[#002b49] text-xs font-bold px-4 py-2.5 rounded-lg transition tracking-wider uppercase shadow-md select-none cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? tp("Submitting") : tp("SubmitAnyway")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
