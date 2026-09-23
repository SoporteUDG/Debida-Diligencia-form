/**
 * Decide con qué estructura se pinta un expediente en la vista de consulta.
 *
 * Normalmente basta con el tipo que devuelve getFormView (el de la fila Draft
 * o Form). Pero ese tipo es una etiqueta: se fija al generar el enlace y nada
 * garantiza que coincida con lo que el cliente terminó llenando. Un expediente
 * etiquetado JURIDICA con datos de persona natural se pintaba con las secciones
 * de empresa —"Identificación de la Empresa" en blanco, "Gobierno y Junta
 * Directiva" y "Beneficiarios Finales" vacíos—, que es justo lo que no debe
 * aparecer en un expediente natural.
 *
 * Cuando la etiqueta y el contenido se contradicen manda el contenido, y el
 * desacuerdo se reporta para avisarlo en pantalla en vez de taparlo.
 */

export type FormViewType = "natural" | "juridica";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FormData = Record<string, any>;

/** Campos que sólo existen en el formulario de persona natural. */
const MARCAS_NATURAL = ["firstName", "lastName", "idNumber", "profession"] as const;

/** Campos que sólo existen en el formulario de persona jurídica. */
const MARCAS_JURIDICA = [
  "razonSocial",
  "tipoSociedad",
  "numeroDocumento",
  "rlNombre",
  "gjcMembers",
  "bfMembers",
] as const;

/**
 * Una fila de persona (dignatario, beneficiario final) cuenta como llenada
 * sólo si alguno de sus campos trae algo. El formulario jurídico arranca con
 * filas de relleno —gjc-initial-1, bf-initial-1...— con todos los campos en
 * blanco salvo el id, y ésas no son contenido: son el estado inicial.
 */
export function tieneDatosPersona(fila: unknown): boolean {
  if (!fila || typeof fila !== "object") return false;
  return Object.entries(fila as Record<string, unknown>).some(
    ([campo, valor]) => campo !== "id" && typeof valor === "string" && valor.trim() !== ""
  );
}

/** Descarta las filas de relleno para no pintar tablas de guiones. */
export function soloPersonasConDatos<T>(filas: T[] | undefined | null): T[] {
  return Array.isArray(filas) ? filas.filter((f) => tieneDatosPersona(f)) : [];
}

/** Un campo cuenta sólo si trae algo: "" y [] son tan vacíos como undefined. */
function tieneValor(valor: unknown): boolean {
  if (Array.isArray(valor)) return valor.some((f) => tieneDatosPersona(f));
  if (typeof valor === "string") return valor.trim() !== "";
  return valor !== null && valor !== undefined;
}

function contarMarcas(data: FormData, marcas: readonly string[]): number {
  return marcas.filter((campo) => tieneValor(data?.[campo])).length;
}

export interface FormTypeResolution {
  /** Tipo con el que se debe pintar el expediente. */
  type: FormViewType;
  /** Tipo que declaró el servidor. */
  declared: FormViewType;
  /** true si el contenido contradijo la etiqueta y se corrigió. */
  mismatch: boolean;
  naturalMarkers: number;
  juridicaMarkers: number;
}

/**
 * Sólo se corrige la etiqueta cuando la evidencia es inequívoca: el tipo
 * declarado no tiene ni un campo propio lleno y el otro sí. Un expediente
 * a medio llenar (ambos en cero) conserva su etiqueta.
 */
export function resolveFormType(declared: FormViewType, data: FormData): FormTypeResolution {
  const naturalMarkers = contarMarcas(data || {}, MARCAS_NATURAL);
  const juridicaMarkers = contarMarcas(data || {}, MARCAS_JURIDICA);

  let type = declared;
  if (declared === "juridica" && juridicaMarkers === 0 && naturalMarkers > 0) type = "natural";
  else if (declared === "natural" && naturalMarkers === 0 && juridicaMarkers > 0) type = "juridica";

  return { type, declared, mismatch: type !== declared, naturalMarkers, juridicaMarkers };
}
