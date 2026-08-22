"use client";

import { FormState } from "@/types/persona-natural";
import { Check, FileCheck2, UploadCloud, X } from "lucide-react";

interface Step3Props {
  formData: FormState;
  uploadStatus: Record<string, "idle" | "uploading" | "success">;
  uploadProgress: Record<string, number>;
  onFileUpload: (fieldName: keyof FormState, file: File) => void;
  onRemoveFile: (fieldName: keyof FormState) => void;
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
  
  // Helper render for document file upload field
  const renderUploadField = (fieldName: keyof FormState, label: string, isRequired = true) => {
    const hasFile = !!formData[fieldName];
    const status = uploadStatus[fieldName] || "idle";
    const progress = uploadProgress[fieldName] || 0;
    const fileName = formData[fieldName] as string;
    const hasError = !!errors[fieldName];

    return (
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-zinc-700 leading-normal">
          {label} {isRequired && <span className="text-red-500 font-bold">*</span>}
        </label>
        
        <div className={`border rounded-xl p-4 flex items-center justify-between gap-4 min-h-[72px] transition-all duration-200 ${
          hasError 
            ? "bg-red-50/10 border-red-500 hover:border-red-600" 
            : "bg-[#f4f6f8] border-zinc-300 hover:border-[#002b49]/20"
        }`}>
          {status === "idle" && !hasFile && (
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-zinc-400 font-medium">Choose File</span>
              <label className="bg-[#002b49] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold hover:bg-[#081827] transition cursor-pointer flex items-center gap-1.5 active:scale-95">
                <UploadCloud className="h-3.5 w-3.5" />
                Cargar
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.heic,.tiff,.tif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      onFileUpload(fieldName, file);
                    }
                  }}
                />
              </label>
            </div>
          )}

          {status === "uploading" && (
            <div className="w-full space-y-1.5">
              <div className="flex justify-between text-[10px] font-semibold text-zinc-500">
                <span>Subiendo...</span>
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

          {(status === "success" || (status === "idle" && hasFile)) && (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 max-w-[70%]">
                <FileCheck2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span className="text-xs text-zinc-700 font-medium truncate">{fileName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Cargado
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveFile(fieldName)}
                  className="p-1.5 text-zinc-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                  title="Quitar archivo"
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
        <h3 className="text-sm font-bold tracking-widest text-[#002b49] uppercase">
          DOCUMENTOS ENTREGADOS
        </h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column */}
        <div className="space-y-6">
          {renderUploadField(
            "idFile",
            "Copia de Documento de Identidad Personal"
          )}

          {renderUploadField(
            "origenFondosFile",
            "Origen de Fondo (Declaración de Renta, Carta de Trabajo, Ficha del Seguro Social, etc.)"
          )}

          {renderUploadField(
            "proofAddressFile",
            "Factura o Copia de un Servicio Público y/o Servicio de Utilidad (estado de cuenta de luz, agua, teléfono o celular)"
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          
          <div className="space-y-4 pt-1">
            
            {/* Checkbox 1 */}
            <label className="flex items-start gap-3 cursor-pointer group select-none">
              <input
                type="checkbox"
                name="hasEstadoCuenta"
                checked={formData.hasEstadoCuenta || false}
                onChange={onInputChange}
                className="w-4 h-4 rounded border-zinc-300 text-[#002b49] focus:ring-[#002b49] transition cursor-pointer mt-0.5"
              />
              <span className="text-xs font-medium text-zinc-700 leading-normal group-hover:text-zinc-950 transition">
                Copia de Estado de Cuenta Bancario de los Últimos 6 (seis) Meses
              </span>
            </label>

            {/* Checkbox 2 */}
            <label className="flex items-start gap-3 cursor-pointer group select-none">
              <input
                type="checkbox"
                name="hasCertificacionBancaria"
                checked={formData.hasCertificacionBancaria || false}
                onChange={onInputChange}
                className="w-4 h-4 rounded border-zinc-300 text-[#002b49] focus:ring-[#002b49] transition cursor-pointer mt-0.5"
              />
              <span className="text-xs font-medium text-zinc-700 leading-normal group-hover:text-zinc-950 transition">
                Certificación bancaria que incluya las cifras promedio de la cuenta.
              </span>
            </label>

          </div>

          <div className="pt-2">
            {renderUploadField(
              "otrosAdjuntosFile",
              "Otros Adjuntos"
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
