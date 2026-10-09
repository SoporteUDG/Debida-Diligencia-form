import prisma from "@/lib/prisma";
import { revokeToken } from "@/lib/tokenService";
import { zoho, buscarDDDelContacto, DD_CONTACT_FIELD, type ZohoAccountContact, type ZohoDDResumen } from "@/lib/zohoService";

type ClientType = "NATURAL" | "JURIDICA";

export interface AccountContactRow {
  id: string;
  crmId: string;
  accountCrmId: string;
  firstName: string;
  lastName: string;
}

/** El Socio de Negocio de Persona Natural no tiene Contacts vinculados en Zoho. */
export class SinContactosError extends Error {
  constructor(public accountCrmId: string) {
    super(
      `El Socio de Negocio ${accountCrmId} es de Persona Natural y no tiene contactos vinculados en Zoho CRM: vincule al menos un contacto (Accounts > Contacts) para generar su Debida Diligencia.`
    );
    this.name = "SinContactosError";
  }
}

/**
 * Crea la copia local de un Contact de Zoho vinculado a un Account. Una cuenta
 * de Persona Jurídica también admite varios: cada contacto lleva su propio
 * expediente de Persona Natural (el Representante Legal no es un contacto).
 */
export async function createAccountContact(params: {
  accountCrmId: string;
  clientType: ClientType;
  contact: ZohoAccountContact;
}): Promise<AccountContactRow> {
  const { accountCrmId, contact } = params;

  const zohoCreatedAt = Date.parse(contact.createdTime);
  const data = {
    accountCrmId,
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email || null,
    phone: contact.phone || null,
    zohoCreatedAt: Number.isNaN(zohoCreatedAt) ? null : new Date(zohoCreatedAt),
    deletedAt: null,
    missingInZohoAt: null,
  };
  const fila = await prisma.accountContact.upsert({
    where: { crmId: contact.id },
    update: data,
    create: { crmId: contact.id, ...data },
  });
  // El contacto volvió a Zoho: se quita la marca de contacto faltante (el enlace
  // desactivado se regenera desde el administrador)
  await prisma.crmContact.updateMany({
    where: { accountContactId: fila.id, missingContactAt: { not: null } },
    data: { missingContactAt: null },
  });
  return fila;
}

/**
 * Contactos con los que se generan expedientes para un Socio de Negocio.
 *
 * Busca en Zoho los Contacts vinculados al Account y los guarda en
 * AccountContact:
 * - Natural: todos (un expediente por contacto).
 * - Jurídica: solo uno, el vinculado más antiguo. Si ya hay uno guardado se
 *   conserva ese.
 *
 * Natural: sin contactos (o si la búsqueda en Zoho falla) lanza error, porque
 * cada expediente debe colgar de un contacto. Jurídica: si no hay contactos o la
 * búsqueda falla devuelve [] y se genera el expediente sin contacto vinculado.
 *
 * Con `todos` (jurídica en /api/generar-expediente) devuelve todos los contactos
 * (cada uno puede llevar su expediente natural): sin contactos devuelve [] y si
 * Zoho falla lanza.
 */
export async function obtenerContactosDeCuenta(
  accountCrmId: string,
  clientType: ClientType,
  opts?: { todos?: boolean }
): Promise<AccountContactRow[]> {
  const todos = clientType === "NATURAL" || !!opts?.todos;
  if (!todos) {
    const existing = await prisma.accountContact.findFirst({
      where: { accountCrmId, deletedAt: null },
      orderBy: [{ zohoCreatedAt: "asc" }, { createdAt: "asc" }],
    });
    if (existing) return [existing];
  }

  let contactos: ZohoAccountContact[];
  try {
    contactos = await zoho.service.searchAccountContacts(accountCrmId);
  } catch (err) {
    if (todos) throw err;
    console.warn(`[Account Contacts] No se pudieron leer los contactos del Socio de Negocio ${accountCrmId}:`, err);
    return [];
  }

  if (clientType === "NATURAL" && contactos.length === 0) throw new SinContactosError(accountCrmId);

  // searchAccountContacts los entrega del más antiguo al más reciente
  const aGuardar = todos ? contactos : contactos.slice(0, 1);
  const filas: AccountContactRow[] = [];
  for (const contact of aGuardar) {
    filas.push(await createAccountContact({ accountCrmId, clientType, contact }));
  }
  return filas;
}

