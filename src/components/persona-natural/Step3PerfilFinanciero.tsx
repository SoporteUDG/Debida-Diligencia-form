"use client";

import { FormState } from "@/types/persona-natural";

interface Step3Props {
  formData: FormState;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  errors: Record<string, string>;
}

export default function Step3PerfilFinanciero({ formData, onInputChange, errors = {} }: Step3Props) {
  return (
    <div className="space-y-8">

      {/* Card A: PERFIL FINANCIERO */}
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border border-zinc-200 space-y-6 text-[#1a1c1a] font-sans">
        <div className="text-center md:text-left border-b border-zinc-200 pb-3">
          <h3 className="text-sm font-bold tracking-widest text-[#002b49] uppercase">
            PERFIL FINANCIERO
          </h3>
          <p className="text-[10px] font-bold text-zinc-500 uppercase mt-1 tracking-wider">
            DECLARO QUE TODAS LAS ACTIVIDADES QUE EJERZO SON DE ORIGEN LICITO Y LEGAL
          </p>
        </div>

        <div className="flex flex-col gap-2 max-w-md">
          <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="ingresosMensuales">
            Ingresos Mensuales Aproximados Son de <span className="text-red-500 font-bold">*</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              id="ingresosMensuales"
              name="ingresosMensuales"
              value={formData.ingresosMensuales || ""}
              onChange={onInputChange}
              placeholder="Ej: 5,000"
              className={`${errors.ingresosMensuales ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
              required
            />
            {errors.ingresosMensuales && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.ingresosMensuales}
              </span>
            )}
            <span className="text-sm font-semibold text-zinc-650">USD</span>
          </div>
        </div>
      </div>

      {/* Card B: MEDIO DE PAGO / FONDOS */}
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border border-zinc-200 space-y-6 text-[#1a1c1a] font-sans">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="medioPago">
              Medio de Pago <span className="text-red-500 font-bold">*</span>
            </label>
            <select
              id="medioPago"
              name="medioPago"
              value={formData.medioPago || ""}
              onChange={onInputChange}
              className={`${errors.medioPago ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
              required
            >
            {errors.medioPago && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.medioPago}
              </span>
            )}
              <option value="">-Select-</option>
              <option value="Transferencia ACH">Transferencia ACH</option>
              <option value="Internacional">Internacional</option>
              <option value="Nacional">Nacional</option>
              <option value="Cheque">Cheque</option>
              <option value="Credito (financciamiento)">Credito (financiamiento)</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="fuenteFondosInmueble">
              Usted Adquiere el Bien Inmueble con Fondos <span className="text-red-500 font-bold">*</span>
            </label>
            <select
              id="fuenteFondosInmueble"
              name="fuenteFondosInmueble"
              value={formData.fuenteFondosInmueble || ""}
              onChange={onInputChange}
              className={`${errors.fuenteFondosInmueble ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
              required
            >
            {errors.fuenteFondosInmueble && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.fuenteFondosInmueble}
              </span>
            )}
              <option value="">-Select-</option>
              <option value="Propios">Propios</option>
              <option value="Financiamiento">Financiamiento</option>
              <option value="Terceros">Terceros</option>
              <option value="Otros">Otros</option>
            </select>
          </div>

          <div className="flex flex-col gap-2 md:col-span-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="montoServiciosAnuales">
              Montos de Servicios y Productos Aproximados Anuales que Adquirirá <span className="text-red-500 font-bold">*</span>
            </label>
            <select
              id="montoServiciosAnuales"
              name="montoServiciosAnuales"
              value={formData.montoServiciosAnuales || ""}
              onChange={onInputChange}
              className={`${errors.montoServiciosAnuales ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
              required
            >
            {errors.montoServiciosAnuales && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.montoServiciosAnuales}
              </span>
            )}
              <option value="">-Select-</option>
              <option value="Menos de $5,000">Menos de $5,000</option>
              <option value="$5,001 a $25,000">$5,001 a $25,000</option>
              <option value="$25,001 a $50,000">$25,001 a $50,000</option>
              <option value="$50,001 a $100,000">$50,001 a $100,000</option>
              <option value="Mas de $100,000">Mas de $100,000</option>
            </select>
          </div>
        </div>
      </div>

      {/* Card C: IDENTIFICACIÓN DEL BENEFICIARIO DEL INMUEBLE */}
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border border-zinc-200 space-y-6 text-[#1a1c1a] font-sans">
        <h3 className="text-sm font-bold tracking-widest text-[#002b49] uppercase border-b border-zinc-200 pb-3">
          IDENTIFICACIÓN DEL BENEFICIARIO DEL INMUEBLE
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">

          <div className="flex flex-col gap-2">
            <span className="text-xs text-zinc-700 leading-normal font-semibold">
              ¿Usted está adquiriendo el Bien Inmueble a nombre de otra Persona? <span className="text-red-500 font-bold">*</span>
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <select
              name="adquiereNombreTercero"
              value={formData.adquiereNombreTercero || ""}
              onChange={onInputChange}
              className={`${errors.adquiereNombreTercero ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
              required
            >
            {errors.adquiereNombreTercero && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.adquiereNombreTercero}
              </span>
            )}
              <option value="">Selecciona opción</option>
              <option value="No">No</option>
              <option value="Si">Si</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs text-zinc-700 leading-normal font-semibold">
              Propósito, Uso y Destino del Inmueble <span className="text-red-500 font-bold">*</span>
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <select
              name="destinoInmueble"
              value={formData.destinoInmueble || ""}
              onChange={onInputChange}
              className={`${errors.destinoInmueble ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
              required
            >
            {errors.destinoInmueble && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.destinoInmueble}
              </span>
            )}
              <option value="">Selecciona opción</option>
              <option value="Vivienda Principal">Vivienda Principal</option>
              <option value="Vivienda Secundaria">Vivienda Secundaria</option>
              <option value="Inversión">Inversión</option>
              <option value="Patrimonio">Patrimonio</option>
            </select>
          </div>
        </div>
      </div>

      {/* Card D: PERSONA EXPUESTA POLÍTICAMENTE (PEP) */}
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border border-zinc-200 space-y-6 text-[#1a1c1a] font-sans">
        <h3 className="text-sm font-bold tracking-widest text-[#002b49] uppercase border-b border-zinc-200 pb-3">
          PERSONA EXPUESTA POLÍTICAMENTE (PEP)
        </h3>

        <div className="bg-[#f4f6f8] border border-zinc-300 rounded-xl p-5 text-xs text-zinc-600 leading-relaxed max-h-52 overflow-y-auto scrollbar-thin">
          <strong className="block text-zinc-800 mb-1">DEFINICIÓN:</strong>
          La legislación de Panamá define como Persona Políticamente Expuesta (PEP) a toda persona natural nacional o extranjera que desempeñe o haya desempeñado funciones públicas de alto nivel o con mando y jurisdicción en un Estado, como son: Los Jefes de Estado o de un gobierno; políticos de alto perfil; funcionarios gubernamentales, judiciales o militares de alta jerarquía; los altos ejecutivos de corporaciones que pertenecen al Estado; los funcionarios públicos que ocupen cargos de elección popular, entre otros que ejerzan la toma de decisiones en las entidades públicas. También aquellas personas que cumplen o a quienes se les ha confiado funciones importantes por una organización internacional, como los miembros de la alta gerencia, es decir, directores, subdirectores y miembros de la junta directiva o funciones equivalentes. El concepto de PEP debe extenderse a sus familiares cercanos entendiéndose por estos el cónyuge, los padres, los hermanos y los hijos del PEP; y a sus estrechos colaboradores, entendiéndose por estos, las personas conocidas por su íntima relación con respecto al PEP, incluyendo a quienes están en posición de realizar transacciones financieras, comerciales o de cualquier naturaleza, ya sea locales e internacionales, en nombre del PEP. Lo anteriormente expuesto no persigue cubrir personas de rango medio o más bajo que las categorías señaladas.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center pt-4 border-t border-zinc-150">
          <span className="text-xs text-zinc-700 leading-normal font-semibold">
            ¿Cualquiera de las personas naturales arriba mencionadas en el presente formulario, ha desempeñado en los últimos 2 años o desempeña algún cargo público que le catalogue como persona expuesta políticamente (PEP) según la Ley 23- 2015 Artículo-4#18, o es conyugue, o mantiene un grado de parentesco dentro del segundo grado de consanguinidad o primero de afinidad, o tiene estrecha relación con una persona PEP? <span className="text-red-500 font-bold">*</span>
          </span>
          <div>
            <select
              name="esPep"
              value={formData.esPep || ""}
              onChange={onInputChange}
              className={`${errors.esPep ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
              required
            >
              <option value="">Selecciona opción</option>
              <option value="No">No</option>
              <option value="Sí">Sí</option>
            </select>
            {errors.esPep && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.esPep}
              </span>
            )}
          </div>
        </div>

        {(formData.esPep === "Sí" || formData.esPep === "Si") && (
          <div className="bg-[#f8fafc] border border-zinc-200/85 rounded-xl p-5 md:p-6 mt-4 space-y-4 animate-fadeIn">
            <h4 className="text-xs font-bold text-[#002b49] uppercase tracking-wider">
              Detalles de la Persona Expuesta Políticamente (PEP)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-700">
                  Nombre Completo <span className="text-red-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  name="pepNombre"
                  value={formData.pepNombre || ""}
                  onChange={onInputChange}
                  className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                    errors.pepNombre
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"
                  }`}
                  placeholder="Ej: Juan Pérez"
                />
                {errors.pepNombre && (
                  <span className="text-xs text-red-500 font-medium">
                    ⚠️ {errors.pepNombre}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-700">
                  Cargo Desempeñado <span className="text-red-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  name="pepCargo"
                  value={formData.pepCargo || ""}
                  onChange={onInputChange}
                  className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                    errors.pepCargo
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"
                  }`}
                  placeholder="Ej: Ministro de Estado"
                />
                {errors.pepCargo && (
                  <span className="text-xs text-red-500 font-medium">
                    ⚠️ {errors.pepCargo}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-700">
                  Institución o Entidad <span className="text-red-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  name="pepInstitucion"
                  value={formData.pepInstitucion || ""}
                  onChange={onInputChange}
                  className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                    errors.pepInstitucion
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"
                  }`}
                  placeholder="Ej: Ministerio de Obras Públicas"
                />
                {errors.pepInstitucion && (
                  <span className="text-xs text-red-500 font-medium">
                    ⚠️ {errors.pepInstitucion}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-700">
                  Relación o Parentesco <span className="text-red-500 font-bold">*</span>
                </label>
                <select
                  name="pepRelacion"
                  value={formData.pepRelacion || ""}
                  onChange={onInputChange}
                  className={`border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 bg-white ${
                    errors.pepRelacion
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"
                  }`}
                >
                  <option value="">Seleccione parentesco</option>
                  <option value="Yo mismo">Titular (Yo mismo)</option>
                  <option value="Cónyuge">Cónyuge</option>
                  <option value="Padre / Madre">Padre / Madre</option>
                  <option value="Hijo(a)">Hijo(a)</option>
                  <option value="Hermano(a)">Hermano(a)</option>
                  <option value="Estrecho Colaborador">Estrecho Colaborador</option>
                  <option value="Otros">Otros</option>
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
