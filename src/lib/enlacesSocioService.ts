import { zoho } from "@/lib/zohoService";
import { logAuditEvent } from "@/lib/auditService";
import {
  crearEnlaceRelacionado,
  crearEnlaceRepresentante,
  contactosConEnlaceRelacionado,
  tieneEnlaceRepresentante,
  vincularContactosAlExpediente,
} from "@/lib/contactLinkService";
import type { AccountContactRow, ClasificacionContactos, ContactoConDD } from "@/lib/accountContactService";

/**
 * Análisis y creación de los enlaces de un Socio de Negocio sobre su expediente
 * de Debida_Diligencia, compartido por:
 * - /api/generar-expediente (desde el Socio de Negocio: crea el expediente si falta)
 * - /api/generar-enlace (desde un expediente creado a mano: nunca crea expedientes)
 *
 * Roles de los enlaces (ver LinkRole): PRINCIPAL (el del expediente), RELATED
 * por cada otro contacto del socio y, en la jurídica, el del Representante
 * Legal (RELATED sin contacto).
 */

export const nombreDe = (c: { firstName: string; lastName: string; crmId: string }) =>
  `${c.firstName} ${c.lastName}`.trim() || c.crmId;

export interface PlanEnlaces {
  /** Contactos con su propio expediente (anterior a este esquema): se respetan. */
  conExpedientePropio: ContactoConDD[];
  /** Jurídica: contacto vinculado al expediente (lo actualiza el formulario principal). */
  vinculadoAlJuridico: string | null;
  /** Contactos que llevan (o llevarán) un enlace relacionado en el expediente. */
  otros: AccountContactRow[];
  /** De `otros`, los que aún no tienen enlace. */
  pendientes: AccountContactRow[];
  /** De `pendientes`, los que se crean ahora (según la selección). */
  porRelacionar: AccountContactRow[];
  /** IDs seleccionados que no se generan. */
  omitidos: string[];
  /** Jurídica: falta el enlace del Representante Legal. */
  faltaRepresentante: boolean;
  /** Datos informativos para la respuesta. */
  extra: Record<string, unknown>;
}

/**
 * Qué enlaces faltan en el expediente del socio (no crea nada).
 *
 * - `principal`: natural, el contacto del enlace PRINCIPAL; jurídica, null.
 * - `existenteCrmId` / `crmContact`: el expediente (si ya existe) y su registro local.
 * - `ddRepresentanteAnterior`: jurídica de antes con expediente natural del
 *   Representante Legal (DD_relacionado): no se genera su enlace, y el contacto
 *   que su lookup señalaba recibe un enlace relacionado como los demás.
 */
export async function planificarEnlaces(p: {
  isNatural: boolean;
  contactos: AccountContactRow[];
  principal: AccountContactRow | null;
  clasif: ClasificacionContactos;
  existenteCrmId: string | null;
  crmContact: { id: string; accountContactId: string | null } | null;
  ddRepresentanteAnterior: string | null;
  seleccion: string[] | null;
}): Promise<PlanEnlaces> {
  const { isNatural, contactos, principal, clasif, existenteCrmId, crmContact, ddRepresentanteAnterior, seleccion } = p;

  // Otros contactos: los que tienen su propio expediente (anterior a este
  // esquema) se respetan; el resto recibe su enlace relacionado. En la jurídica
  // no cuentan como propios: el expediente natural del Representante Legal de
  // antes, ni el contacto ya vinculado al expediente jurídico (lo actualiza el
  // formulario principal: no recibe además un enlace relacionado, para no
  // escribir su Contact dos veces).
  const conExpedientePropio = clasif.existentes.filter(
    (e) => e.contact.id !== principal?.id && e.ddCrmId !== ddRepresentanteAnterior && e.ddCrmId !== existenteCrmId
  );
  const vinculadoAlJuridico = !isNatural ? crmContact?.accountContactId ?? null : null;
  const otros = contactos.filter(
    (c) =>
      c.id !== principal?.id &&
      c.id !== vinculadoAlJuridico &&
      !conExpedientePropio.some((e) => e.contact.id === c.id)
  );
  const conEnlace = crmContact ? await contactosConEnlaceRelacionado(crmContact.id) : new Set<string>();
  const pendientes = otros.filter((c) => !conEnlace.has(c.id));
  const porRelacionar = seleccion ? pendientes.filter((c) => seleccion.includes(c.crmId)) : pendientes;
  const omitidos = (seleccion ?? []).filter(
    (id) => id !== principal?.crmId && !porRelacionar.some((c) => c.crmId === id)
  );

  const faltaRepresentante =
    !isNatural && !ddRepresentanteAnterior && !(crmContact && (await tieneEnlaceRepresentante(crmContact.id)));

  const extra = {
    ...(principal ? { principalContactId: principal.crmId } : {}),
    ...(conExpedientePropio.length
      ? { existentes: conExpedientePropio.map((e) => ({ contactId: e.contact.crmId, crmId: e.ddCrmId, fuente: e.fuente })) }
      : {}),
    ...(omitidos.length ? { contactosOmitidos: omitidos } : {}),
    ...(clasif.eliminadosEnZoho.length ? { contactosEliminadosEnZoho: clasif.eliminadosEnZoho.map((c) => c.crmId) } : {}),
  };

  return { conExpedientePropio, vinculadoAlJuridico, otros, pendientes, porRelacionar, omitidos, faltaRepresentante, extra };
}

