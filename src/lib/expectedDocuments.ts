/**
 * Catálogo de documentos que un expediente puede contener, usado por la vista
 * de consulta (/view) para señalar por nombre lo que falta en vez de limitarse
 * a decir que no hay adjuntos.
 *
 * Espeja las listas que las pantallas de carga declaran:
 *   - natural:  components/persona-natural/Step3Documentos.tsx
 *   - jurídica: components/persona-juridica/Step4Documentos.tsx (staticDocumentFields
 *               y buildIdDocumentTargets)
 * Se mantiene aparte para que la vista de solo lectura no arrastre los
 * componentes del formulario (y su FormState) dentro de su bundle. Al agregar
 * o quitar un campo de carga hay que reflejarlo aquí.
 */

/** Un documento del expediente tal como lo expone getFormView. */
export interface ExpectedDocumentMatch {
  documentType?: string | null;
  personType?: string | null;
  personId?: string | null;
}

export interface ExpectedDocument {
  /** Identificador estable para React y para el cotejo. */
  key: string;
  label: string;
  /** Aclaración opcional (a quién corresponde, qué debe contener). */
  detail?: string;
  required: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FormData = Record<string, any>;

const NATURAL_SLOTS = (data: FormData): ExpectedDocument[] => [
  {
    key: "idFile",
    label: data.tipoIdentificacion
      ? `Documento de ${data.tipoIdentificacion}`
      : "Documento de identidad",
    required: true,
  },
  {
    key: "hasCertificacionBancaria",
    label: "Certificación bancaria con cifras promedio de la cuenta",
    required: false,
  },
  {
    key: "hasEstadoCuenta",
    label: "Estado de cuenta bancario de los últimos 6 meses",
    required: false,
  },
  {
    key: "origenFondosFile",
    label: "Sustento de ingresos (origen de fondos)",
    detail: "Carta de trabajo, ficha de seguro social, declaración de renta, comprobantes de pago.",
    required: false,
  },
];

const JURIDICA_STATIC_SLOTS: ExpectedDocument[] = [
  { key: "avisoOperacionesFile", label: "Certificado de Aviso de Operaciones o equivalente", required: false },
  {
    key: "origenFondosFile",
    label: "Origen de fondos",
    detail: "Declaración de renta, estados financieros, etc.",
    required: false,
  },
  { key: "pactoSocialFile", label: "Pacto Social y sus adendas", required: false },
  { key: "certBancariaFile", label: "Certificación bancaria con cifras promedio de la cuenta", required: false },
  { key: "certRegistroFile", label: "Certificado de Registro Público", required: false },
  { key: "certComprasFile", label: "Compras de beneficiarios con fondos corporativos", required: false },
];

/** Cédula o pasaporte de cada persona vinculada a la sociedad. */
function juridicaPersonSlots(data: FormData): (ExpectedDocument & ExpectedDocumentMatch)[] {
  const gjc = Array.isArray(data.gjcMembers) ? data.gjcMembers : [];
  const bf = Array.isArray(data.bfMembers) ? data.bfMembers : [];

  return [
    {
      key: "RL-rl-copiaIdFile",
      label: "Cédula o pasaporte",
      detail: `Representante Legal · ${data.rlNombre || "sin nombre registrado"}`,
      required: true,
      personType: "RL",
      personId: "rl",
      documentType: "copiaIdFile",
    },
    ...gjc.map((m: FormData) => ({
      key: `GJC-${m.id}-copiaIdFile`,
      label: "Cédula o pasaporte",
      detail: `${m.cargo || "Gobierno Corporativo"} · ${`${m.nombre || ""} ${m.apellidos || ""}`.trim() || "sin nombre registrado"}`,
      required: true,
      personType: "GJC",
      personId: m.id,
      documentType: "copiaIdFile",
    })),
    ...bf.map((m: FormData) => ({
      key: `BF-${m.id}-copiaIdFile`,
      label: "Cédula o pasaporte",
      detail: `Beneficiario Final · ${m.nombreCompleto || "sin nombre registrado"}`,
      required: true,
      personType: "BF",
      personId: m.id,
      documentType: "copiaIdFile",
    })),
  ];
}

/** Todos los espacios de documentos que corresponden a este expediente. */
export function getExpectedDocuments(
  type: "natural" | "juridica",
  data: FormData
): (ExpectedDocument & ExpectedDocumentMatch)[] {
  if (type === "natural") {
    return NATURAL_SLOTS(data || {}).map((slot) => ({ ...slot, documentType: slot.key }));
  }
  return [
    ...JURIDICA_STATIC_SLOTS.map((slot) => ({ ...slot, documentType: slot.key })),
    ...juridicaPersonSlots(data || {}),
  ];
}

/** True si `documents` ya contiene un archivo para ese espacio. */
export function isSlotFilled(
  slot: ExpectedDocumentMatch,
  documents: readonly ExpectedDocumentMatch[]
): boolean {
  return documents.some((d) => {
    if (d.documentType !== slot.documentType) return false;
    // Los documentos por persona comparten documentType (copiaIdFile): sólo
    // cuentan si además coinciden la persona y su rol.
    if (slot.personId) return d.personType === slot.personType && d.personId === slot.personId;
    return true;
  });
}

/** Espacios sin archivo, en el mismo orden en que se piden en el formulario. */
export function getMissingDocuments(
  type: "natural" | "juridica",
  data: FormData,
  documents: readonly ExpectedDocumentMatch[]
): (ExpectedDocument & ExpectedDocumentMatch)[] {
  return getExpectedDocuments(type, data).filter((slot) => !isSlotFilled(slot, documents));
}
