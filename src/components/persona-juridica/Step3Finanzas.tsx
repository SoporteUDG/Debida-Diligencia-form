"use client";

import SearchableSelect from "@/components/ui/SearchableSelect";
import { countries } from "@/lib/countries";
import { BfMember, FormState } from "@/types/persona-juridica";
import { Plus, Trash2 } from "lucide-react";

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
  return (
    <div className="space-y-8">
      
      {/* SECTION 1: BENEFICIARIO (S) FINAL (ES) */}
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border border-zinc-200 text-center">
        <h3 className="text-base md:text-lg font-serif font-bold tracking-widest text-[#002b49] uppercase border-b border-zinc-200 pb-3 mb-4">
          BENEFICIARIO (S) FINAL (ES) **
        </h3>
        <p className="text-xs text-red-600 italic leading-relaxed max-w-3xl mx-auto">
          Persona o personas naturales que, directa o indirectamente, poseen, controlan y/o ejercen influencia significativa sobre la relación de cuenta, relación contractual y/o de negocios o la persona natural en cuyo nombre o beneficio se realiza una transacción, lo cual incluye también a las personas naturales que ejercen control final sobre una persona jurídica.
        </p>
      </div>

      {/* Dynamic or Fixed BF Cards */}
      <div className="space-y-6">
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
              <span className="text-xs font-bold uppercase tracking-wider text-[#002b49]">
                {idx + 1}. BF - Beneficiario Final
              </span>
              {((formData.bfMembers || [])).length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemoveBfMember(bf.id)}
                  className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition cursor-pointer"
                  title="Eliminar Beneficiario Final"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[#1a1c1a]">
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">
                  {idx + 1}. BF - Nombre Completo (Solo persona natural que ejerce control final sobre la persona jurídica)
                </label>
                <input
                  type="text"
                  value={bf.nombreCompleto}
                  onChange={(e) => onBfMemberChange(bf.id, "nombreCompleto", e.target.value)}
                  placeholder="Nombre y apellido"
                  className={`border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full ${
                    errors[`bfMembers.${idx}.nombreCompleto`]
                      ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"
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
                  {idx + 1}. BF - No. Identificación
                </label>
                <input
                  type="text"
                  value={bf.noIdentificacion}
                  onChange={(e) => onBfMemberChange(bf.id, "noIdentificacion", e.target.value)}
                  placeholder="Cédula o pasaporte"
                  className={`border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full ${
                    errors[`bfMembers.${idx}.noIdentificacion`]
                      ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"
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
                  {idx + 1}. BF - Nacionalidad
                </label>
                <SearchableSelect
                  value={bf.nacionalidad}
                  onChange={(val) => onBfMemberChange(bf.id, "nacionalidad", val)}
                  options={countries}
                  placeholder="Buscar nacionalidad..."
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
                  {idx + 1}. BF - Fecha En La Que Adquiere Condición de Beneficiario Final
                </label>
                <input
                  type="date"
                  value={bf.fechaAdquisicion}
                  onChange={(e) => onBfMemberChange(bf.id, "fechaAdquisicion", e.target.value)}
                  className={`border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full ${
                    errors[`bfMembers.${idx}.fechaAdquisicion`]
                      ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"
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
                  {idx + 1}. BF - % de Participación
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={bf.porcentajeParticipacion}
                  onChange={(e) => onBfMemberChange(bf.id, "porcentajeParticipacion", e.target.value)}
                  placeholder="0"
                  className={`border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full ${
                    errors[`bfMembers.${idx}.porcentajeParticipacion`]
                      ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"
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
                  {idx + 1}. BF - País de Nacimiento
                </label>
                <SearchableSelect
                  value={bf.paisNacimiento}
                  onChange={(val) => onBfMemberChange(bf.id, "paisNacimiento", val)}
                  options={countries}
                  placeholder="Buscar país..."
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
                  {idx + 1}. BF - Dirección
                </label>
                <input
                  type="text"
                  value={bf.direccion}
                  onChange={(e) => onBfMemberChange(bf.id, "direccion", e.target.value)}
                  placeholder="Dirección residencial completa"
                  className={`border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full ${
                    errors[`bfMembers.${idx}.direccion`]
                      ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"
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
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onAddBfMember}
          className="inline-flex items-center gap-1.5 text-xs text-white bg-[#002b49] border border-[#c8a788]/40 px-4 py-2 rounded-lg hover:bg-[#081827] transition cursor-pointer font-semibold"
        >
          <Plus className="h-4 w-4" />
          Agregar Beneficiario Final
        </button>
      </div>

      {/* SECTION 2: PERFIL FINANCIERO */}
      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border border-zinc-200 text-center space-y-4">
          <h3 className="text-base md:text-lg font-serif font-bold tracking-widest text-[#002b49] uppercase border-b border-zinc-200 pb-3">
            PERFIL FINANCIERO
          </h3>
          <p className="text-xs md:text-sm font-semibold tracking-wider text-zinc-800 italic uppercase">
            DECLARO QUE TODAS LAS ACTIVIDADES QUE EJERZO SON DE ORIGEN LÍCITO Y LEGAL
          </p>

          <div className="max-w-md mx-auto pt-4 text-left">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700 block mb-2" htmlFor="ingresosMensuales">
              Ingresos Mensuales Aproximados Son de <span className="text-red-500 font-bold">*</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="text"
                id="ingresosMensuales"
                name="ingresosMensuales"
                value={formData.ingresosMensuales}
                onChange={onInputChange}
                placeholder="Monto estimado mensual"
                className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                  errors.ingresosMensuales
                    ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20"
                    : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"
                }`}
              />
              <span className="text-xs font-bold text-zinc-600 tracking-wider">USD</span>
            </div>
            {errors.ingresosMensuales && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.ingresosMensuales}
              </span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border border-zinc-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[#1a1c1a]">
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="medioPago">
                MEDIO DE PAGO
              </label>
              <select
                id="medioPago"
                name="medioPago"
                value={formData.medioPago}
                onChange={onInputChange}
                className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 cursor-pointer ${
                  errors.medioPago
                    ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20"
                    : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"
                }`}
              >
                <option value="">Selecciona medio de pago</option>
                <option value="Transferencia ACH">Transferencia ACH</option>
                <option value="Internacional">Internacional</option>
                <option value="Nacional">Nacional</option>
                <option value="Cheque">Cheque</option>
                <option value="Crédito (Financiamiento)">Crédito (Financiamiento)</option>
              </select>
              {errors.medioPago && (
                <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                  ⚠️ {errors.medioPago}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="fuenteFondosInmueble">
                Usted Adquiere el Bien Inmueble con Fondos
              </label>
              <select
                id="fuenteFondosInmueble"
                name="fuenteFondosInmueble"
                value={formData.fuenteFondosInmueble}
                onChange={onInputChange}
                className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 cursor-pointer ${
                  errors.fuenteFondosInmueble
                    ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20"
                    : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"
                }`}
              >
                <option value="">Selecciona origen de fondos</option>
                <option value="Propios">Propios</option>
                <option value="Financiamiento">Financiamiento</option>
                <option value="Terceros">Terceros</option>
                <option value="Otros">Otros</option>
              </select>
              {errors.fuenteFondosInmueble && (
                <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                  ⚠️ {errors.fuenteFondosInmueble}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="montoServiciosAnuales">
                Montos de Servicios y Productos Aproximados Anuales que Adquirirá
              </label>
              <select
                id="montoServiciosAnuales"
                name="montoServiciosAnuales"
                value={formData.montoServiciosAnuales}
                onChange={onInputChange}
                className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 cursor-pointer ${
                  errors.montoServiciosAnuales
                    ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20"
                    : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"
                }`}
              >
                <option value="">Selecciona rango anual</option>
                <option value="Menos de $5,000">Menos de $5,000</option>
                <option value="$5,001 a $25,000">$5,001 a $25,000</option>
                <option value="$25,001 a $50,000">$25,001 a $50,000</option>
                <option value="$50,001 a $100,000">$50,001 a $100,000</option>
                <option value="Más de $100,000">Más de $100,000</option>
              </select>
              {errors.montoServiciosAnuales && (
                <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                  ⚠️ {errors.montoServiciosAnuales}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: PERSONA EXPUESTA POLÍTICAMENTE (PEP) */}
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border border-zinc-200 text-zinc-800 space-y-6">
        <h3 className="text-base md:text-lg font-serif font-bold tracking-widest text-[#002b49] uppercase border-b border-zinc-200 pb-3">
          PERSONA EXPUESTA POLÍTICAMENTE (PEP)
        </h3>

        <div className="bg-[#f4f6f8] p-5 rounded-xl border border-zinc-200 text-xs leading-relaxed text-zinc-700 space-y-2">
          <p className="font-bold text-[#002b49]">
            DEFINICIÓN –
          </p>
          <p>
            La legislación de Panamá define como Persona Políticamente Expuesta (PEP) a toda persona Jurídica nacional o extranjera que desempeñe o haya desempeñado funciones públicas de alto nivel o con mando y jurisdicción en un Estado, como son: Los Jefes de Estado o de un gobierno; políticos de alto perfil; funcionarios gubernamentales, judiciales o militares de alta jerarquía; los altos ejecutivos de corporaciones que pertenecen al Estado; los funcionarios públicos que ocupen cargos de elección popular, entre otros que ejerzan la toma de decisiones en las entidades públicas. También aquellas personas que cumplen o a quienes se les ha confiado funciones importantes por una organización internacional, como los miembros de la alta gerencia, es decir, directores, subdirectores y miembros de la junta directiva o funciones equivalentes. El concepto de PEP debe extenderse a sus familiares cercanos entendiéndose por estos el cónyuge, los padres, los hermanos y los hijos del PEP; y a sus estrechos colaboradores, entendiéndose por estos, las personas conocidas por su íntima relación con respecto al PEP, incluyendo a quienes están en posición de realizar transacciones financieras, comerciales o de cualquier naturaleza, ya sea locales e internacionales, en nombre del PEP. Lo anteriormente expuesto no persigue cubrir personas de rango medio o más bajo que las categorías señaladas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center pt-2">
          <p className="text-xs md:text-sm font-medium leading-relaxed text-zinc-700 md:col-span-2">
            ¿Cualquiera de las personas naturales arriba mencionadas en el presente formulario, ha desempeñado en los últimos 2 años o desempeña algún cargo público que le catalogue como persona expuesta políticamente (PEP) según la Ley 23- 2015 Artículo-4#18, o es cónyuge, o mantiene un grado de parentesco dentro del segundo grado de consanguinidad o primero de afinidad, o tiene estrecha relación con una persona PEP?
          </p>
          <div>
            <select
              name="esPep"
              value={formData.esPep || ""}
              onChange={onInputChange}
              className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 font-semibold cursor-pointer ${
                errors.esPep
                  ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20"
                  : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"
              }`}
              required
            >
              <option value="">Selecciona opción</option>
              <option value="Sí">Sí</option>
              <option value="No">No</option>
            </select>
            {errors.esPep && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.esPep}
              </span>
            )}
          </div>
        </div>

        {(formData.esPep === "Sí" || formData.esPep === "Si") && (
          <div className="bg-[#040e16]/30 border border-zinc-800/80 rounded-xl p-5 md:p-6 mt-4 space-y-4 animate-fadeIn">
            <h4 className="text-xs font-bold text-[#c8a788] uppercase tracking-wider">
              Detalles de la Persona Expuesta Políticamente (PEP)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  Nombre Completo <span className="text-red-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  name="pepNombre"
                  value={formData.pepNombre || ""}
                  onChange={onInputChange}
                  className={`bg-[#040e16] border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition text-white ${
                    errors.pepNombre
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "border-zinc-800 focus:border-[#c8a788] focus:ring-[#c8a788]/20"
                  }`}
                  placeholder="Ej: Juan Pérez"
                />
                {errors.pepNombre && (
                  <span className="text-xs text-red-400 font-medium">
                    ⚠️ {errors.pepNombre}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  Cargo Desempeñado <span className="text-red-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  name="pepCargo"
                  value={formData.pepCargo || ""}
                  onChange={onInputChange}
                  className={`bg-[#040e16] border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition text-white ${
                    errors.pepCargo
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "border-zinc-800 focus:border-[#c8a788] focus:ring-[#c8a788]/20"
                  }`}
                  placeholder="Ej: Ministro de Estado"
                />
                {errors.pepCargo && (
                  <span className="text-xs text-red-400 font-medium">
                    ⚠️ {errors.pepCargo}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  Institución o Entidad <span className="text-red-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  name="pepInstitucion"
                  value={formData.pepInstitucion || ""}
                  onChange={onInputChange}
                  className={`bg-[#040e16] border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition text-white ${
                    errors.pepInstitucion
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "border-zinc-800 focus:border-[#c8a788] focus:ring-[#c8a788]/20"
                  }`}
                  placeholder="Ej: Ministerio de Obras Públicas"
                />
                {errors.pepInstitucion && (
                  <span className="text-xs text-red-400 font-medium">
                    ⚠️ {errors.pepInstitucion}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  Relación o Parentesco <span className="text-red-500 font-bold">*</span>
                </label>
                <select
                  name="pepRelacion"
                  value={formData.pepRelacion || ""}
                  onChange={onInputChange}
                  className={`bg-[#040e16] border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 transition text-white cursor-pointer ${
                    errors.pepRelacion
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "border-zinc-800 focus:border-[#c8a788] focus:ring-[#c8a788]/20"
                  }`}
                >
                  <option value="">Seleccione parentesco</option>
                  <option value="Representante Legal">Representante Legal</option>
                  <option value="Dignatario / Director">Dignatario / Director</option>
                  <option value="Beneficiario Final">Beneficiario Final</option>
                  <option value="Apoderado">Apoderado</option>
                  <option value="Familiar de PEP">Familiar de PEP</option>
                  <option value="Estrecho Colaborador">Estrecho Colaborador</option>
                  <option value="Otros">Otros</option>
                </select>
                {errors.pepRelacion && (
                  <span className="text-xs text-red-400 font-medium">
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
