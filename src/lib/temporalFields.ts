import { naturalStep1Schema, juridicaStep1Schema } from "./validation";
import type { ClientFormType } from "./tokenAccess";
import { INITIAL_FORM_STATE as INITIAL_NATURAL } from "@/types/persona-natural";
import { INITIAL_FORM_STATE as INITIAL_JURIDICA } from "@/types/persona-juridica";

/**
 * Campos de los pasos del enlace temporal: las secciones I a III del primer
 * paso del formulario completo (sin documentos ni firma).
 * - Natural: Step1DatosPersonales, Step2PerfilFinanciero y Step3PerfilFinanciero
 *   (Step3Documentos queda fuera).
 * - Jurídica: Step1Identificacion, Step2GobiernoRL y Step3Finanzas.
 * Módulo compartido entre servidor y navegador.
 */
export const TEMPORAL_FIELDS: Record<ClientFormType, readonly string[]> = {
  NATURAL: [
    // Paso 1: Datos personales
    "nombreProyecto", "formaContacto", "formaContactoDetalle", "referidoPor",
    "firstName", "lastName", "estadoCivil", "paisNacimiento", "paisResidenciaFiscal",
    "nationality", "otraNacionalidad", "tipoIdentificacion", "idNumber",
    "fechaVencimientoId", "estatusMigratorio", "fechaNacimiento",
    // Paso 2: Ubicación, datos laborales y actividades económicas
    "direccionResidencial", "ciudad", "provinciaEstado", "paisResidencial", "email",
    "telefonoCodigo", "telefono", "celularCodigo", "celular",
    "profession", "profesionOtros", "paisActividadLaboral", "employer", "actividadLaboral",
    "actividadLaboralOtros", "direccionLaboral", "cargoDesempena", "esPropietario", "usaFondos",
    "actEconPrincipal", "otroActEcon", "pctDedicacionPrincipal", "jurisdiccionPrincipal",
    "actEconSecundaria", "pctDedicacionSecundaria", "jurisdiccionSecundaria",
    // Paso 3: Perfil financiero y PEP
    "ingresosMensuales", "medioPago", "fuenteFondosInmueble", "ifOtroNombre",
    "ifTerceroNombre", "ifTerceroNacionalidad", "ifTerceroRelacion", "ifTerceroFuenteDeIngresos",
    "montoServiciosAnuales", "cantidadServiciosAnuales", "adquiereNombreTercero", "nombreTercero",
    "destinoInmueble", "esPep", "pepNombre", "pepCargo", "pepInstitucion", "pepRelacion",
  ],
  JURIDICA: [
    // Paso 1: Identificación de la empresa
    "nombreProyecto", "formaContacto", "formaContactoDetalle", "referidoPor",
    "razonSocial", "tipoSociedad", "estadoSociedad", "tipoCliente", "tipoDocumentoIdentidad",
    "actividadPrincipal", "fechaVencimientoId", "numeroIdTributaria", "paisTributacion",
    "fechaConstitucion", "paisOpera", "paisInscripcion",
    "contactoNombre", "contactoApellido", "contactoId", "contactoTelefono", "contactoEmail",
    "ifContacto", "contactoCargo",
    "empresaDireccion", "empresaCiudad", "empresaProvincia", "empresaPais",
    "empresaTelefonoCodigo", "empresaTelefono", "empresaCelularCodigo", "empresaCelular", "empresaEmail",
    // Paso 2: Representante legal y gobierno corporativo
    "rlNombre", "rlFechaNacimiento", "rlNacionalidad", "rlEstadoCivil", "rlNoIdentificacion",
    "rlProfesionOcupacion", "rlActividadEconomica", "rlDireccion", "rlPaisResidencia",
    "rlTelefono", "rlObjetoInvestigacion", "gjcMembers",
    // Paso 3: Beneficiarios finales y perfil financiero
    "bfMembers", "ingresosMensuales", "medioPago", "fuenteFondosInmueble",
    "terceroNombre", "terceroNacionalidad", "terceroVinculo", "terceroFuenteFondos",
    "adquiereMasUnidades", "cantidadUnidadesInmobiliarias",
    "esPep", "pepNombre", "pepCargo", "pepInstitucion", "pepRelacion",
  ],
};

/**
 * Valida los pasos del temporal con el esquema del paso 1 del formulario
 * completo (que ya agrupa las secciones I a III), conservando solo los errores
 * de los campos que el temporal muestra.
 * Los campos ausentes toman su valor inicial para que las reglas condicionales
 * (superRefine) se evalúen igual que en el formulario completo.
 * Devuelve { campo: mensaje }; vacío si es válido.
 */
export function validarPasoTemporal(type: ClientFormType, data: Record<string, any>): Record<string, string> {
  const schema = type === "NATURAL" ? naturalStep1Schema : juridicaStep1Schema;
  const inicial = type === "NATURAL" ? INITIAL_NATURAL : INITIAL_JURIDICA;
  const resultado = schema.safeParse({ ...inicial, ...data });
  if (resultado.success) return {};

  const campos = new Set(TEMPORAL_FIELDS[type]);
  const errors: Record<string, string> = {};
  for (const issue of resultado.error.issues) {
    if (campos.has(String(issue.path[0]))) errors[issue.path.join(".")] = issue.message;
  }
  return errors;
}

/** Solo los campos del temporal (lo demás que llegue se descarta). */
export function datosDelTemporal(type: ClientFormType, data: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const campo of TEMPORAL_FIELDS[type]) if (data[campo] !== undefined) out[campo] = data[campo];
  return out;
}

/**
 * Identificador fiscal que el cliente llenó en el temporal: el RUC / ID
 * tributaria de la empresa (numeroIdTributaria) o la identificación de la
 * persona natural (idNumber). "" si no lo llenó.
 */
export function identificadorDelTemporal(type: ClientFormType, data: Record<string, any>): string {
  const valor = type === "JURIDICA" ? data?.numeroIdTributaria : data?.idNumber;
  return String(valor ?? "").trim();
}
