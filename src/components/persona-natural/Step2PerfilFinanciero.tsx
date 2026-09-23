"use client";

import SearchableSelect from "@/components/ui/SearchableSelect";
import { countries } from "@/lib/countries";
import { FormState } from "@/types/persona-natural";
import { PHONE_CODES } from "@/types/persona-juridica";

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
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-zinc-200">
      
      {/* Card A: JURISDICCIÓN / UBICACIÓN GEOGRÁFICA */}
      <div className="px-6 md:px-8 pt-6 space-y-6 text-[#1a1c1a] font-sans">
        <h3 className="text-sm font-bold tracking-widest text-[#052B48] uppercase border-b border-zinc-200 pb-3">
          JURISDICCIÓN / UBICACIÓN GEOGRÁFICA
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col gap-2 md:col-span-3">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="direccionResidencial">
              Dirección (Calle, Número, Urbanización/Edificio, Piso, Apartamento, etc.) <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="text"
              id="direccionResidencial"
              name="direccionResidencial"
              value={formData.direccionResidencial || ""}
              onChange={onInputChange}
              placeholder="Ej: Calle 50, Edificio Royal Tower, Apto 12B"
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
              Ciudad
            </label>
            <input
              type="text"
              id="ciudad"
              name="ciudad"
              value={formData.ciudad || ""}
              onChange={onInputChange}
              placeholder="Ej: Panamá"
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
              Provincia/Estado
            </label>
            <input
              type="text"
              id="provinciaEstado"
              name="provinciaEstado"
              value={formData.provinciaEstado || ""}
              onChange={onInputChange}
              placeholder="Ej: Panamá"
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
              País
            </label>
            <SearchableSelect
              options={countries}
              value={formData.paisResidencial || ""}
              onChange={(value) => onSearchableSelectChange("paisResidencial", value)}
              placeholder="Selecciona país"
             hasError={!!errors.paisResidencial} />
            {errors.paisResidencial && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.paisResidencial}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="email">
              E-mail <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email || ""}
              onChange={onInputChange}
              placeholder="correo@ejemplo.com"
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
              Teléfono
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
                placeholder="200-0000"
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
              Celular <span className="text-red-500 font-bold">*</span>
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
                placeholder="6000-0000"
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
          Datos Laborales
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">
              Profesión u Oficio <span className="text-red-500 font-bold">*</span>
            </label>
            <SearchableSelect
              options={professions}
              value={formData.profession || ""}
              onChange={(value) => onSearchableSelectChange("profession", value)}
              placeholder="Busca o selecciona profesión"
             hasError={!!errors.profession} />
            {errors.profession && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.profession}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">
              País o Jurisdicción Donde Opera o Ejerce su Actividad Laboral
            </label>
            <SearchableSelect
              options={countries}
              value={formData.paisActividadLaboral || ""}
              onChange={(value) => onSearchableSelectChange("paisActividadLaboral", value)}
              placeholder="Selecciona país"
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
                Especificar Profesión u Oficio <span className="text-red-500 font-bold">*</span>
              </label>
              <input
                type="text"
                id="profesionOtros"
                name="profesionOtros"
                value={formData.profesionOtros || ""}
                onChange={onInputChange}
                placeholder="Escribe tu profesión u oficio aquí..."
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
              Nombre de Empresa Donde Labora <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="text"
              id="employer"
              name="employer"
              value={formData.employer || ""}
              onChange={onInputChange}
              placeholder="Ej: Corporación de Servicios S.A."
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
              Actividad/Ocupación Laboral, Empresarial o Comercial
            </label>
            <SearchableSelect
              options={economicActivities}
              value={formData.actividadLaboral || ""}
              onChange={(value) => onSearchableSelectChange("actividadLaboral", value)}
              placeholder="Busca o selecciona actividad"
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
                Especificar Actividad u Ocupación <span className="text-red-500 font-bold">*</span>
              </label>
              <input
                type="text"
                id="actividadLaboralOtros"
                name="actividadLaboralOtros"
                value={formData.actividadLaboralOtros || ""}
                onChange={onInputChange}
                placeholder="Escribe tu actividad laboral aquí..."
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
              Dirección Laboral Empresarial o Comercial
            </label>
            <input
              type="text"
              id="direccionLaboral"
              name="direccionLaboral"
              value={formData.direccionLaboral || ""}
              onChange={onInputChange}
              placeholder="Ej: Vía España, Torre Delta, Piso 5"
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
              Cargo que Desempeña
            </label>
            <input
              type="text"
              id="cargoDesempena"
              name="cargoDesempena"
              value={formData.cargoDesempena || ""}
              onChange={onInputChange}
              placeholder="Ej: Gerente Operativo"
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
              ¿Es propietario, accionista o mantiene participación dentro de esta sociedad?
            </label>
            <SearchableSelect
              options={["No", "Propietario", "Accionista", "Miembro de la sociedad"]}
              value={formData.esPropietario}
              onChange={(value) => onSearchableSelectChange("esPropietario", value)}
              placeholder="No"
              hasError={!!errors.esPropietario}
            />
            {errors.esPropietario && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.esPropietario}
              </span>
            )}
          </div>
          {/* Conditional field for specifying custom porpietary */}
          {formData.esPropietario !== "No"  && (
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="usaFondos">
                ¿Los fondos utilizados en la relación comercial provendrán de dicha sociedad?
              </label>
              <SearchableSelect
                options={["No", "Sí"]}
                value={formData.usaFondos || ""}
                onChange={(value) => onSearchableSelectChange("usaFondos", value)}
                placeholder="No"
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
            ACTIVIDADES ECONÓMICAS O PROFESIONALES
          </h3>
          <p className="text-[10px] text-zinc-550 italic mt-1 font-sans leading-normal">
            (declarar abajo las actividades principales de donde provienen sus ingresos, ej. 80% salario/20% asesorías)
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold tracking-wider uppercase text-zinc-500" htmlFor="actEconPrincipal">
                Fuente de Ingreso Principal
              </label>
              <SearchableSelect
                options={["Asalariado", "Trabajador independiente", "Ingresos provenientes de empresas propias", "Otros"]}
                value={formData.actEconPrincipal || ""}
                onChange={(value) => onSearchableSelectChange("actEconPrincipal", value)}
                placeholder="Elija actividad principal"
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
                Especifique Otra Actividad Económica
              </label>
                <input
                  type="text"
                  id="otroActEcon"
                  name="otroActEcon"
                  value={formData.otroActEcon || ""}
                  onChange={onInputChange}
                  placeholder="Ej: Salario"
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
                Porcentaje de Dedicación
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
                placeholder="Ej: 80%"
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
                Jurisdicción de Operación
              </label>
              <input
                type="text"
                id="jurisdiccionPrincipal"
                name="jurisdiccionPrincipal"
                value={formData.jurisdiccionPrincipal || ""}
                onChange={onInputChange}
                placeholder="Ej: Panamá"
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
                Otros Ingresos
              </label>
              <input
                  type="text"
                  id="actEconSecundaria"
                  name="actEconSecundaria"
                  value={formData.actEconSecundaria || ""}
                  onChange={onInputChange}
                  placeholder="Ej: Asesorias"
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
                Porcentaje de Dedicación
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
                placeholder="Ej: 20%"
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
                Jurisdicción de Operación
              </label>
              <input
                type="text"
                id="jurisdiccionSecundaria"
                name="jurisdiccionSecundaria"
                value={formData.jurisdiccionSecundaria || ""}
                onChange={onInputChange}
                placeholder="Ej: Panamá"
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
