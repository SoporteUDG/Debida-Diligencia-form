import type { ClientFormType } from "./tokenAccess";
import { zoho } from "./zohoService";
import { identificadorDelTemporal } from "./temporalFields";

/**
 * API name del RUC del Socio de Negocio (Accounts). ZOHO_ACCOUNT_RUC_FIELD lo
 * sustituye. También se usa al crear el Socio de Negocio (temporalScaffold).
 */
export const ACCOUNT_RUC_FIELD = process.env.ZOHO_ACCOUNT_RUC_FIELD || "RUC";

type ModuloBusqueda = "Accounts" | "Contacts" | "Debida_Diligencia";

/**
 * Dónde puede estar el RUC / ID tributaria de un cliente que ya compró:
 * - Jurídica: RUC del Socio de Negocio e ID_tributaria del expediente
 *   (RUC_NIT en expedientes antiguos).
 * - Natural: RUC del Socio de Negocio, cédula/pasaporte del Contact e
 *   identificación del expediente.
 */
export const CAMPOS_IDENTIFICADOR: Record<ClientFormType, ReadonlyArray<{ module: ModuloBusqueda; field: string }>> = {
  JURIDICA: [
    { module: "Accounts", field: ACCOUNT_RUC_FIELD },
    { module: "Debida_Diligencia", field: "ID_tributaria" },
  ],
  NATURAL: [
    { module: "Accounts", field: ACCOUNT_RUC_FIELD },
    { module: "Contacts", field: "C_I_P_Pasaporte" },
    { module: "Debida_Diligencia", field: "Numero_Identificacion" },
  ],
};

/** Registro de Zoho que ya tiene el identificador del cliente. */
export interface CoincidenciaZoho {
  module: ModuloBusqueda;
  field: string;
  id: string;
  name: string;
}

/** No se pudo consultar Zoho en ningún campo: no se sabe si el cliente existe. */
export class VerificacionZohoError extends Error {
  constructor(public readonly errores: unknown[]) {
    super("No se pudo verificar en Zoho CRM si el cliente ya existe.");
    this.name = "VerificacionZohoError";
  }
}

const nombreDe = (r: Record<string, any>): string =>
  String(r.Account_Name ?? r.Full_Name ?? r.Name ?? [r.First_Name, r.Last_Name].filter(Boolean).join(" ") ?? "").trim();

/**
 * Busca en Zoho el RUC / ID tributaria que el cliente llenó en el temporal.
 * Devuelve los registros que ya lo tienen (sin repetir); [] si no hay ninguno o
 * si el cliente no llenó el identificador. Un campo que falle (p. ej. no existe
 * en el layout) solo se registra en el log; si fallan todos lanza
 * VerificacionZohoError para no crear un cliente duplicado a ciegas.
 */
export async function buscarClienteEnZoho(
  type: ClientFormType,
  data: Record<string, any>
): Promise<CoincidenciaZoho[]> {
  const identificador = identificadorDelTemporal(type, data);
  if (!identificador) return [];

  const campos = CAMPOS_IDENTIFICADOR[type];
  const resultados = await Promise.allSettled(
    campos.map(({ module, field }) => zoho.service.searchByField(module, field, identificador))
  );

  const errores: unknown[] = [];
  const vistos = new Set<string>();
  const coincidencias: CoincidenciaZoho[] = [];
  resultados.forEach((resultado, i) => {
    const { module, field } = campos[i];
    if (resultado.status === "rejected") {
      console.warn(`[Temporal Validation] No se pudo buscar ${module}.${field}:`, resultado.reason);
      errores.push(resultado.reason);
      return;
    }
    for (const registro of resultado.value) {
      const id = String(registro?.id ?? "");
      if (!id || vistos.has(`${module}:${id}`)) continue;
      vistos.add(`${module}:${id}`);
      coincidencias.push({ module, field, id, name: nombreDe(registro) });
    }
  });

  if (errores.length === campos.length) throw new VerificacionZohoError(errores);
  return coincidencias;
}
