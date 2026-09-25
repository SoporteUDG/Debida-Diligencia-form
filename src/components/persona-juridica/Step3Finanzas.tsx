"use client";

import SearchableSelect from "@/components/ui/SearchableSelect";
import { countries } from "@/lib/countries";
import { BfMember, FormState } from "@/types/persona-juridica";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import es from "@/messages/es.json";
import { optionLabeler } from "@/i18n/optionLabel";

interface Step3Props {
  formData: FormState;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onAddBfMember: () => void;
  onRemoveBfMember: (id: string) => void;
  onBfMemberChange: (id: string, field: keyof BfMember, value: string) => void;
  errors: Record<string, string>;
}

export default function Step3Finanzas({
  formData,
  onInputChange,
  onAddBfMember,
  onRemoveBfMember,
  onBfMemberChange,
  errors = {},
}: Step3Props) {
  const t = useTranslations("JuridicaForm.JuridicaFormStep3Titles");
  const p = useTranslations("JuridicaForm.JuridicaFormStep3Placeholders");
  const OPTIONS = es.JuridicaForm.JuridicaFormStep3Options;
  const paymentLabel = optionLabeler(OPTIONS.PaymentOptions, useTranslations("JuridicaForm.JuridicaFormStep3Options.PaymentOptions"));
  const fundsLabel = optionLabeler(OPTIONS.FundsSourceOptions, useTranslations("JuridicaForm.JuridicaFormStep3Options.FundsSourceOptions"));
  const pepRelationLabel = optionLabeler(OPTIONS.PepRelationOptions, useTranslations("JuridicaForm.JuridicaFormStep3Options.PepRelationOptions"));
  const yesNoLabel = optionLabeler(es.JuridicaForm.TrueFalseOptions, useTranslations("JuridicaForm.TrueFalseOptions"));
  return (
    <div className="bg-white rounded-2xl ">
      
      {/* SECTION 1: BENEFICIARIO (S) FINAL (ES) */}
      <div className="px-6 md:px-8 pt-6 text-center">
        <h3 className="text-base md:text-lg font-serif font-bold tracking-widest text-[#052B48] uppercase border-b border-zinc-200 pb-3 mb-4">
          {t("FinalBeneficiariesTitle")} 
        </h3>
        <p className="text-xs text-red-600 italic leading-relaxed max-w-3xl mx-auto">
          {t("FinalBeneficiaryDefinition")}
        </p>
        <h3 className="text-base md:text-lg font-serif font-bold tracking-widest text-[#052B48] uppercase border-b border-zinc-200 pb-3 mb-4">
        </h3>
      </div>

      {/* Dynamic or Fixed BF Cards */}
      <div className="px-6 md:px-8 pt-6 space-y-4">
        <h3 className="text-sm font-bold tracking-widest text-[#052B48] uppercase pb-3 mb-6 flex items-center justify-between">
          <span>{t("BeneficiariesTitle")}</span>
          <span className="text-[10px] text-zinc-400 lowercase font-normal italic">{t("BeneficiariesMultipleHint")}</span>
        </h3>
        {errors.bfMembers && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs mb-4">
            ⚠️ {errors.bfMembers}
          </div>
        )}
        {((formData.bfMembers || [])).map((bf, idx) => (
          <div 
            key={bf.id} 
            className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border border-zinc-200 relative animate-fadeIn space-y-6"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#052B48]">
                {idx + 1}. {t("FinalBeneficiaryCardTitle")}
              </span>
              {((formData.bfMembers || [])).length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemoveBfMember(bf.id)}
                  className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition cursor-pointer"
                  title={t("RemoveFinalBeneficiaryButton")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[#1a1c1a]">
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">
                  {idx + 1}. - {t("BfFullNameLabel")}
                </label>
                <input
                  type="text"
                  value={bf.nombreCompleto}
                  onChange={(e) => onBfMemberChange(bf.id, "nombreCompleto", e.target.value)}
                  placeholder={p("BfFullName")}
                  className={`border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full ${
                    errors[`bfMembers.${idx}.nombreCompleto`]
                      ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
                  }`}
                />
                {errors[`bfMembers.${idx}.nombreCompleto`] && (
                  <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                    ⚠️ {errors[`bfMembers.${idx}.nombreCompleto`]}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">
                  {idx + 1}. - {t("BfIdNumberLabel")}
                </label>
                <input
                  type="text"
                  value={bf.noIdentificacion}
                  onChange={(e) => onBfMemberChange(bf.id, "noIdentificacion", e.target.value)}
                  placeholder={p("BfIdNumber")}
                  className={`border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full ${
                    errors[`bfMembers.${idx}.noIdentificacion`]
                      ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
                  }`}
                />
                {errors[`bfMembers.${idx}.noIdentificacion`] && (
                  <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                    ⚠️ {errors[`bfMembers.${idx}.noIdentificacion`]}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">
                  {idx + 1}. - {t("BfNationalityLabel")}
                </label>
                <SearchableSelect
                  value={bf.nacionalidad}
                  onChange={(val) => onBfMemberChange(bf.id, "nacionalidad", val)}
                  options={countries}
                  placeholder={p("SearchNationality")}
                  hasError={!!errors[`bfMembers.${idx}.nacionalidad`]}
                />
                {errors[`bfMembers.${idx}.nacionalidad`] && (
                  <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                    ⚠️ {errors[`bfMembers.${idx}.nacionalidad`]}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">
                  {idx + 1}. - {t("BfAcquisitionDateLabel")}
                </label>
                <input
                  type="date"
                  value={bf.fechaAdquisicion}
                  onChange={(e) => onBfMemberChange(bf.id, "fechaAdquisicion", e.target.value)}
                  className={`border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full ${
                    errors[`bfMembers.${idx}.fechaAdquisicion`]
                      ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
                  }`}
                />
                {errors[`bfMembers.${idx}.fechaAdquisicion`] && (
                  <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                    ⚠️ {errors[`bfMembers.${idx}.fechaAdquisicion`]}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">
                  {idx + 1}. - {t("BfOwnershipPercentageLabel")}
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  value={bf.porcentajeParticipacion}
                  onChange={(e) => onBfMemberChange(bf.id, "porcentajeParticipacion", e.target.value)}
                  onKeyDown={(e) => {
                    if (["e", "E", "+", "-"].includes(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  placeholder="0"
                  className={`border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full ${
                    errors[`bfMembers.${idx}.porcentajeParticipacion`]
                      ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
                  }`}
                />
                {errors[`bfMembers.${idx}.porcentajeParticipacion`] && (
                  <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                    ⚠️ {errors[`bfMembers.${idx}.porcentajeParticipacion`]}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">
                  {idx + 1}. - {t("BfBirthCountryLabel")}
                </label>
                <SearchableSelect
                  value={bf.paisNacimiento}
                  onChange={(val) => onBfMemberChange(bf.id, "paisNacimiento", val)}
                  options={countries}
                  placeholder={p("SearchCountry")}
                  hasError={!!errors[`bfMembers.${idx}.paisNacimiento`]}
                />
                {errors[`bfMembers.${idx}.paisNacimiento`] && (
                  <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                    ⚠️ {errors[`bfMembers.${idx}.paisNacimiento`]}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2 md:col-span-3">
                <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">
                  {idx + 1}. - {t("BfAddressLabel")}
                </label>
                <input
                  type="text"
                  value={bf.direccion}
                  onChange={(e) => onBfMemberChange(bf.id, "direccion", e.target.value)}
                  placeholder={p("BfAddress")}
                  className={`border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full ${
                    errors[`bfMembers.${idx}.direccion`]
                      ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
                  }`}
                />
                {errors[`bfMembers.${idx}.direccion`] && (
                  <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                    ⚠️ {errors[`bfMembers.${idx}.direccion`]}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onAddBfMember}
            className="inline-flex items-center gap-1.5 text-xs text-white bg-[#052B48] border border-[#c8a788]/40 px-4 py-2 rounded-lg hover:bg-[#081827] transition cursor-pointer font-semibold"
          >
            <Plus className="h-4 w-4" />
            {t("AddFinalBeneficiaryButton")}
          </button>
        </div>
      </div>  

      {/* SECTION 2: PERFIL FINANCIERO */}
      <div className="space-y-6">
        <div className="px-6 md:px-8 text-center">
          <h3 className="text-sm font-bold tracking-widest text-[#052B48] uppercase border-b border-zinc-200 pb-3 mb-6 flex items-center justify-between">
            <span>{t("FinancialProfileTitle")}</span>
          </h3>
          <p className="text-xs md:text-sm font-semibold tracking-wider text-zinc-800 italic uppercase">
            {t("LawfulOriginDeclaration")}
          </p>

          <div className="max-w-md mx-auto pt-4 text-left">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700 block mb-2" htmlFor="ingresosMensuales">
              {t("MonthlyIncomeLabel")} <span className="text-red-500 font-bold">*</span>
            </label>
            <div className="flex items-center gap-3">
              <div className="relative w-full">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-sm select-none">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  id="ingresosMensuales"
                  name="ingresosMensuales"
                  value={formData.ingresosMensuales}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.,]/g, "");
                    const syntheticEvent = {
                      ...e,
                      target: { ...e.target, name: "ingresosMensuales", value: val },
                    };
                    onInputChange(syntheticEvent as unknown as React.ChangeEvent<HTMLInputElement>);
                  }}
                  onKeyDown={(e) => {
                    if (
                      ["Backspace", "Tab", "Delete", "ArrowLeft", "ArrowRight", "Enter", "Home", "End"].includes(e.key) ||
                      e.ctrlKey ||
                      e.metaKey
                    ) {
                      return;
                    }
                    if (!/[\d.,]/.test(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  placeholder={p("MonthlyIncome")}
                  className={`w-full border rounded-lg pl-8 pr-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 font-medium ${
                    errors.ingresosMensuales
                      ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
                  }`}
                />
              </div>
              <span className="text-xs font-bold text-zinc-600 tracking-wider">USD</span>
            </div>
            {errors.ingresosMensuales && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.ingresosMensuales}
              </span>
            )}
          </div>
        </div>

        <div className="p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[#1a1c1a]">
            <div className="flex flex-col gap-2.5 md:col-span-2">
              <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">
                {t("PaymentMethodLabel")} <span className="text-red-500 font-bold">*</span>
                <span className="text-[10px] font-normal text-zinc-500 lowercase ml-1.5 italic">({t("MultipleSelectionHint")})</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {[
                  "Efectivo",
                  "Transferencia ACH",
                  "Internacional",
                  "Nacional",
                  "Cheque",
                  "Crédito (Financiamiento)",
                ].map((opt) => {
                  const selectedMedios = (formData.medioPago || "")
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                  const isSelected = selectedMedios.includes(opt);
                  return (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => {
                        let updated: string[];
                        if (isSelected) {
                          updated = selectedMedios.filter((item) => item !== opt);
                        } else {
                          updated = [...selectedMedios, opt];
                        }
                        const syntheticEvent = {
                          target: {
                            name: "medioPago",
                            value: updated.join(", "),
                          },
                        } as unknown as React.ChangeEvent<HTMLInputElement>;
                        onInputChange(syntheticEvent);
                      }}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border text-left text-xs font-semibold transition-all duration-150 cursor-pointer select-none ${
                        isSelected
                          ? "bg-[#052B48] text-white border-[#052B48] shadow-sm ring-1 ring-[#052B48]/30"
                          : "bg-[#f4f6f8] text-zinc-700 border-zinc-300 hover:bg-zinc-100 hover:border-zinc-400"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border transition-colors shrink-0 ${
                          isSelected ? "bg-[#c8a788] border-[#c8a788] text-white" : "border-zinc-400 bg-white"
                        }`}
                      >
                        {isSelected && (
                          <svg className="w-3 h-3 stroke-current stroke-[3]" fill="none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="truncate">{paymentLabel(opt)}</span>
                    </button>
                  );
                })}
              </div>
              {errors.medioPago && (
                <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                  ⚠️ {errors.medioPago}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2.5 md:col-span-2">
              <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">
                {t("PropertyFundsLabel")} <span className="text-red-500 font-bold">*</span>
                <span className="text-[10px] font-normal text-zinc-500 lowercase ml-1.5 italic">({t("MultipleSelectionHint")})</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  "Recursos propios",
                  "Financiamiento",
                  "Ambos",
                  "Terceros",
                ].map((opt) => {
                  const selectedFondos = (formData.fuenteFondosInmueble || "")
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                  const isSelected = selectedFondos.includes(opt);
                  return (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => {
                        let updated: string[];
                        if (isSelected) {
                          updated = selectedFondos.filter((item) => item !== opt);
                        } else {
                          updated = [...selectedFondos, opt];
                        }
                        const syntheticEvent = {
                          target: {
                            name: "fuenteFondosInmueble",
                            value: updated.join(", "),
                          },
                        } as unknown as React.ChangeEvent<HTMLInputElement>;
                        onInputChange(syntheticEvent);
                      }}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border text-left text-xs font-semibold transition-all duration-150 cursor-pointer select-none ${
                        isSelected
                          ? "bg-[#052B48] text-white border-[#052B48] shadow-sm ring-1 ring-[#052B48]/30"
                          : "bg-[#f4f6f8] text-zinc-700 border-zinc-300 hover:bg-zinc-100 hover:border-zinc-400"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border transition-colors shrink-0 ${
                          isSelected ? "bg-[#c8a788] border-[#c8a788] text-white" : "border-zinc-400 bg-white"
                        }`}
                      >
                        {isSelected && (
                          <svg className="w-3 h-3 stroke-current stroke-[3]" fill="none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="truncate">{fundsLabel(opt)}</span>
                    </button>
                  );
                })}
              </div>
              {errors.fuenteFondosInmueble && (
                <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                  ⚠️ {errors.fuenteFondosInmueble}
                </span>
              )}
            </div>

            {((formData.fuenteFondosInmueble || "").includes("Terceros")) && (
              <div className="bg-[#f8fafc] border border-zinc-300/80 rounded-xl p-5 md:p-6 space-y-4 animate-fadeIn shadow-sm md:col-span-2">
                <h4 className="text-xs font-bold text-[#052B48] uppercase tracking-wider border-b border-zinc-200 pb-2">
                  {t("ThirdPartyFundsTitle")}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-700">
                      {t("ThirdPartyFullNameLabel")} <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      name="terceroNombre"
                      value={formData.terceroNombre || ""}
                      onChange={onInputChange}
                      placeholder={p("ThirdPartyFullName")}
                      className={`bg-white border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 placeholder:text-zinc-400 ${
                        errors.terceroNombre
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                          : "border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
                      }`}
                    />
                    {errors.terceroNombre && (
                      <span className="text-xs text-red-500 font-medium">⚠️ {errors.terceroNombre}</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-700">
                      {t("ThirdPartyNationalityLabel")} <span className="text-red-500 font-bold">*</span>
                    </label>
                    <SearchableSelect
                      value={formData.terceroNacionalidad || ""}
                      onChange={(val) => {
                        const syntheticEvent = {
                          target: { name: "terceroNacionalidad", value: val },
                        } as unknown as React.ChangeEvent<HTMLInputElement>;
                        onInputChange(syntheticEvent);
                      }}
                      options={countries}
                      placeholder={p("SearchNationality")}
                      hasError={!!errors.terceroNacionalidad}
                    />
                    {errors.terceroNacionalidad && (
                      <span className="text-xs text-red-500 font-medium">⚠️ {errors.terceroNacionalidad}</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-700">
                      {t("ThirdPartyRelationshipLabel")} <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      name="terceroVinculo"
                      value={formData.terceroVinculo || ""}
                      onChange={onInputChange}
                      placeholder={p("ThirdPartyRelationship")}
                      className={`bg-white border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 placeholder:text-zinc-400 ${
                        errors.terceroVinculo
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                          : "border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
                      }`}
                    />
                    {errors.terceroVinculo && (
                      <span className="text-xs text-red-500 font-medium">⚠️ {errors.terceroVinculo}</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-700">
                      {t("ThirdPartyFundsSourceLabel")} <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      name="terceroFuenteFondos"
                      value={formData.terceroFuenteFondos || ""}
                      onChange={onInputChange}
                      placeholder={p("ThirdPartyFundsSource")}
                      className={`bg-white border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 placeholder:text-zinc-400 ${
                        errors.terceroFuenteFondos
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                          : "border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
                      }`}
                    />
                    {errors.terceroFuenteFondos && (
                      <span className="text-xs text-red-500 font-medium">⚠️ {errors.terceroFuenteFondos}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 md:col-span-2 pt-4 border-t border-zinc-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <label className="text-xs text-zinc-700 font-semibold leading-normal md:max-w-xl" htmlFor="adquiereMasUnidades">
                  {t("MultipleUnitsQuestion")} <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="w-full md:w-56">
                  <select
                    id="adquiereMasUnidades"
                    name="adquiereMasUnidades"
                    value={formData.adquiereMasUnidades || ""}
                    onChange={onInputChange}
                    className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 font-semibold cursor-pointer ${
                      errors.adquiereMasUnidades
                        ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20"
                        : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
                    }`}
                    required
                  >
                    <option value="">{p("SelectOption")}</option>
                    <option value="No">{yesNoLabel("No")}</option>
                    <option value="Sí">{yesNoLabel("Sí")}</option>
                  </select>
                  {errors.adquiereMasUnidades && (
                    <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                      ⚠️ {errors.adquiereMasUnidades}
                    </span>
                  )}
                </div>
              </div>

              {(formData.adquiereMasUnidades === "Sí" || formData.adquiereMasUnidades === "Si") && (
                <div className="bg-[#f8fafc] border border-zinc-300/80 rounded-xl p-4 mt-2 animate-fadeIn space-y-2">
                  <label className="text-xs font-semibold text-zinc-700" htmlFor="cantidadUnidadesInmobiliarias">
                    {t("UnitsQuantityLabel")}: <span className="text-red-500 font-bold">*</span>
                  </label>
                  <div className="max-w-xs">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      id="cantidadUnidadesInmobiliarias"
                      name="cantidadUnidadesInmobiliarias"
                      value={formData.cantidadUnidadesInmobiliarias || ""}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "");
                        const syntheticEvent = {
                          ...e,
                          target: { ...e.target, name: "cantidadUnidadesInmobiliarias", value: val },
                        };
                        onInputChange(syntheticEvent as unknown as React.ChangeEvent<HTMLInputElement>);
                      }}
                      onKeyDown={(e) => {
                        if (["Backspace", "Tab", "Delete", "ArrowLeft", "ArrowRight", "Enter", "Home", "End"].includes(e.key) || e.ctrlKey || e.metaKey) {
                          return;
                        }
                        if (!/\d/.test(e.key)) {
                          e.preventDefault();
                        }
                      }}
                      placeholder={p("UnitsQuantity")}
                      className={`w-full bg-white border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                        errors.cantidadUnidadesInmobiliarias
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                          : "border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
                      }`}
                      required
                    />
                    {errors.cantidadUnidadesInmobiliarias && (
                      <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                        ⚠️ {errors.cantidadUnidadesInmobiliarias}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: PERSONA EXPUESTA POLÍTICAMENTE (PEP) */}
      <div className="px-6 md:px-8 py-6 text-zinc-800 space-y-6">
        <h3 className="text-sm font-bold tracking-widest text-[#052B48] uppercase border-b border-zinc-200 pb-3 mb-6 flex items-center justify-between">
          <span>{t("PepTitle")}</span>
        </h3>

        <div className="bg-[#f4f6f8] p-5 rounded-xl border border-zinc-200 text-xs leading-relaxed text-zinc-700 space-y-2">
          <p className="font-bold text-[#052B48]">
            {t("PepDefinitionTitle")}
          </p>
          <p>
            {t("PepDefinition")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center pt-2">
          <p className="text-xs md:text-sm font-medium leading-relaxed text-zinc-700 md:col-span-2">
            {t("PepQuestion")} <span className="text-red-500 font-bold">*</span>
          </p>
          <div>
            <select
              name="esPep"
              value={formData.esPep || ""}
              onChange={onInputChange}
              className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 font-semibold cursor-pointer ${
                errors.esPep
                  ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20"
                  : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
              }`}
              required
            >
              <option value="">{p("SelectOption")}</option>
              <option value="No">{yesNoLabel("No")}</option>
              <option value="Sí">{yesNoLabel("Sí")}</option>
            </select>
            {errors.esPep && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.esPep}
              </span>
            )}
          </div>
        </div>

        {(formData.esPep === "Sí" || formData.esPep === "Si") && (
          <div className="bg-[#f8fafc] border border-zinc-300/80 rounded-xl p-5 md:p-6 mt-4 space-y-4 animate-fadeIn shadow-sm">
            <h4 className="text-xs font-bold text-[#052B48] uppercase tracking-wider border-b border-zinc-200 pb-2">
              {t("PepDetailsTitle")}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-700">
                  {t("PepFullNameLabel")} <span className="text-red-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  name="pepNombre"
                  value={formData.pepNombre || ""}
                  onChange={onInputChange}
                  className={`bg-white border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 placeholder:text-zinc-400 ${
                    errors.pepNombre
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
                  }`}
                  placeholder={p("PepFullName")}
                />
                {errors.pepNombre && (
                  <span className="text-xs text-red-500 font-medium">
                    ⚠️ {errors.pepNombre}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-700">
                  {t("PepPositionLabel")} <span className="text-red-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  name="pepCargo"
                  value={formData.pepCargo || ""}
                  onChange={onInputChange}
                  className={`bg-white border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 placeholder:text-zinc-400 ${
                    errors.pepCargo
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
                  }`}
                  placeholder={p("PepPosition")}
                />
                {errors.pepCargo && (
                  <span className="text-xs text-red-500 font-medium">
                    ⚠️ {errors.pepCargo}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-700">
                  {t("PepInstitutionLabel")} <span className="text-red-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  name="pepInstitucion"
                  value={formData.pepInstitucion || ""}
                  onChange={onInputChange}
                  className={`bg-white border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 placeholder:text-zinc-400 ${
                    errors.pepInstitucion
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
                  }`}
                  placeholder={p("PepInstitution")}
                />
                {errors.pepInstitucion && (
                  <span className="text-xs text-red-500 font-medium">
                    ⚠️ {errors.pepInstitucion}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-700">
                  {t("PepRelationLabel")} <span className="text-red-500 font-bold">*</span>
                </label>
                <select
                  name="pepRelacion"
                  value={formData.pepRelacion || ""}
                  onChange={onInputChange}
                  className={`bg-white border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 cursor-pointer ${
                    errors.pepRelacion
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
                  }`}
                >
                  <option value="">{p("PepRelation")}</option>
                  <option value="Representante Legal">{pepRelationLabel("Representante Legal")}</option>
                  <option value="Dignatario / Director">{pepRelationLabel("Dignatario / Director")}</option>
                  <option value="Beneficiario Final">{pepRelationLabel("Beneficiario Final")}</option>
                  <option value="Apoderado">{pepRelationLabel("Apoderado")}</option>
                  <option value="Cónyuge">{pepRelationLabel("Cónyuge")}</option>
                  <option value="Padre / Madre">{pepRelationLabel("Padre / Madre")}</option>
                  <option value="Hijo / Hija">{pepRelationLabel("Hijo / Hija")}</option>
                  <option value="Hermano / Hermana">{pepRelationLabel("Hermano / Hermana")}</option>
                  <option value="Estrecho Colaborador">{pepRelationLabel("Estrecho Colaborador")}</option>
                  <option value="Otros">{pepRelationLabel("Otros")}</option>
                </select>
                {errors.pepRelacion && (
                  <span className="text-xs text-red-500 font-medium">
                    ⚠️ {errors.pepRelacion}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
