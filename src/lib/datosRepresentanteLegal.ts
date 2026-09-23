import { FormState as FormStateNatural } from "@/types/persona-natural";
import { FormState as FormStateJuridica } from "@/types/persona-juridica";

/**
 * Datos personales que el usuario de Persona Natural puede optar por guardar
 * localmente para reutilizarlos como Representante Legal / Apoderado en el
 * formulario de Persona Jurídica.
 */
export const DATOS_RL_STORAGE_KEY = "udg_datos_representante_legal";

/** Campos del bloque "REPRESENTANTE LEGAL O APODERADO" que se pueden precargar. */
export type CamposRL = Pick<
  FormStateJuridica,
  | "rlNombre"
  | "rlFechaNacimiento"
  | "rlNacionalidad"
  | "rlEstadoCivil"
  | "rlNoIdentificacion"
  | "rlProfesionOcupacion"
  | "rlActividadEconomica"
  | "rlDireccion"
  | "rlPaisResidencia"
  | "rlTelefono"
>;

export interface DatosRepresentanteLegal extends CamposRL {
  /** Fecha ISO en la que el usuario guardó los datos. */
  guardadoEn: string;
}

export const CAMPOS_RL: (keyof CamposRL)[] = [
  "rlNombre",
  "rlFechaNacimiento",
  "rlNacionalidad",
  "rlEstadoCivil",
  "rlNoIdentificacion",
  "rlProfesionOcupacion",
  "rlActividadEconomica",
  "rlDireccion",
  "rlPaisResidencia",
  "rlTelefono",
];

/** Devuelve el valor "Otros" especificado por el usuario cuando aplica. */
const resolverOtros = (valor: string, sentinela: string, otro: string) =>
  valor === sentinela ? (otro || "").trim() : (valor || "").trim();

/** Traduce los datos personales de Persona Natural a los campos del RL. */
export function mapearNaturalARL(formData: FormStateNatural): CamposRL {
  const nombreCompleto = [formData.firstName, formData.lastName]
    .map((parte) => (parte || "").trim())
    .filter(Boolean)
    .join(" ");

  const telefono = (formData.telefono || "").trim() || (formData.celular || "").trim();
  const codigo = (formData.telefono || "").trim()
    ? formData.telefonoCodigo
    : formData.celularCodigo;

  const actividad =
    resolverOtros(formData.actividadLaboral, "OTROS", formData.actividadLaboralOtros) ||
    resolverOtros(formData.actEconPrincipal, "Otros", formData.otroActEcon);

  return {
    rlNombre: nombreCompleto,
    rlFechaNacimiento: (formData.fechaNacimiento || "").trim(),
    rlNacionalidad: (formData.nationality || "").trim(),
    rlEstadoCivil: (formData.estadoCivil || "").trim(),
    rlNoIdentificacion: (formData.idNumber || "").trim(),
    rlProfesionOcupacion: resolverOtros(formData.profession, "Otros", formData.profesionOtros),
    rlActividadEconomica: actividad,
    rlDireccion: (formData.direccionResidencial || "").trim(),
    rlPaisResidencia: (formData.paisResidencial || "").trim(),
    rlTelefono: telefono ? `${(codigo || "").trim()} ${telefono}`.trim() : "",
  };
}

/** Persiste los datos del RL en localStorage. */
export function guardarDatosRL(formData: FormStateNatural): void {
  if (typeof window === "undefined") return;
  try {
    const datos: DatosRepresentanteLegal = {
      ...mapearNaturalARL(formData),
      guardadoEn: new Date().toISOString(),
    };
    window.localStorage.setItem(DATOS_RL_STORAGE_KEY, JSON.stringify(datos));
  } catch (error) {
    console.warn("[DatosRL] No se pudieron guardar los datos del representante legal:", error);
  }
}

/** Lee los datos del RL guardados previamente. Devuelve null si no existen. */
export function leerDatosRL(): DatosRepresentanteLegal | null {
  if (typeof window === "undefined") return null;
  try {
    const item = window.localStorage.getItem(DATOS_RL_STORAGE_KEY);
    if (!item) return null;

    const parsed = JSON.parse(item);
    if (typeof parsed !== "object" || parsed === null) return null;

    const datos = { guardadoEn: "" } as DatosRepresentanteLegal;
    for (const campo of CAMPOS_RL) {
      datos[campo] = typeof parsed[campo] === "string" ? parsed[campo] : "";
    }
    datos.guardadoEn = typeof parsed.guardadoEn === "string" ? parsed.guardadoEn : "";

    // Sin al menos un dato útil no tiene sentido ofrecer la precarga
    return CAMPOS_RL.some((campo) => datos[campo]) ? datos : null;
  } catch (error) {
    console.warn("[DatosRL] No se pudieron leer los datos del representante legal:", error);
    return null;
  }
}

/** Elimina los datos guardados del RL. */
export function borrarDatosRL(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DATOS_RL_STORAGE_KEY);
  } catch (error) {
    console.warn("[DatosRL] No se pudieron borrar los datos del representante legal:", error);
  }
}
