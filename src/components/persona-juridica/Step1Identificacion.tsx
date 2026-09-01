"use client";

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
  return (
    <div className="space-y-8">
      
      {/* Card A: Proyecto e Información de Contacto Inicial */}
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border border-zinc-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700 flex items-center gap-1" htmlFor="nombreProyecto">
              <span>Nombre del Proyecto</span>
              <span className="text-red-500 font-bold">*</span>
            </label>
            <select
              id="nombreProyecto"
              name="nombreProyecto"
              value={formData.nombreProyecto}
              onChange={onInputChange}
              className={`${errors.nombreProyecto ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
              required
            >
              <option value="">Selecciona proyecto</option>
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
              Formas de Contacto
            </label>
            <select
              id="formaContacto"
              name="formaContacto"
              value={formData.formaContacto}
              onChange={onInputChange}
              className={`${errors.formaContacto ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
            >
              <option value="">Selecciona opción</option>
              <option value="Mercadeo (feria, evento, revista, valla)">Mercadeo (feria, evento, revista, valla)</option>
              <option value="Redes Sociales">Redes Sociales</option>
              <option value="Referencia Interna (ej. colaborador, vendedor, sala de ventas)">Referencia Interna (ej. colaborador, vendedor, sala de ventas)</option>
              <option value="Referencia Externa (ej. corredor, broker, cliente, familiar, cliente antiguo)">Referencia Externa (ej. corredor, broker, cliente, familiar, cliente antiguo)</option>
              <option value="Otros">Otros</option>
            </select>
            {errors.formaContacto && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.formaContacto}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Card B: IDENTIFICACIÓN DEL CLIENTE */}
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border border-zinc-200">
        <h3 className="text-sm font-bold tracking-widest text-[#002b49] uppercase border-b border-zinc-200 pb-3 mb-6 flex items-center justify-between">
          <span>IDENTIFICACIÓN DEL CLIENTE **</span>
          <span className="text-[10px] text-zinc-400 lowercase font-normal italic">Información Registral</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="razonSocial">
              Nombre de Razón Social <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="text"
              id="razonSocial"
              name="razonSocial"
              value={formData.razonSocial}
              onChange={onInputChange}
              placeholder="Ej: Inversiones UDG, S.A."
              className={`${errors.razonSocial ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
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
              Tipo de Sociedad
            </label>
            <select
              id="tipoSociedad"
              name="tipoSociedad"
              value={formData.tipoSociedad}
              onChange={onInputChange}
              className={`${errors.tipoSociedad ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
            >
              <option value="">Selecciona tipo</option>
              <option value="Sociedad Anónima">Sociedad Anónima</option>
              <option value="Sociedad Civil">Sociedad Civil</option>
              <option value="Fundación">Fundación</option>
              <option value="Otros">Otros</option>
            </select>
            {errors.tipoSociedad && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.tipoSociedad}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="tipoCliente">
              Tipo de Cliente
            </label>
            <select
              id="tipoCliente"
              name="tipoCliente"
              value={formData.tipoCliente}
              onChange={onInputChange}
              className={`${errors.tipoCliente ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
            >
              <option value="">Selecciona tipo</option>
              <option value="Persona Jurídica Nacional">Persona Jurídica Nacional</option>
              <option value="Persona Jurídica Extranjera">Persona Jurídica Extranjera</option>
              <option value="Operativa">Operativa</option>
              <option value="No Operativa">No Operativa</option>
            </select>
            {errors.tipoCliente && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.tipoCliente}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="tipoDocumentoIdentidad">
              Documento de Identidad <span className="text-red-500 font-bold">*</span>
            </label>
            <select
              id="tipoDocumentoIdentidad"
              name="tipoDocumentoIdentidad"
              value={formData.tipoDocumentoIdentidad}
              onChange={onInputChange}
              className={`${errors.tipoDocumentoIdentidad ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
              required
            >
              <option value="">Selecciona documento</option>
              <option value="RUC Empresarial">RUC Empresarial</option>
              <option value="Ficha o Doc">Ficha o Doc</option>
              <option value="Aviso de Operaciones">Aviso de Operaciones</option>
              <option value="NIT">NIT</option>
              <option value="Otro ID">Otro ID</option>
            </select>
            {errors.tipoDocumentoIdentidad && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.tipoDocumentoIdentidad}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="actividadPrincipal">
              Actividad Principal A La Que Se Dedica Su Empresa
            </label>
            <input
              type="text"
              id="actividadPrincipal"
              name="actividadPrincipal"
              value={formData.actividadPrincipal}
              onChange={onInputChange}
              placeholder="Ej: Comercio, Inversiones"
              className="bg-[#f4f6f8] border border-zinc-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#002b49] focus:ring-1 focus:ring-[#002b49] transition text-zinc-800"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="numeroDocumento">
              No. de Documento <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="text"
              id="numeroDocumento"
              name="numeroDocumento"
              value={formData.numeroDocumento}
              onChange={onInputChange}
              placeholder="Número del documento elegido arriba"
              className={`${errors.numeroDocumento ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
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
              Fecha de Vencimiento de Identificación
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
              No. de ID Tributaria
            </label>
            <input
              type="text"
              id="numeroIdTributaria"
              name="numeroIdTributaria"
              value={formData.numeroIdTributaria}
              onChange={onInputChange}
              placeholder="Si aplica (ej. R.T.N / Tax ID)"
              className={`${errors.numeroIdTributaria ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
            />
            {errors.numeroIdTributaria && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.numeroIdTributaria}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="paisTributacion">
              País donde Tributa Ingresos
            </label>
            <SearchableSelect
              id="paisTributacion"
              value={formData.paisTributacion}
              onChange={(val) => onSearchableSelectChange("paisTributacion", val)}
              options={countries}
              placeholder="Buscar país..."
             hasError={!!errors.paisTributacion} />
            {errors.paisTributacion && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.paisTributacion}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="porcentajeActividad">
              % De Actividad Dedica (si aplica)
            </label>
            <input
              type="number"
              id="porcentajeActividad"
              name="porcentajeActividad"
              value={formData.porcentajeActividad}
              onChange={onInputChange}
              placeholder="0"
              min="0"
              max="100"
              className={`${errors.porcentajeActividad ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
            />
            {errors.porcentajeActividad && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.porcentajeActividad}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="fechaConstitucion">
              Fecha de Constitución
            </label>
            <input
              type="date"
              id="fechaConstitucion"
              name="fechaConstitucion"
              value={formData.fechaConstitucion}
              onChange={onInputChange}
              className={`${errors.fechaConstitucion ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
            />
            {errors.fechaConstitucion && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.fechaConstitucion}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="paisOpera">
              País Donde Opera
            </label>
            <SearchableSelect
              id="paisOpera"
              value={formData.paisOpera}
              onChange={(val) => onSearchableSelectChange("paisOpera", val)}
              options={countries}
              placeholder="Buscar país..."
             hasError={!!errors.paisOpera} />
            {errors.paisOpera && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.paisOpera}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="paisInscripcion">
              País de Inscripción
            </label>
            <SearchableSelect
              id="paisInscripcion"
              value={formData.paisInscripcion}
              onChange={(val) => onSearchableSelectChange("paisInscripcion", val)}
              options={countries}
              placeholder="Buscar país..."
             hasError={!!errors.paisInscripcion} />
            {errors.paisInscripcion && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.paisInscripcion}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="fechaNacimiento">
              Fecha de Nacimiento <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="date"
              id="fechaNacimiento"
              name="fechaNacimiento"
              value={formData.fechaNacimiento}
              onChange={onInputChange}
              className={`${errors.fechaNacimiento ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
              required
            />
            {errors.fechaNacimiento && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.fechaNacimiento}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Card C: PERSONA DE CONTACTO */}
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border border-zinc-200">
        <h3 className="text-sm font-bold tracking-widest text-[#002b49] uppercase border-b border-zinc-200 pb-3 mb-6 flex items-center justify-between">
          <span>PERSONA DE CONTACTO **</span>
          <span className="text-[10px] text-zinc-400 lowercase font-normal italic">Representante Operativo</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="contactoNombre">
              Nombre <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="text"
              id="contactoNombre"
              name="contactoNombre"
              value={formData.contactoNombre}
              onChange={onInputChange}
              placeholder="Nombre"
              className={`${errors.contactoNombre ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
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
              Apellido <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="text"
              id="contactoApellido"
              name="contactoApellido"
              value={formData.contactoApellido}
              onChange={onInputChange}
              placeholder="Apellido"
              className={`${errors.contactoApellido ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
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
              Nº de identificación
            </label>
            <input
              type="text"
              id="contactoId"
              name="contactoId"
              value={formData.contactoId}
              onChange={onInputChange}
              placeholder="Cédula o pasaporte"
              className={`${errors.contactoId ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
            />
            {errors.contactoId && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.contactoId}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="contactoTelefono">
              Teléfono/Celular <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="tel"
              id="contactoTelefono"
              name="contactoTelefono"
              value={formData.contactoTelefono}
              onChange={onInputChange}
              placeholder="Celular"
              className={`${errors.contactoTelefono ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
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
              Correo Electrónico <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="email"
              id="contactoEmail"
              name="contactoEmail"
              value={formData.contactoEmail}
              onChange={onInputChange}
              placeholder="correo@ejemplo.com"
              className={`${errors.contactoEmail ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
              required
            />
            {errors.contactoEmail && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.contactoEmail}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Card D: DATOS GENERALES DE LA EMPRESA */}
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border border-zinc-200">
        <h3 className="text-sm font-bold tracking-widest text-[#002b49] uppercase border-b border-zinc-200 pb-3 mb-6 flex items-center justify-between">
          <span>DATOS GENERALES DE LA EMPRESA **</span>
          <span className="text-[10px] text-zinc-400 lowercase font-normal italic">Domicilio y Contacto Corporativo</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col gap-2 md:col-span-3">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="empresaDireccion">
              Dirección Comercial (Calle, Número, Urbanización/Edificio, Piso, Local, etc.) <span className="text-red-500 font-bold">*</span>
            </label>
            <textarea
              id="empresaDireccion"
              name="empresaDireccion"
              value={formData.empresaDireccion}
              onChange={onInputChange}
              rows={3}
              placeholder="Completa la dirección física"
              className="w-full bg-[#f4f6f8] border border-zinc-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#002b49] focus:ring-1 focus:ring-[#002b49] transition text-zinc-800 resize-none"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="empresaCiudad">
              Ciudad
            </label>
            <input
              type="text"
              id="empresaCiudad"
              name="empresaCiudad"
              value={formData.empresaCiudad}
              onChange={onInputChange}
              placeholder="Ciudad"
              className={`${errors.empresaCiudad ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
            />
            {errors.empresaCiudad && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.empresaCiudad}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="empresaProvincia">
              Provincia
            </label>
            <input
              type="text"
              id="empresaProvincia"
              name="empresaProvincia"
              value={formData.empresaProvincia}
              onChange={onInputChange}
              placeholder="Provincia / Estado"
              className={`${errors.empresaProvincia ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
            />
            {errors.empresaProvincia && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.empresaProvincia}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="empresaPais">
              País
            </label>
            <SearchableSelect
              id="empresaPais"
              value={formData.empresaPais}
              onChange={(val) => onSearchableSelectChange("empresaPais", val)}
              options={countries}
              placeholder="Buscar país..."
             hasError={!!errors.empresaPais} />
            {errors.empresaPais && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.empresaPais}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="empresaTelefono">
              Teléfono(s)
            </label>
            <div className="flex gap-2">
              <select
                name="empresaTelefonoCodigo"
                value={formData.empresaTelefonoCodigo || "+507"}
                onChange={onInputChange}
                className="bg-[#f4f6f8] border border-zinc-300 rounded-lg px-2 py-3 text-xs font-semibold text-zinc-700 focus:outline-none focus:border-[#002b49] focus:ring-1 focus:ring-[#002b49] transition text-zinc-800 cursor-pointer max-w-[90px]"
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
                placeholder="Número fijo"
                className={`${errors.empresaTelefono ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
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
              Celular(es)
            </label>
            <div className="flex gap-2">
              <select
                name="empresaCelularCodigo"
                value={formData.empresaCelularCodigo || "+507"}
                onChange={onInputChange}
                className="bg-[#f4f6f8] border border-zinc-300 rounded-lg px-2 py-3 text-xs font-semibold text-zinc-700 focus:outline-none focus:border-[#002b49] focus:ring-1 focus:ring-[#002b49] transition text-zinc-800 cursor-pointer max-w-[90px]"
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
                placeholder="Número móvil"
                className={`${errors.empresaCelular ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
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
              E-mail
            </label>
            <input
              type="email"
              id="empresaEmail"
              name="empresaEmail"
              value={formData.empresaEmail}
              onChange={onInputChange}
              placeholder="contacto@empresa.com"
              className={`${errors.empresaEmail ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
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
