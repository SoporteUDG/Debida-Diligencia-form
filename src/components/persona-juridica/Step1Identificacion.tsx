"use client";

import { useTranslations } from "next-intl";
import es from "@/messages/es.json";
import { optionLabeler } from "@/i18n/optionLabel";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { countries } from "@/lib/countries";
import { FormState, PHONE_CODES } from "@/types/persona-juridica";

interface Step1Props {
  formData: FormState;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onSearchableSelectChange: (fieldName: keyof FormState, value: string) => void;
  errors: Record<string, string>;
}

export default function Step1Identificacion({
  formData,
  onInputChange,
  onSearchableSelectChange,
  errors = {},
}: Step1Props) {
  const t = useTranslations("JuridicaForm.JuridicaFormStep1Titles");
  const p = useTranslations("JuridicaForm.JuridicaFormStep1Placeholders");
  const OPTIONS = es.JuridicaForm.JuridicaFormStep1Options;
  const tipoSociedadLabel = optionLabeler(OPTIONS.TipoSociedadOptions, useTranslations("JuridicaForm.JuridicaFormStep1Options.TipoSociedadOptions"));
  const tipoClienteLabel = optionLabeler(OPTIONS.TipoClienteOptions, useTranslations("JuridicaForm.JuridicaFormStep1Options.TipoClienteOptions"));
  const estadoSociedadLabel = optionLabeler(OPTIONS.EstadoSociedadOptions, useTranslations("JuridicaForm.JuridicaFormStep1Options.EstadoSociedadOptions"));
  const formaContactoLabel = optionLabeler(OPTIONS.FormaContactoOptions, useTranslations("JuridicaForm.JuridicaFormStep1Options.FormaContactoOptions"));
  const tipoDocumentoLabel = optionLabeler(OPTIONS.TipoDocumentoOptions, useTranslations("JuridicaForm.JuridicaFormStep1Options.TipoDocumentoOptions"));
  const yesNoLabel = optionLabeler(es.JuridicaForm.TrueFalseOptions, useTranslations("JuridicaForm.TrueFalseOptions"));

  return (
    <div className={`bg-white rounded-2xl shadow-xl border border-zinc-200`}>
      
      {/* Card A: Proyecto e Información de Contacto Inicial */}
      <div className="px-6 md:px-8 pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700 flex items-center gap-1" htmlFor="nombreProyecto">
              <span>{t("NombreProyectoTitle")}</span>
              <span className="text-red-500 font-bold">*</span>
            </label>
            <select
              id="nombreProyecto"
              name="nombreProyecto"
              value={formData.nombreProyecto}
              onChange={onInputChange}
              className={`${errors.nombreProyecto ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
              required
            >
              <option value="">{p("NombreProyectoPlaceholder")}</option>
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
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="formaContacto">
              {t("FormaContactoTitle")}
            </label>
            <select
              id="formaContacto"
              name="formaContacto"
              value={formData.formaContacto}
              onChange={onInputChange}
              className={`${errors.formaContacto ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
            >
              <option value="">{p("FormaContactoPlaceholder")}</option>
              <option value="Mercadeo (feria, evento, revista, valla)">{formaContactoLabel("Mercadeo (feria, evento, revista, valla)")}</option>
              <option value="Redes Sociales">{formaContactoLabel("Redes Sociales")}</option>
              <option value="Referencia Interna (ej. colaborador, vendedor, sala de ventas)">{formaContactoLabel("Referencia Interna (ej. colaborador, vendedor, sala de ventas)")}</option>
              <option value="Referencia Externa (ej. corredor, broker, cliente, familiar, cliente antiguo)">{formaContactoLabel("Referencia Externa (ej. corredor, broker, cliente, familiar, cliente antiguo)")}</option>
              <option value="Referido">{formaContactoLabel("Referido")}</option>
              <option value="Otros">{formaContactoLabel("Otros")}</option>
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
                {t("FormaContactoDetalleTitle")} <span className="text-red-500 font-bold">*</span>
              </label>
              <input
                type="text"
                id="formaContactoDetalle"
                name="formaContactoDetalle"
                value={formData.formaContactoDetalle || ""}
                onChange={onInputChange}
                placeholder={p("FormaContactoDetallePlaceholder")}
                className={`bg-[#f4f6f8] border border-zinc-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#052B48] focus:ring-1 focus:ring-[#052B48] transition text-zinc-800 ${
                  errors.formaContactoDetalle ? "border-red-500 bg-red-50/10" : ""
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
                {t("ReferidoPorTitle")} <span className="text-red-500 font-bold">*</span>
              </label>
              <input
                type="text"
                id="referidoPor"
                name="referidoPor"
                value={formData.referidoPor || ""}
                onChange={onInputChange}
                placeholder={p("ReferidoPorPlaceholder")}
                className={`bg-[#f4f6f8] border border-zinc-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#052B48] focus:ring-1 focus:ring-[#052B48] transition text-zinc-800 ${
                  errors.referidoPor ? "border-red-500 bg-red-50/10" : ""
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

      {/* Card B: IDENTIFICACIÓN DEL CLIENTE */}
      <div className="px-6 md:px-8 pt-6">
        <h3 className="text-sm font-bold tracking-widest text-[#052B48] uppercase border-b border-zinc-200 pb-3 mb-6 flex items-center justify-between">
          <span>{t("IdentificacionClienteTitle")}</span>
          <span className="text-[10px] text-zinc-400 lowercase font-normal italic">{t("IdentificacionClienteSubtitle")}</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="razonSocial">
              {t("RazonSocialTitle")} <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="text"
              id="razonSocial"
              name="razonSocial"
              value={formData.razonSocial}
              onChange={onInputChange}
              placeholder={p("RazonSocialPlaceholder")}
              className={`${errors.razonSocial ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
              required
            />
            {errors.razonSocial && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.razonSocial}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="tipoSociedad">
              {t("TipoSociedadTitle")}
            </label>
            <select
              id="tipoSociedad"
              name="tipoSociedad"
              value={formData.tipoSociedad}
              onChange={onInputChange}
              className={`${errors.tipoSociedad ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
            >
              <option value="">{p("SeleccionaTipoPlaceholder")}</option>
              <option value="Sociedad Anónima">{tipoSociedadLabel("Sociedad Anónima")}</option>
              <option value="Sociedad Civil">{tipoSociedadLabel("Sociedad Civil")}</option>
              <option value="Fundación">{tipoSociedadLabel("Fundación")}</option>
              <option value="Fundación de Interés Privado">{tipoSociedadLabel("Fundación de Interés Privado")}</option>
              <option value="Otros">{tipoSociedadLabel("Otros")}</option>
            </select>
            {errors.tipoSociedad && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.tipoSociedad}
              </span>
            )}
          </div>
          

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="tipoCliente">
              {t("TipoClienteTitle")}
            </label>
            <select
              id="tipoCliente"
              name="tipoCliente"
              value={formData.tipoCliente}
              onChange={onInputChange}
              className={`${errors.tipoCliente ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
            >
              <option value="">{p("SeleccionaTipoPlaceholder")}</option>
              <option value="Persona Jurídica Nacional">{tipoClienteLabel("Persona Jurídica Nacional")}</option>
              <option value="Persona Jurídica Extranjera">{tipoClienteLabel("Persona Jurídica Extranjera")}</option>
            </select>
            {errors.tipoCliente && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.tipoCliente}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="estadoSociedad">
              {t("EstadoSociedadTitle")}
            </label>
            <select
              id="estadoSociedad"
              name="estadoSociedad"
              value={formData.estadoSociedad}
              onChange={onInputChange}
              className={`${errors.estadoSociedad ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
            >
              <option value="">{p("SeleccionaTipoPlaceholder")}</option>
              <option value="Operativa">{estadoSociedadLabel("Operativa")}</option>
              <option value="No Operativa">{estadoSociedadLabel("No Operativa")}</option>
            </select>
            {errors.estadoSociedad && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.estadoSociedad}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="tipoDocumentoIdentidad">
              {t("TipoDocumentoIdentidadTitle")} <span className="text-red-500 font-bold">*</span>
            </label>
            <select
              id="tipoDocumentoIdentidad"
              name="tipoDocumentoIdentidad"
              value={formData.tipoDocumentoIdentidad}
              onChange={onInputChange}
              className={`${errors.tipoDocumentoIdentidad ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
              required
            >
              <option value="">{p("TipoDocumentoIdentidadPlaceholder")}</option>
              <option value="RUC Empresarial">{tipoDocumentoLabel("RUC Empresarial")}</option>
              <option value="Ficha o Doc">{tipoDocumentoLabel("Ficha o Doc")}</option>
              <option value="Aviso de Operaciones">{tipoDocumentoLabel("Aviso de Operaciones")}</option>
              <option value="NIT">{tipoDocumentoLabel("NIT")}</option>
              <option value="Otro ID">{tipoDocumentoLabel("Otro ID")}</option>
            </select>
            {errors.tipoDocumentoIdentidad && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.tipoDocumentoIdentidad}
              </span>
            )}
          </div>

          

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="actividadPrincipal">
              {t("ActividadPrincipalTitle")}
            </label>
            <input
              type="text"
              id="actividadPrincipal"
              name="actividadPrincipal"
              value={formData.actividadPrincipal}
              onChange={onInputChange}
              placeholder={p("ActividadPrincipalPlaceholder")}
              className={`bg-[#f4f6f8] border border-zinc-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#052B48] focus:ring-1 focus:ring-[#052B48] transition text-zinc-800`}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="numeroDocumento">
              {t("NumeroDocumentoTitle")} <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="text"
              id="numeroDocumento"
              name="numeroDocumento"
              value={formData.numeroDocumento}
              onChange={onInputChange}
              placeholder={p("NumeroDocumentoPlaceholder")}
              className={`${errors.numeroDocumento ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
              required
            />
            {errors.numeroDocumento && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.numeroDocumento}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="fechaVencimientoId">
              {t("FechaVencimientoIdTitle")}
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
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="numeroIdTributaria">
              {t("NumeroIdTributariaTitle")}
            </label>
            <input
              type="text"
              id="numeroIdTributaria"
              name="numeroIdTributaria"
              value={formData.numeroIdTributaria}
              onChange={onInputChange}
              placeholder={p("NumeroIdTributariaPlaceholder")}
              className={`${errors.numeroIdTributaria ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
            />
            {errors.numeroIdTributaria && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.numeroIdTributaria}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="paisTributacion">
              {t("PaisTributacionTitle")}
            </label>
            <SearchableSelect
              id="paisTributacion"
              value={formData.paisTributacion}
              onChange={(val) => onSearchableSelectChange("paisTributacion", val)}
              options={countries}
              placeholder={p("BuscarPaisPlaceholder")}
             hasError={!!errors.paisTributacion} />
            {errors.paisTributacion && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.paisTributacion}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="fechaConstitucion">
              {t("FechaConstitucionTitle")}
            </label>
            <input
              type="date"
              id="fechaConstitucion"
              name="fechaConstitucion"
              value={formData.fechaConstitucion}
              onChange={onInputChange}
              className={`${errors.fechaConstitucion ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
            />
            {errors.fechaConstitucion && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.fechaConstitucion}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="paisOpera">
              {t("PaisOperaTitle")}
            </label>
            <SearchableSelect
              id="paisOpera"
              value={formData.paisOpera}
              onChange={(val) => onSearchableSelectChange("paisOpera", val)}
              options={countries}
              placeholder={p("BuscarPaisPlaceholder")}
             hasError={!!errors.paisOpera} />
            {errors.paisOpera && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.paisOpera}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="paisInscripcion">
              {t("PaisInscripcionTitle")}
            </label>
            <SearchableSelect
              id="paisInscripcion"
              value={formData.paisInscripcion}
              onChange={(val) => onSearchableSelectChange("paisInscripcion", val)}
              options={countries}
              placeholder={p("BuscarPaisPlaceholder")}
             hasError={!!errors.paisInscripcion} />
            {errors.paisInscripcion && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.paisInscripcion}
              </span>
            )}
          </div>

        </div>
      </div>



      {/* Card C: PERSONA DE CONTACTO */}
      <div className="px-6 md:px-8 pt-6">
        <h3 className="text-sm font-bold tracking-widest text-[#052B48] uppercase border-b border-zinc-200 pb-3 mb-6 flex items-center justify-between">
          <span>{t("PersonaContactoTitle")}</span>
          <span className="text-[10px] text-zinc-400 lowercase font-normal italic">{t("PersonaContactoSubtitle")}</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="contactoNombre">
              {t("ContactoNombreTitle")} <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="text"
              id="contactoNombre"
              name="contactoNombre"
              value={formData.contactoNombre}
              onChange={onInputChange}
              placeholder={p("ContactoNombrePlaceholder")}
              className={`${errors.contactoNombre ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
              required
            />
            {errors.contactoNombre && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.contactoNombre}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="contactoApellido">
              {t("ContactoApellidoTitle")} <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="text"
              id="contactoApellido"
              name="contactoApellido"
              value={formData.contactoApellido}
              onChange={onInputChange}
              placeholder={p("ContactoApellidoPlaceholder")}
              className={`${errors.contactoApellido ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
              required
            />
            {errors.contactoApellido && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.contactoApellido}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="contactoId">
              {t("ContactoIdTitle")}
            </label>
            <input
              type="text"
              id="contactoId"
              name="contactoId"
              value={formData.contactoId}
              onChange={onInputChange}
              placeholder={p("ContactoIdPlaceholder")}
              className={`${errors.contactoId ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
            />
            {errors.contactoId && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.contactoId}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="contactoTelefono">
              {t("ContactoTelefonoTitle")} <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="tel"
              id="contactoTelefono"
              name="contactoTelefono"
              value={formData.contactoTelefono}
              onChange={onInputChange}
              placeholder={p("ContactoTelefonoPlaceholder")}
              className={`${errors.contactoTelefono ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
              required
            />
            {errors.contactoTelefono && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.contactoTelefono}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2 md:col-span-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="contactoEmail">
              {t("ContactoEmailTitle")} <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="email"
              id="contactoEmail"
              name="contactoEmail"
              value={formData.contactoEmail}
              onChange={onInputChange}
              placeholder={p("ContactoEmailPlaceholder")}
              className={`${errors.contactoEmail ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
              required
            />
            {errors.contactoEmail && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.contactoEmail}
              </span>
            )}

          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="ifContacto">
              {t("IfContactoTitle")}
            </label>
            <select
              id="ifContacto"
              name="ifContacto"
              value={formData.ifContacto}
              onChange={onInputChange}
              className={`${errors.ifContacto ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
              required
            >
              <option value="">{p("IfContactoPlaceholder")}</option>
              <option value="Sí">{yesNoLabel("Sí")}</option>
              <option value="No">{yesNoLabel("No")}</option>
            </select>
            {errors.ifContacto && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.ifContacto}
              </span>
            )}
          </div>
          {formData.ifContacto === "Sí" && (  
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="contactoCargo">
                {t("ContactoCargoTitle")}
              </label>
              <input
                type="text"
                id="contactoCargo"
                name="contactoCargo"
                value={formData.contactoCargo}
                onChange={onInputChange}
                placeholder={p("ContactoCargoPlaceholder")}
                className={`${errors.contactoCargo ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
                required
              />
              {errors.contactoCargo && (
                <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                  ⚠️ {errors.contactoCargo}
                </span>
              )}

            </div>
          )}
        </div>
      </div>

      {/* Card D: DATOS GENERALES DE LA EMPRESA */}
      <div className="px-6 md:px-8 py-6">
        <h3 className="text-sm font-bold tracking-widest text-[#052B48] uppercase border-b border-zinc-200 pb-3 mb-6 flex items-center justify-between">
          <span>{t("DatosGeneralesEmpresaTitle")}</span>
          <span className="text-[10px] text-zinc-400 lowercase font-normal italic">{t("DatosGeneralesEmpresaSubtitle")}</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col gap-2 md:col-span-3">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="empresaDireccion">
              {t("EmpresaDireccionTitle")} <span className="text-red-500 font-bold">*</span>
            </label>
            <textarea
              id="empresaDireccion"
              name="empresaDireccion"
              value={formData.empresaDireccion}
              onChange={onInputChange}
              rows={3}
              placeholder={p("EmpresaDireccionPlaceholder")}
              className={`w-full bg-[#f4f6f8] border border-zinc-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#052B48] focus:ring-1 focus:ring-[#052B48] transition text-zinc-800 resize-none`}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="empresaCiudad">
              {t("EmpresaCiudadTitle")}
            </label>
            <input
              type="text"
              id="empresaCiudad"
              name="empresaCiudad"
              value={formData.empresaCiudad}
              onChange={onInputChange}
              placeholder={p("EmpresaCiudadPlaceholder")}
              className={`${errors.empresaCiudad ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
            />
            {errors.empresaCiudad && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.empresaCiudad}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="empresaProvincia">
              {t("EmpresaProvinciaTitle")}
            </label>
            <input
              type="text"
              id="empresaProvincia"
              name="empresaProvincia"
              value={formData.empresaProvincia}
              onChange={onInputChange}
              placeholder={p("EmpresaProvinciaPlaceholder")}
              className={`${errors.empresaProvincia ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
            />
            {errors.empresaProvincia && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.empresaProvincia}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="empresaPais">
              {t("EmpresaPaisTitle")}
            </label>
            <SearchableSelect
              id="empresaPais"
              value={formData.empresaPais}
              onChange={(val) => onSearchableSelectChange("empresaPais", val)}
              options={countries}
              placeholder={p("BuscarPaisPlaceholder")}
             hasError={!!errors.empresaPais} />
            {errors.empresaPais && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.empresaPais}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="empresaTelefono">
              {t("EmpresaTelefonoTitle")}
            </label>
            <div className="flex gap-2">
              <select
                name="empresaTelefonoCodigo"
                value={formData.empresaTelefonoCodigo || "+507"}
                onChange={onInputChange}
                className={`bg-[#f4f6f8] border border-zinc-300 rounded-lg px-2 py-3 text-xs font-semibold text-zinc-700 focus:outline-none focus:border-[#052B48] focus:ring-1 focus:ring-[#052B48] transition text-zinc-800 cursor-pointer max-w-[90px]`}
              >
                {PHONE_CODES.map((p) => (
                  <option key={p.code + p.country} value={p.code}>
                    {p.code}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                id="empresaTelefono"
                name="empresaTelefono"
                value={formData.empresaTelefono}
                onChange={onInputChange}
                placeholder={p("EmpresaTelefonoPlaceholder")}
                className={`${errors.empresaTelefono ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
              />
            {errors.empresaTelefono && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.empresaTelefono}
              </span>
            )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="empresaCelular">
              {t("EmpresaCelularTitle")}
            </label>
            <div className="flex gap-2">
              <select
                name="empresaCelularCodigo"
                value={formData.empresaCelularCodigo || "+507"}
                onChange={onInputChange}
                className={`bg-[#f4f6f8] border border-zinc-300 rounded-lg px-2 py-3 text-xs font-semibold text-zinc-700 focus:outline-none focus:border-[#052B48] focus:ring-1 focus:ring-[#052B48] transition text-zinc-800 cursor-pointer max-w-[90px]`}
              >
                {PHONE_CODES.map((p) => (
                  <option key={p.code + p.country} value={p.code}>
                    {p.code}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                id="empresaCelular"
                name="empresaCelular"
                value={formData.empresaCelular}
                onChange={onInputChange}
                placeholder={p("EmpresaCelularPlaceholder")}
                className={`${errors.empresaCelular ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
              />
            {errors.empresaCelular && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.empresaCelular}
              </span>
            )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="empresaEmail">
              {t("EmpresaEmailTitle")}
            </label>
            <input
              type="email"
              id="empresaEmail"
              name="empresaEmail"
              value={formData.empresaEmail}
              onChange={onInputChange}
              placeholder={p("EmpresaEmailPlaceholder")}
              className={`${errors.empresaEmail ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#052B48] focus:ring-[#052B48]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
            />
            {errors.empresaEmail && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.empresaEmail}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}