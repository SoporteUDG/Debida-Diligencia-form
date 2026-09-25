"use client";

import SearchableSelect from "@/components/ui/SearchableSelect";
import { countries } from "@/lib/countries";
import { FormState, GjcMember } from "@/types/persona-juridica";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import es from "@/messages/es.json";
import { optionLabeler } from "@/i18n/optionLabel";

interface Step2Props {
  formData: FormState;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onSearchableSelectChange: (fieldName: keyof FormState, value: string) => void;
  onAddGjcMember: () => void;
  onRemoveGjcMember: (id: string) => void;
  onGjcMemberChange: (id: string, field: keyof GjcMember, value: string) => void;
  errors: Record<string, string>;
}

export default function Step2GobiernoRL({
  formData,
  onInputChange,
  onSearchableSelectChange,
  onAddGjcMember,
  onRemoveGjcMember,
  onGjcMemberChange,
  errors = {},
}: Step2Props) {
  const t = useTranslations("JuridicaForm.JuridicaFormStep2Titles");
  const p = useTranslations("JuridicaForm.JuridicaFormStep2Placeholders");
  const OPTIONS = es.JuridicaForm.JuridicaFormStep2Options;
  const cargoLabel = optionLabeler(OPTIONS.CargoOptions, useTranslations("JuridicaForm.JuridicaFormStep2Options.CargoOptions"));
  const estadoCivilLabel = optionLabeler(OPTIONS.EstadoCivilOptions, useTranslations("JuridicaForm.JuridicaFormStep2Options.EstadoCivilOptions"));
  const yesNoLabel = optionLabeler(es.JuridicaForm.TrueFalseOptions, useTranslations("JuridicaForm.TrueFalseOptions"));
  const members = formData.gjcMembers || [];
  const minMemberError = members.length <= 1;

  // Helper validation for each member
  const isMemberComplete = (m: GjcMember) => {
    return !!(
      m.cargo?.trim() &&
      m.nombre?.trim() &&
      m.apellidos?.trim() &&
      m.nacionalidad?.trim() &&
      m.fechaNacimiento?.trim() &&
      m.nroId?.trim() &&
      m.direccion?.trim()
    );
  };

  const hasIncompleteMembers = members.some(m => !isMemberComplete(m));

  return (
    <div className="bg-white rounded-2xl shadow-xl">
      
      {/* Card: GOBIERNO CORPORATIVO */}
      <div className="px-6 md:px-8 pt-6 space-y-6">
        <div className="border-b border-zinc-200 pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold tracking-widest text-[#052B48] uppercase">
              {t("GovernanceTitle")} **
            </h3>
            <p className="text-[11px] text-zinc-500 mt-1">
              {t("GovernanceDescription")}
            </p>
          </div>
          <button
            type="button"
            onClick={onAddGjcMember}
            className="inline-flex items-center gap-1.5 text-xs text-white bg-[#052B48] border border-[#052B48] px-4 py-2 rounded-lg hover:bg-[#081827] transition cursor-pointer font-sans font-semibold active:scale-95"
          >
            <Plus className="h-4 w-4" />
            {t("AddMemberButton")}
          </button>
        </div>

        {/* Dynamic List Validation Banner */}
        {errors.gjcMembers && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold">{t("StructureErrorLabel")}</span> {errors.gjcMembers}
            </div>
          </div>
        )}

        {hasIncompleteMembers && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold">{t("PendingInfoLabel")}</span> {t("PendingInfoText")}
            </div>
          </div>
        )}

        {members.length === 0 ? (
          <div className="text-center py-8 bg-[#f4f6f8] rounded-xl border border-dashed border-zinc-300 text-zinc-600 text-xs space-y-3">
            <p>{t("NoMembersText")}</p>
            <button
              type="button"
              onClick={onAddGjcMember}
              className="inline-flex items-center gap-1.5 text-xs text-[#052B48] border border-[#052B48]/30 px-3 py-1.5 rounded-lg hover:bg-[#052B48]/10 font-semibold transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("CreateInitialRecordButton")}
            </button>
          </div>
        ) : (
          <div className="space-y-8 pb-8 border-b border-zinc-200">
            {members.map((member, idx) => {
              const complete = isMemberComplete(member);

              return (
                <div 
                  key={member.id} 
                  className={`bg-[#faf9f6]/60 border p-6 rounded-xl relative space-y-6 animate-fadeIn transition-colors ${
                    complete ? "border-zinc-200" : "border-amber-300/80 bg-amber-50/20"
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-zinc-200/60 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] bg-[#052B48] text-white px-2.5 py-1 rounded-full font-bold uppercase">
                        {t("MemberNumber", { number: idx + 1 })}
                      </span>
                      {!complete && (
                        <span className="text-[10px] text-amber-700 font-semibold bg-amber-100 px-2 py-0.5 rounded">
                          {t("IncompleteBadge")}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (minMemberError) {
                            alert(t("MinMemberAlert"));
                            return;
                          }
                          onRemoveGjcMember(member.id);
                        }}
                        disabled={minMemberError}
                        className={`p-1.5 rounded transition ${
                          minMemberError
                            ? "text-zinc-300 cursor-not-allowed opacity-50"
                            : "text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                        }`}
                        title={minMemberError ? t("MinMemberTooltip") : t("RemoveMemberTooltip")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[#1a1c1a]">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">
                        {idx + 1} - {t("MemberCargo")} <span className="text-red-500 font-bold">*</span>
                      </label>
                      <select
                        value={member.cargo}
                        onChange={(e) => onGjcMemberChange(member.id, "cargo", e.target.value)}
                        className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                          errors[`gjcMembers.${idx}.cargo`]
                            ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20"
                            : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
                        }`}
                        required
                      >
                        <option value="">{p("SelectCargo")}</option>
                        <option value="Presidente">{cargoLabel("Presidente")}</option>
                        <option value="Vicepresidente">{cargoLabel("Vicepresidente")}</option>
                        <option value="Secretario">{cargoLabel("Secretario")}</option>
                        <option value="Tesorero">{cargoLabel("Tesorero")}</option>
                        <option value="Director">{cargoLabel("Director")}</option>
                        <option value="Dignatario">{cargoLabel("Dignatario")}</option>
                        <option value="Vocal">{cargoLabel("Vocal")}</option>
                        <option value="Protector">{cargoLabel("Protector")}</option>
                        <option value="Otro">{cargoLabel("Otro")}</option>
                      </select>
                      {errors[`gjcMembers.${idx}.cargo`] && (
                        <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                          ⚠️ {errors[`gjcMembers.${idx}.cargo`]}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">
                        {idx + 1} - {t("MemberNombre")} <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input
                        type="text"
                        value={member.nombre}
                        onChange={(e) => onGjcMemberChange(member.id, "nombre", e.target.value)}
                        placeholder={p("MemberNombre")}
                        className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                          errors[`gjcMembers.${idx}.nombre`]
                            ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20"
                            : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
                        }`}
                        required
                      />
                      {errors[`gjcMembers.${idx}.nombre`] && (
                        <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                          ⚠️ {errors[`gjcMembers.${idx}.nombre`]}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">
                        {idx + 1} - {t("MemberApellidos")} <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input
                        type="text"
                        value={member.apellidos}
                        onChange={(e) => onGjcMemberChange(member.id, "apellidos", e.target.value)}
                        placeholder={p("MemberApellidos")}
                        className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                          errors[`gjcMembers.${idx}.apellidos`]
                            ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20"
                            : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
                        }`}
                        required
                      />
                      {errors[`gjcMembers.${idx}.apellidos`] && (
                        <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                          ⚠️ {errors[`gjcMembers.${idx}.apellidos`]}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">
                        {idx + 1} - {t("MemberNacionalidad")} <span className="text-red-500 font-bold">*</span>
                      </label>
                      <SearchableSelect
                        value={member.nacionalidad}
                        onChange={(val) => onGjcMemberChange(member.id, "nacionalidad", val)}
                        options={countries}
                        placeholder={p("MemberNacionalidad")}
                        hasError={!!errors[`gjcMembers.${idx}.nacionalidad`]}
                      />
                      {errors[`gjcMembers.${idx}.nacionalidad`] && (
                        <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                          ⚠️ {errors[`gjcMembers.${idx}.nacionalidad`]}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">
                        {idx + 1} - {t("MemberFechaNacimiento")} <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input
                        type="date"
                        value={member.fechaNacimiento}
                        onChange={(e) => onGjcMemberChange(member.id, "fechaNacimiento", e.target.value)}
                        className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                          errors[`gjcMembers.${idx}.fechaNacimiento`]
                            ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20"
                            : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
                        }`}
                        required
                      />
                      {errors[`gjcMembers.${idx}.fechaNacimiento`] && (
                        <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                          ⚠️ {errors[`gjcMembers.${idx}.fechaNacimiento`]}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">
                        {idx + 1} - {t("MemberNroId")} <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input
                        type="text"
                        value={member.nroId}
                        onChange={(e) => onGjcMemberChange(member.id, "nroId", e.target.value)}
                        placeholder={p("MemberNroId")}
                        className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                          errors[`gjcMembers.${idx}.nroId`]
                            ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20"
                            : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
                        }`}
                        required
                      />
                      {errors[`gjcMembers.${idx}.nroId`] && (
                        <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                          ⚠️ {errors[`gjcMembers.${idx}.nroId`]}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5 md:col-span-3">
                      <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">
                        {idx + 1} - {t("MemberDireccion")} <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input
                        type="text"
                        value={member.direccion}
                        onChange={(e) => onGjcMemberChange(member.id, "direccion", e.target.value)}
                        placeholder={p("MemberDireccion")}
                        className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                          errors[`gjcMembers.${idx}.direccion`]
                            ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20"
                            : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
                        }`}
                        required
                      />
                      {errors[`gjcMembers.${idx}.direccion`] && (
                        <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                          ⚠️ {errors[`gjcMembers.${idx}.direccion`]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Card: REPRESENTANTE LEGAL O APODERADO */}
      <div className="px-6 md:px-8 pt-6">
        <h3 className="text-sm font-bold tracking-widest text-[#052B48] uppercase border-b border-zinc-200 pb-3 mb-6 flex items-center justify-between">
          <span>{t("LegalRepTitle")}</span>
          <span className="text-[10px] text-zinc-400 lowercase font-normal italic">{t("LegalRepSubtitle")}</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[#1a1c1a]">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="rlNombre">
              {t("RlNombre")}
            </label>
            <input
              type="text"
              id="rlNombre"
              name="rlNombre"
              value={formData.rlNombre}
              onChange={onInputChange}
              placeholder={p("RlNombre")}
              className={`${errors.rlNombre ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
            />
            {errors.rlNombre && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.rlNombre}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="rlFechaNacimiento">
              {t("RlFechaNacimiento")} <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="date"
              id="rlFechaNacimiento"
              name="rlFechaNacimiento"
              value={formData.rlFechaNacimiento}
              onChange={onInputChange}
              className={`${errors.rlFechaNacimiento ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
              required
            />
            {errors.rlFechaNacimiento && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.rlFechaNacimiento}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="rlNacionalidad">
              {t("RlNacionalidad")}
            </label>
            <SearchableSelect
              id="rlNacionalidad"
              value={formData.rlNacionalidad}
              onChange={(val) => onSearchableSelectChange("rlNacionalidad", val)}
              options={countries}
              placeholder={p("SearchCountry")}
             hasError={!!errors.rlNacionalidad} />
            {errors.rlNacionalidad && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.rlNacionalidad}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="rlEstadoCivil">
              {t("RlEstadoCivil")} <span className="text-red-500 font-bold">*</span>
            </label>
            <select
              id="rlEstadoCivil"
              name="rlEstadoCivil"
              value={formData.rlEstadoCivil || ""}
              onChange={onInputChange}
              className={`${errors.rlEstadoCivil ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full cursor-pointer`}
              required
            >
              <option value="">{p("SelectEstadoCivil")}</option>
              <option value="Casado">{estadoCivilLabel("Casado")}</option>
              <option value="Soltero">{estadoCivilLabel("Soltero")}</option>
              <option value="Divorciado">{estadoCivilLabel("Divorciado")}</option>
              <option value="Viudo">{estadoCivilLabel("Viudo")}</option>
              <option value="Unido">{estadoCivilLabel("Unido")}</option>
            </select>
            {errors.rlEstadoCivil && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.rlEstadoCivil}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="rlNoIdentificacion">
              {t("RlNoIdentificacion")}
            </label>
            <input
              type="text"
              id="rlNoIdentificacion"
              name="rlNoIdentificacion"
              value={formData.rlNoIdentificacion}
              onChange={onInputChange}
              placeholder={p("RlNoIdentificacion")}
              className={`${errors.rlNoIdentificacion ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
            />
            {errors.rlNoIdentificacion && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.rlNoIdentificacion}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="rlProfesionOcupacion">
              {t("RlProfesionOcupacion")} <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="text"
              id="rlProfesionOcupacion"
              name="rlProfesionOcupacion"
              value={formData.rlProfesionOcupacion}
              onChange={onInputChange}
              placeholder={p("RlProfesionOcupacion")}
              className={`${errors.rlProfesionOcupacion ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
              required
            />
            {errors.rlProfesionOcupacion && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.rlProfesionOcupacion}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="rlActividadEconomica">
              {t("RlActividadEconomica")}
            </label>
            <input
              type="text"
              id="rlActividadEconomica"
              name="rlActividadEconomica"
              value={formData.rlActividadEconomica}
              onChange={onInputChange}
              placeholder={p("RlActividadEconomica")}
              className={`${errors.rlActividadEconomica ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
            />
            {errors.rlActividadEconomica && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.rlActividadEconomica}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="rlDireccion">
              {t("RlDireccion")}
            </label>
            <input
              type="text"
              id="rlDireccion"
              name="rlDireccion"
              value={formData.rlDireccion}
              onChange={onInputChange}
              placeholder={p("RlDireccion")}
              className={`${errors.rlDireccion ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
            />
            {errors.rlDireccion && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.rlDireccion}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="rlPaisResidencia">
              {t("RlPaisResidencia")}
            </label>
            <SearchableSelect
              id="rlPaisResidencia"
              value={formData.rlPaisResidencia}
              onChange={(val) => onSearchableSelectChange("rlPaisResidencia", val)}
              options={countries}
              placeholder={p("SearchCountry")}
             hasError={!!errors.rlPaisResidencia} />
            {errors.rlPaisResidencia && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.rlPaisResidencia}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="rlTelefono">
              {t("RlTelefono")}
            </label>
            <input
              type="tel"
              id="rlTelefono"
              name="rlTelefono"
              value={formData.rlTelefono}
              onChange={onInputChange}
              placeholder={p("RlTelefono")}
              className={`${errors.rlTelefono ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
            />
            {errors.rlTelefono && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.rlTelefono}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Card: PREGUNTA LEGAL AML */}
      <div className="px-6 md:px-8 py-6 shadow-xl space-y-4">
        <h3 className="text-sm font-bold tracking-widest text-[#052B48] uppercase border-b border-zinc-200 pb-3 mb-6 flex items-center justify-between">
          <span>{t("AmlTitle")}</span>
          <span className="text-[10px] text-zinc-400 lowercase font-normal italic">{t("AmlRequired")}</span>
        </h3>
        <p className="text-xs md:text-sm font-medium leading-relaxed text-zinc-700">
          {t("AmlQuestion")}
        </p>
        <div className="max-w-xs">
          <select
            name="rlObjetoInvestigacion"
            value={formData.rlObjetoInvestigacion || ""}
            onChange={onInputChange}
            className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 font-semibold cursor-pointer ${
              errors.rlObjetoInvestigacion
                ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20"
                : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
            }`}
            required
          >
            <option value="">{p("SelectAnswer")}</option>
            <option value="Sí">{yesNoLabel("Sí")}</option>
            <option value="No">{yesNoLabel("No")}</option>
          </select>
          {errors.rlObjetoInvestigacion && (
            <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
              ⚠️ {errors.rlObjetoInvestigacion}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
