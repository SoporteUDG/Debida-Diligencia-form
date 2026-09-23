/**
 * Reglas de visibilidad de los campos condicionales del formulario.
 *
 * La vista de consulta mostraba todos los campos de su tipo, incluidos los que
 * el cliente nunca llegó a ver: "Referido Por" aparecía aunque el contacto no
 * hubiera sido por referido, y salía como "—". Aquí se replican, campo por
 * campo, las mismas condiciones con que cada paso del formulario los muestra
 * u oculta, para que la consulta refleje el formulario que se llenó.
 *
 * Cada regla apunta al lugar del que se copió. Si allá cambia la condición,
 * aquí hay que reflejarlo.
 */

import type { FormViewType } from "./formTypeResolution";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FormData = Record<string, any>;

type Regla = (data: FormData) => boolean;

/** Los selectores del formulario guardan "Sí" o "Si" según la pantalla. */
const esSi = (valor: unknown): boolean => {
  const s = String(valor ?? "").trim().toLowerCase();
  return s === "sí" || s === "si";
};

/** fuenteFondosInmueble es texto (a veces multiselección concatenada). */
const incluye = (valor: unknown, aguja: string): boolean => {
  const texto = Array.isArray(valor) ? valor.join(" ") : String(valor ?? "");
  return texto.toLowerCase().includes(aguja.toLowerCase());
};

/** Vale para ambos formularios: el paso 1 es el mismo en los dos. */
const COMUNES: Record<string, Regla> = {
  // persona-natural/Step1DatosPersonales.tsx:136 · persona-juridica/Step1Identificacion.tsx:110
  referidoPor: (d) => d.formaContacto === "Referido",
  // persona-natural/Step1DatosPersonales.tsx:109 · persona-juridica/Step1Identificacion.tsx:85
  formaContactoDetalle: (d) => d.formaContacto === "Otros" || d.formaContacto === "Otro",
};

const NATURAL: Record<string, Regla> = {
  ...COMUNES,
  // Step2PerfilFinanciero.tsx:446 — se conserva el !== "No" del formulario:
  // un expediente sin responder sigue mostrando el campo, igual que allá.
  usaFondos: (d) => d.esPropietario !== "No",
  // Step3PerfilFinanciero.tsx:342
  cantidadServiciosAnuales: (d) => esSi(d.montoServiciosAnuales),
  // Step3PerfilFinanciero.tsx:398
  nombreTercero: (d) => esSi(d.adquiereNombreTercero),
  // Step3PerfilFinanciero.tsx:222
  ifOtroNombre: (d) => incluye(d.fuenteFondosInmueble, "Otros"),
  // Step3PerfilFinanciero.tsx:239 — bloque "Tercero Aportante de Fondos"
  ifTerceroNombre: (d) => incluye(d.fuenteFondosInmueble, "Terceros"),
  ifTerceroNacionalidad: (d) => incluye(d.fuenteFondosInmueble, "Terceros"),
  ifTerceroFuenteDeIngresos: (d) => incluye(d.fuenteFondosInmueble, "Terceros"),
  ifTerceroRelacion: (d) => incluye(d.fuenteFondosInmueble, "Terceros"),
};

const JURIDICA: Record<string, Regla> = {
  ...COMUNES,
  // Step1Identificacion.tsx:555
  contactoCargo: (d) => esSi(d.ifContacto),
  // Step3Finanzas.tsx:558
  cantidadUnidadesInmobiliarias: (d) => esSi(d.adquiereMasUnidades),
  // Step3Finanzas.tsx:435 — bloque "Tercero Aportante de Fondos"
  terceroNombre: (d) => incluye(d.fuenteFondosInmueble, "Terceros"),
  terceroNacionalidad: (d) => incluye(d.fuenteFondosInmueble, "Terceros"),
  terceroVinculo: (d) => incluye(d.fuenteFondosInmueble, "Terceros"),
  terceroFuenteFondos: (d) => incluye(d.fuenteFondosInmueble, "Terceros"),
};

const REGLAS: Record<FormViewType, Record<string, Regla>> = { natural: NATURAL, juridica: JURIDICA };

/**
 * ¿Se le mostró este campo al cliente? Un campo sin regla es incondicional
 * en el formulario, así que siempre se muestra.
 */
export function isFieldVisible(type: FormViewType, field: string, data: FormData): boolean {
  const regla = REGLAS[type]?.[field];
  return regla ? regla(data || {}) : true;
}

/**
 * ¿Se llenó el bloque de tercero aportante? Ambos formularios lo abren con la
 * misma condición, sólo cambian los nombres de los campos.
 */
export function muestraBloqueTercero(type: FormViewType, data: FormData): boolean {
  const campo = type === "natural" ? "ifTerceroNombre" : "terceroNombre";
  return isFieldVisible(type, campo, data);
}

/** persona-natural/Step3PerfilFinanciero.tsx:488 · persona-juridica/Step3Finanzas.tsx:651 */
export function muestraBloquePep(data: FormData): boolean {
  return esSi(data?.esPep);
}

/** Descarta de una lista los campos que el formulario no mostró. */
export function camposVisibles<T extends { field?: string }>(
  type: FormViewType,
  data: FormData,
  fields: T[]
): T[] {
  return fields.filter((f) => !f.field || isFieldVisible(type, f.field, data));
}
