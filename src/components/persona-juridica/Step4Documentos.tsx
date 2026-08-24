"use client";

import { FormState } from "@/types/persona-juridica";
import { Check, FileCheck2, UploadCloud, X } from "lucide-react";

interface Step4Props {
  formData: FormState;
  uploadStatus: Record<string, "idle" | "uploading" | "success">;
  uploadProgress: Record<string, number>;
  onFileUpload: (fieldName: keyof FormState, file: File) => void;
  onRemoveFile: (fieldName: keyof FormState) => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  errors: Record<string, string>;
}

export default function Step4Documentos({
  formData,
  uploadStatus,
  uploadProgress,
  onFileUpload,
  onRemoveFile,
  onInputChange,
  errors = {},
}: Step4Props) {
  const documentFields = [
    {
      field: "copiaIdFile" as keyof FormState,
      checkboxField: "checkedCopiaId" as keyof FormState,
      title: "Copia de cédula o pasaporte de dignatarios, directores, beneficiario final, representante legal, apoderado, protector",
      required: true,
    },
    {
      field: "avisoOperacionesFile" as keyof FormState,
      checkboxField: "checkedAvisoOperaciones" as keyof FormState,
      title: "Copia de Certificado de Aviso de Operaciones o Equivalente",
      required: true,
    },
    {
      field: "origenFondosFile" as keyof FormState,
      checkboxField: "checkedOrigenFondos" as keyof FormState,
      title: "Origen de Fondos (declaración de renta, estados financieros, etc.)",
      required: false,
    },
    {
      field: "serviciosPublicosFile" as keyof FormState,
      checkboxField: "checkedServiciosPublicos" as keyof FormState,
      title: "Factura de Servicios Público",
      required: false,
    },
    {
      field: "pactoSocialFile" as keyof FormState,
      checkboxField: "checkedPactoSocial" as keyof FormState,
      title: "Copia de Pacto Social y sus Adendas",
      required: false,
    },
    {
      field: "certBancariaFile" as keyof FormState,
      checkboxField: "checkedCertBancaria" as keyof FormState,
      title: "Certificación bancaria que incluya las cifras promedio de la cuenta",
      required: false,
    },
    {
      field: "certRegistroFile" as keyof FormState,
      checkboxField: "checkedCertRegistro" as keyof FormState,
      title: "Certificado de Registro Público",
      required: false,
    },
  ];

  // Group columns for checklist to match the physical paper layout
  const leftChecklist = [
    { field: "checkedCopiaId" as keyof FormState, label: "Copia de cédula o pasaporte de dignatarios, directores, beneficiario final, representante legal, apoderado, protector" },
    { field: "checkedOrigenFondos" as keyof FormState, label: "Origen de Fondos (declaración de renta, estados financieros, etc.)." },
    { field: "checkedPactoSocial" as keyof FormState, label: "Copia de Pacto Social y sus Adendas" },
  ];

  const rightChecklist = [
    { field: "checkedAvisoOperaciones" as keyof FormState, label: "Copia de Certificado de Aviso de Operaciones o Equivalente." },
    { field: "checkedServiciosPublicos" as keyof FormState, label: "Factura de Servicios Público" },
    { field: "checkedCertBancaria" as keyof FormState, label: "Certificación bancaria que incluya las cifras promedio de la cuenta." },
    { field: "checkedCertRegistro" as keyof FormState, label: "Certificado de Registro Publico" },
  ];

  // Helper to trigger file upload and check the corresponding checkbox
  const handleFileChange = (field: keyof FormState, checkboxField: keyof FormState, file: File) => {
    onFileUpload(field, file);
    // Auto check the corresponding checklist checkbox
    const event = {
      target: {
        name: checkboxField,
        type: "checkbox",
        checked: true,
      }
    } as any;
    onInputChange(event);
  };

  const handleFileRemoval = (field: keyof FormState, checkboxField: keyof FormState) => {
    onRemoveFile(field);
    // Auto uncheck the corresponding checklist checkbox
    const event = {
      target: {
        name: checkboxField,
        type: "checkbox",
        checked: false,
      }
    } as any;
    onInputChange(event);
  };

  return (
    <div className="bg-[#081827] border border-zinc-800/60 rounded-2xl p-6 md:p-10 shadow-xl space-y-8 text-white font-sans">
      
      {/* Top Section Checklist: DOCUMENTOS ENTREGADOS */}
      <div className="border border-zinc-800/65 bg-[#040e16]/30 p-6 rounded-xl space-y-4">
        <h3 className="text-sm font-bold tracking-widest text-[#c8a788] uppercase border-b border-zinc-800/60 pb-2 mb-4">
          DOCUMENTOS ENTREGADOS
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-zinc-300">
          
          {/* Left Column Checklist */}
          <div className="space-y-3">
            {leftChecklist.map((item) => (
              <label key={item.field} className="flex items-start gap-3 text-xs leading-normal select-none cursor-pointer">
                <input
                  type="checkbox"
                  name={item.field}
                  checked={!!formData[item.field]}
                  onChange={onInputChange}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-800 bg-[#040e16] text-[#c8a788] accent-[#c8a788] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>

          {/* Right Column Checklist */}
          <div className="space-y-3">
            {rightChecklist.map((item) => (
              <label key={item.field} className="flex items-start gap-3 text-xs leading-normal select-none cursor-pointer">
                <input
                  type="checkbox"
                  name={item.field}
                  checked={!!formData[item.field]}
                  onChange={onInputChange}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-800 bg-[#040e16] text-[#c8a788] accent-[#c8a788] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>

        </div>
      </div>

      {/* File Uploaders Grid */}
      <div className="space-y-6">
        <div className="border-b border-zinc-800/60 pb-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Adjuntar Archivos</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {documentFields.map((doc) => {
            const hasFile = !!formData[doc.field];
            const status = uploadStatus[doc.field] || "idle";
            const progress = uploadProgress[doc.field] || 0;
            const fileName = formData[doc.field] as string;
            const hasError = !!errors[doc.field];

            return (
              <div 
                key={doc.field}
                className={`bg-[#040e16]/30 border p-5 rounded-xl flex flex-col justify-between gap-4 hover:border-[#c8a788]/20 transition ${
                  hasError ? "border-red-500 bg-red-500/5" : "border-zinc-800"
                }`}
              >
                <div className="space-y-1">
                  <h4 className="text-xs md:text-sm font-semibold text-zinc-200">
                    {doc.title} {doc.required && <span className="text-red-500 font-bold">*</span>}
                  </h4>
                  {hasFile && (status === "success" || (status === "idle" && hasFile)) && (
                    <div className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium pt-1.5">
                      <FileCheck2 className="h-4 w-4" />
                      <span>{fileName}</span>
                    </div>
                  )}
                  {hasError && (
                    <span className="text-xs text-red-400 font-medium flex items-center gap-1 pt-1.5 animate-fadeIn">
                      ⚠️ {errors[doc.field]}
                    </span>
                  )}
                </div>

                <div className="w-full flex items-center justify-start mt-2">
                  {status === "idle" && !hasFile && (
                    <label className="inline-flex items-center gap-2 bg-[#040e16] border border-[#c8a788]/30 text-[#c8a788] px-4 py-2.5 rounded-lg text-xs font-semibold hover:bg-[#c8a788]/10 hover:border-[#c8a788]/60 transition cursor-pointer active:scale-95">
                      <UploadCloud className="h-4 w-4" />
                      Choose File
                      <input 
                        type="file" 
                        accept=".pdf,.jpg,.jpeg"
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleFileChange(doc.field, doc.checkboxField, file);
                          }
                        }}
                      />
                    </label>
                  )}

                  {status === "uploading" && (
                    <div className="w-full space-y-1.5">
                      <div className="flex justify-between text-[10px] font-semibold text-zinc-400">
                        <span>Subiendo...</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="w-full bg-zinc-950/60 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-[#c8a788] to-yellow-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {(status === "success" || (status === "idle" && hasFile)) && (
                    <div className="flex items-center gap-3">
                      <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5" />
                        Cargado
                      </div>
                      <button
                        type="button"
                        onClick={() => handleFileRemoval(doc.field, doc.checkboxField)}
                        className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition cursor-pointer"
                        title="Quitar archivo"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
