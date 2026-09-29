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
  certComprasFile: "Compras de Beneficiarios con Fondos Corporativos"
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
 * Siguiente número de archivo de una ranura: el mayor "file_N" entre los
 * nombres existentes + 1. Un hueco por archivos eliminados no se reutiliza.
 */
export function nextDocumentFileIndex(existingNames: string[]): number {
  let max = 0;
  for (const name of existingNames) {
    const match = /_file_(\d+)_[0-9a-f]+\.[^.]+$/i.exec(name);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

/**
 * Nombre del archivo de un documento subido:
 *   - Un archivo:    NombreLegible_{Titular}.{ext}
 *   - Multi-archivo: NombreLegible_{Titular}_file_{N}_{sufijo}.{ext}
 *   - Por persona:   NombreLegible_{Persona}_{Tipo}-{N}.{ext}   (p. ej. BF-2)
 *
 * - Titular: el cliente (razón social o nombre completo) o, en documentos por
 *   persona (RL, GJC, BF), el nombre de esa persona.
 * - Tipo-N (solo por persona): tipo de persona y su posición en la lista del
 *   formulario. Todos los documentos por persona comparten carpeta; el número
 *   distingue a personas con el mismo nombre y es estable para cada persona,
 *   así que volver a subir su documento reemplaza el anterior.
 * - N (solo multi-archivo): número del archivo dentro de la ranura (legible,
 *   no garantiza unicidad).
 * - sufijo (solo multi-archivo): hexadecimal aleatorio. Es lo que hace único
 *   el nombre: WorkDrive sobrescribe archivos con el mismo nombre en la misma
 *   carpeta, y el borrador, el borrado y la lista de archivos identifican los
 *   multi-archivo por nombre.
 */
export function buildDocumentFileName(params: {
  documentType: string;
  ext: string;
  ownerName?: string;
  person?: { type: string; index: number };
  index?: number;
  suffix?: string;
}): string {
  const partes = [toFileNamePart(getDocumentLabel(params.documentType))];
  const titular = params.ownerName ? toFileNamePart(params.ownerName) : "";
  if (titular) partes.push(titular);
  if (params.person) partes.push(`${params.person.type}-${params.person.index}`);
  if (params.index) partes.push(`file_${params.index}`);
  if (params.suffix) partes.push(params.suffix);
  return `${partes.join("_")}.${params.ext}`;
}
