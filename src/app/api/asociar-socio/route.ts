import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { zoho, DD_CONTACT_FIELD } from "@/lib/zohoService";
import { logAuditEvent } from "@/lib/auditService";
import { expedienteRetirado, MENSAJE_RETIRADO } from "@/lib/ddRetireService";
import { ESTADO_EN_BORRADOR, ESTADO_SIN_ASOCIAR } from "@/lib/ddEstados";
import { migrarCarpetasASocio, SocioSinCarpetaError } from "@/lib/workdriveService";
import { nombreDe } from "@/lib/enlacesSocioService";
import { vincularContactosAlExpediente } from "@/lib/contactLinkService";
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
 * Se ejecuta en cada cambio del Socio de Negocio (Client Script onBeforeUpdate), no
 * solo desde "Sin Asociar":
 * - El socio nuevo no puede tener otra Debida Diligencia vigente (409 SOCIO_CON_DD).
 * - Si el expediente ya estaba en otro socio, sus carpetas pasan de /{Anterior}/DD a
 *   /{Nuevo}/DD, y el Estado solo cambia a "En borrador" cuando venía de "Sin Asociar".
 * - Todos los contactos del socio se atan al expediente (Contacts.Debida_Diligencia),
 *   sin generar enlaces; en la natural, además, el Contacto estándar se guarda en
 *   Nombre de contacto.
 * - Si el cambio se rechaza (SOCIO_CON_DD, SIN_CARPETA_SOCIO, SIN_CONTACTO,
 *   CONTACTO_ESTANDAR) y el expediente tenía un socio, se restaura en Zoho
 *   (`restaurado: true`).
 *
 * Errores: 404 inexistente; 409 RETIRADO / SOCIO_CON_DD;
 * 422 SIN_SOCIO, SIN_CONTACTO, CONTACTO_ESTANDAR o SIN_CARPETA_SOCIO.
 *
 * Body: { recordId (ID del expediente), socioId? (el nuevo; el guardado en Zoho puede
 * no haber llegado), socioAnteriorId? (el que tenía; si falta se usa el del portal) }
 */
export async function POST(request: NextRequest) {
  // Devuelve el Socio de Negocio anterior al expediente cuando se rechaza el cambio
  let restaurar: () => Promise<boolean> = async () => false;
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
    const sinAsociar = texto(ddRecord.Estado) === ESTADO_SIN_ASOCIAR;
    // El socio nuevo viene del script (el guardado puede no haber llegado a Zoho); si no, del registro
    const socioId = String(body.socioId ?? "").trim() || idDe(ddRecord.Socio_de_Negocios ?? ddRecord.Socio_de_Negocio);
    const socioAnteriorId = String(body.socioAnteriorId ?? "").trim() || contact.accountCrmId || null;
    restaurar = async () => {
      if (!socioAnteriorId || socioAnteriorId === socioId) return false;
      try {
        await zoho.service.updateDDFields(recordId, { Socio_de_Negocios: { id: socioAnteriorId } });
        return true;
      } catch (err) {
        console.error(`[API Asociar Socio] No se pudo restaurar el socio ${socioAnteriorId} del expediente ${recordId}:`, err);
        return false;
      }
    };

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

    // Sin cambio de socio en un expediente ya asociado: nada que hacer
    if (!sinAsociar && contact.accountCrmId === socioId) {
      return NextResponse.json(
        { success: true, status: "unchanged", message: "El expediente ya está asociado a este Socio de Negocio.", crmId: recordId, socioId },
        { headers: corsHeaders }
      );
    }

    // El socio no puede tener otra Debida Diligencia vigente (la propia y las retiradas no cuentan)
    const otras = (await zoho.service.searchDDsByAccount(socioId)).filter((d) => d.id !== recordId && !d.retirado);
    if (otras.length) {
      const restaurado = await restaurar();
      return NextResponse.json(
        {
          success: false,
          code: "SOCIO_CON_DD",
          error:
            `El Socio de Negocio ya tiene una Debida Diligencia asociada (${otras[0].name || otras[0].id}).` +
            (restaurado ? " Se restauró el Socio de Negocio anterior." : ""),
          crmId: recordId,
          socioId,
          ddExistente: otras[0].id,
          restaurado,
        },
        { status: 409, headers: corsHeaders }
      );
    }

    const isNatural = !/jur/i.test(texto(ddRecord.Tipo_de_Persona));
    const clientType = isNatural ? "NATURAL" : "JURIDICA";

    // Contactos del socio (o, si no tiene, los atados al expediente); natural: el estándar
    let estandar: AccountContactRow | null = null;
    let contactos: AccountContactRow[] = [];
    try {
      contactos = await obtenerContactosDeCuenta(socioId, clientType, { todos: true });
    } catch (err) {
      if (!(err instanceof SinContactosError)) throw err;
    }
    if (!contactos.length) contactos = await obtenerContactosDeDD(recordId, socioId);
    if (isNatural) {
      if (!contactos.length) {
        const restaurado = await restaurar();
        return NextResponse.json(
          {
            success: false,
            code: "SIN_CONTACTO",
            error: "Ni el Socio de Negocio ni el expediente tienen contactos: vincule el Contacto estándar para asociar el expediente.",
            crmId: recordId,
            restaurado,
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
      socioId,
      socioAnteriorId,
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
      // Solo cambia el Estado cuando venía de "Sin Asociar"
      ...(sinAsociar ? { Estado: ESTADO_EN_BORRADOR } : {}),
      ...(unidadId ? { Unidad_Vendida: { id: unidadId } } : {}),
      ...(unidad ? { Unidad: unidad } : {}),
      ...(estandar ? { [DD_CONTACT_FIELD]: { id: estandar.crmId } } : {}),
    });

    // 5. Todos los contactos del socio quedan atados al expediente (sin generar enlaces)
    const contactosVinculados = await vincularContactosAlExpediente(
      recordId,
      contactos.map((c) => c.crmId)
    );

    await logAuditEvent({
      action: "DD_SOCIO_ASOCIADO",
      entityName: "CrmContact",
      entityId: contact.id,
      details: {
        crmId: recordId,
        socioId,
        socioAnteriorId,
        contactosVinculados,
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
        message: `Expediente asociado al Socio de Negocio y renombrado a "${nombreNuevo}".${sinAsociar ? ` Estado: ${ESTADO_EN_BORRADOR}.` : ""}`,
        crmId: recordId,
        socioId,
        name: nombreNuevo,
        contactId: estandar?.crmId ?? null,
        datosPasadosAlContacto: !!(estandar && enviado),
        carpetas,
        contactosVinculados,
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    if (error instanceof SocioSinCarpetaError) {
      const restaurado = await restaurar();
      return NextResponse.json(
        { success: false, error: error.message, code: "SIN_CARPETA_SOCIO", socioId: error.socioId, restaurado },
        { status: 422, headers: corsHeaders }
      );
    }
    console.error("[API Asociar Socio Error]:", error);
    if (error instanceof ContactoEstandarError) {
      const restaurado = await restaurar();
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: "CONTACTO_ESTANDAR",
          restaurado,
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
