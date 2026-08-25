"use client";

import Link from "next/link";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useEffect, useState } from "react";
import { BfMember, FormState, GjcMember, INITIAL_FORM_STATE } from "@/types/persona-juridica";

import dynamic from "next/dynamic";
import Header from "@/components/persona-juridica/Header";
import PoliciesScreen from "@/components/persona-juridica/PoliciesScreen";
import FormStepper from "@/components/persona-juridica/FormStepper";

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

const getStepForField = (field: string): number => {
  const step1Fields = [
    "nombreProyecto", "formaContacto", "razonSocial", "tipoSociedad", "tipoCliente", "tipoDocumentoIdentidad", "actividadPrincipal", "numeroDocumento", "numeroIdTributaria", "paisTributacion", "porcentajeActividad", "fechaConstitucion", "paisOpera", "paisInscripcion", "fechaNacimiento", "contactoNombre", "contactoApellido", "contactoId", "contactoTelefono", "contactoEmail", "empresaDireccion", "empresaCiudad", "empresaProvincia", "empresaPais", "empresaTelefonoCodigo", "empresaTelefono", "empresaCelularCodigo", "empresaCelular", "empresaEmail",
    "rlNombre", "rlFechaNacimiento", "rlNacionalidad", "rlNoIdentificacion", "rlProfesionOcupacion", "rlActividadEconomica", "rlDireccion", "rlPaisResidencia", "rlTelefono", "rlObjetoInvestigacion", "gjcMembers",
    "bfMembers", "ingresosMensuales", "medioPago", "fuenteFondosInmueble", "montoServiciosAnuales", "esPep", "pepNombre", "pepCargo", "pepInstitucion", "pepRelacion", "actividadComercial", "origenFondos", "destinoFondos", "volumenVentas", "bancoReferencia"
  ];
  const step2Fields = ["avisoOperacionesFile", "copiaIdFile", "origenFondosFile", "pactoSocialFile", "serviciosPublicosFile", "certBancariaFile", "certRegistroFile"];
  const step3Fields = ["termsAccepted", "signerName", "signatureDate", "firmaImage"];

  if (step1Fields.some(f => field.startsWith(f))) return 1;
  if (step2Fields.some(f => field.startsWith(f))) return 2;
  if (step3Fields.some(f => field.startsWith(f))) return 3;
  return 1;
};

const getStepName = (step: number): string => {
  switch (step) {
    case 1: return "Datos de la Empresa";
    case 2: return "Representación y Junta";
    case 3: return "Beneficiarios y Finanzas";
    case 4: return "Documentos Adjuntos";
    case 5: return "Firma y Declaración";
    default: return "Datos";
  }
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
  return normalized;
};

