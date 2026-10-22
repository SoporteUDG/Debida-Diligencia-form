import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { zoho, DD_CONTACT_FIELD } from "@/lib/zohoService";
import { logAuditEvent } from "@/lib/auditService";
import { expedienteRetirado, MENSAJE_RETIRADO } from "@/lib/ddRetireService";
import { ESTADO_EN_BORRADOR, ESTADO_SIN_ASOCIAR } from "@/lib/ddEstados";
import { migrarCarpetasASocio, SocioSinCarpetaError } from "@/lib/workdriveService";
import { nombreDe } from "@/lib/enlacesSocioService";
import {
  obtenerContactosDeCuenta,
  obtenerContactosDeDD,
  contactoPrincipal,
  ContactoEstandarError,
  SinContactosError,
  type AccountContactRow,
} from "@/lib/accountContactService";

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
  return NextResponse.json({ message: "El endpoint de asociación de socio está activo y listo." }, { headers: corsHeaders });
}

const texto = (v: any): string =>
  String((v && typeof v === "object" ? v.name ?? v.display_value ?? v.value : v) ?? "").trim();

const idDe = (v: any): string => String((v && typeof v === "object" ? v.id : v) ?? "").trim();

/**
 * Completa un expediente creado en /registro/* ("Sin Asociar") cuando en Zoho ya
 * se le asignó un Socio de Negocio (lookup Socio_de_Negocios):
 *
 * - Prisma: el CrmContact queda con accountCrmId (y, en la natural, con el
 *   Contacto estándar del socio en accountContactId).
 * - Natural: el Contacto estándar (Contacto_est_ndar) del socio —o, si no tiene
 *   contactos, de los atados al expediente— se escribe en Nombre_de_contacto y
 *   en el borrador del enlace principal. La jurídica no lleva contacto.
 * - Natural cuyo cliente ya completó el formulario: sus datos personales se copian
 *   al Contacto estándar del socio (si aún no lo completó, al hacerlo se guardan
 *   en ese contacto). Un formulario enviado sin socio no falla: escribe en el
 *   propio expediente.
 * - WorkDrive: las carpetas del expediente pasan de la raíz a /{Socio}/DD y la
 *   principal se renombra con el Name nuevo.
 * - Zoho: el Name pasa de "nombre-proyecto" a "nombre-unidad-proyecto" (con la
 *   unidad del socio) y el Estado de "Sin Asociar" a "En borrador".
 *
 * Errores: 404 inexistente; 409 RETIRADO / NO_SIN_ASOCIAR (otro Estado);
 * 422 SIN_SOCIO, SIN_CONTACTO, CONTACTO_ESTANDAR o SIN_CARPETA_SOCIO.
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
    if (!recordId) {
      return NextResponse.json(
        { success: false, error: "El ID del registro de Zoho CRM (recordId) es requerido" },
        { status: 400, headers: corsHeaders }
      );
    }

    const ddRecord = await zoho.service.getDDRecord(recordId);
    if (!ddRecord) {
      return NextResponse.json(
        { success: false, error: `No se encontró el expediente ${recordId} en Zoho CRM`, code: "NOT_FOUND" },
        { status: 404, headers: corsHeaders }
      );
    }

    const contact = await prisma.crmContact.findUnique({ where: { crmId: recordId } });
    if (!contact) {
      return NextResponse.json(
        { success: false, error: `El expediente ${recordId} no existe en el portal.`, code: "NOT_FOUND" },
        { status: 404, headers: corsHeaders }
      );
    }
    if (expedienteRetirado(ddRecord, contact)) {
      return NextResponse.json(
        { success: false, error: MENSAJE_RETIRADO, code: "RETIRADO", crmId: recordId },
        { status: 409, headers: corsHeaders }
      );
    }
    if (texto(ddRecord.Estado) !== ESTADO_SIN_ASOCIAR) {
      return NextResponse.json(
        {
          success: false,
          code: "NO_SIN_ASOCIAR",
          error: `El expediente no está en estado "${ESTADO_SIN_ASOCIAR}" (Estado actual: ${texto(ddRecord.Estado) || "vacío"}).`,
          crmId: recordId,
        },
        { status: 409, headers: corsHeaders }
      );
    }

    const socioId = idDe(ddRecord.Socio_de_Negocios ?? ddRecord.Socio_de_Negocio);
    if (!socioId) {
      return NextResponse.json(
        {
          success: false,
          code: "SIN_SOCIO",
          error: "El expediente aún no tiene un Socio de Negocio: asígnelo (Socio_de_Negocios) y vuelva a intentar.",
          crmId: recordId,
        },
        { status: 422, headers: corsHeaders }
      );
    }

    const isNatural = !/jur/i.test(texto(ddRecord.Tipo_de_Persona));
    const clientType = isNatural ? "NATURAL" : "JURIDICA";

    // Natural: Contacto estándar del socio (o, si no tiene contactos, de los atados al expediente)
    let estandar: AccountContactRow | null = null;
    if (isNatural) {
      let contactos: AccountContactRow[] = [];
      try {
        contactos = await obtenerContactosDeCuenta(socioId, clientType, { todos: true });
      } catch (err) {
        if (!(err instanceof SinContactosError)) throw err;
      }
      if (!contactos.length) contactos = await obtenerContactosDeDD(recordId, socioId);
      if (!contactos.length) {
        return NextResponse.json(
          {
            success: false,
            code: "SIN_CONTACTO",
            error: "Ni el Socio de Negocio ni el expediente tienen contactos: vincule el Contacto estándar para asociar el expediente.",
            crmId: recordId,
          },
          { status: 422, headers: corsHeaders }
        );
      }
      estandar = contactoPrincipal(socioId, contactos); // lanza ContactoEstandarError
    }

    // Enlaces del expediente (el principal no tiene carpeta propia) y su formulario ya enviado, si lo hay
    const drafts = await prisma.draft.findMany({
      where: { crmContactId: contact.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, role: true, token: true, data: true },
    });
    const draft = drafts.find((d) => d.role === "PRINCIPAL");
    const enviado = estandar
      ? await prisma.form.findFirst({
          where: { crmContactId: contact.id, role: "PRINCIPAL", deletedAt: null },
          orderBy: { createdAt: "desc" },
          select: { type: true, data: true },
        })
      : null;

    // 1. Name nuevo ("nombre-unidad-proyecto") y carpetas de WorkDrive al socio. Antes de
    // cambiar nada más: si falla, el expediente sigue "Sin Asociar" y se puede reintentar.
    const nombreCliente = estandar ? nombreDe(estandar) : "";
    const nombre = nombreCliente || `${contact.firstName} ${contact.lastName}`.trim() || texto(ddRecord.Name);
    const { name: nombreNuevo, unidadId, unidad } = await zoho.service.resolverNombreDDDeSocio({ ddRecord, socioId, nombre });
    const carpetas = await migrarCarpetasASocio({
      ddId: recordId,
      formType: clientType,
      nombreAnterior: texto(ddRecord.Name),
      nombreNuevo,
      tokens: drafts.filter((d) => d.role !== "PRINCIPAL").map((d) => d.token),
    });

    // 2. Natural con el formulario ya enviado: sus datos pasan al Contacto estándar del socio
    // (los que se escribieron en el expediente quedan también ahí)
    if (estandar && enviado) {
      await zoho.service.updateAccountContact(estandar.crmId, enviado.type as any, enviado.data);
    }

    // 3. Prisma
    await prisma.crmContact.update({
      where: { id: contact.id },
      data: { accountCrmId: socioId, ...(estandar ? { accountContactId: estandar.id } : {}) },
    });
    if (estandar && draft) {
      await prisma.draft.update({
        where: { id: draft.id },
        data: { data: { ...((draft.data as Record<string, any>) ?? {}), [DD_CONTACT_FIELD]: estandar.crmId } },
      });
    }

    // 4. Zoho: Name, unidad, contacto y Estado, en una sola actualización
    await zoho.service.updateDDFields(recordId, {
      Name: nombreNuevo,
      Estado: ESTADO_EN_BORRADOR,
      ...(unidadId ? { Unidad_Vendida: { id: unidadId } } : {}),
      ...(unidad ? { Unidad: unidad } : {}),
      ...(estandar ? { [DD_CONTACT_FIELD]: { id: estandar.crmId } } : {}),
    });

    await logAuditEvent({
      action: "DD_SOCIO_ASOCIADO",
      entityName: "CrmContact",
      entityId: contact.id,
      details: {
        crmId: recordId,
        socioId,
        contactCrmId: estandar?.crmId ?? null,
        nombreAnterior: texto(ddRecord.Name),
        nombreNuevo,
        carpetas,
        datosPasadosAlContacto: !!(estandar && enviado),
      },
    });

    return NextResponse.json(
      {
        success: true,
        status: "success",
        message: `Expediente asociado al Socio de Negocio y renombrado a "${nombreNuevo}". Estado: ${ESTADO_EN_BORRADOR}.`,
        crmId: recordId,
        socioId,
        name: nombreNuevo,
        contactId: estandar?.crmId ?? null,
        datosPasadosAlContacto: !!(estandar && enviado),
        carpetas,
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    if (error instanceof SocioSinCarpetaError) {
      return NextResponse.json(
        { success: false, error: error.message, code: "SIN_CARPETA_SOCIO", socioId: error.socioId },
        { status: 422, headers: corsHeaders }
      );
    }
    console.error("[API Asociar Socio Error]:", error);
    if (error instanceof ContactoEstandarError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: "CONTACTO_ESTANDAR",
          socioId: error.accountCrmId,
          estandares: error.estandares.map((c) => c.crmId),
        },
        { status: 422, headers: corsHeaders }
      );
    }
    return NextResponse.json(
      { success: false, error: error.message || "Error interno del servidor" },
      { status: 500, headers: corsHeaders }
    );
  }
}
