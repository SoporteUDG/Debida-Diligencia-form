/**
 * Campos de documentos que admiten varios archivos. Se persisten como string[]
 * tanto en el borrador como en el estado del formulario.
 *
 * La lista vive aquí (y no en los componentes) porque el servidor también la
 * necesita: al subir o eliminar un archivo debe saber si el campo acumula
 * varios nombres o guarda uno solo.
 */
export const MULTI_FILE_FIELDS_NATURAL = ["origenFondosFile", "hasEstadoCuenta"] as const;

export const MULTI_FILE_FIELDS_JURIDICA = ["origenFondosFile", "pactoSocialFile"] as const;

/** Unión de ambos formularios, para validaciones del lado del servidor. */
export const MULTI_FILE_FIELDS: readonly string[] = Array.from(
  new Set<string>([...MULTI_FILE_FIELDS_NATURAL, ...MULTI_FILE_FIELDS_JURIDICA])
);

export function isMultiFileField(fieldName: string): boolean {
  return MULTI_FILE_FIELDS.includes(fieldName);
}

/**
 * Normaliza el valor de un campo multi-archivo. Tolera los formatos heredados
 * ("" de un borrador antiguo, [""] de un borrado parcial, null) y siempre
 * devuelve un arreglo limpio de nombres.
 */
export function normalizeMultiFileValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string" && v.trim() !== "");
  if (typeof value === "string" && value.trim() !== "") return [value];
  return [];
}
