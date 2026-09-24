"use client";

import SearchableSelect from "@/components/ui/SearchableSelect";
import { countries } from "@/lib/countries";
import { FormState } from "@/types/persona-natural";
import { PHONE_CODES } from "@/types/persona-juridica";
import { useTranslations } from "next-intl";
import es from "@/messages/es.json";
import { optionLabeler } from "@/i18n/optionLabel";

interface Step1Props {
  formData: FormState;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onSearchableSelectChange: (fieldName: keyof FormState, value: string) => void;
  errors: Record<string, string>;
}

const OPTIONS = es.NaturalForm.NaturalFormStep1OptionFields;

export default function Step1DatosPersonales({
  formData,
  onInputChange,
  onSearchableSelectChange,
  errors = {},
}: Step1Props) {

  const t = useTranslations("NaturalForm.NaturalFormStep1Titles");
  const p = useTranslations("NaturalForm.NaturalFormStep1PlaceHolders");
  const civilLabel = optionLabeler(OPTIONS.civilOptions, useTranslations("NaturalForm.NaturalFormStep1OptionFields.civilOptions"));
  const typeIdLabel = optionLabeler(OPTIONS.TypeIdOption, useTranslations("NaturalForm.NaturalFormStep1OptionFields.TypeIdOption"));
  const migrationLabel = optionLabeler(OPTIONS.MigrationOption, useTranslations("NaturalForm.NaturalFormStep1OptionFields.MigrationOption"));

  return (
    <div className="bg-white rounded-2xl ">

      {/* Card A: Proyecto e Información de Contacto Inicial */}
      <div className="px-6 md:px-8 pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700 flex items-center gap-1" htmlFor="nombreProyecto">
              <span>{t("ProjectTitle")}</span>
              <span className="text-red-500 font-bold">*</span>
            </label>
            <select
              id="nombreProyecto"
              name="nombreProyecto"
              value={formData.nombreProyecto || ""}
              onChange={onInputChange}
              className={`w-full bg-[#f4f6f8] border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                errors.nombreProyecto
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                  : "border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
              }`}
              required
            >
              <option value="">{p("ProjectPlaceholder")}</option>
              <option value="Altos del Parque">Altos del Parque</option>
              <option value="Caminos de Centennial">Caminos de Centennial</option>
              <option value="Deici">Deici</option>
              <option value="Guayacán">Guayacán</option>
              <option value="Living73">Living73</option>
              <option value="New West I">New West I</option>
              <option value="New West II">New West II</option>
              <option value="Paramount">Paramount</option>
              <option value="Spotlight">Spotlight</option>
              <option value="The Hub">The Hub</option>
            </select>
            {errors.nombreProyecto && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.nombreProyecto}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700 font-semibold" htmlFor="formaContacto">
              {t("MediumTitle")}
            </label>
            <select
              id="formaContacto"
              name="formaContacto"
              value={formData.formaContacto || ""}
              onChange={onInputChange}
              className={`w-full bg-[#f4f6f8] border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 cursor-pointer ${
                errors.formaContacto
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                  : "border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
              }`}
            >
              <option value="">{p("MediumPlaceholder")}</option>
              <option value="Pagina Web">Pagina Web</option>
              <option value="Alta Gerencia">Alta Gerencia</option>
              <option value="BBDD interna">BBDD interna</option>
              <option value="BD Vendedor">BD Vendedor</option>
              <option value="Broker">Broker</option>
              <option value="Camapañas internas">Camapañas internas</option>
              <option value="Chat">Chat</option>
              <option value="Encuentra 24">Encuentra 24</option>
              <option value="Eventos">Eventos</option>
              <option value="Facebook">Facebook</option>
              <option value="Ferias">Ferias</option>
              <option value="Google AdWords">Google AdWords</option>
              <option value="Instagram">Instagram</option>
              <option value="Landing casa desde 150">Landing casa desde 150</option>
              <option value="Linkedln">Linkedln</option>
              <option value="Referido">Referido</option>
              <option value="Timelines">Timelines</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Sala de Ventas">Sala de Ventas</option>
              <option value="Valla">Valla</option>
              <option value="Otros">Otros</option>
            </select>
            {errors.formaContacto && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.formaContacto}
              </span>
            )}
          </div>

          {/* Campo condicional para 'Otros' */}
          {(formData.formaContacto === "Otros" || formData.formaContacto === "Otro") && (
            <div className="flex flex-col gap-2 md:col-span-2 animate-fadeIn">
              <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="formaContactoDetalle">
                {t("OtherMedium")} <span className="text-red-500 font-bold">*</span>
              </label>
              <input
                type="text"
                id="formaContactoDetalle"
                name="formaContactoDetalle"
                value={formData.formaContactoDetalle || ""}
                onChange={onInputChange}
                placeholder={p("OtherMediumPlaceholder")}
                className={`bg-[#f4f6f8] border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                  errors.formaContactoDetalle
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                    : "border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
                }`}
              />
              {errors.formaContactoDetalle && (
                <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                  ⚠️ {errors.formaContactoDetalle}
                </span>
              )}
            </div>
          )}

          {/* Campo condicional para 'Referido' */}
          {formData.formaContacto === "Referido" && (
            <div className="flex flex-col gap-2 md:col-span-2 animate-fadeIn">
              <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="referidoPor">
                {t("referredMedium")} <span className="text-red-500 font-bold">*</span>
              </label>
              <input
                type="text"
                id="referidoPor"
                name="referidoPor"
                value={formData.referidoPor || ""}
                onChange={onInputChange}
                placeholder={p("referredMediumPlaceholder")}
                className={`bg-[#f4f6f8] border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                  errors.referidoPor
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                    : "border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
                }`}
              />
              {errors.referidoPor && (
                <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                  ⚠️ {errors.referidoPor}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Card B: IDENTIFICACIÓN DEL CLIENTE ** */}
      <div className="p-6 md:p-8 space-y-6 text-[#1a1c1a] font-sans">
        <h3 className="text-sm font-bold tracking-widest text-[#052B48] uppercase border-b border-zinc-200 pb-3 font-sans">
          {t("FirstSubtitle")}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="firstName">
              {t("NameTitle")} <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={formData.firstName || ""}
              onChange={onInputChange}
              placeholder={p("NamePlaceholder")}
              className={`bg-[#f4f6f8] border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                errors.firstName
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                  : "border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
              }`}
              required
            />
            {errors.firstName && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.firstName}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="lastName">
              {t("LastnameTitle")} <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={formData.lastName || ""}
              onChange={onInputChange}
              placeholder={p("LastnamePlaceholder")}
              className={`bg-[#f4f6f8] border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                errors.lastName
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                  : "border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
              }`}
              required
            />
            {errors.lastName && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.lastName}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">
              {t("BirthCountryTitle")} <span className="text-red-500 font-bold">*</span>
            </label>
            <SearchableSelect
              options={countries}
              value={formData.paisNacimiento || ""}
              onChange={(value) => onSearchableSelectChange("paisNacimiento", value)}
              placeholder={p("BirthCountryPlaceholder")}
              hasError={!!errors.paisNacimiento}
            />
            {errors.paisNacimiento && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.paisNacimiento}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">
              {t("FiscalCountryTitle")}
            </label>
            <SearchableSelect
              options={countries}
              value={formData.paisResidenciaFiscal || ""}
              onChange={(value) => onSearchableSelectChange("paisResidenciaFiscal", value)}
              placeholder={p("FiscalCountryPlaceholder")}
              hasError={!!errors.paisResidenciaFiscal}
            />
            {errors.paisResidenciaFiscal && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.paisResidenciaFiscal}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="idTributaria">
              {t("IdTributaryTitle")}
            </label>
            <input
              type="text"
              id="idTributaria"
              name="idTributaria"
              value={formData.idTributaria || ""}
              onChange={onInputChange}
              placeholder={p("IdTributaryPlaceholder")}
              className={`bg-[#f4f6f8] border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                errors.idTributaria
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                  : "border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
              }`}
            />
            {errors.idTributaria && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.idTributaria}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">
              {t("NacionalityTitle")} <span className="text-red-500 font-bold">*</span>
            </label>
            <SearchableSelect
              options={countries}
              value={formData.nationality || ""}
              onChange={(value) => onSearchableSelectChange("nationality", value)}
              placeholder={p("NacionalityPlaceholder")}
              hasError={!!errors.nationality}
            />
            {errors.nationality && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.nationality}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="tipoIdentificacion">
              {t("TypeIdTitle")}
            </label>
            <select
              id="tipoIdentificacion"
              name="tipoIdentificacion"
              value={formData.tipoIdentificacion || ""}
              onChange={onInputChange}
              className={`w-full bg-[#f4f6f8] border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                errors.tipoIdentificacion
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                  : "border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
              }`}
            >
              <option value="">{p("TypeIdPlaceholder")}</option>
              <option value="Cédula">{typeIdLabel("Cédula")}</option>
              <option value="Pasaporte">{typeIdLabel("Pasaporte")}</option>
              <option value="Carné de Residente">{typeIdLabel("Carné de Residente")}</option>
              <option value="Otro">{typeIdLabel("Otro")}</option>
            </select>
            {errors.tipoIdentificacion && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.tipoIdentificacion}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">
              {t("OtherNationalityTitle")}
            </label>
            <SearchableSelect
              options={countries}
              value={formData.otraNacionalidad || ""}
              onChange={(value) => onSearchableSelectChange("otraNacionalidad", value)}
              placeholder={p("OtherNationalityPlaceholder")}
              hasError={!!errors.otraNacionalidad}
            />
            {errors.otraNacionalidad && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.otraNacionalidad}
              </span>
            )}
          </div>

          {/* Estado Civil (Ubicación exacta según mockup: entre Otra Nacionalidad y Estatus Migratorio) */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="estadoCivil">
              {t("CivilTitle")} <span className="text-red-500 font-bold">*</span>
            </label>
            <select
              id="estadoCivil"
              name="estadoCivil"
              value={formData.estadoCivil || ""}
              onChange={onInputChange}
              className={`w-full bg-[#f4f6f8] border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 cursor-pointer ${
                errors.estadoCivil
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                  : "border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
              }`}
              required
            >
              <option value="">{p("CivilPlaceholder")}</option>
              <option value="Casado">{civilLabel("Casado")}</option>
              <option value="Soltero">{civilLabel("Soltero")}</option>
              <option value="Divorciado">{civilLabel("Divorciado")}</option>
              <option value="Viudo">{civilLabel("Viudo")}</option>
              <option value="Unido">{civilLabel("Unido")}</option>
            </select>
            {errors.estadoCivil && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.estadoCivil}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="idNumber">
              {t("IdTitle")} <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="text"
              id="idNumber"
              name="idNumber"
              value={formData.idNumber || ""}
              onChange={onInputChange}
              placeholder={p("IdPlaceholder")}
              className={`bg-[#f4f6f8] border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                errors.idNumber
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                  : "border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
              }`}
              required
            />
            {errors.idNumber && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.idNumber}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="fechaVencimientoId">
              {t("DueDateTitle")}
            </label>
            <input
              type="date"
              id="fechaVencimientoId"
              name="fechaVencimientoId"
              value={formData.fechaVencimientoId || ""}
              onChange={onInputChange}
              className={`bg-[#f4f6f8] border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                errors.fechaVencimientoId
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20 bg-red-50/10"
                  : "border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
              }`}
            />
            {errors.fechaVencimientoId && (
              <div className="text-xs text-red-700 font-medium flex items-center gap-1.5 mt-1 animate-fadeIn bg-red-50 border border-red-200 p-2.5 rounded-lg">
                <span className="text-red-600 font-bold">⚠️</span>
                <span>{errors.fechaVencimientoId}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="estatusMigratorio">
              {t("MigrationTitle")}
            </label>
            <select
              id="estatusMigratorio"
              name="estatusMigratorio"
              value={formData.estatusMigratorio || ""}
              onChange={onInputChange}
              className={`w-full bg-[#f4f6f8] border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                errors.estatusMigratorio
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                  : "border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
              }`}
            >
              <option value="">{p("MigrationPlaceholder")}</option>
              <option value="Nacional">{migrationLabel("Nacional")}</option>
              <option value="Extranjero">{migrationLabel("Extranjero")}</option>
              <option value="Extranjero - No Residente">{migrationLabel("Extranjero - No Residente")}</option>
            </select>
            {errors.estatusMigratorio && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.estatusMigratorio}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="fechaNacimiento">
              {t("BirthTitle")} <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="date"
              id="fechaNacimiento"
              name="fechaNacimiento"
              value={formData.fechaNacimiento || ""}
              onChange={onInputChange}
              className={`bg-[#f4f6f8] border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                errors.fechaNacimiento
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                  : "border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"
              }`}
              required
            />
            {errors.fechaNacimiento && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.fechaNacimiento}
              </span>
            )}

          </div>
          {/* Checkbox 3: Reutilizar datos como Representante Legal en Persona Jurídica (opcional) */}
            <div className="flex flex-col md:col-span-3 gap-2">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="compartirDatosRL"
                  name="compartirDatosRL"
                  checked={formData.compartirDatosRL}
                  onChange={onInputChange}
                  className="mt-1 h-4 w-4 rounded border-zinc-300 bg-[#f4f6f8] text-[#c8a788] accent-[#c8a788] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <label htmlFor="compartirDatosRL" className="text-xs text-zinc-600 leading-normal select-none cursor-pointer">
                  <span className="font-semibold text-[#052B48]">{t("SaveDataTitle")}.</span>{" "}
                  {p("SaveDataPlaceholder")}
                </label>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}
