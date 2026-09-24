"use client";

import SearchableSelect from "@/components/ui/SearchableSelect";
import { countries } from "@/lib/countries";
import { FormState } from "@/types/persona-natural";
import { PHONE_CODES } from "@/types/persona-juridica";
import { useTranslations } from "next-intl";
import es from "@/messages/es.json";
import { optionLabeler } from "@/i18n/optionLabel";

interface Step2Props {
  formData: FormState;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onSearchableSelectChange: (fieldName: keyof FormState, value: string) => void;
  errors: Record<string, string>;
}

const professions = [
  "Abogado",
  "Administrador",
  "Agrónomo",
  "Analista de Datos",
  "Arquitecto",
  "Asistente Administrativo",
  "Auditor",
  "Biólogo",
  "Chef / Cocinero",
  "Consultor",
  "Contador Público",
  "Diseñador Gráfico",
  "Economista",
  "Educador / Profesor",
  "Empresario / Dueño de Negocio",
  "Enfermero(a)",
  "Estudiante",
  "Farmacéutico",
  "Financiero",
  "Fisioterapeuta",
  "Ingeniero Civil",
  "Ingeniero de Sistemas / Software",
  "Ingeniero Eléctrico",
  "Ingeniero Industrial",
  "Ingeniero Mecánico",
  "Jubilado / Pensionado",
  "Médico / Doctor",
  "Mercadólogo",
  "Odontólogo",
  "Periodista",
  "Psicólogo",
  "Recursos Humanos",
  "Soporte Técnico",
  "Veterinario",
  "Otros",
];

const economicActivities = [
  "VAPOR Y AIRE ACONDICIONADO",
  "TELECOMUNICACIONES",
  "TRANSPORTE POR VÍA ACUÁTICA",
  "TRANSPORTE POR VÍA AÉREA",
  "TRANSPORTE POR VÍA TERRESTRE; TRANSPORTE POR TUBERÍAS",
  "REPARACIÓN Y MANTENIMIENTO DE COMPUTADORAS Y ENSERES DE USO PERSONAL Y DOMÉSTICO",
  "REPARACIÓN, MANTENIMIENTO E INSTALACIÓN DE MAQUINARIA Y EQUIPO COMERCIAL E INDUSTRIAL",
  "RESTAURANTES, BARES Y CANTINAS",
  "ACTIVIDADES DE APOYO A LA EXPLOTACIÓN DE MINAS Y CANTERAS",
  "AGRICULTURA, GANADERÍA, SILVICULTURA Y PESCA",
  "INDUSTRIAS MANUFACTURERAS",
  "CONSTRUCCIÓN",
  "COMERCIO AL POR MAYOR Y AL POR MENOR",
  "ACTIVIDADES INMOBILIARIAS",
  "ACTIVIDADES FINANCIERAS Y DE SEGUROS",
  "ENSEÑANZA",
  "ACTIVIDADES DE ATENCIÓN DE LA SALUD HUMANA",
  "OTROS",
];

