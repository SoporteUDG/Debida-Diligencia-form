import { crearLimitador } from "./rateLimit";

const DIEZ_MINUTOS_MS = 10 * 60 * 1000;
const UNA_HORA_MS = 60 * 60 * 1000;

/** Expedientes que una misma IP puede crear cada 10 minutos. */
export const MAX_CREACIONES_POR_IP = 5;
/** Expedientes que puede crear todo el portal cada 10 minutos (protege la cuota de la API de Zoho). */
export const MAX_CREACIONES_GLOBAL = 40;
/** Envíos (válidos o no) por IP cada hora: acota también las búsquedas en Zoho. */
export const MAX_ENVIOS_POR_IP = 30;

export const limitadorCreaciones = crearLimitador(MAX_CREACIONES_POR_IP, DIEZ_MINUTOS_MS);
export const limitadorGlobal = crearLimitador(MAX_CREACIONES_GLOBAL, DIEZ_MINUTOS_MS);
export const limitadorEnvios = crearLimitador(MAX_ENVIOS_POR_IP, UNA_HORA_MS);
