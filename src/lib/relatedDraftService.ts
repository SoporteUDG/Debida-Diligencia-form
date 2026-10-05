import prisma from "@/lib/prisma";
import { zoho } from "@/lib/zohoService";
import { logAuditEvent } from "@/lib/auditService";
import { PROFESSIONS } from "@/lib/naturalOptions";

/**
 * Al completar un formulario (Natural o Jurídica) se buscan en Zoho CRM el
 * expediente relacionado (Debida_Diligencia.dd_relacionado) y su borrador en el
 * portal. Si ese borrador sigue sin enviarse, se completan los campos que ambos
 * formularios comparten según zoho_fields_guide.md (mismo campo de API en
 * Zoho). Solo se escriben campos vacíos: nunca se pisa lo que el otro cliente
 * ya capturó.
 *
 * Se cancela todo si dd_relacionado está vacío, si el relacionado no tiene
 * borrador, si ya fue completado o si es del mismo tipo de formulario.
 */

type FormType = "NATURAL" | "JURIDICA";
type Datos = Record<string, any>;

/**
 * Campos a escribir en el borrador destino. `siVacios` son los campos que deben
 * estar vacíos para aplicar el grupo (p. ej. el número de teléfono, no su
 * código, que siempre trae "+507" por defecto).
 */
interface GrupoCampos {
  valores: Record<string, string>;
  siVacios?: string[];
}

const texto = (v: unknown): string =>
  v === null || v === undefined ? "" : String(v).trim();

const estaVacio = (v: unknown): boolean =>
  Array.isArray(v) ? v.length === 0 : texto(v) === "";

// ---------------------------------------------------------------------------
// Valores que no coinciden entre formularios
// ---------------------------------------------------------------------------

/** Actividad económica principal (selector en Natural, texto libre en Jurídica). */
const ACT_ECON_NATURAL = [
  "Asalariado",
  "Trabajador independiente",
  "Ingresos provenientes de empresas propias",
  "Otros",
];

/** Fuente de fondos: Natural -> Jurídica ("Otros" no existe en Jurídica). */
const FUENTE_FONDOS_N_A_J: Record<string, string[]> = {
  Propios: ["Recursos propios"],
  Financiamiento: ["Financiamiento"],
  Terceros: ["Terceros"],
};

/** Fuente de fondos: Jurídica -> Natural. */
const FUENTE_FONDOS_J_A_N: Record<string, string[]> = {
  "Recursos propios": ["Propios"],
  Financiamiento: ["Financiamiento"],
  Ambos: ["Propios", "Financiamiento"],
  Terceros: ["Terceros"],
};

const PEP_RELACION_NATURAL = [
  "Titular (Yo mismo)", "Cónyuge", "Padre / Madre", "Hijo / Hija",
  "Hermano / Hermana", "Estrecho Colaborador", "Otro",
];
const PEP_RELACION_JURIDICA = [
  "Representante Legal", "Dignatario / Director", "Beneficiario Final", "Apoderado",
  "Cónyuge", "Padre / Madre", "Hijo / Hija", "Hermano / Hermana", "Estrecho Colaborador", "Otros",
];

/** Formas de contacto presentes en ambos formularios. */
const FORMA_CONTACTO_COMUN = ["Referido", "Otros"];

/** Traduce una lista separada por ", " con un mapa de equivalencias. */
function traducirLista(valor: string, mapa: Record<string, string[]>): string {
  const salida: string[] = [];
  for (const item of valor.split(",").map((v) => v.trim()).filter(Boolean)) {
    for (const equivalente of mapa[item] || []) {
      if (!salida.includes(equivalente)) salida.push(equivalente);
    }
  }
  return salida.join(", ");
}

/** "Otro" (Natural) <-> "Otros" (Jurídica); el resto solo si existe en destino. */
function traducirPepRelacion(valor: string, destino: FormType): string {
  if (destino === "JURIDICA") {
    if (valor === "Otro") return "Otros";
    return PEP_RELACION_JURIDICA.includes(valor) ? valor : "";
  }
  if (valor === "Otros") return "Otro";
  return PEP_RELACION_NATURAL.includes(valor) ? valor : "";
}

const normalizarSiNo = (v: string) => (v === "Si" ? "Sí" : v);

/** Valor de un selector con opción "Otros" + campo de texto. */
const resolverOtros = (valor: string, otros: string) =>
  valor === "Otros" ? texto(otros) : valor;

