/**
 * Helper to remove accents/diacritics and normalize characters.
 * Example: "María-José 123!" -> "MARIA_JOSE_123"
 */
export function normalizeText(text: string): string {
  if (!text) return "";
  
  return text
    .normalize("NFD") // Split accents from characters
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-zA-Z0-9]/g, "_") // Replace non-alphanumeric characters with underscores
    .replace(/_+/g, "_") // Collapse multiple underscores
    .replace(/^_+|_+$/g, "") // Trim leading/trailing underscores
    .toUpperCase();
}

/**
 * Normalizes and validates the file extension.
 * Example: ".PDF" -> "pdf"
 */
export function normalizeExtension(ext: string): string {
  if (!ext) return "";
  return ext
    .trim()
    .toLowerCase()
    .replace(/^\./, "") // Remove leading dot if present
    .replace(/[^a-z0-9]/g, ""); // Keep only alphanumeric
}

/**
 * Formats a Date or date string to YYYYMMDD.
 * If input is invalid, defaults to current date in YYYYMMDD format.
 */
export function formatDateToYYYYMMDD(dateInput?: Date | string): string {
  if (typeof dateInput === "string") {
    // Direct regex extraction for standard YYYY-MM-DD or YYYY/MM/DD formats
    // to bypass any timezone shifts.
    const match = dateInput.trim().match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
    if (match) {
      return `${match[1]}${match[2]}${match[3]}`;
    }
  }

  const d = dateInput ? new Date(dateInput) : new Date();
  
  // Verify if it's a valid date
  if (isNaN(d.getTime())) {
    // If it's a string that already matches YYYYMMDD (8 digits)
    if (typeof dateInput === "string" && /^\d{8}$/.test(dateInput)) {
      return dateInput.trim();
    }
    // Fallback to current date
    const fallback = new Date();
    const yyyy = fallback.getFullYear();
    const mm = String(fallback.getMonth() + 1).padStart(2, "0");
    const dd = String(fallback.getDate()).padStart(2, "0");
    return `${yyyy}${mm}${dd}`;
  }

  // Use UTC methods for parsed string inputs to prevent timezone offset shifts
  const useUTC = typeof dateInput === "string";
  const yyyy = useUTC ? d.getUTCFullYear() : d.getFullYear();
  const mm = String((useUTC ? d.getUTCMonth() : d.getMonth()) + 1).padStart(2, "0");
  const dd = String(useUTC ? d.getUTCDate() : d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

interface GenerateFilenameOptions {
  documentType: string;
  lastName: string;
  firstName: string;
  date?: Date | string;
  extension: string;
  existingNames?: string[];
}

/**
 * Pure function that generates a safe, normalized filename complying with the UDG standard:
 * {TIPO_DOC}_{APELLIDO}_{NOMBRE}_{FECHA}.{ext}
 *
 * It prevents path traversal, removes invalid characters, and resolves filename
 * collisions if `existingNames` is provided by appending a suffix (e.g. _1, _2).
 */
export function generateNormalizedFilename({
  documentType,
  lastName,
  firstName,
  date,
  extension,
  existingNames = [],
}: GenerateFilenameOptions): string {
  const normType = normalizeText(documentType);
  const normLastName = normalizeText(lastName);
  const normFirstName = normalizeText(firstName);
  const formattedDate = formatDateToYYYYMMDD(date);
  const normExt = normalizeExtension(extension);

  if (!normType) {
    throw new Error("El tipo de documento es obligatorio para generar el nombre.");
  }
  if (!normLastName) {
    throw new Error("El apellido del cliente es obligatorio para generar el nombre.");
  }
  if (!normFirstName) {
    throw new Error("El nombre del cliente es obligatorio para generar el nombre.");
  }
  if (!normExt) {
    throw new Error("La extensión del archivo es obligatoria para generar el nombre.");
  }

  const baseFileName = `${normType}_${normLastName}_${normFirstName}_${formattedDate}`;
  const finalExt = `.${normExt}`;

  let candidateName = `${baseFileName}${finalExt}`;
  
  // Resolve duplicate collision in a deterministic, pure way
  if (existingNames && existingNames.length > 0) {
    // Normalize existing names array for reliable comparison
    const normalizedExisting = existingNames.map(name => name.trim().toLowerCase());
    let counter = 1;

    while (normalizedExisting.includes(candidateName.toLowerCase())) {
      candidateName = `${baseFileName}_${counter}${finalExt}`;
      counter++;
    }
  }

  return candidateName;
}
