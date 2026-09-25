"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useErrorTranslator, useTranslatedErrors } from "@/i18n/translateError";
import { BfMember, DocumentTarget, FormState, GjcMember, INITIAL_FORM_STATE } from "@/types/persona-juridica";

import { docKey, isDocumentUploaded, staticDocumentFields } from "@/components/persona-juridica/Step4Documentos";


import dynamic from "next/dynamic";
import Header from "@/components/persona-juridica/Header";
import PoliciesScreen from "@/components/persona-juridica/PoliciesScreen";
import FormStepper from "@/components/persona-juridica/FormStepper";
import AccessRestricted from "@/components/AccessRestricted";
import BlockedAccess from "@/components/BlockedAccess";
import { FORM_TYPE_HEADER, tokenReasonFromResponse, type TokenFailureReason } from "@/lib/tokenAccess";

const Step1Identificacion = dynamic(() => import("@/components/persona-juridica/Step1Identificacion"), { ssr: false });
const Step2GobiernoRL = dynamic(() => import("@/components/persona-juridica/Step2GobiernoRL"), { ssr: false });
const Step3Finanzas = dynamic(() => import("@/components/persona-juridica/Step3Finanzas"), { ssr: false });
const Step4Documentos = dynamic(() => import("@/components/persona-juridica/Step4Documentos"), { ssr: false });
const Step5Declaracion = dynamic(() => import("@/components/persona-juridica/Step5Declaracion"), { ssr: false });

import NavigationButtons from "@/components/persona-juridica/NavigationButtons";
import { generatePDF } from "@/lib/pdfGenerator";
import { 
  juridicaStep1Schema, 
  juridicaStep2Schema, 
  juridicaStep3Schema, 
  juridicaStep4Schema, 
  juridicaStep5Schema, 
  juridicaFormSchema 
} from "@/lib/validation";

import { useAutosave } from "@/hooks/useAutosave";
import { CAMPOS_RL, DatosRepresentanteLegal, leerDatosRL } from "@/lib/datosRepresentanteLegal";
import { MULTI_FILE_FIELDS_JURIDICA, normalizeMultiFileValue } from "@/lib/documentFields";

