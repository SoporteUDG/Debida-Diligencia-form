/**
 * Motivos por los que un enlace de cliente no da acceso al formulario.
 * Módulo compartido entre servidor y navegador: no importa nada de servidor.
 */
export type TokenFailureReason =
  /** El enlace ya se usó para enviar el formulario o fue revocado desde el CRM. */
  | "USED"
  /** El enlace venció. */
  | "EXPIRED"
  /** El token no existe en la base de datos. */
  | "NOT_FOUND"
  /** Token ausente, mal formado o con la firma alterada. */
  | "INVALID"
  /** El enlace es de persona natural y se abrió en persona jurídica, o al revés. */
  | "WRONG_FORM";

export type ClientFormType = "NATURAL" | "JURIDICA";

/** Cabecera con la que cada página indica qué formulario está abierto. */
export const FORM_TYPE_HEADER = "x-form-type";

const REASONS: readonly TokenFailureReason[] = ["USED", "EXPIRED", "NOT_FOUND", "INVALID", "WRONG_FORM"];

/**
 * Extrae el motivo de rechazo de la respuesta JSON de una llamada tRPC
 * (`{ error: { data: { tokenReason } } }`). Devuelve null si no es un rechazo de token.
 */
export function tokenReasonFromResponse(body: unknown): TokenFailureReason | null {
  const reason = (body as { error?: { data?: { tokenReason?: unknown } } } | null)?.error?.data?.tokenReason;
  return REASONS.includes(reason as TokenFailureReason) ? (reason as TokenFailureReason) : null;
}
