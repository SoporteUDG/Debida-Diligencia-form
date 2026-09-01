"use client";

import SearchableSelect from "@/components/ui/SearchableSelect";
import { countries } from "@/lib/countries";
import { FormState } from "@/types/persona-natural";
import { PHONE_CODES } from "@/types/persona-juridica";

interface Step1Props {
  formData: FormState;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onSearchableSelectChange: (fieldName: keyof FormState, value: string) => void;
  errors: Record<string, string>;
}

export default function Step1DatosPersonales({
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
              value={formData.nombreProyecto || ""}
              onChange={onInputChange}
              className={`w-full bg-[#f4f6f8] border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                errors.nombreProyecto 
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" 
                  : "border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"
              }`}
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
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700 font-semibold" htmlFor="formaContacto">
              Formas de Contacto
            </label>
            <select
              id="formaContacto"
              name="formaContacto"
              value={formData.formaContacto || ""}
              onChange={onInputChange}
              className={`w-full bg-[#f4f6f8] border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 cursor-pointer ${
                errors.formaContacto
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                  : "border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"
              }`}
            >
              <option value="">Selecciona opción</option>
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
        </div>
      </div>

      {/* Card B: IDENTIFICACIÓN DEL CLIENTE ** */}
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border border-zinc-200 space-y-6 text-[#1a1c1a] font-sans">
        <h3 className="text-sm font-bold tracking-widest text-[#002b49] uppercase border-b border-zinc-200 pb-3 font-sans">
          IDENTIFICACIÓN DEL CLIENTE **
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="firstName">
              Nombre <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={formData.firstName || ""}
              onChange={onInputChange}
              placeholder="Tus nombres"
              className={`bg-[#f4f6f8] border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                errors.firstName 
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" 
                  : "border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"
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
              Apellido(s) <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={formData.lastName || ""}
              onChange={onInputChange}
              placeholder="Tus apellidos"
              className={`bg-[#f4f6f8] border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                errors.lastName 
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" 
                  : "border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"
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
              País de Nacimiento <span className="text-red-500 font-bold">*</span>
            </label>
            <SearchableSelect
              options={countries}
              value={formData.paisNacimiento || ""}
              onChange={(value) => onSearchableSelectChange("paisNacimiento", value)}
              placeholder="Selecciona país de nacimiento"
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
              País de Residencia Fiscal
            </label>
            <SearchableSelect
              options={countries}
              value={formData.paisResidenciaFiscal || ""}
              onChange={(value) => onSearchableSelectChange("paisResidenciaFiscal", value)}
              placeholder="Selecciona país de residencia fiscal"
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
              No. ID. Tributaria (ej. Cédula, NIT, TIN)
            </label>
            <input
              type="text"
              id="idTributaria"
              name="idTributaria"
              value={formData.idTributaria || ""}
              onChange={onInputChange}
              placeholder="Escribe tu ID Tributaria"
              className={`bg-[#f4f6f8] border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                errors.idTributaria 
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" 
                  : "border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"
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
              Nacionalidad <span className="text-red-500 font-bold">*</span>
            </label>
            <SearchableSelect
              options={countries}
              value={formData.nationality || ""}
              onChange={(value) => onSearchableSelectChange("nationality", value)}
              placeholder="Selecciona nacionalidad"
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
              Tipo de Identificación
            </label>
            <select
              id="tipoIdentificacion"
              name="tipoIdentificacion"
              value={formData.tipoIdentificacion || ""}
              onChange={onInputChange}
              className={`w-full bg-[#f4f6f8] border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                errors.tipoIdentificacion 
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" 
                  : "border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"
              }`}
            >
              <option value="">Selecciona tipo</option>
              <option value="Cédula">Cédula</option>
              <option value="Pasaporte">Pasaporte</option>
              <option value="Carné de Residente">Carné de Residente</option>
              <option value="Otro">Otro</option>
            </select>
            {errors.tipoIdentificacion && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.tipoIdentificacion}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">
              Otra Nacionalidad
            </label>
            <SearchableSelect
              options={countries}
              value={formData.otraNacionalidad || ""}
              onChange={(value) => onSearchableSelectChange("otraNacionalidad", value)}
              placeholder="Selecciona otra nacionalidad"
              hasError={!!errors.otraNacionalidad}
            />
            {errors.otraNacionalidad && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.otraNacionalidad}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="idNumber">
              N° de Identificación <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="text"
              id="idNumber"
              name="idNumber"
              value={formData.idNumber || ""}
              onChange={onInputChange}
              placeholder="Ej: PE-123-456"
              className={`bg-[#f4f6f8] border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                errors.idNumber 
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" 
                  : "border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"
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
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="estatusMigratorio">
              Estatus Migratorio
            </label>
            <select
              id="estatusMigratorio"
              name="estatusMigratorio"
              value={formData.estatusMigratorio || ""}
              onChange={onInputChange}
              className={`w-full bg-[#f4f6f8] border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                errors.estatusMigratorio 
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" 
                  : "border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"
              }`}
            >
              <option value="">Selecciona opción</option>
              <option value="Nacional">Nacional</option>
              <option value="Extranjero">Extranjero</option>
              <option value="Extranjero - No Residente">Extranjero - No Residente</option>
            </select>
            {errors.estatusMigratorio && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.estatusMigratorio}
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
              value={formData.fechaNacimiento || ""}
              onChange={onInputChange}
              className={`bg-[#f4f6f8] border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                errors.fechaNacimiento 
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" 
                  : "border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"
              }`}
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
    </div>
  );
}