export default function Step2PerfilFinanciero({
  formData,
  onInputChange,
  onSearchableSelectChange,
  errors = {},
}: Step2Props) {
  const t = useTranslations("NaturalForm.NaturalFormStep2Titles");
  const p = useTranslations("NaturalForm.NaturalFormStep2Placeholder");
  const OPTIONS = es.NaturalForm.NaturalFormStep2Options;
  const professionLabel = optionLabeler(OPTIONS.ProfesionOptions, useTranslations("NaturalForm.NaturalFormStep2Options.ProfesionOptions"));
  const activityLabel = optionLabeler(OPTIONS.ActivityOptions, useTranslations("NaturalForm.NaturalFormStep2Options.ActivityOptions"));
  const propietaryLabel = optionLabeler(OPTIONS.PropietaryOptions, useTranslations("NaturalForm.NaturalFormStep2Options.PropietaryOptions"));
  const personalActivityLabel = optionLabeler(OPTIONS.PersonalActivityOptions, useTranslations("NaturalForm.NaturalFormStep2Options.PersonalActivityOptions"));
  const yesNoLabel = optionLabeler(es.NaturalForm.TrueFalseOptions, useTranslations("NaturalForm.TrueFalseOptions"));

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-zinc-200">
      
      {/* Card A: JURISDICCIÓN / UBICACIÓN GEOGRÁFICA */}
      <div className="px-6 md:px-8 pt-6 space-y-6 text-[#1a1c1a] font-sans">
        <h3 className="text-sm font-bold tracking-widest text-[#052B48] uppercase border-b border-zinc-200 pb-3">
          {t("Title1")}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col gap-2 md:col-span-3">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="direccionResidencial">
              {t("DirectionTitle")} <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="text"
              id="direccionResidencial"
              name="direccionResidencial"
              value={formData.direccionResidencial || ""}
              onChange={onInputChange}
              placeholder={p("DirectionPlaceholder")}
              className={`${errors.direccionResidencial ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800`}
              required
            />
            {errors.direccionResidencial && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.direccionResidencial}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="ciudad">
              {t("CityTitle")}
            </label>
            <input
              type="text"
              id="ciudad"
              name="ciudad"
              value={formData.ciudad || ""}
              onChange={onInputChange}
              placeholder={p("CityPlaceholder")}
              className={`${errors.ciudad ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800`}
            />
            {errors.ciudad && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.ciudad}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="provinciaEstado">
              {t("ProvinceTitle")}
            </label>
            <input
              type="text"
              id="provinciaEstado"
              name="provinciaEstado"
              value={formData.provinciaEstado || ""}
              onChange={onInputChange}
              placeholder={p("ProvincePlaceholder")}
              className={`${errors.provinciaEstado ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800`}
            />
            {errors.provinciaEstado && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.provinciaEstado}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">
              {t("CountryTitle")}
            </label>
            <SearchableSelect
              options={countries}
              value={formData.paisResidencial || ""}
              onChange={(value) => onSearchableSelectChange("paisResidencial", value)}
              placeholder={p("CountryPlaceholder")}
             hasError={!!errors.paisResidencial} />
            {errors.paisResidencial && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.paisResidencial}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="email">
              {t("MailTitle")} <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email || ""}
              onChange={onInputChange}
              placeholder={p("MailPlaceholder")}
              className={`${errors.email ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800`}
              required
            />
            {errors.email && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.email}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="telefono">
              {t("TelefonoTitle")}
            </label>
            <div className="flex gap-1 w-full">
              <select
                name="telefonoCodigo"
                value={formData.telefonoCodigo || "+507"}
                onChange={onInputChange}
                className="bg-[#f4f6f8] border border-zinc-300 rounded-lg px-1 py-2 text-xs focus:outline-none focus:border-[#052B48] focus:ring-1 focus:ring-[#052B48] transition text-zinc-800 w-18 shink-0"
              >
                {PHONE_CODES.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.code}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                id="telefono"
                name="telefono"
                value={formData.telefono || ""}
                onChange={onInputChange}
                placeholder={p("TelefonoPlaceholder")}
                className="bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20 border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 flex-1 min-w-0 w-full"
              />
           
            </div>
            {errors.telefono && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.telefono}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="celular">
              {t("CelularTitle")} <span className="text-red-500 font-bold">*</span>
            </label>
            <div className="flex gap-1 w-full">
              <select
                name="celularCodigo"
                value={formData.celularCodigo || "+507"}
                onChange={onInputChange}
                className="bg-[#f4f6f8] border border-zinc-300 rounded-lg px-1 py-2 text-xs focus:outline-none focus:border-[#052B48] focus:ring-1 focus:ring-[#052B48] transition text-zinc-800 w-18 shrink-0"
              >
                {PHONE_CODES.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.code}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                id="celular"
                name="celular"
                value={formData.celular || ""}
                onChange={onInputChange}
                placeholder={p("CelularPlaceholder")}
                className="bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20 border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 flex-1 min-w-0 w-full"
                required
              />
            
            </div>
            {errors.celular && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.celular}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Card B: Datos Laborales */}
      <div className="px-6 md:px-8 pt-6 space-y-6 text-[#1a1c1a] font-sans">
        <h3 className="text-sm font-bold tracking-widest text-[#052B48] uppercase border-b border-zinc-200 pb-3">
          {t("Title2")}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">
              {t("ProfesionTitle")} <span className="text-red-500 font-bold">*</span>
            </label>
            <SearchableSelect
              options={professions}
              value={formData.profession || ""}
              onChange={(value) => onSearchableSelectChange("profession", value)}
              placeholder={p("ProfesionPlaceholder")}
              getLabel={professionLabel}
             hasError={!!errors.profession} />
            {errors.profession && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.profession}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">
              {t("CountryJurTitle")}
            </label>
            <SearchableSelect
              options={countries}
              value={formData.paisActividadLaboral || ""}
              onChange={(value) => onSearchableSelectChange("paisActividadLaboral", value)}
              placeholder={p("CountryJurPlaceholder")}
             hasError={!!errors.paisActividadLaboral} />
            {errors.paisActividadLaboral && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.paisActividadLaboral}
              </span>
            )}
          </div>

          {/* Conditional field for specifying custom profession */}
          {formData.profession === "Otros" && (
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-[11px] font-bold tracking-wider uppercase text-[#052B48]" htmlFor="profesionOtros">
                {t("OtherProfesionTitle")} <span className="text-red-500 font-bold">*</span>
              </label>
              <input
                type="text"
                id="profesionOtros"
                name="profesionOtros"
                value={formData.profesionOtros || ""}
                onChange={onInputChange}
                placeholder={p("OtherProfesionPlaceholder")}
                className={`${errors.profesionOtros ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800`}
                required
              />
            {errors.profesionOtros && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.profesionOtros}
              </span>
            )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="employer">
              {t("CompanyTitle")} <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="text"
              id="employer"
              name="employer"
              value={formData.employer || ""}
              onChange={onInputChange}
              placeholder={p("CompanyPlaceholder")}
              className={`${errors.employer ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800`}
              required
            />
            {errors.employer && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.employer}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">
              {t("CompanyActivityTitle")}
            </label>
            <SearchableSelect
              options={economicActivities}
              value={formData.actividadLaboral || ""}
              onChange={(value) => onSearchableSelectChange("actividadLaboral", value)}
              placeholder={p("CompanyActivityPlaceholder")}
              getLabel={activityLabel}
             hasError={!!errors.actividadLaboral} />
            {errors.actividadLaboral && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.actividadLaboral}
              </span>
            )}
          </div>

          {/* Conditional field for specifying custom activity */}
          {formData.actividadLaboral === "OTROS" && (
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-[11px] font-bold tracking-wider uppercase text-[#052B48]" htmlFor="actividadLaboralOtros">
                {t("OtherCompanyActivityTitle")} <span className="text-red-500 font-bold">*</span>
              </label>
              <input
                type="text"
                id="actividadLaboralOtros"
                name="actividadLaboralOtros"
                value={formData.actividadLaboralOtros || ""}
                onChange={onInputChange}
                placeholder={p("OtherCompanyActivityPlaceholder")}
                className={`${errors.actividadLaboralOtros ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800`}
                required
              />
            {errors.actividadLaboralOtros && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.actividadLaboralOtros}
              </span>
            )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="direccionLaboral">
              {t("CompanyDirectionTitle")}
            </label>
            <input
              type="text"
              id="direccionLaboral"
              name="direccionLaboral"
              value={formData.direccionLaboral || ""}
              onChange={onInputChange}
              placeholder={p("CompanyDirectionPlaceholder")}
              className={`${errors.direccionLaboral ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800`}
            />
            {errors.direccionLaboral && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.direccionLaboral}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="cargoDesempena">
              {t("CargoTitle")}
            </label>
            <input
              type="text"
              id="cargoDesempena"
              name="cargoDesempena"
              value={formData.cargoDesempena || ""}
              onChange={onInputChange}
              placeholder={p("CargoPlaceholder")}
              className={`${errors.cargoDesempena ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800`}
            />
            {errors.cargoDesempena && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.cargoDesempena}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="esPropietario">
              {t("PropietaryTitle")}
            </label>
            <SearchableSelect
              options={["No", "Propietario", "Accionista", "Miembro de la sociedad"]}
              value={formData.esPropietario || "No"}
              onChange={(value) => onSearchableSelectChange("esPropietario", value)}
              placeholder={propietaryLabel("No")}
              getLabel={propietaryLabel}
              hasError={!!errors.esPropietario}
            />
            {errors.esPropietario && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.esPropietario}
              </span>
            )}
          </div>
          {/* Conditional field for specifying custom porpietary */}
          {formData.esPropietario !== "No" && formData.esPropietario !== ""   && (
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="usaFondos">
                {t("PropietaryFundsTitle")}
              </label>
              <SearchableSelect
                options={["No", "Sí"]}
                value={formData.usaFondos || ""}
                onChange={(value) => onSearchableSelectChange("usaFondos", value)}
                placeholder={yesNoLabel("No")}
                getLabel={yesNoLabel}
                hasError={!!errors.usaFondos}
              />
              {errors.usaFondos && (
                <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                  ⚠️ {errors.usaFondos}
                </span>
              )}
            </div>
          )}
          
        </div>
      </div>

      {/* Card C: ACTIVIDADES ECONÓMICAS O PROFESIONALES */}
      <div className="p-6 md:p-8 space-y-6 text-[#1a1c1a] font-sans">
        <div className="border-b border-zinc-200 pb-3">
          <h3 className="text-sm font-bold tracking-widest text-[#052B48] uppercase">
            {t("Title3")}
          </h3>
          <p className="text-[10px] text-zinc-550 italic mt-1 font-sans leading-normal">
            {t("SubtTitle3")}
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold tracking-wider uppercase text-zinc-500" htmlFor="actEconPrincipal">
                {t("PersonalActivityTitle")}
              </label>
              <SearchableSelect
                options={["Asalariado", "Trabajador independiente", "Ingresos provenientes de empresas propias", "Otros"]}
                value={formData.actEconPrincipal || ""}
                onChange={(value) => onSearchableSelectChange("actEconPrincipal", value)}
                placeholder={p("PersonalActivityPlaceholder")}
                getLabel={personalActivityLabel}
                hasError={!!errors.actEconPrincipal}
              />
              
            {errors.actEconPrincipal && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.actEconPrincipal}
              </span>
            )}
            </div>
            {/* Conditional field for specifying other activities */}
            {formData.actEconPrincipal === "Otros" && (
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold tracking-wider uppercase text-zinc-500" htmlFor="otroActEcon">
                {t("OtherPersonalActivityTitle")}
              </label>
                <input
                  type="text"
                  id="otroActEcon"
                  name="otroActEcon"
                  value={formData.otroActEcon || ""}
                  onChange={onInputChange}
                  placeholder={p("OtherPersonalActivityPlaceholder")}
                  className={`${errors.otroActEcon ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800`}
                />
              
            {errors.otroActEcon && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.otroActEcon}
              </span>
            )}
            </div>
            )}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold tracking-wider uppercase text-zinc-500" htmlFor="pctDedicacionPrincipal">
                {t("PercActivityTitle")}
              </label>
              <input
                type="number"
                id="pctDedicacionPrincipal"
                name="pctDedicacionPrincipal"
                min="0"
                max="100"
                step="any"
                value={formData.pctDedicacionPrincipal || ""}
                onChange={onInputChange}
                onKeyDown={(e) => {
                  if (["e", "E", "+", "-"].includes(e.key)) {
                    e.preventDefault();
                  }
                }}
                placeholder={p("PercActivityPlaceholder")}
                className={`${errors.pctDedicacionPrincipal ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800`}
              />
            {errors.pctDedicacionPrincipal && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.pctDedicacionPrincipal}
              </span>
            )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold tracking-wider uppercase text-zinc-500" htmlFor="jurisdiccionPrincipal">
                {t("JurActivityTitle")}
              </label>
              <input
                type="text"
                id="jurisdiccionPrincipal"
                name="jurisdiccionPrincipal"
                value={formData.jurisdiccionPrincipal || ""}
                onChange={onInputChange}
                placeholder={p("JurActivityPlaceholder")}
                className={`${errors.jurisdiccionPrincipal ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800`}
              />
            {errors.jurisdiccionPrincipal && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.jurisdiccionPrincipal}
              </span>
            )}
            </div>
          </div>

          <hr className="border-zinc-200" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold tracking-wider uppercase text-zinc-500" htmlFor="actEconSecundaria">
                {t("OtherActivityTitle")}
              </label>
              <input
                  type="text"
                  id="actEconSecundaria"
                  name="actEconSecundaria"
                  value={formData.actEconSecundaria || ""}
                  onChange={onInputChange}
                  placeholder={p("OtherActivityPlaceholder")}
                  className={`${errors.actEconSecundaria ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800`}
                />
            {errors.actEconSecundaria && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.actEconSecundaria}
              </span>
            )}
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold tracking-wider uppercase text-zinc-500" htmlFor="pctDedicacionSecundaria">
                {t("PercOtherActivityTitle")}
              </label>
              <input
                type="number"
                id="pctDedicacionSecundaria"
                name="pctDedicacionSecundaria"
                min="0"
                max="100"
                step="any"
                value={formData.pctDedicacionSecundaria || ""}
                onChange={onInputChange}
                onKeyDown={(e) => {
                  if (["e", "E", "+", "-"].includes(e.key)) {
                    e.preventDefault();
                  }
                }}
                placeholder={p("PercOtherActivityPlaceholder")}
                className={`${errors.pctDedicacionSecundaria ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800`}
              />
            {errors.pctDedicacionSecundaria && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.pctDedicacionSecundaria}
              </span>
            )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold tracking-wider uppercase text-zinc-500" htmlFor="jurisdiccionSecundaria">
                {t("JurOtherActivityTitle")}
              </label>
              <input
                type="text"
                id="jurisdiccionSecundaria"
                name="jurisdiccionSecundaria"
                value={formData.jurisdiccionSecundaria || ""}
                onChange={onInputChange}
                placeholder={p("JurOtherActivityPlaceholder")}
                className={`${errors.jurisdiccionSecundaria ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800`}
              />
            {errors.jurisdiccionSecundaria && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.jurisdiccionSecundaria}
              </span>
            )}
            </div>

            
          </div>
        </div>
      </div>

    </div>
  );
}
