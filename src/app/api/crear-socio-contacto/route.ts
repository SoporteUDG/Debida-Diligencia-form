import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { zoho, formatDDName } from "@/lib/zohoService";
import { logAuditEvent } from "@/lib/auditService";
import { expedienteRetirado, MENSAJE_RETIRADO } from "@/lib/ddRetireService";
import { crearContactoYSocio } from "@/lib/temporalScaffold";
import { buscarClienteEnZoho, VerificacionZohoError } from "@/lib/temporalValidation";
import { identificadorDelTemporal } from "@/lib/temporalFields";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
  return NextResponse.json({ message: "El endpoint de creación de socio y contacto está activo y listo." }, { headers: corsHeaders });
}

const texto = (v: any): string =>
  String((v && typeof v === "object" ? v.name ?? v.display_value ?? v.value : v) ?? "").trim();

const idDe = (v: any): string => String((v && typeof v === "object" ? v.id : v) ?? "").trim();

const fallo = (status: number, code: string, error: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ success: false, code, error, ...extra }, { status, headers: corsHeaders });

/**
 * Crea el Contact y el Socio de Negocio de un expediente que aún no tiene socio
 * (creado desde /registro/*), con los datos que su cliente capturó en el
 * formulario y el mismo código del enlace temporal (crearContactoYSocio):
 * Natural: Contact (contacto estándar) + Socio; Jurídica: solo el Socio.
 * Después los ata al expediente (Socio_de_Negocios, Nombre_de_contacto). El resto
 * (renombrar, mover carpetas, Estado) lo hace /api/asociar-socio.
 *
 * Valida antes de crear nada:
 * - El expediente existe, no está retirado y no tiene ya un Socio de Negocio.
 * - Tiene un enlace creado (404/422 SIN_ENLACE) con un nombre y un RUC / ID
 *   tributaria (422 SIN_NOMBRE / SIN_IDENTIFICADOR).
 * - Ese RUC / ID tributaria no existe ya en Zoho en otro registro (409 DUPLICADO).
 *   Si no se puede consultar Zoho: 503 (no se crea a ciegas).
 *
 * Body: { recordId (ID del expediente) }
 */
