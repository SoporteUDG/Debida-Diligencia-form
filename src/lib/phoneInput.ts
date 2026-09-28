/**
 * Campos de teléfono de ambos formularios. Solo admiten dígitos y los
 * separadores habituales de un número: espacio, guion, paréntesis y "+"
 * (los campos sin selector de código de país lo necesitan).
 */
export const PHONE_INPUT_FIELDS: ReadonlySet<string> = new Set([
  // Persona Natural
  "telefono",
  "celular",
  // Persona Jurídica
  "contactoTelefono",
  "empresaTelefono",
  "empresaCelular",
  "rlTelefono",
]);

/** Quita letras y cualquier otro carácter que no forme parte de un teléfono. */
export function sanitizePhoneInput(value: string): string {
  return value.replace(/[^0-9+\-\s()]/g, "");
}