// ---------------------------------------------------------------------------
// Mapeos entre formularios
// ---------------------------------------------------------------------------

/** Campos con la misma clave en ambos formularios (cabecera, PEP, perfil financiero). */
function gruposMismasClaves(origen: Datos, destino: FormType): GrupoCampos[] {
  const grupos: GrupoCampos[] = [{ valores: { nombreProyecto: texto(origen.nombreProyecto) } }];

  // Natural usa "Otros"/"Otro" indistintamente en el detalle; se normaliza a "Otros".
  const forma = texto(origen.formaContacto) === "Otro" ? "Otros" : texto(origen.formaContacto);
  if (FORMA_CONTACTO_COMUN.includes(forma)) {
    grupos.push({
      siVacios: ["formaContacto"],
      valores: {
        formaContacto: forma,
        formaContactoDetalle: texto(origen.formaContactoDetalle),
        referidoPor: texto(origen.referidoPor),
      },
    });
  }

  // PEP
  grupos.push({
    siVacios: ["esPep"],
    valores: {
      esPep: normalizarSiNo(texto(origen.esPep)),
      pepNombre: texto(origen.pepNombre),
      pepCargo: texto(origen.pepCargo),
      pepInstitucion: texto(origen.pepInstitucion),
      pepRelacion: traducirPepRelacion(texto(origen.pepRelacion), destino),
    },
  });

  grupos.push(
    { valores: { ingresosMensuales: texto(origen.ingresosMensuales) } },
    { valores: { medioPago: texto(origen.medioPago) } }
  );

  return grupos;
}

/** Persona Natural -> Persona Jurídica (la persona natural es el Representante Legal). */
function naturalAJuridica(n: Datos): GrupoCampos[] {
  return [
    ...gruposMismasClaves(n, "JURIDICA"),

    // Representante Legal (Nombre_natural, Numero_Identificacion, ...)
    { valores: { rlNombre: `${texto(n.firstName)} ${texto(n.lastName)}`.trim() } },
    { valores: { rlNoIdentificacion: texto(n.idNumber) } },
    { valores: { rlEstadoCivil: texto(n.estadoCivil) } },
    { valores: { rlNacionalidad: texto(n.nationality) } },
    { valores: { rlFechaNacimiento: texto(n.fechaNacimiento) } },
    { valores: { rlProfesionOcupacion: resolverOtros(texto(n.profession), n.profesionOtros) } },
    { valores: { rlActividadEconomica: resolverOtros(texto(n.actEconPrincipal), n.otroActEcon) } },
    { valores: { rlPaisResidencia: texto(n.paisResidenciaFiscal) } },
    { valores: { numeroIdTributaria: texto(n.idTributaria) } },

    // Dirección / contacto (Direccion_Calle, Ciudad, Provincia, Pa_s, Tel_fono, Celular, Email_corporativo)
    { valores: { empresaDireccion: texto(n.direccionResidencial) } },
    { valores: { empresaCiudad: texto(n.ciudad) } },
    { valores: { empresaProvincia: texto(n.provinciaEstado) } },
    { valores: { empresaPais: texto(n.paisResidencial) } },
    {
      siVacios: ["empresaTelefono"],
      valores: { empresaTelefonoCodigo: texto(n.telefonoCodigo), empresaTelefono: texto(n.telefono) },
    },
    {
      siVacios: ["empresaCelular"],
      valores: { empresaCelularCodigo: texto(n.celularCodigo), empresaCelular: texto(n.celular) },
    },
    { valores: { empresaEmail: texto(n.email) } },

    // Perfil financiero
    { valores: { fuenteFondosInmueble: traducirLista(texto(n.fuenteFondosInmueble), FUENTE_FONDOS_N_A_J) } },
    {
      siVacios: ["terceroNombre"],
      valores: {
        terceroNombre: texto(n.ifTerceroNombre),
        terceroNacionalidad: texto(n.ifTerceroNacionalidad),
        terceroVinculo: texto(n.ifTerceroRelacion),
        terceroFuenteFondos: texto(n.ifTerceroFuenteDeIngresos),
      },
    },
    {
      siVacios: ["adquiereMasUnidades"],
      valores: {
        adquiereMasUnidades: normalizarSiNo(texto(n.montoServiciosAnuales)),
        cantidadUnidadesInmobiliarias: texto(n.cantidadServiciosAnuales),
      },
    },
  ];
}