const tipoDe = (dd: ZohoDDResumen): "NATURAL" | "JURIDICA" | null => {
  const t = (dd.tipo ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  return t === "natural" ? "NATURAL" : t === "juridica" ? "JURIDICA" : null;
};

export interface ContactoConDD {
  contact: AccountContactRow;
  /** Expediente existente (ID de Debida_Diligencia en Zoho = CrmContact.crmId). */
  ddCrmId: string;
  /** Dónde se encontró primero: Zoho, o solo en la base local. */
  fuente: "zoho" | "prisma";
}

export interface ClasificacionContactos {
  /** Contactos sin expediente ni en Zoho ni en Prisma: son los únicos a los que se genera. */
  faltantes: AccountContactRow[];
  existentes: ContactoConDD[];
  /** Contactos guardados localmente que ya no están en Zoho (eliminados allí). */
  eliminadosEnZoho: Array<{ id: string; crmId: string; firstName: string; lastName: string }>;
}

/**
 * Separa los contactos de un Socio de Negocio Natural según tengan ya su
 * expediente de Debida_Diligencia: primero se busca en Zoho (fuente de verdad)
 * y luego en Prisma. Si la consulta a Zoho falla lanza: no se debe crear sin
 * saber qué existe, para no duplicar expedientes.
 */
export async function clasificarContactosNaturales(
  accountCrmId: string,
  contactos: AccountContactRow[]
): Promise<ClasificacionContactos> {
  // Solo los expedientes naturales son de un contacto (en un socio jurídico, el
  // expediente jurídico no cuenta)
  const ddsZoho = (await zoho.service.searchDDsByAccount(accountCrmId)).filter((d) => tipoDe(d) !== "JURIDICA");

  const faltantes: AccountContactRow[] = [];
  const existentes: ContactoConDD[] = [];
  for (const contact of contactos) {
    const enZoho = buscarDDDelContacto(ddsZoho, contact);
    if (enZoho) {
      existentes.push({ contact, ddCrmId: enZoho.id, fuente: "zoho" });
      continue;
    }
    // Prisma: por el vínculo del expediente al contacto o, si no, por el
    // contacto guardado en los datos del formulario
    const enPrisma =
      (await prisma.crmContact.findFirst({
        // Un expediente anulado (archivado) cuenta: se reactiva, no se vuelve a crear
        where: { accountContactId: contact.id, OR: [{ deletedAt: null }, { retiredAt: { not: null } }] },
        select: { crmId: true },
      })) ??
      (await prisma.form
        .findFirst({
          where: { data: { path: [DD_CONTACT_FIELD], equals: contact.crmId }, crmContact: { deletedAt: null } },
          select: { crmContact: { select: { crmId: true } } },
        })
        .then((f) => f?.crmContact ?? null));
    if (enPrisma) {
      console.warn(
        `[Account Contacts] El expediente ${enPrisma.crmId} del contacto ${contact.crmId} existe en Prisma pero no se halló en Zoho: no se vuelve a generar.`
      );
      existentes.push({ contact, ddCrmId: enPrisma.crmId, fuente: "prisma" });
      continue;
    }
    faltantes.push(contact);
  }

  // Contactos guardados que ya no existen en Zoho: solo se MARCAN
  // (AccountContact.missingInZohoAt). No se toca su expediente, token ni archivos
  // de WorkDrive; eso es una decisión humana (ver anularDD / eliminarDD).
  const eliminadosEnZoho = await prisma.accountContact.findMany({
    where: { accountCrmId, deletedAt: null, crmId: { notIn: contactos.map((c) => c.crmId) } },
    select: { id: true, crmId: true, firstName: true, lastName: true, missingInZohoAt: true },
  });
  const sinMarca = eliminadosEnZoho.filter((c) => !c.missingInZohoAt).map((c) => c.id);
  if (sinMarca.length) {
    await prisma.accountContact.updateMany({ where: { id: { in: sinMarca } }, data: { missingInZohoAt: new Date() } });
  }
  if (eliminadosEnZoho.length) {
    console.warn(
      `[Account Contacts] Socio ${accountCrmId}: contactos que ya no están en Zoho: ${eliminadosEnZoho.map((c) => c.crmId).join(", ")}`
    );
    await marcarExpedientesDeContactosFaltantes(eliminadosEnZoho);
  }

  return { faltantes, existentes, eliminadosEnZoho };
}

export interface ExpedientesJuridica {
  /** Expediente vigente (no retirado) de Persona Jurídica; null si falta. */
  juridica: ZohoDDResumen | null;
  /** Expediente vigente de Persona Natural del Representante Legal; null si falta. */
  natural: ZohoDDResumen | null;
  /** Más de un jurídico vigente, o varios candidatos a Representante Legal sin vínculo. */
  duplicados: boolean;
  juridicas: ZohoDDResumen[];
  /** Candidatos a expediente del Representante Legal (ver clasificarExpedientesJuridica). */
  naturales: ZohoDDResumen[];
  /** IDs de los expedientes del socio retirados (en Zoho o en el portal). */
  retirados: string[];
}


/**
 * Expedientes vigentes de un Socio de Negocio Jurídico: el de Persona Jurídica y
 * el de Persona Natural del Representante Legal, como valida el widget de Zoho
 * (validarDebidaDiligencia). Un expediente retirado (en Zoho o en el portal) no
 * cuenta: se puede volver a generar. Lanza si Zoho falla, para no duplicar.
 *
 * Los contactos del socio también pueden tener expedientes naturales, así que el
 * del Representante Legal es el relacionado al jurídico por DD_relacionado (en
 * cualquier sentido); si no hay vínculo, el natural sin contacto o que apunta a
 * un jurídico del socio (aunque esté retirado).
 */
export async function clasificarExpedientesJuridica(accountCrmId: string): Promise<ExpedientesJuridica> {
  const dds = await zoho.service.searchDDsByAccount(accountCrmId);

  const retiradosEnPortal = dds.length
    ? new Set(
        (
          await prisma.crmContact.findMany({
            where: { crmId: { in: dds.map((d) => d.id) }, retiredAt: { not: null } },
            select: { crmId: true },
          })
        ).map((c) => c.crmId)
      )
    : new Set<string>();
  const vigentes = dds.filter((d) => !d.retirado && !retiradosEnPortal.has(d.id));

  const juridicas = vigentes.filter((d) => tipoDe(d) === "JURIDICA");
  const juridica = juridicas[0] ?? null;
  const idsJuridicos = new Set(dds.filter((d) => tipoDe(d) === "JURIDICA").map((d) => d.id));
  const naturales = vigentes.filter((d) => tipoDe(d) === "NATURAL");

  const vinculado = juridica
    ? naturales.find((n) => n.id === juridica.relatedCrmId || n.relatedCrmId === juridica.id) ?? null
    : null;
  const candidatos = vinculado
    ? [vinculado]
    : naturales.filter((n) => !n.contactCrmId || idsJuridicos.has(n.relatedCrmId));

  return {
    juridica,
    natural: vinculado ?? (candidatos.length === 1 ? candidatos[0] : null),
    duplicados: juridicas.length > 1 || candidatos.length > 1,
    juridicas,
    naturales: candidatos,
    retirados: dds.filter((d) => !vigentes.includes(d)).map((d) => d.id),
  };
}

/**
 * Expedientes cuyo contacto ya no existe en el Socio de Negocio de Zoho: se
 * marcan (CrmContact.missingContactAt), se desactiva su enlace (si seguía
 * activo) y se deja una nota en el expediente de Zoho. No se anula ni se borra
 * nada. Se reintenta en la siguiente generación si algún paso falla.
 */
async function marcarExpedientesDeContactosFaltantes(
  contactos: Array<{ id: string; crmId: string; firstName: string; lastName: string }>
) {
  for (const contacto of contactos) {
    const expedientes = await prisma.crmContact.findMany({
      where: { accountContactId: contacto.id, deletedAt: null, retiredAt: null, missingContactAt: null },
      select: { id: true, crmId: true },
    });
    const nombre = `${contacto.firstName} ${contacto.lastName}`.trim() || contacto.crmId;

    for (const exp of expedientes) {
      try {
        // Enlace: se revocan los tokens vigentes y, si había alguno, se refleja en Zoho
        const vigentes = await prisma.token.findMany({
          where: { crmContactId: exp.id, used: false, expiresAt: { gt: new Date() } },
          select: { token: true },
        });
        for (const t of vigentes) await revokeToken(t.token);
        if (vigentes.length) {
          await zoho.service.updateClientFormLink(exp.crmId, "Debida_Diligencia", undefined, undefined, "Expirado / Revocado");
        }

        await zoho.service.createNote(
          exp.crmId,
          "Contacto faltante en el Socio de Negocio",
          `El contacto ${nombre} falta en el Socio de Negocio. Agréguelo nuevamente o archive el registro de Debida Diligencia.`
        );

        await prisma.crmContact.update({ where: { id: exp.id }, data: { missingContactAt: new Date() } });
      } catch (err) {
        console.error(`[Account Contacts] No se pudo marcar el expediente ${exp.crmId} (contacto faltante ${contacto.crmId}):`, err);
      }
    }
  }
}

/** El expediente no tiene un Contact de Zoho asociado (lookup Nombre_de_contacto). */
export class SinContactoExpedienteError extends Error {
  constructor(public ddCrmId: string) {
    super(
      `El expediente ${ddCrmId} no tiene un Contact de Zoho asociado (${DD_CONTACT_FIELD}): vincule un contacto al expediente para generar su enlace.`
    );
    this.name = "SinContactoExpedienteError";
  }
}

const idDe = (v: any): string => String((v && typeof v === "object" ? v.id : v) ?? "").trim();

/**
 * Contact de Zoho que indica el lookup Nombre_de_contacto del expediente (copia
 * local; se crea si aún no existe). null si el lookup está vacío o el Contact no
 * se pudo leer de Zoho.
 */
export async function contactoDelLookupZoho(params: {
  clientType: ClientType;
  ddRecord: Record<string, any> | null;
}): Promise<AccountContactRow | null> {
  const { clientType, ddRecord } = params;
  const contactId = idDe(ddRecord?.[DD_CONTACT_FIELD]);
  if (!contactId) return null;

  const fila = await prisma.accountContact.findUnique({ where: { crmId: contactId } });
  if (fila && !fila.deletedAt) return fila;

  const socioId = idDe(ddRecord?.Socio_de_Negocios ?? ddRecord?.Socio_de_Negocio);
  const rec = await zoho.service.getAccountContactRecord(contactId);
  if (!rec || !socioId) return null;
  return createAccountContact({
    accountCrmId: socioId,
    clientType,
    contact: {
      id: contactId,
      firstName: String(rec.First_Name ?? "").trim(),
      lastName: String(rec.Last_Name ?? "").trim(),
      email: String(rec.Email ?? "").trim(),
      phone: String(rec.Phone ?? rec.Mobile ?? "").trim(),
      createdTime: String(rec.Created_Time ?? ""),
    },
  });
}

/**
 * Contact de Zoho de un expediente de Debida_Diligencia que YA existe (botón del
 * expediente). Es obligatorio. Orden de búsqueda:
 * 1. El contacto ya vinculado en el portal (CrmContact.accountContact).
 * 2. El lookup Nombre_de_contacto del expediente en Zoho (se guarda su copia local).
 * 3. Solo Persona Jurídica: el único contacto del Socio de Negocio (como
 *    /api/generar-expediente).
 * Si no hay ninguno lanza SinContactoExpedienteError.
 */
export async function resolverContactoDeExpediente(params: {
  ddCrmId: string;
  clientType: ClientType;
  /** Registro de Debida_Diligencia tal como lo devuelve Zoho */
  ddRecord: Record<string, any> | null;
}): Promise<AccountContactRow> {
  const { ddCrmId, clientType, ddRecord } = params;

  // 1. Vínculo local
  const local = await prisma.crmContact.findUnique({ where: { crmId: ddCrmId }, include: { accountContact: true } });
  if (local?.accountContact && !local.accountContact.deletedAt) return local.accountContact;

  const socioId = idDe(ddRecord?.Socio_de_Negocios ?? ddRecord?.Socio_de_Negocio);

  // 2. Lookup del expediente en Zoho
  const delLookup = await contactoDelLookupZoho({ clientType, ddRecord });
  if (delLookup) return delLookup;

  // 3. Jurídica: el único contacto del Socio de Negocio
  if (clientType === "JURIDICA" && socioId) {
    const [unico] = await obtenerContactosDeCuenta(socioId, "JURIDICA");
    if (unico) return unico;
  }

  throw new SinContactoExpedienteError(ddCrmId);
}