export async function POST(request: NextRequest) {
  try {
    let body: any = {};
    try {
      body = JSON.parse(await request.text());
    } catch (e) {
      // Ignorar si no es JSON válido
    }
    const recordId = String(body.recordId ?? "").trim();
    if (!recordId) return fallo(400, "BAD_REQUEST", "El ID del registro de Zoho CRM (recordId) es requerido");

    const ddRecord = await zoho.service.getDDRecord(recordId);
    if (!ddRecord) return fallo(404, "NOT_FOUND", `No se encontró el expediente ${recordId} en Zoho CRM`);
    if (idDe(ddRecord.Socio_de_Negocios ?? ddRecord.Socio_de_Negocio)) {
      return fallo(409, "YA_TIENE_SOCIO", "El expediente ya tiene un Socio de Negocio: no se crea otro.", { crmId: recordId });
    }

    // Enlace creado: el expediente existe en el portal y tiene su enlace principal
    const contact = await prisma.crmContact.findUnique({ where: { crmId: recordId } });
    if (contact && expedienteRetirado(ddRecord, contact)) return fallo(409, "RETIRADO", MENSAJE_RETIRADO, { crmId: recordId });
    const [enviado, borrador] = contact
      ? await Promise.all([
          prisma.form.findFirst({
            where: { crmContactId: contact.id, role: "PRINCIPAL", deletedAt: null },
            orderBy: { createdAt: "desc" },
            select: { data: true },
          }),
          prisma.draft.findFirst({
            where: { crmContactId: contact.id, role: "PRINCIPAL" },
            orderBy: { createdAt: "desc" },
            select: { data: true },
          }),
        ])
      : [null, null];
    if (!contact || (!enviado && !borrador)) {
      return fallo(422, "SIN_ENLACE", "El expediente no tiene un enlace creado: genere su enlace antes de crear el Socio de Negocio.", { crmId: recordId });
    }

    // Datos del cliente: el formulario enviado o, si no, su borrador
    const d = ((enviado?.data ?? borrador?.data) as Record<string, any>) ?? {};
    const type = /jur/i.test(texto(ddRecord.Tipo_de_Persona)) ? "JURIDICA" : "NATURAL";
    const esNatural = type === "NATURAL";
    const nombre = esNatural ? `${texto(d.firstName)} ${texto(d.lastName)}`.trim() : texto(d.razonSocial);
    if (!nombre) return fallo(422, "SIN_NOMBRE", "El enlace aún no tiene el nombre del cliente: debe completarlo antes de crear el Socio de Negocio.", { crmId: recordId });
    const identificador = identificadorDelTemporal(type, d);
    if (!identificador) {
      return fallo(
        422,
        "SIN_IDENTIFICADOR",
        `El enlace aún no tiene ${esNatural ? "la identificación" : "el RUC / ID tributaria"} del cliente: debe completarlo antes de crear el Socio de Negocio.`,
        { crmId: recordId }
      );
    }

    // RUC / ID tributaria no duplicado en Zoho (el propio expediente no cuenta)
    const duplicados = (await buscarClienteEnZoho(type, d)).filter((c) => !(c.module === "Debida_Diligencia" && c.id === recordId));
    if (duplicados.length) {
      return fallo(
        409,
        "DUPLICADO",
        `${esNatural ? "La identificación" : "El RUC / ID tributaria"} ${identificador} ya existe en Zoho: ` +
          duplicados.map((c) => `${c.module} ${c.name} (${c.id})`).join(", ") +
          ". Asigne ese registro al expediente en lugar de crear uno nuevo.",
        { crmId: recordId, coincidencias: duplicados }
      );
    }

    // ---------- Creación (mismo código que el enlace temporal) ----------
    const proyecto = texto(d.nombreProyecto) || texto(ddRecord.Proyecto);
    const nombreRegistro = formatDDName({ socio: nombre, proyecto });
    const { contactCrmId, accountCrmId } = await crearContactoYSocio({ type, data: d, nombreRegistro, proyecto });

    // Se atan al expediente enseguida: si algo después falla, el socio ya no queda suelto
    await zoho.service.updateDDFields(recordId, {
      Socio_de_Negocios: { id: accountCrmId },
      ...(contactCrmId ? { Nombre_de_contacto: { id: contactCrmId } } : {}),
    });
    if (contactCrmId) await zoho.service.vincularContactoADD(contactCrmId, recordId);

    const email = texto(esNatural ? d.email : d.empresaEmail || d.contactoEmail);
    const accountContact = contactCrmId
      ? await prisma.accountContact.upsert({
          where: { crmId: contactCrmId },
          update: { accountCrmId, deletedAt: null },
          create: {
            crmId: contactCrmId,
            accountCrmId,
            firstName: texto(d.firstName),
            lastName: texto(d.lastName),
            email: email || null,
            isStandard: true,
          },
        })
      : null;
    await prisma.crmContact.update({
      where: { id: contact.id },
      data: { accountCrmId, ...(accountContact ? { accountContactId: accountContact.id } : {}) },
    });

    const resumen =
      `Creado desde el expediente ${recordId}.\n\n` +
      `Tipo: ${esNatural ? "Persona Natural" : "Persona Jurídica"}\nCliente: ${nombre}\nIdentificación: ${identificador}\n` +
      `Proyecto: ${proyecto || "(sin proyecto)"}\nSocio de Negocio: ${accountCrmId}\n` +
      (contactCrmId ? `Contacto: ${contactCrmId}\n` : "") +
      `Timestamp: ${new Date().toLocaleString()}`;
    const notas: Array<[string, "Accounts" | "Contacts", string]> = [
      [accountCrmId, "Accounts", "Socio de Negocio creado desde un expediente"],
      ...(contactCrmId ? [[contactCrmId, "Contacts", "Contacto creado desde un expediente"] as [string, "Contacts", string]] : []),
    ];
    for (const [id, modulo, titulo] of notas) {
      try {
        await zoho.service.createNote(id, titulo, resumen, modulo);
      } catch (err) {
        console.warn(`[Crear Socio Contacto] No se pudo crear la nota en ${modulo} ${id}:`, err);
      }
    }

    await logAuditEvent({
      action: "DD_SOCIO_CREADO",
      entityName: "CrmContact",
      entityId: contact.id,
      details: { crmId: recordId, type, accountCrmId, contactCrmId, identificador },
    });

    return NextResponse.json(
      {
        success: true,
        status: "success",
        message: `Socio de Negocio${contactCrmId ? " y contacto" : ""} creado${contactCrmId ? "s" : ""}.`,
        crmId: recordId,
        socioId: accountCrmId,
        contactId: contactCrmId,
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error("[API Crear Socio Contacto Error]:", error);
    if (error instanceof VerificacionZohoError) {
      return fallo(503, "VERIFICACION_ZOHO", `${error.message} Intente de nuevo en unos minutos.`);
    }
    return fallo(500, "ERROR", error.message || "Error interno del servidor");
  }
}