/** Persona Jurídica -> Persona Natural (el Representante Legal es la persona natural). */
function juridicaANatural(j: Datos): GrupoCampos[] {
  // Nombre_natural: se reparte entre nombre y apellido
  const partes = texto(j.rlNombre).split(/\s+/).filter(Boolean);
  const mitad = Math.ceil(partes.length / 2);
  const nombre = partes.length > 1 ? partes.slice(0, mitad).join(" ") : partes.join(" ");
  const apellido = partes.length > 1 ? partes.slice(mitad).join(" ") : "";

  const profesion = texto(j.rlProfesionOcupacion);
  const profesionEnLista = PROFESSIONS.includes(profesion);
  const actividad = texto(j.rlActividadEconomica);
  const actividadEnLista = ACT_ECON_NATURAL.includes(actividad);

  return [
    ...gruposMismasClaves(j, "NATURAL"),

    { siVacios: ["firstName", "lastName"], valores: { firstName: nombre, lastName: apellido } },
    { valores: { idNumber: texto(j.rlNoIdentificacion) } },
    { valores: { estadoCivil: texto(j.rlEstadoCivil) } },
    { valores: { nationality: texto(j.rlNacionalidad) } },
    { valores: { fechaNacimiento: texto(j.rlFechaNacimiento) } },
    {
      siVacios: ["profession"],
      valores: profesion
        ? profesionEnLista
          ? { profession: profesion }
          : { profession: "Otros", profesionOtros: profesion }
        : {},
    },
    {
      siVacios: ["actEconPrincipal"],
      valores: actividad
        ? actividadEnLista
          ? { actEconPrincipal: actividad }
          : { actEconPrincipal: "Otros", otroActEcon: actividad }
        : {},
    },
    { valores: { paisResidenciaFiscal: texto(j.rlPaisResidencia) } },
    { valores: { idTributaria: texto(j.numeroIdTributaria) } },

    { valores: { direccionResidencial: texto(j.empresaDireccion) } },
    { valores: { ciudad: texto(j.empresaCiudad) } },
    { valores: { provinciaEstado: texto(j.empresaProvincia) } },
    { valores: { paisResidencial: texto(j.empresaPais) } },
    {
      siVacios: ["telefono"],
      valores: { telefonoCodigo: texto(j.empresaTelefonoCodigo), telefono: texto(j.empresaTelefono) },
    },
    {
      siVacios: ["celular"],
      valores: { celularCodigo: texto(j.empresaCelularCodigo), celular: texto(j.empresaCelular) },
    },
    { valores: { email: texto(j.empresaEmail) } },

    { valores: { fuenteFondosInmueble: traducirLista(texto(j.fuenteFondosInmueble), FUENTE_FONDOS_J_A_N) } },
    {
      siVacios: ["ifTerceroNombre"],
      valores: {
        ifTerceroNombre: texto(j.terceroNombre),
        ifTerceroNacionalidad: texto(j.terceroNacionalidad),
        ifTerceroRelacion: texto(j.terceroVinculo),
        ifTerceroFuenteDeIngresos: texto(j.terceroFuenteFondos),
      },
    },
    {
      siVacios: ["montoServiciosAnuales"],
      valores: {
        montoServiciosAnuales: normalizarSiNo(texto(j.adquiereMasUnidades)),
        cantidadServiciosAnuales: texto(j.cantidadUnidadesInmobiliarias),
      },
    },
  ];
}

/**
 * Calcula los cambios a aplicar sobre el borrador destino: solo campos con
 * valor en el origen y vacíos en el destino.
 */
export function calcularAutocompletado(
  origenTipo: FormType,
  origen: Datos,
  destino: Datos
): Record<string, string> {
  const grupos = origenTipo === "NATURAL" ? naturalAJuridica(origen) : juridicaANatural(origen);
  const cambios: Record<string, string> = {};

  for (const grupo of grupos) {
    const conValor = Object.entries(grupo.valores).filter(([, v]) => v !== "");
    if (conValor.length === 0) continue;

    const requisitos = grupo.siVacios ?? conValor.map(([k]) => k);
    if (!requisitos.every((campo) => estaVacio(destino[campo]))) continue;

    for (const [campo, valor] of conValor) cambios[campo] = valor;
  }

  return cambios;
}