const getStepForField = (field: string): number => {
  const step1Fields = [
    "nombreProyecto", "formaContacto", "razonSocial", "tipoSociedad", "tipoCliente", "tipoDocumentoIdentidad", "actividadPrincipal", "numeroDocumento", "numeroIdTributaria", "paisTributacion", "porcentajeActividad", "fechaConstitucion", "paisOpera", "paisInscripcion", "fechaNacimiento", "contactoNombre", "contactoApellido", "contactoId", "contactoTelefono", "contactoEmail", "empresaDireccion", "empresaCiudad", "empresaProvincia", "empresaPais", "empresaTelefonoCodigo", "empresaTelefono", "empresaCelularCodigo", "empresaCelular", "empresaEmail",
    "rlNombre", "rlFechaNacimiento", "rlNacionalidad", "rlNoIdentificacion", "rlProfesionOcupacion", "rlActividadEconomica", "rlDireccion", "rlPaisResidencia", "rlTelefono", "rlObjetoInvestigacion", "gjcMembers",
    "bfMembers", "ingresosMensuales", "medioPago", "fuenteFondosInmueble", "terceroNombre", "terceroNacionalidad", "terceroVinculo", "terceroFuenteFondos", "adquiereMasUnidades", "cantidadUnidadesInmobiliarias", "montoServiciosAnuales", "esPep", "pepNombre", "pepCargo", "pepInstitucion", "pepRelacion", "actividadComercial", "origenFondos", "destinoFondos", "volumenVentas", "bancoReferencia"
  ];
  const step2Fields = ["avisoOperacionesFile", "copiaIdFile", "origenFondosFile", "pactoSocialFile", "serviciosPublicosFile", "certBancariaFile", "certRegistroFile"];
  const step3Fields = ["termsAccepted", "signatureConfirmed", "signerName", "signatureDate", "firmaImage"];

  if (step1Fields.some(f => field.startsWith(f))) return 1;
  if (step2Fields.some(f => field.startsWith(f))) return 2;
  if (step3Fields.some(f => field.startsWith(f))) return 3;
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

const normalizeFormData = (dbData: any): FormState => {
  const normalized = { ...INITIAL_FORM_STATE, ...dbData };
  for (const key of Object.keys(normalized)) {
    if ((normalized as any)[key] === null || (normalized as any)[key] === undefined) {
      (normalized as any)[key] = (INITIAL_FORM_STATE as any)[key] ?? "";
    }
  }
  // Borradores antiguos guardaron estos campos como "" o [""]; sin esta
  // normalización la lista de archivos se renderiza vacía.
  for (const key of MULTI_FILE_FIELDS_JURIDICA) {
    (normalized as any)[key] = normalizeMultiFileValue((normalized as any)[key]);
  }
  return normalized;
};

export default function PersonaJuridicaPage() {
  const t = useTranslations("JuridicaForm");
  const tp = useTranslations("JuridicaForm.Page");

  const getStepName = (step: number): string => {
    switch (step) {
      case 1: return tp("StepName1");
      case 2: return tp("StepName2");
      case 3: return tp("StepName3");
      case 4: return tp("StepName4");
      case 5: return tp("StepName5");
      default: return tp("StepNameDefault");
    }
  };
  const [formData, setFormData] = useLocalStorage<FormState>("udg_due_diligence_juridica", INITIAL_FORM_STATE);
  const [currentStep, setCurrentStep] = useState(0); // Step 0 is policies screen
  const [isMounted, setIsMounted] = useState(false);
  const [draftToken, setDraftToken] = useState<string | null>(null);
  // Acceso del enlace: se confirma con getDraft antes de mostrar el formulario
  const [accessStatus, setAccessStatus] = useState<"checking" | "granted" | TokenFailureReason>("checking");

  // Precarga del Representante Legal con los datos guardados en Persona Natural
  const [draftCargado, setDraftCargado] = useState(false);
  const [rlPrecargaEvaluada, setRlPrecargaEvaluada] = useState(false);
  const [avisoPrecargaRL, setAvisoPrecargaRL] = useState<DatosRepresentanteLegal | null>(null);

  // Simulated upload status for each document
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


  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      let token = searchParams.get("token") || searchParams.get("t");
      
      if (token) {
        localStorage.setItem("udg_due_diligence_juridica_token", token);
      } else {
        token = localStorage.getItem("udg_due_diligence_juridica_token");
      }

      if (token && !token.startsWith("draft-jur-")) {
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
    type: "juridica",
    step: currentStep,
    draftToken: accessStatus === "granted" ? draftToken : null,
    onConflict: (dbData, dbStep, dbUpdatedAt) => {
      // Nunca se sobrescribe lo que el usuario tiene en pantalla: se retiene la
      // versión del servidor y se le pide que decida.
      console.warn("[Juridica Page] Conflicto de concurrencia detectado. Se conservan los cambios locales.");
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
    if (!isMounted) return;
    if (!draftToken) {
      setDraftCargado(true);
      return;
    }

    const loadDraftFromDb = async () => {
      try {
        const response = await fetch("/api/trpc/getDraft", {
          headers: {
            "Authorization": `Bearer ${draftToken}`,
            [FORM_TYPE_HEADER]: "JURIDICA",
          },
        });

        const resJson = await response.json().catch(() => null);

        // Enlace usado, revocado, vencido o de otro formulario: no se muestra el formulario
        const reason = tokenReasonFromResponse(resJson);
        if (reason) {
          // Un enlace ya utilizado se conserva para seguir mostrando "Formulario ya completado"
          if (reason !== "USED") localStorage.removeItem("udg_due_diligence_juridica_token");
          setAccessStatus(reason);
          return;
        }
        setAccessStatus("granted");

        if (response.ok && resJson) {
          if (resJson.error) {
            console.error("[Juridica Page] Error loading draft from tRPC:", resJson.error);
            return;
          }

          const result = resJson.result?.data;
          if (result && result.exists) {
            console.log("[Juridica Page] Borrador encontrado y rehidratado desde base de datos:", result);
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
        console.error("[Juridica Page] Error fetching draft:", error);
        setAccessStatus("granted");
      } finally {
        setDraftCargado(true);
      }
    };

    loadDraftFromDb();
  }, [draftToken, isMounted]);

  // Precarga los campos del Representante Legal con los datos que el usuario
  // decidió guardar al completar el formulario de Persona Natural. Solo se
  // rellenan los campos vacíos, y nunca antes de rehidratar el borrador.
  useEffect(() => {
    if (!isMounted || !draftCargado || rlPrecargaEvaluada) return;

    setRlPrecargaEvaluada(true);

    const datos = leerDatosRL();
    if (!datos) return;

    const cambios: Partial<FormState> = {};
    for (const campo of CAMPOS_RL) {
      const actual = (formData[campo] || "").trim();
      if (!actual && datos[campo]) {
        cambios[campo] = datos[campo];
      }
    }

    if (Object.keys(cambios).length === 0) return;

    console.log("[Juridica Page] Datos del Representante Legal precargados desde Persona Natural:", cambios);
    setFormData(prev => ({ ...prev, ...cambios }));
    setAvisoPrecargaRL(datos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, draftCargado, rlPrecargaEvaluada]);

  const triggerSaveIndicator = () => {
    // No-op: useAutosave handles saving via debounce
  };

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
    triggerSaveIndicator();
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
    triggerSaveIndicator();
  };

  // Corporate Governance (GjcMember) management
  const handleAddGjcMember = () => {
    const newGjc: GjcMember = {
      id: crypto.randomUUID(),
      cargo: "",
      nombre: "",
      apellidos: "",
      nacionalidad: "",
      fechaNacimiento: "",
      nroId: "",
      direccion: "",
    };
    setFormData(prev => ({
      ...prev,
      gjcMembers: [...(prev.gjcMembers || []), newGjc]
    }));
    triggerSaveIndicator();
  };

  const handleRemoveGjcMember = (id: string) => {
    setFormData(prev => ({
      ...prev,
      gjcMembers: (prev.gjcMembers || []).filter(m => m.id !== id)
    }));
    setErrors(prev => {
      const copy = { ...prev };
      Object.keys(copy).forEach(k => {
        if (k.startsWith("gjcMembers")) {
          delete copy[k];
        }
      });
      return copy;
    });
    triggerSaveIndicator();
  };

  const handleGjcMemberChange = (id: string, field: keyof GjcMember, value: string) => {
    setFormData(prev => ({
      ...prev,
      gjcMembers: (prev.gjcMembers || []).map(m => m.id === id ? { ...m, [field]: value } : m)
    }));
    setErrors(prev => {
      const copy = { ...prev };
      Object.keys(copy).forEach(k => {
        if (k.startsWith("gjcMembers")) {
          delete copy[k];
        }
      });
      return copy;
    });
    triggerSaveIndicator();
  };

  // Beneficiario Final (BfMember) management
  const handleAddBfMember = () => {
    const newBf: BfMember = {
      id: crypto.randomUUID(),
      nombreCompleto: "",
      noIdentificacion: "",
      nacionalidad: "",
      fechaAdquisicion: "",
      porcentajeParticipacion: "",
      paisNacimiento: "",
      direccion: "",
    };
    setFormData(prev => ({
      ...prev,
      bfMembers: [...(prev.bfMembers || []), newBf]
    }));
    triggerSaveIndicator();
  };

  const handleRemoveBfMember = (id: string) => {
    setFormData(prev => ({
      ...prev,
      bfMembers: (prev.bfMembers || []).filter(m => m.id !== id)
    }));
    setErrors(prev => {
      const copy = { ...prev };
      Object.keys(copy).forEach(k => {
        if (k.startsWith("bfMembers")) {
          delete copy[k];
        }
      });
      return copy;
    });
    triggerSaveIndicator();
  };

  const handleBfMemberChange = (id: string, field: keyof BfMember, value: string) => {
    setFormData(prev => ({
      ...prev,
      bfMembers: (prev.bfMembers || []).map(m => m.id === id ? { ...m, [field]: value } : m)
    }));
    setErrors(prev => {
      const copy = { ...prev };
      Object.keys(copy).forEach(k => {
        if (k.startsWith("bfMembers")) {
          delete copy[k];
        }
      });
      return copy;
    });
    triggerSaveIndicator();
  };

  const handleFileUpload = (target: DocumentTarget, file: File) => {
    const key = docKey(target);
    setUploadStatus(prev => ({ ...prev, [key]: "uploading" }));
    setUploadProgress(prev => ({ ...prev, [key]: 10 }));

    // Start a smooth visual progress simulation while upload happens
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        const current = prev[key] || 10;
        if (current >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return { ...prev, [key]: current + 15 };
      });
    }, 200);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const base64Data = (reader.result as string).split(",")[1];

        // documentType stays the semantic slot name (used for the Zoho subfolder);
        // personType/personId travel alongside it so the backend can attribute the file.
        const documentType = target.kind === "static" ? target.field : target.documentType;

        const response = await fetch("/api/trpc/documents.uploadDocument", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${draftToken}`,
            [FORM_TYPE_HEADER]: "JURIDICA",
          },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            fileData: base64Data,
            documentType,
            draftId: draftToken,
            ...(target.kind === "person"
              ? { personType: target.personType, personId: target.personId }
              : {}),
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
        setUploadProgress(prev => ({ ...prev, [key]: 100 }));
        setUploadStatus(prev => ({ ...prev, [key]: "success" }));

        if (target.kind === "static") {
          const isMultiField = staticDocumentFields.find(d => d.field === target.field)?.multiple;
          if (isMultiField) {
            setFormData(prev => ({
              ...prev,
              [target.field]: [...((prev[target.field] as string[]) || []), data.document.name],
            }));
            // Reset to idle (skip the "success" state) so the "Agregar otro archivo"
            // button reappears immediately, letting the user keep adding files.
            setUploadStatus(prevStatus => ({ ...prevStatus, [key]: "idle" }));
          } else {
            setFormData(prev => ({ ...prev, [target.field]: data.document.name }));
          }
        } else {
          setFormData(prev => ({
            ...prev,
            personDocuments: [
              // replace any existing entry for this exact person+documentType, then add the new one
              ...prev.personDocuments.filter(
                d => !(d.personType === target.personType && d.personId === target.personId && d.documentType === target.documentType)
              ),
              {
                personType: target.personType,
                personId: target.personId,
                documentType: target.documentType,
                fileName: data.document.name,
              },
            ],
          }));
        }

        setErrors(prev => {
          const copy = { ...prev };
          delete copy[key];
          return copy;
        });
        triggerSaveIndicator();

      } catch (error: any) {
        clearInterval(progressInterval);
        console.error("[Juridica Page] Error uploading file:", error);
        setUploadStatus(prev => ({ ...prev, [key]: "idle" }));
        setUploadProgress(prev => ({ ...prev, [key]: 0 }));
        setErrors(prev => ({ ...prev, [key]: error.message || "Fallo en la carga del archivo" }));
        alert(error.message || tp("UploadFailed"));
      }
    };
    reader.onerror = () => {
      clearInterval(progressInterval);
      setUploadStatus(prev => ({ ...prev, [key]: "idle" }));
      setUploadProgress(prev => ({ ...prev, [key]: 0 }));
      alert(tp("LocalFileReadError"));
    };
  };

  const handleRemoveFile = async (target: DocumentTarget) => {
    const key = docKey(target);
    const hadFile =
      target.kind === "static" && target.fileName
        ? ((formData[target.field] as string[]) || []).includes(target.fileName)
        : isDocumentUploaded(formData, target);
    if (!hadFile) return;

    if (confirm(tp("ConfirmDeleteDocument"))) {
      try {
        setUploadStatus(prev => ({ ...prev, [key]: "uploading" }));
        setUploadProgress(prev => ({ ...prev, [key]: 50 }));

        // fieldName still identifies the document *type* for the backend's lookup;
        // personType/personId narrow it to the specific person when applicable.
        const fieldName = target.kind === "static" ? target.field : target.documentType;

        const response = await fetch("/api/trpc/documents.deleteDocument", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${draftToken}`,
            [FORM_TYPE_HEADER]: "JURIDICA",
          },
          body: JSON.stringify({
            draftId: draftToken,
            fieldName,
            ...(target.kind === "person"
              ? { personType: target.personType, personId: target.personId }
              : {}),
            ...(target.kind === "static" && target.fileName ? { fileName: target.fileName } : {}),
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
        if (target.kind === "static") {
          const isMultiField = staticDocumentFields.find(d => d.field === target.field)?.multiple;
          if (isMultiField && target.fileName) {
            setFormData(prev => ({
              ...prev,
              [target.field]: ((prev[target.field] as string[]) || []).filter(f => f !== target.fileName),
            }));
          } else {
            setFormData(prev => ({ ...prev, [target.field]: isMultiField ? [] : "" }));
          }
        } else {
          setFormData(prev => ({
            ...prev,
            personDocuments: prev.personDocuments.filter(
              d => !(d.personType === target.personType && d.personId === target.personId && d.documentType === target.documentType)
            ),
          }));
        }
        setUploadStatus(prev => ({ ...prev, [key]: "idle" }));
        setUploadProgress(prev => ({ ...prev, [key]: 0 }));
        triggerSaveIndicator();

      } catch (error: any) {
        console.error("[Juridica Page] Error deleting file:", error);
        setUploadStatus(prev => ({ ...prev, [key]: "success" }));
        setUploadProgress(prev => ({ ...prev, [key]: 100 }));
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
    if (step === 1) schema = juridicaStep1Schema;
    else if (step === 2) schema = juridicaStep2Schema;
    else if (step === 3) schema = juridicaStep3Schema;
    else return false;

    return schema.safeParse(formData).success;
  };

  const validateStep = (step: number): boolean => {
    if (step === 0) return true;
    let schema;
    if (step === 1) schema = juridicaStep1Schema;
    else if (step === 2) schema = juridicaStep2Schema;
    else if (step === 3) schema = juridicaStep3Schema;
    else return true;

    const validation = schema.safeParse(formData);
    if (!validation.success) {
      const stepErrors: Record<string, string> = {};
      validation.error.issues.forEach(err => {
        const path = err.path.join(".");
        stepErrors[path] = err.message;
      });
      setErrors(stepErrors);
      console.log("Validation errors for step", step, stepErrors);
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

    const fullValidation = juridicaFormSchema.safeParse(formData);
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
      { key: "formaContacto", label: tp("OptionalFields.formaContacto"), step: 1 },
      { key: "tipoSociedad", label: tp("OptionalFields.tipoSociedad"), step: 1 },
      { key: "tipoCliente", label: tp("OptionalFields.tipoCliente"), step: 1 },
      { key: "actividadPrincipal", label: tp("OptionalFields.actividadPrincipal"), step: 1 },
      { key: "numeroIdTributaria", label: tp("OptionalFields.numeroIdTributaria"), step: 1 },
      { key: "paisTributacion", label: tp("OptionalFields.paisTributacion"), step: 1 },
      { key: "paisOpera", label: tp("OptionalFields.paisOpera"), step: 1 },
      { key: "paisInscripcion", label: tp("OptionalFields.paisInscripcion"), step: 1 },
      { key: "empresaCiudad", label: tp("OptionalFields.empresaCiudad"), step: 1 },
      { key: "empresaProvincia", label: tp("OptionalFields.empresaProvincia"), step: 1 },
      { key: "empresaPais", label: tp("OptionalFields.empresaPais"), step: 1 },
      { key: "empresaTelefono", label: tp("OptionalFields.empresaTelefono"), step: 1 },
      { key: "empresaCelular", label: tp("OptionalFields.empresaCelular"), step: 1 },
      { key: "empresaEmail", label: tp("OptionalFields.empresaEmail"), step: 1 },
      { key: "rlActividadEconomica", label: tp("OptionalFields.rlActividadEconomica"), step: 1 },
      { key: "rlDireccion", label: tp("OptionalFields.rlDireccion"), step: 1 },
      { key: "rlPaisResidencia", label: tp("OptionalFields.rlPaisResidencia"), step: 1 },
      { key: "rlTelefono", label: tp("OptionalFields.rlTelefono"), step: 1 },
      
      { key: "origenFondosFile", label: tp("OptionalFields.origenFondosFile"), step: 2 },
      { key: "pactoSocialFile", label: tp("OptionalFields.pactoSocialFile"), step: 2 },
      { key: "certBancariaFile", label: tp("OptionalFields.certBancariaFile"), step: 2 },
      { key: "certRegistroFile", label: tp("OptionalFields.certRegistroFile"), step: 2 }
    ];

    if (formData.esPep === "Sí") {
      optionalFieldsToCheck.push(
        { key: "pepNombre", label: tp("OptionalFields.pepNombre"), step: 1 },
        { key: "pepCargo", label: tp("OptionalFields.pepCargo"), step: 1 },
        { key: "pepInstitucion", label: tp("OptionalFields.pepInstitucion"), step: 1 },
        { key: "pepRelacion", label: tp("OptionalFields.pepRelacion"), step: 1 }
      );
    }

    const emptyOptionals = optionalFieldsToCheck.filter(field => {
      const val = formData[field.key as keyof FormState];
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

    const newId = "JUR-" + Math.floor(100000 + Math.random() * 900000);
    const dateNow = new Date();

    try {
      // Fetch documents list for PDF merging before submitting and clearing tokens
      try {
        const docsResponse = await fetch("/api/trpc/documents.getDraftDocuments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${draftToken}`,
            [FORM_TYPE_HEADER]: "JURIDICA",
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
          [FORM_TYPE_HEADER]: "JURIDICA",
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
        type: "juridica",
        clientName: (formData.razonSocial || "Empresa Registrada").trim(),
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

      localStorage.removeItem("udg_due_diligence_juridica_token");
      localStorage.removeItem("udg_due_diligence_juridica");
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
                <span className="font-medium text-zinc-500">{tp("CompanyNameLabel")}</span>
                <span className="font-bold text-[#052B48]">
                  {submittedData?.razonSocial || "N/A"}
                </span>
              </div>
              <div className="flex justify-between border-b border-zinc-150 pb-2.5">
                <span className="font-medium text-zinc-500">{tp("ProjectLabel")}</span>
                <span className="font-bold text-[#052B48]">{submittedData?.nombreProyecto || "UDG General"}</span>
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
                    generatePDF("juridica", submittedData, submissionId, new Date().toLocaleDateString(), submittedDocuments, draftToken);
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
            {tp("FooterCopyright", { year: new Date().getFullYear() })}
          </p>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#052B48] text-[#1a1c1a] flex flex-col justify-between selection:bg-[#c8a788]/30 selection:text-white font-sans">
      
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

        {/* Step 1 to 5: MULTI-STEP JURIDICAL FORM */}
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
                    <Step1Identificacion 
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

                    {avisoPrecargaRL && (
                      <div className="flex flex-col gap-2 rounded-2xl border border-[#c8a788]/40 bg-[#c8a788]/10 px-4 py-3 animate-fadeIn md:flex-row md:items-center md:justify-between">
                        <p className="text-xs leading-relaxed text-[#e8d7c5]">
                          {tp.rich("RlPrefillNotice", { b: (chunks) => <span className="font-semibold">{chunks}</span> })}
                          {avisoPrecargaRL.guardadoEn && (
                            <> {tp("RlPrefillSavedOn", { date: new Date(avisoPrecargaRL.guardadoEn).toLocaleDateString("es-PA") })}</>
                          )}
                          . {tp("RlPrefillVerify")}
                        </p>
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const limpios: Partial<FormState> = {};
                              CAMPOS_RL.forEach(campo => { limpios[campo] = ""; });
                              setFormData(prev => ({ ...prev, ...limpios }));
                              setAvisoPrecargaRL(null);
                            }}
                            className="rounded-lg border border-zinc-600 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 transition hover:bg-white/5 cursor-pointer"
                          >
                            {tp("RlClearFields")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setAvisoPrecargaRL(null)}
                            className="rounded-lg bg-[#c8a788] px-3 py-1.5 text-[11px] font-semibold text-[#052B48] transition hover:bg-[#d8bb9f] cursor-pointer"
                          >
                            {tp("RlAcknowledge")}
                          </button>
                        </div>
                      </div>
                    )}

                    <Step2GobiernoRL
                      formData={formData}
                      onInputChange={handleInputChange}
                      onSearchableSelectChange={handleSearchableSelectChange}
                      onAddGjcMember={handleAddGjcMember}
                      onRemoveGjcMember={handleRemoveGjcMember}
                      onGjcMemberChange={handleGjcMemberChange}
                      errors={shownErrors}
                    />
                  </div>

                  <div className="bg-white/5 p-6 rounded-3xl border border-zinc-800 space-y-4">
                    <h2 className="text-[#c8a788] text-sm font-bold uppercase tracking-wider border-b border-zinc-850 pb-2">
                      {t("BigTitleStep3")}
                    </h2>
                    <Step3Finanzas 
                      formData={formData}
                      onInputChange={handleInputChange}
                      onAddBfMember={handleAddBfMember}
                      onRemoveBfMember={handleRemoveBfMember}
                      onBfMemberChange={handleBfMemberChange}
                      errors={shownErrors}
                    />
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <Step4Documentos 
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
                <Step5Declaracion 
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
            {tp("FooterCopyright", { year: new Date().getFullYear() })}
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
                {tp("ValidationSummaryAcknowledge")}
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
