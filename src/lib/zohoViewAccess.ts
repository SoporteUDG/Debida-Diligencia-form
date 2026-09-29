import crypto from "crypto";

/**
 * Acceso a /view desde Zoho CRM sin pegar el enlace del cliente.
 *
 * Zoho firma `${recordId}.${ts}` con HMAC-SHA256 usando ZOHO_VIEW_SECRET
 * (Deluge: zoho.encryption.hmacsha256). La firma sólo vale unos minutos: basta
 * para que el botón del Canvas abra la vista, no para compartirla.
 *
 * Los Web Tabs de Zoho no admiten parámetros dinámicos (sólo de usuario y
 * organización), así que el botón deja un "traspaso" a nombre del usuario de
 * Zoho y el Web Tab lo reclama con el parámetro de usuario que sí puede anexar.
 */

const VIGENCIA_FIRMA_MS = 10 * 60 * 1000;
const TOLERANCIA_RELOJ_MS = 2 * 60 * 1000;
const VIGENCIA_TRASPASO_MS = 2 * 60 * 1000;

const getSecret = () => process.env.ZOHO_VIEW_SECRET || "";

export function accesoZohoHabilitado(): boolean {
  return getSecret().length > 0;
}

/** Deluge devuelve la firma en base64 por defecto; se acepta también hex. */
function firmaCoincide(mensaje: string, firma: string): boolean {
  const esperado = crypto.createHmac("sha256", getSecret()).update(mensaje).digest();
  const limpia = firma.trim();
  const candidatos = [
    /^[0-9a-f]{64}$/i.test(limpia) ? Buffer.from(limpia, "hex") : null,
    Buffer.from(limpia.replace(/-/g, "+").replace(/_/g, "/"), "base64"),
  ];
  return candidatos.some(
    (c) => !!c && c.length === esperado.length && crypto.timingSafeEqual(c, esperado)
  );
}

export type AccesoZoho = { recordId: string; ts: string; sig: string };

export function verificarAccesoZoho({ recordId, ts, sig }: AccesoZoho): { ok: true } | { ok: false; error: string } {
  if (!accesoZohoHabilitado()) {
    return { ok: false, error: "El acceso desde Zoho no está configurado (falta ZOHO_VIEW_SECRET)" };
  }
  if (!recordId || !ts || !sig) return { ok: false, error: "Faltan parámetros de acceso desde Zoho" };

  const emitido = Number(ts);
  const ahora = Date.now();
  if (!Number.isFinite(emitido) || emitido > ahora + TOLERANCIA_RELOJ_MS || ahora - emitido > VIGENCIA_FIRMA_MS) {
    return { ok: false, error: "El acceso desde Zoho venció. Vuelva a pulsar el botón en el registro." };
  }
  if (!firmaCoincide(`${recordId}.${ts}`, sig)) {
    return { ok: false, error: "Acceso desde Zoho inválido: la firma no es válida" };
  }
  return { ok: true };
}

// ---------- traspaso botón -> Web Tab ----------

type Traspaso = { recordId: string; expiresAt: number };

// Un solo contenedor (igual que el rate limiter del middleware). globalThis
// evita perder el mapa con cada recarga en caliente durante el desarrollo.
const almacenGlobal = globalThis as typeof globalThis & { __zohoViewTraspasos?: Map<string, Traspaso> };
const almacen: Map<string, Traspaso> =
  (almacenGlobal.__zohoViewTraspasos ??= new Map<string, Traspaso>());

// El Web Tab sustituye ${Usuarios.Correo electrónico} sin codificar: un "+" del
// correo llega como espacio. Un email no admite espacios, así que se restituye.
const claveUsuario = (usuario: string) => usuario.trim().replace(/ /g, "+").toLowerCase();

export function registrarTraspaso(usuario: string, recordId: string) {
  const ahora = Date.now();
  for (const [k, v] of almacen) if (v.expiresAt < ahora) almacen.delete(k);
  almacen.set(claveUsuario(usuario), { recordId, expiresAt: ahora + VIGENCIA_TRASPASO_MS });
}

/** Un traspaso se consume al reclamarlo: la siguiente apertura del Web Tab pide enlace. */
export function reclamarTraspaso(usuario: string): string | null {
  const clave = claveUsuario(usuario);
  const traspaso = almacen.get(clave);
  almacen.delete(clave);
  if (!traspaso || traspaso.expiresAt < Date.now()) return null;
  return traspaso.recordId;
}