/**
 * Ata cada contacto del socio a su expediente en Zoho (Contacts.Debida_Diligencia):
 * el principal, el vinculado al jurídico y los relacionados al expediente del
 * socio; los que tienen expediente propio, al suyo. Nunca lanza.
 */
export async function vincularContactosDelSocio(params: {
  ddCrmId: string;
  plan: PlanEnlaces;
  contactos: AccountContactRow[];
  principal: AccountContactRow | null;
}): Promise<string[]> {
  const { ddCrmId, plan, contactos, principal } = params;
  const delJuridico = contactos.filter((c) => c.id === plan.vinculadoAlJuridico);
  const propios = [...(principal ? [principal] : []), ...delJuridico, ...plan.otros].map((c) => c.crmId);
  const vinculados = await vincularContactosAlExpediente(ddCrmId, propios);
  for (const e of plan.conExpedientePropio) {
    vinculados.push(...(await vincularContactosAlExpediente(e.ddCrmId, [e.contact.crmId])));
  }
  return vinculados;
}

export interface EnlacesGenerados {
  representante: { nombre: string; clientUrl: string; expiresAt: Date } | null;
  relacionados: Array<{ contactId: string; nombre: string; clientUrl: string; expiresAt: Date }>;
}

/**
 * Crea los enlaces que faltan según el plan: el del Representante Legal
 * (jurídica, si falta) y uno RELATED por contacto pendiente. Deja una nota en
 * el expediente con todos ellos. No crea registros en Zoho.
 */
export async function generarEnlacesRelacionados(params: {
  crmContact: { id: string; crmId: string };
  plan: PlanEnlaces;
  representanteLegal: string;
  principal: AccountContactRow | null;
  appUrl: string;
  projectName?: string;
  socioId?: string;
}): Promise<EnlacesGenerados> {
  const { crmContact, plan, representanteLegal, principal, appUrl, projectName, socioId } = params;
  const crmId = crmContact.crmId;

  // 1. Jurídica: enlace del Representante Legal sobre el mismo expediente
  let representante: EnlacesGenerados["representante"] = null;
  if (plan.faltaRepresentante) {
    const { tokenUuid, clientUrl, expiresAt } = await crearEnlaceRepresentante({
      crmContact,
      representanteLegal,
      appUrl,
      projectName,
    });
    representante = { nombre: representanteLegal, clientUrl, expiresAt };
    await logAuditEvent({
      action: "LINK_GENERATE_RELATED",
      entityName: "Token",
      entityId: tokenUuid,
      details: { crmId, type: "NATURAL", clientUrl, name: representanteLegal, socioId, representanteLegal: true },
    });
  }

  // 2. Enlaces de los contactos relacionados
  const relacionados: EnlacesGenerados["relacionados"] = [];
  for (const c of plan.porRelacionar) {
    const nombre = nombreDe(c);
    const { tokenUuid, clientUrl, expiresAt } = await crearEnlaceRelacionado({ crmContact, accountContact: c, appUrl, projectName });
    relacionados.push({ contactId: c.crmId, nombre, clientUrl, expiresAt });
    await logAuditEvent({
      action: "LINK_GENERATE_RELATED",
      entityName: "Token",
      entityId: tokenUuid,
      details: {
        crmId,
        type: "NATURAL",
        clientUrl,
        name: nombre,
        socioId,
        contactCrmId: c.crmId,
        ...(principal ? { principalContactId: principal.crmId } : {}),
      },
    });
  }

  // 3. Nota con los enlaces relacionados
  if (representante || relacionados.length) {
    const lineas = [
      ...(representante ? [{ titulo: `Representante Legal: ${representante.nombre}`, ...representante }] : []),
      ...relacionados.map((r) => ({ titulo: `Contacto: ${r.nombre} (${r.contactId})`, ...r })),
    ];
    try {
      await zoho.service.createNote(
        crmId,
        "Enlaces Relacionados Generados",
        `Se generaron enlaces relacionados sobre este expediente.\n\n` +
        lineas
          .map((l) => `${l.titulo}\nEnlace del Formulario: ${l.clientUrl}\nVigencia del Enlace: ${l.expiresAt.toLocaleString()}`)
          .join("\n\n") +
        `\n\nTimestamp: ${new Date().toLocaleString()}`
      );
    } catch (crmErr) {
      console.error(`[Enlaces Socio Warning] Error al crear la nota de enlaces relacionados en ${crmId}:`, crmErr);
    }
  }

  return { representante, relacionados };
}

/** Mensaje de lo creado ("Expediente ..., enlace del Representante Legal y N enlaces ..."). */
export function mensajeEnlaces(partes: { principal?: string; generados: EnlacesGenerados }): string {
  const n = partes.generados.relacionados.length;
  const mensaje = [
    partes.principal ?? "",
    partes.generados.representante ? "enlace del Representante Legal generado" : "",
    n ? `${n} enlace${n > 1 ? "s" : ""} de contacto${n > 1 ? "s" : ""} relacionado${n > 1 ? "s" : ""} generado${n > 1 ? "s" : ""}` : "",
  ].filter(Boolean).join(", ");
  return `¡${mensaje.charAt(0).toUpperCase()}${mensaje.slice(1)} exitosamente!`;
}
