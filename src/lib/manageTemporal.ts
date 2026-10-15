import type { Temporal } from "@prisma/client";
import type { CoincidenciaZoho } from "./temporalValidation";
import { crearEstructuraDelTemporal, registrarClienteExistente, type EnlaceDelTemporal } from "./temporalScaffold";

/**
 * Se llama cuando el cliente envía los pasos del enlace temporal
 * (POST /api/temporal), con el temporal ya bloqueado (completedAt).
 *
 * - Su RUC / ID tributaria ya estaba en Zoho (y confirmó sus datos): no se crea
 *   nada, solo notas para el asesor. Devuelve null (no hay enlace nuevo).
 * - Si no: crea Contacto, Socio de Negocio y Debida Diligencia, y devuelve el
 *   enlace normal del formulario, cuyo borrador lleva los datos del temporal.
 *
 * Si lanza, quien llama libera el temporal para que el cliente reintente.
 */
export async function manageTemporal(
  temporal: Temporal,
  opciones: { coincidencias: CoincidenciaZoho[]; appUrl: string }
): Promise<EnlaceDelTemporal | null> {
  console.log(`[ManageTemporal] Temporal ${temporal.id} enviado (generado desde ${temporal.crmModule}).`);
  if (opciones.coincidencias.length) {
    await registrarClienteExistente(temporal, opciones.coincidencias);
    return null;
  }
  return crearEstructuraDelTemporal(temporal, opciones.appUrl);
}