export default function PersonaJuridicaPage() {
  const [formData, setFormData] = useLocalStorage<FormState>("udg_due_diligence_juridica", INITIAL_FORM_STATE);
  const [currentStep, setCurrentStep] = useState(0); // Step 0 is policies screen
  const [isMounted, setIsMounted] = useState(false);
  const [draftToken, setDraftToken] = useState<string | null>(null);
  
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

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      let token = searchParams.get("token") || searchParams.get("t");
      
      if (token) {
        localStorage.setItem("udg_due_diligence_juridica_token", token);
      } else {
        token = localStorage.getItem("udg_due_diligence_juridica_token");
        if (!token) {
          token = "draft-jur-" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
          localStorage.setItem("udg_due_diligence_juridica_token", token);
        }
      }
      setDraftToken(token);
    }
  }, []);

  // Hook up custom autosave hook
  const { status: saveStatus, lastSaved, setStatus: setSaveStatus, setLastSaved, lastSavedAtRef } = useAutosave({
    data: formData,
    type: "juridica",
    step: currentStep,
    draftToken,
    onConflict: (dbData, dbStep, dbUpdatedAt) => {
      console.warn("[Juridica Page] Conflicto de concurrencia detectado. Sincronizando con la versión de base de datos.");
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
      }
    };

    loadDraftFromDb();
  }, [draftToken, isMounted]);

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
          const errMsg = resJson.error?.message || "Error al subir el archivo.";
          throw new Error(errMsg);
        }

        const data = resJson.result?.data;
        if (!data || !data.document) {
          throw new Error("Respuesta de servidor inválida.");
        }

        // Set success states
        setUploadProgress(prev => ({ ...prev, [fieldName]: 100 }));
        setUploadStatus(prev => ({ ...prev, [fieldName]: "success" }));
        setFormData(prev => ({ ...prev, [fieldName]: data.document.name }));
        setErrors(prev => {
          const copy = { ...prev };
          delete copy[fieldName];
          return copy;
        });
        triggerSaveIndicator();

      } catch (error: any) {
        clearInterval(progressInterval);
        console.error("[Juridica Page] Error uploading file:", error);
        setUploadStatus(prev => ({ ...prev, [fieldName]: "idle" }));
        setUploadProgress(prev => ({ ...prev, [fieldName]: 0 }));
        setErrors(prev => ({ ...prev, [fieldName]: error.message || "Fallo en la carga del archivo" }));
        alert(error.message || "Fallo al subir el archivo.");
      }
    };
    reader.onerror = () => {
      clearInterval(progressInterval);
      setUploadStatus(prev => ({ ...prev, [fieldName]: "idle" }));
      setUploadProgress(prev => ({ ...prev, [fieldName]: 0 }));
      alert("Error al leer el archivo local.");
    };
  };

  const handleRemoveFile = async (fieldName: keyof FormState) => {
    const fileName = formData[fieldName];
    if (!fileName) return;

    if (confirm("¿Estás seguro de que deseas eliminar este documento cargado?")) {
      try {
        setUploadStatus(prev => ({ ...prev, [fieldName]: "uploading" }));
        setUploadProgress(prev => ({ ...prev, [fieldName]: 50 }));

        const response = await fetch("/api/trpc/documents.deleteDocument", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${draftToken}`,
          },
          body: JSON.stringify({
            draftId: draftToken,
            fieldName: fieldName,
          }),
        });

        if (!response.ok) {
          const resJson = await response.json();
          throw new Error(resJson.error?.message || "Error al eliminar el archivo.");
        }

        // Reset states on success
        setFormData(prev => ({ ...prev, [fieldName]: "" }));
        setUploadStatus(prev => ({ ...prev, [fieldName]: "idle" }));
        setUploadProgress(prev => ({ ...prev, [fieldName]: 0 }));
        triggerSaveIndicator();

      } catch (error: any) {
        console.error("[Juridica Page] Error deleting file:", error);
        setUploadStatus(prev => ({ ...prev, [fieldName]: "success" }));
        setUploadProgress(prev => ({ ...prev, [fieldName]: 100 }));
        alert(error.message || "Fallo al eliminar el archivo.");
      }
    }
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
    const isFinalValid = validateStep(3);
    if (!isFinalValid) {
      setTimeout(() => {
        const firstError = document.querySelector(".text-red-500");
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
      { key: "formaContacto", label: "Forma de Contacto", step: 1 },
      { key: "tipoSociedad", label: "Tipo de Sociedad", step: 1 },
      { key: "tipoCliente", label: "Tipo de Cliente", step: 1 },
      { key: "actividadPrincipal", label: "Actividad Principal de la Empresa", step: 1 },
      { key: "numeroIdTributaria", label: "NIF / ID Tributaria de la Empresa", step: 1 },
      { key: "paisTributacion", label: "País de Tributación", step: 1 },
      { key: "paisOpera", label: "País de Operaciones", step: 1 },
      { key: "paisInscripcion", label: "País de Inscripción", step: 1 },
      { key: "empresaCiudad", label: "Ciudad de la Empresa", step: 1 },
      { key: "empresaProvincia", label: "Provincia de la Empresa", step: 1 },
      { key: "empresaPais", label: "País de la Empresa", step: 1 },
      { key: "empresaTelefono", label: "Teléfono Fijo de la Empresa", step: 1 },
      { key: "empresaCelular", label: "Celular de la Empresa", step: 1 },
      { key: "empresaEmail", label: "Email de la Empresa", step: 1 },
      { key: "rlActividadEconomica", label: "Actividad Económica del Representante Legal", step: 1 },
      { key: "rlDireccion", label: "Dirección del Representante Legal", step: 1 },
      { key: "rlPaisResidencia", label: "País de Residencia del Representante Legal", step: 1 },
      { key: "rlTelefono", label: "Teléfono del Representante Legal", step: 1 },
      { key: "actividadComercial", label: "Descripción de Actividad Comercial", step: 1 },
      { key: "origenFondos", label: "Origen de Fondos de la Empresa", step: 1 },
      { key: "destinoFondos", label: "Destino de Fondos de la Empresa", step: 1 },
      { key: "volumenVentas", label: "Volumen Estimado de Ventas", step: 1 },
      { key: "bancoReferencia", label: "Banco de Referencia", step: 1 },
      { key: "origenFondosFile", label: "Documento: Origen de Fondos", step: 2 },
      { key: "pactoSocialFile", label: "Documento: Copia de Pacto Social", step: 2 },
      { key: "serviciosPublicosFile", label: "Documento: Factura de Servicios Públicos", step: 2 },
      { key: "certBancariaFile", label: "Documento: Certificación Bancaria", step: 2 },
      { key: "certRegistroFile", label: "Documento: Certificado de Registro Público", step: 2 }
    ];

    if (formData.esPep === "Sí") {
      optionalFieldsToCheck.push(
        { key: "pepNombre", label: "PEP: Nombre Completo", step: 1 },
        { key: "pepCargo", label: "PEP: Cargo", step: 1 },
        { key: "pepInstitucion", label: "PEP: Institución", step: 1 },
        { key: "pepRelacion", label: "PEP: Relación/Parentesco", step: 1 }
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
                Tu registro de Debida Diligencia para Persona Jurídica ha sido formalizado y guardado con éxito. Un oficial de cumplimiento revisará tu documentación a la brevedad.
              </p>
            </div>

            <div className="bg-[#f4f6f8] border border-zinc-250 rounded-2xl p-6 text-left text-xs text-zinc-700 space-y-3 font-sans max-w-md mx-auto">
              <div className="flex justify-between border-b border-zinc-200 pb-2">
                <span className="font-semibold text-zinc-500">ID del Expediente:</span>
                <span className="font-bold text-[#002b49]">{submissionId}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-200 pb-2">
                <span className="font-semibold text-zinc-500">Sociedad / Razón Social:</span>
                <span className="font-bold text-[#002b49]">
                  {submittedData?.razonSocial}
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
                    generatePDF("juridica", submittedData, submissionId, new Date().toLocaleDateString(), submittedDocuments);
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

        {/* Step 1 to 5: MULTI-STEP JURIDICAL FORM */}
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
                <div className="space-y-12">
                  <div className="bg-white/5 p-6 rounded-3xl border border-zinc-800 space-y-4">
                    <h2 className="text-[#c8a788] text-sm font-bold uppercase tracking-wider border-b border-zinc-850 pb-2">
                      I. Identificación de la Empresa
                    </h2>
                    <Step1Identificacion 
                      formData={formData}
                      onInputChange={handleInputChange}
                      onSearchableSelectChange={handleSearchableSelectChange}
                      errors={errors}
                    />
                  </div>

                  <div className="bg-white/5 p-6 rounded-3xl border border-zinc-800 space-y-4">
                    <h2 className="text-[#c8a788] text-sm font-bold uppercase tracking-wider border-b border-zinc-850 pb-2">
                      II. Representante Legal y Gobierno Corporativo
                    </h2>
                    <Step2GobiernoRL 
                      formData={formData}
                      onInputChange={handleInputChange}
                      onSearchableSelectChange={handleSearchableSelectChange}
                      onAddGjcMember={handleAddGjcMember}
                      onRemoveGjcMember={handleRemoveGjcMember}
                      onGjcMemberChange={handleGjcMemberChange}
                      errors={errors}
                    />
                  </div>

                  <div className="bg-white/5 p-6 rounded-3xl border border-zinc-800 space-y-4">
                    <h2 className="text-[#c8a788] text-sm font-bold uppercase tracking-wider border-b border-zinc-850 pb-2">
                      III. Beneficiarios Finales y Perfil Financiero
                    </h2>
                    <Step3Finanzas 
                      formData={formData}
                      onInputChange={handleInputChange}
                      onAddBfMember={handleAddBfMember}
                      onRemoveBfMember={handleRemoveBfMember}
                      onBfMemberChange={handleBfMemberChange}
                      errors={errors}
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
                  errors={errors}
                />
              )}

              {currentStep === 3 && (
                <Step5Declaracion 
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
      {/* Premium Validation Summary Modal */}
      {validationSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn animate-duration-200">
          <div className="bg-[#081b2a] border border-[#c8a788]/30 rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-sans">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-[#0b243b] to-[#081b2a] border-b border-[#c8a788]/20 flex justify-between items-center">
              <h3 className="text-sm font-semibold tracking-wider text-[#c8a788] uppercase">
                Requisitos Pendientes
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
                Por favor complete la siguiente información y documentos obligatorios antes de enviar su expediente:
              </p>
              
              {/* Render grouped errors */}
              {Object.entries(groupByStep(validationSummary)).map(([stepNum, items]) => (
                <div key={stepNum} className="bg-[#002b49]/40 border border-[#c8a788]/10 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold tracking-wider text-[#c8a788] uppercase">
                      Paso {stepNum}: {getStepName(parseInt(stepNum))}
                    </span>
                    <button
                      onClick={() => {
                        setCurrentStep(parseInt(stepNum));
                        setValidationSummary(null);
                      }}
                      className="text-[10px] font-semibold text-[#c8a788] hover:underline cursor-pointer"
                    >
                      Ir a este paso →
                    </button>
                  </div>
                  <ul className="list-disc pl-5 space-y-1">
                    {items.map((item, idx) => (
                      <li key={idx} className="text-xs text-zinc-300">
                        {item.message}
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
                Entendido, Completar
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
                Información Pendiente (Opcional)
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
                Hemos detectado que algunos campos opcionales han quedado vacíos. Aunque **no son obligatorios** para enviar su expediente hoy, recuerde que deberá suministrar esta información más adelante.
              </p>
              
              {/* Render grouped optional fields */}
              {[1, 2, 3, 4].map(stepNum => {
                const stepItems = pendingOptionalFields.filter(f => f.step === stepNum);
                if (stepItems.length === 0) return null;
                return (
                  <div key={stepNum} className="bg-[#002b49]/40 border border-[#c8a788]/10 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold tracking-wider text-[#c8a788] uppercase">
                        Paso {stepNum}: {getStepName(stepNum)}
                      </span>
                      <button
                        onClick={() => {
                          setCurrentStep(stepNum);
                          setPendingOptionalFields(null);
                        }}
                        className="text-[10px] font-semibold text-[#c8a788] hover:underline cursor-pointer"
                      >
                        Ir a este paso →
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
                Completar datos
              </button>
              <button
                disabled={isSubmitting}
                onClick={() => {
                  executeSubmission();
                }}
                className="bg-[#c8a788] hover:bg-[#b08e6f] text-[#002b49] text-xs font-bold px-4 py-2.5 rounded-lg transition tracking-wider uppercase shadow-md select-none cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? "Enviando..." : "Enviar de todos modos"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
