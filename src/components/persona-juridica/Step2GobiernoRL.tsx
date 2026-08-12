"use client";

import SearchableSelect from "@/components/ui/SearchableSelect";
import { countries } from "@/lib/countries";
import { FormState, GjcMember } from "@/types/persona-juridica";
import { Plus, Trash2, AlertCircle } from "lucide-react";

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
    <div className="space-y-8">
      
      {/* Card: GOBIERNO CORPORATIVO */}
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border border-zinc-200 space-y-6">
        <div className="border-b border-zinc-200 pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold tracking-widest text-[#002b49] uppercase">
              GOBIERNO CORPORATIVO / JUNTA DIRECTIVA / CONSEJO FUNDACIONAL **
            </h3>
            <p className="text-[11px] text-zinc-500 mt-1">
              Mínimo un (1) miembro completo requerido con cargo, nombre, apellidos, nacionalidad, nacimiento, identificación y dirección.
            </p>
          </div>
          <button
            type="button"
            onClick={onAddGjcMember}
            className="inline-flex items-center gap-1.5 text-xs text-white bg-[#002b49] border border-[#002b49] px-4 py-2 rounded-lg hover:bg-[#081827] transition cursor-pointer font-sans font-semibold active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Agregar Miembro
          </button>
        </div>

        {/* Dynamic List Validation Banner */}
        {errors.gjcMembers && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold">Error de estructura:</span> {errors.gjcMembers}
            </div>
          </div>
        )}

        {hasIncompleteMembers && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold">Información requerida pendiente:</span> Todos los miembros agregados deben tener completos los campos obligatorios (* cargo, nombre, apellidos, nacionalidad, fecha de nacimiento, ID y dirección) para poder avanzar.
            </div>
          </div>
        )}

        {members.length === 0 ? (
          <div className="text-center py-8 bg-[#f4f6f8] rounded-xl border border-dashed border-zinc-300 text-zinc-600 text-xs space-y-3">
            <p>Se requiere al menos un (1) miembro de gobierno corporativo.</p>
            <button
              type="button"
              onClick={onAddGjcMember}
              className="inline-flex items-center gap-1.5 text-xs text-[#002b49] border border-[#002b49]/30 px-3 py-1.5 rounded-lg hover:bg-[#002b49]/10 font-semibold transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Crear Registro Inicial
            </button>
          </div>
        ) : (
          <div className="space-y-8">
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
                      <span className="text-[10px] bg-[#002b49] text-white px-2.5 py-1 rounded-full font-bold uppercase">
                        Miembro #{idx + 1}
                      </span>
                      {!complete && (
                        <span className="text-[10px] text-amber-700 font-semibold bg-amber-100 px-2 py-0.5 rounded">
                          Incompleto
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (minMemberError) {
                            alert("Se requiere exigir al menos un (1) miembro en Gobierno Corporativo.");
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
                        title={minMemberError ? "Se requiere mantener al menos 1 miembro" : "Eliminar miembro"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[#1a1c1a]">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">
                        {idx + 1} - GJC Cargo <span className="text-red-500 font-bold">*</span>
                      </label>
                      <select
                        value={member.cargo}
                        onChange={(e) => onGjcMemberChange(member.id, "cargo", e.target.value)}
                        className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                          errors[`gjcMembers.${idx}.cargo`]
                            ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20"
                            : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"
                        }`}
                        required
                      >
                        <option value="">Selecciona cargo</option>
                        <option value="Presidente">Presidente</option>
                        <option value="Vicepresidente">Vicepresidente</option>
                        <option value="Secretario">Secretario</option>
                        <option value="Tesorero">Tesorero</option>
                        <option value="Director">Director</option>
                        <option value="Dignatario">Dignatario</option>
                        <option value="Vocal">Vocal</option>
                        <option value="Protector">Protector</option>
                        <option value="Otro">Otro</option>
                      </select>
                      {errors[`gjcMembers.${idx}.cargo`] && (
                        <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                          ⚠️ {errors[`gjcMembers.${idx}.cargo`]}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700">
                        {idx + 1} - GJC Nombre <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input
                        type="text"
                        value={member.nombre}
                        onChange={(e) => onGjcMemberChange(member.id, "nombre", e.target.value)}
                        placeholder="Nombres completos"
                        className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                          errors[`gjcMembers.${idx}.nombre`]
                            ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20"
                            : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"
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
                        {idx + 1} - GJC Apellidos <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input
                        type="text"
                        value={member.apellidos}
                        onChange={(e) => onGjcMemberChange(member.id, "apellidos", e.target.value)}
                        placeholder="Apellidos completos"
                        className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                          errors[`gjcMembers.${idx}.apellidos`]
                            ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20"
                            : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"
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
                        {idx + 1} - GJC Nacionalidad <span className="text-red-500 font-bold">*</span>
                      </label>
                      <SearchableSelect
                        value={member.nacionalidad}
                        onChange={(val) => onGjcMemberChange(member.id, "nacionalidad", val)}
                        options={countries}
                        placeholder="Buscar nacionalidad..."
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
                        {idx + 1} - GJC Fecha de Nacimiento <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input
                        type="date"
                        value={member.fechaNacimiento}
                        onChange={(e) => onGjcMemberChange(member.id, "fechaNacimiento", e.target.value)}
                        className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                          errors[`gjcMembers.${idx}.fechaNacimiento`]
                            ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20"
                            : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"
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
                        {idx + 1} - GJC No. de ID (Identificación) <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input
                        type="text"
                        value={member.nroId}
                        onChange={(e) => onGjcMemberChange(member.id, "nroId", e.target.value)}
                        placeholder="Número de Cédula o Pasaporte"
                        className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                          errors[`gjcMembers.${idx}.nroId`]
                            ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20"
                            : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"
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
                        {idx + 1} - GJC Dirección <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input
                        type="text"
                        value={member.direccion}
                        onChange={(e) => onGjcMemberChange(member.id, "direccion", e.target.value)}
                        placeholder="Dirección residencial completa"
                        className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 ${
                          errors[`gjcMembers.${idx}.direccion`]
                            ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20"
                            : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"
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
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border border-zinc-200">
        <h3 className="text-sm font-bold tracking-widest text-[#002b49] uppercase border-b border-zinc-200 pb-3 mb-6 flex items-center justify-between">
          <span>REPRESENTANTE LEGAL O APODERADO **</span>
          <span className="text-[10px] text-zinc-400 lowercase font-normal italic">RL - Datos Personales</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[#1a1c1a]">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="rlNombre">
              1 RL - Nombre y Apellido
            </label>
            <input
              type="text"
              id="rlNombre"
              name="rlNombre"
              value={formData.rlNombre}
              onChange={onInputChange}
              placeholder="Nombre y Apellido"
              className={`${errors.rlNombre ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
            />
            {errors.rlNombre && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.rlNombre}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="rlFechaNacimiento">
              1 RL - Fecha de Nacimiento <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="date"
              id="rlFechaNacimiento"
              name="rlFechaNacimiento"
              value={formData.rlFechaNacimiento}
              onChange={onInputChange}
              className={`${errors.rlFechaNacimiento ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
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
              1 RL - Nacionalidad
            </label>
            <SearchableSelect
              id="rlNacionalidad"
              value={formData.rlNacionalidad}
              onChange={(val) => onSearchableSelectChange("rlNacionalidad", val)}
              options={countries}
              placeholder="Buscar país..."
             hasError={!!errors.rlNacionalidad} />
            {errors.rlNacionalidad && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.rlNacionalidad}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="rlNoIdentificacion">
              1 RL - No. Identificación
            </label>
            <input
              type="text"
              id="rlNoIdentificacion"
              name="rlNoIdentificacion"
              value={formData.rlNoIdentificacion}
              onChange={onInputChange}
              placeholder="Cédula o pasaporte"
              className={`${errors.rlNoIdentificacion ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
            />
            {errors.rlNoIdentificacion && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.rlNoIdentificacion}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="rlProfesionOcupacion">
              1 RL - Profesión / Ocupación <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="text"
              id="rlProfesionOcupacion"
              name="rlProfesionOcupacion"
              value={formData.rlProfesionOcupacion}
              onChange={onInputChange}
              placeholder="Profesión u Ocupación"
              className={`${errors.rlProfesionOcupacion ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
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
              1 RL - Actividad Económica
            </label>
            <input
              type="text"
              id="rlActividadEconomica"
              name="rlActividadEconomica"
              value={formData.rlActividadEconomica}
              onChange={onInputChange}
              placeholder="Actividad Económica"
              className={`${errors.rlActividadEconomica ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
            />
            {errors.rlActividadEconomica && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.rlActividadEconomica}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="rlDireccion">
              1 RL - Dirección
            </label>
            <input
              type="text"
              id="rlDireccion"
              name="rlDireccion"
              value={formData.rlDireccion}
              onChange={onInputChange}
              placeholder="Dirección residencial"
              className={`${errors.rlDireccion ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
            />
            {errors.rlDireccion && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.rlDireccion}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="rlPaisResidencia">
              1 RL - País de Residencia
            </label>
            <SearchableSelect
              id="rlPaisResidencia"
              value={formData.rlPaisResidencia}
              onChange={(val) => onSearchableSelectChange("rlPaisResidencia", val)}
              options={countries}
              placeholder="Buscar país..."
             hasError={!!errors.rlPaisResidencia} />
            {errors.rlPaisResidencia && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                ⚠️ {errors.rlPaisResidencia}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold tracking-wider uppercase text-zinc-700" htmlFor="rlTelefono">
              1 RL - Teléfono
            </label>
            <input
              type="tel"
              id="rlTelefono"
              name="rlTelefono"
              value={formData.rlTelefono}
              onChange={onInputChange}
              placeholder="Teléfono de contacto"
              className={`${errors.rlTelefono ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20" : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"} border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 w-full`}
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
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border border-zinc-200 text-zinc-800 space-y-4">
        <p className="text-xs md:text-sm font-medium leading-relaxed text-zinc-700">
          Indique si el Representante Legal, Apoderado o la Sociedad misma son o han sido objeto de investigación, indagación, condena por actividad ilícita, delitos de blanqueo de capitales o financiamiento de terrorismo, fraude o corrupción pública o algunos de los delitos establecidos en el ART.254-A del código penal.
        </p>
        <div className="max-w-xs">
          <select
            name="rlObjetoInvestigacion"
            value={formData.rlObjetoInvestigacion || ""}
            onChange={onInputChange}
            className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 transition text-zinc-800 font-semibold cursor-pointer ${
              errors.rlObjetoInvestigacion
                ? "bg-red-50/10 border-red-500 focus:border-red-500 focus:ring-red-500/20"
                : "bg-[#f4f6f8] border-zinc-300 focus:border-[#002b49] focus:ring-[#002b49]/20"
            }`}
            required
          >
            <option value="">Selecciona respuesta</option>
            <option value="Sí">Sí</option>
            <option value="No">No</option>
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
