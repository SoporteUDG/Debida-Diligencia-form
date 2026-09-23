/**
 * Un documento no siempre tiene todavía su archivo en WorkDrive. Mientras la
 * sincronización no termina, la fila guarda un marcador en zohoFileId en vez
 * de un id real, y pedir ese "id" a WorkDrive sólo produce un error.
 *
 * La lista vivía duplicada: completeDossierService la filtraba y el generador
 * del navegador no, así que el mismo expediente descartaba el anexo en el
 * servidor y fallaba al descargarlo en el cliente.
 */

/** Valores que ocupan el lugar de un id real mientras no hay archivo en WorkDrive. */
export const MARCADORES_WORKDRIVE = ["PENDING_SYNC", "LOCAL_BACKUP"] as const;

/** true si el id es un marcador y no apunta a ningún archivo de WorkDrive. */
export function esMarcadorWorkDrive(zohoFileId: string | null | undefined): boolean {
  if (!zohoFileId) return false;
  return (MARCADORES_WORKDRIVE as readonly string[]).includes(zohoFileId.trim());
}

/** true si vale la pena pedir el archivo: hay id, es real y el documento vive. */
export function esDescargable(doc: {
  zohoFileId?: string | null;
  status?: string | null;
}): boolean {
  return !!doc.zohoFileId && !esMarcadorWorkDrive(doc.zohoFileId) && doc.status !== "DELETED";
}
