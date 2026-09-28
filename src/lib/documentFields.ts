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

/**
 * Nombre legible de cada ranura documental. Se usa para las subcarpetas de
 * WorkDrive, para el nombre de los archivos subidos y en el PDF del expediente.
 */
export const DOCUMENT_LABELS: Record<string, string> = {
  idFile: "Copia del Documento de Identidad",
  copiaIdFile: "Copia del Documento de Identidad",
  proofAddressFile: "Prueba de Domicilio",
  origenFondosFile: "Origen de Fondos",
  hasEstadoCuenta: "Estado de Cuenta Bancario",
  hasCertificacionBancaria: "Certificación Bancaria",
  certBancariaFile: "Certificación Bancaria",
  pactoSocialFile: "Pacto Social y sus Adendas",
  avisoOperacionesFile: "Certificado de Aviso de Operaciones",
  serviciosPublicosFile: "Factura de Servicios Públicos",
  certRegistroFile: "Certificado de Registro Público",
  certComprasFile: "Compras de Beneficiarios con Fondos Corporativos",
  otrosAdjuntosFile: "Otros Adjuntos",
};

/** Nombre legible de una ranura; si no está catalogada se usa la clave tal cual. */
export function getDocumentLabel(documentType: string): string {
  return DOCUMENT_LABELS[documentType] || documentType.replace(/_/g, " ").trim();
}

/** Quita tildes y reemplaza todo lo que no sea alfanumérico por "_". */
function toFileNamePart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Nombre del archivo de un documento subido:
 *   - General:            NombreLegible_{timestamp}.{ext}
 *   - Por persona (RL, GJC, BF): NombreLegible_NombrePersona_{timestamp}.{ext}
 */
export function buildDocumentFileName(
  documentType: string,
  timestamp: number,
  ext: string,
  personName?: string
): string {
  const partes = [toFileNamePart(getDocumentLabel(documentType))];
  const persona = personName ? toFileNamePart(personName) : "";
  if (persona) partes.push(persona);
  partes.push(String(timestamp));
  return `${partes.join("_")}.${ext}`;
}
