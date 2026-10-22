import type { ClientFormType } from "./tokenAccess";

/** Resultado de enviar un formulario independiente a /api/registro. */
export type ResultadoRegistro =
  | { status: "ok"; url: string }
  | { status: "listo" } // el servidor lo aceptó sin crear nada (trampa para bots)
  | { status: "validacion"; errors: Record<string, string> }
  | { status: "existente" } // el RUC / ID tributaria ya está en Zoho: pedir confirmación
  | { status: "limite"; retryAfter: number }
  | { status: "verificacion" }
  | { status: "error" };

/**
 * Envía las secciones I a III de /registro/persona-natural o /persona-juridica.
 * El servidor crea el expediente en Zoho (sin socio, contacto ni unidad) y
 * devuelve el enlace del formulario normal. `website` es la trampa para bots:
 * el formulario la deja vacía.
 */
export async function procesarRegistroEstandalone(
  type: ClientFormType,
  data: Record<string, unknown>,
  /** submissionId: UUID de este envío; se repite en los reintentos para no duplicar el expediente. */
  opciones: { submissionId: string; confirmarExistente?: boolean; website?: string }
): Promise<ResultadoRegistro> {
  let res: Response;
  try {
    res = await fetch("/api/registro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, data, ...opciones }),
    });
  } catch {
    return { status: "error" };
  }
  const json = await res.json().catch(() => ({}));

  if (res.ok) return json.url ? { status: "ok", url: json.url } : { status: "listo" };
  if (res.status === 422 && json.errors) return { status: "validacion", errors: json.errors };
  if (res.status === 409 && json.code === "CLIENTE_EXISTENTE") return { status: "existente" };
  if (res.status === 429) return { status: "limite", retryAfter: Number(res.headers.get("Retry-After")) || 600 };
  if (res.status === 503 && json.code === "VERIFICACION") return { status: "verificacion" };
  return { status: "error" };
}