// ---------------------------------------------------------------------------
// Orquestación
// ---------------------------------------------------------------------------

/**
 * Completa el borrador del expediente relacionado con los datos del formulario
 * recién enviado. Nunca lanza: cualquier motivo para no continuar se registra
 * y se devuelve.
 */
export async function autocompletarExpedienteRelacionado(
  formId: string
): Promise<{ applied: boolean; reason?: string; relatedDraftId?: string; fields?: string[] }> {
  const cancelar = (reason: string) => {
    console.log(`[Relacionado] Autocompletado cancelado para el formulario ${formId}: ${reason}`);
    return { applied: false, reason };
  };

  try {
    const form = await prisma.form.findUnique({
      where: { id: formId },
      include: { crmContact: true },
    });
    if (!form) return cancelar("formulario no encontrado");
    if (form.isAditional) return cancelar("el formulario es adicional");

    const ddId = form.crmContact?.crmId;
    if (!ddId) return cancelar("el formulario no está vinculado a un expediente de Zoho CRM");
    if (ddId.startsWith("mock-") || ddId === "simulated-crm-contact-id") {
      return cancelar("expediente simulado");
    }

    // 1. Expediente relacionado en Zoho (dd_relacionado)
    const relatedCrmId = await zoho.service.getRelatedDDId(ddId);
    if (!relatedCrmId) return cancelar("el campo dd_relacionado está vacío");
    if (relatedCrmId === ddId) return cancelar("dd_relacionado apunta al mismo expediente");

    // 2. Su registro en el portal
    const relatedContact = await prisma.crmContact.findUnique({ where: { crmId: relatedCrmId } });
    if (!relatedContact) return cancelar(`el expediente relacionado ${relatedCrmId} no existe en el portal`);

    const formularioRelacionado = await prisma.form.findFirst({
      where: { crmContactId: relatedContact.id, deletedAt: null, isAditional: false },
    });
    if (formularioRelacionado) return cancelar("el expediente relacionado ya fue completado");

    // El borrador se vincula al contacto por Draft.crmContactId o, en borradores
    // antiguos sin esa columna, por el token de acceso emitido al contacto.
    const tokensRelacionado = await prisma.token.findMany({
      where: { crmContactId: relatedContact.id },
      select: { token: true },
    });
    const relatedDraft = await prisma.draft.findFirst({
      where: {
        isAditional: false,
        OR: [
          { crmContactId: relatedContact.id },
          { token: { in: tokensRelacionado.map((t) => t.token) } },
        ],
      },
      orderBy: { updatedAt: "desc" },
    });
    if (!relatedDraft) return cancelar("el expediente relacionado no tiene borrador");

    // 3. Estado del relacionado: debe seguir siendo un borrador
    const destino = (relatedDraft.data || {}) as Datos;
    if (destino.completed) return cancelar("el expediente relacionado ya fue completado");
    if (relatedDraft.type === form.type) {
      return cancelar(`ambos expedientes son del mismo tipo (${form.type})`);
    }

    // 4. Campos comunes vacíos en el destino
    const cambios = calcularAutocompletado(form.type, form.data as Datos, destino);
    const campos = Object.keys(cambios);
    if (campos.length === 0) return cancelar("no hay campos vacíos que completar");

    // Actualizar updatedAt hace que un cliente con el formulario abierto reciba
    // el aviso de conflicto en su siguiente autoguardado en lugar de pisarlo.
    await prisma.draft.update({
      where: { id: relatedDraft.id },
      data: { data: { ...destino, ...cambios }, updatedAt: new Date() },
    });

    await logAuditEvent({
      action: "DRAFT_AUTOFILL_RELATED",
      entityName: "Draft",
      entityId: relatedDraft.id,
      details: {
        sourceFormId: formId,
        sourceCrmId: ddId,
        relatedCrmId,
        fields: campos,
      },
    });

    console.log(
      `[Relacionado] Borrador ${relatedDraft.id} (${relatedCrmId}) completado desde el formulario ${formId}: ${campos.join(", ")}`
    );
    return { applied: true, relatedDraftId: relatedDraft.id, fields: campos };
  } catch (error: any) {
    console.error(`[Relacionado] Error al autocompletar el expediente relacionado de ${formId}:`, error);
    return { applied: false, reason: error?.message || String(error) };
  }
}
