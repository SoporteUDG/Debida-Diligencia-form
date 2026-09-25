"use client";

import { FormState } from "@/types/persona-natural";
import { Check, FileCheck2, UploadCloud, X } from "lucide-react";
import { useTranslations } from "next-intl";
import es from "@/messages/es.json";
import { optionLabeler } from "@/i18n/optionLabel";

interface Step3Props {
  formData: FormState;
  uploadStatus: Record<string, "idle" | "uploading" | "success">;
  uploadProgress: Record<string, number>;
  onFileUpload: (fieldName: keyof FormState, file: File) => void;
  // fileName is passed for multi-file fields to remove one specific entry
  onRemoveFile: (fieldName: keyof FormState, fileName?: string) => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  errors: Record<string, string>;
}

export default function Step3Documentos({
  formData,
  uploadStatus,
  uploadProgress,
  onFileUpload,
  onRemoveFile,
  onInputChange,
  errors = {},
}: Step3Props) {
  const t = useTranslations("NaturalForm.DocumentsStep.Titles");
  const p = useTranslations("NaturalForm.DocumentsStep.Placeholders");
  const typeIdLabel = optionLabeler(es.NaturalForm.NaturalFormStep1OptionFields.TypeIdOption, useTranslations("NaturalForm.NaturalFormStep1OptionFields.TypeIdOption"));

  // Helper render for document file upload field
  const renderUploadField = (fieldName: keyof FormState, label: string, description: string, isRequired = true, multiple = false) => {
    const rawValue = formData[fieldName] as string | string[];
    const fileList: string[] = multiple ? (Array.isArray(rawValue) ? rawValue.filter(Boolean) : []) : [];
    const hasFile = multiple ? fileList.length > 0 : !!rawValue;
    const status = uploadStatus[fieldName] || "idle";
    const progress = uploadProgress[fieldName] || 0;
    const fileName = multiple ? undefined : (rawValue as string);
    const hasError = !!errors[fieldName];

    return (
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-zinc-700 leading-normal">
          {label} {isRequired && <span className="text-red-500 font-bold">*</span>}
        </label>
        <label className="text-[11px] text-zinc-500 leading-normal">{description}</label>


        
        {/* Multi-file: list of uploaded files, each removable on its own */}
        {multiple && fileList.length > 0 && (
          <ul className="space-y-1">
            {fileList.map((fname) => (
              <li key={fname} className="flex items-center justify-between gap-2 text-xs text-zinc-700 font-medium">
                <span className="inline-flex items-center gap-1.5 truncate">
                  <FileCheck2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="truncate">{fname}</span>
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveFile(fieldName, fname)}
                  className="p-1 text-zinc-500 hover:text-red-500 hover:bg-red-50 rounded transition cursor-pointer shrink-0"
                  title={t("RemoveFile")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className={`border rounded-xl p-4 flex items-center justify-between gap-4 min-h-[72px] transition-all duration-200 ${
          hasError
            ? "bg-red-50/10 border-red-500 hover:border-red-600"
            : "bg-[#f4f6f8] border-zinc-300 hover:border-[#052B48]/20"
        }`}>
          {status === "idle" && (multiple || !hasFile) && (
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-zinc-400 font-medium">
                {multiple && hasFile ? p("AddAnotherFile") : p("ChooseFile")}
              </span>
              <label className="bg-[#052B48] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold hover:bg-[#081827] transition cursor-pointer flex items-center gap-1.5 active:scale-95">
                <UploadCloud className="h-3.5 w-3.5" />
                {t("UploadButton")}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      onFileUpload(fieldName, file);
                    }
                    e.target.value = ""; // allow re-selecting the same filename again
                  }}
                />
              </label>
            </div>
          )}

          {status === "uploading" && (
            <div className="w-full space-y-1.5">
              <div className="flex justify-between text-[10px] font-semibold text-zinc-500">
                <span>{t("Uploading")}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-zinc-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[#c8a788] to-yellow-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Single-file: "Cargado" badge with remove button */}
          {!multiple && (status === "success" || (status === "idle" && hasFile)) && (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 max-w-[70%]">
                <FileCheck2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span className="text-xs text-zinc-700 font-medium truncate">{fileName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  {t("Uploaded")}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveFile(fieldName)}
                  className="p-1.5 text-zinc-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                  title={t("RemoveFile")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
        {hasError && (
          <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
            ⚠️ {errors[fieldName]}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border border-zinc-200 text-[#1a1c1a] font-sans">
      <div className="border-b border-zinc-250 pb-4 mb-6">
        <h3 className="text-sm font-bold tracking-widest text-[#052B48] uppercase mb-4">
          {t("MainTitle")}
        </h3>
        <div className="bg-[#f4f6f8] p-5 rounded-xl border border-zinc-200 text-xs leading-relaxed text-zinc-700 space-y-2">
          <p className="font-bold text-[#052B48]">
            {t("NoticeTitle")}
          </p>
          <p>
            {t("NoticeText")}
          </p>
        </div>
      </div>

      

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column */}
        <div className="space-y-6">
          {renderUploadField(
            "idFile",
            t("IdFileLabel", { type: typeIdLabel(formData.tipoIdentificacion || "") }),
            "",
            true
          )}
          {renderUploadField(
            "hasCertificacionBancaria",
            t("BankCertLabel"),
            "",
            false
          )}

        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {renderUploadField(
            "hasEstadoCuenta",
            t("BankStatementLabel"),
            "",
            false,
            true
          )}

          {renderUploadField(
            "origenFondosFile",
            t("IncomeProofLabel"),
            t("IncomeProofDescription"),
            false,
            true
          )}
        </div>

      </div>
    </div>
  );
}
