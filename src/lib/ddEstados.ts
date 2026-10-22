/**
 * Valores del campo Estado de Debida_Diligencia en Zoho que usa el portal.
 * Sin imports: lo comparten zohoService y ddRetireService.
 */

/** Al crear el expediente (y al reactivarlo). */
export const ESTADO_EN_BORRADOR = "En borrador";
/** Al crear el expediente de /registro/*: aún sin Socio de Negocio. Las demás creaciones y actualizaciones no lo usan. */
export const ESTADO_SIN_ASOCIAR = "Sin Asociar";
/** Expediente retirado: solo se reactiva. */
export const ESTADO_ANULADO = "Anulado";
