import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { zoho, DD_CONTACT_FIELD } from "@/lib/zohoService";
import { logAuditEvent } from "@/lib/auditService";
import { expedienteRetirado, MENSAJE_RETIRADO } from "@/lib/ddRetireService";
import { crearEnlaceConBorrador } from "@/lib/enlaceService";
import {
  planificarEnlaces,
  generarEnlacesRelacionados,
  vincularContactosDelSocio,
  mensajeEnlaces,
  nombreDe,
} from "@/lib/enlacesSocioService";
import {
  obtenerContactosDeCuenta,
  clasificarContactosNaturales,
  contactoDelLookupZoho,
  contactoPrincipal,
  obtenerContactosDeDD,
  ContactoEstandarError,
  SinContactosError,
  type AccountContactRow,
  type ClasificacionContactos,
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

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { message: "El endpoint de generación de enlaces ZDK está activo y listo." },
    { headers: corsHeaders }
  );
}

/** Valor de texto de un campo de Zoho (los lookups/picklists pueden venir como objeto). */
const texto = (v: any): string =>
  String((v && typeof v === "object" ? v.name ?? v.display_value ?? v.value : v) ?? "").trim();

const idDe = (v: any): string => String((v && typeof v === "object" ? v.id : v) ?? "").trim();

/**
 * Botón de un expediente de Debida_Diligencia creado a mano en Zoho: crea los
 * enlaces que le faltan, con el MISMO análisis que /api/generar-expediente
 * (ver enlacesSocioService). La diferencia: aquí el expediente ya existe (es el
 * del botón) y nunca se crea otro registro en Zoho.
 *
 * Enlaces (ver LinkRole):
 * - PRINCIPAL: el del expediente, si aún no lo tiene.
 * - Jurídica: el del Representante Legal (RELATED sin contacto), si falta.
 * - RELATED: uno por cada otro contacto del Socio de Negocio que no lo tenga.
 * Además cada contacto del socio queda atado al expediente (Contacts.Debida_Diligencia).
 *
 * Validaciones:
 * - Expediente inexistente: 404. Retirado (anulado): 409 RETIRADO.
 * - Natural: el contacto del expediente es el Contacto estándar (Contacto_est_ndar,
 *   no el lookup Nombre_de_contacto). Se busca entre los contactos del Socio de
 *   Negocio y, si no tiene, entre los atados al expediente (Contacts.Debida_Diligencia).
 *   Sin contactos: 422 SIN_CONTACTO; debe haber exactamente un estándar (422
 *   CONTACTO_ESTANDAR): solo el contacto estándar escribe el expediente.
 * - Jurídica: no requiere contacto. Sin Representante legal (socio o
 *   Nombre_natural del expediente) y su enlace falta: 422 SIN_REPRESENTANTE_LEGAL
 *   (requiereConfirmacion); con sinRepresentante: true solo se crea el enlace de la jurídica.
 * - El Contact del expediente cambió en Zoho: si el formulario principal sigue
 *   en borrador se actualiza el vínculo (CONTACT_UPDATED); si ya se envió, 409.
 * - Ya existe todo: 409 ALREADY_EXISTS (aun así ata los contactos).
 *
 * Body: { recordId (ID del expediente), tipo?: "natural" | "juridica" (si el
 * expediente no trae Tipo_de_Persona), modulo? }
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let body: any = {};
    if (contentType.includes("application/json")) {
      body = await request.json();
    } else {
      try {
        body = JSON.parse(await request.text());
      } catch (e) {
        // Ignorar si no es JSON válido
      }
    }

    const { recordId, modulo = "Debida_Diligencia" } = body;
    if (!recordId) {
      return NextResponse.json(
        { success: false, error: "El ID del registro de Zoho CRM (recordId) es requerido" },
        { status: 400, headers: corsHeaders }
      );
    }

    // 1. Expediente en Zoho y en el portal
    const ddRecord = await zoho.service.getDDRecord(recordId);
    if (!ddRecord) {
      return NextResponse.json(
        { success: false, error: `No se encontró el expediente ${recordId} en Zoho CRM`, code: "NOT_FOUND" },
        { status: 404, headers: corsHeaders }
      );
    }

    // El tipo sale del propio expediente (Tipo_de_Persona); el body solo es respaldo
    const tipoTexto = texto(ddRecord.Tipo_de_Persona) || String(body.tipo ?? "natural");
    const isNatural = !/jur/i.test(tipoTexto);
    const clientType = isNatural ? "NATURAL" : "JURIDICA";
    console.log(`[API Generar Enlace ZDK] Solicitud para ${recordId} (${clientType}).`);

    let contact = await prisma.crmContact.findUnique({
      where: { crmId: recordId },
      include: { accountContact: true },
    });
    if (expedienteRetirado(ddRecord, contact)) {
      return NextResponse.json(
        { success: false, error: MENSAJE_RETIRADO, code: "RETIRADO", crmId: recordId },
        { status: 409, headers: corsHeaders }
      );
    }

    const socioId = idDe(ddRecord.Socio_de_Negocios ?? ddRecord.Socio_de_Negocio) || undefined;
    const account = socioId ? await zoho.service.getAccountRecord(socioId) : null;

    // 2. Contactos del socio (mismo análisis que generar-expediente). Si el socio
    // no tiene (o el expediente no tiene socio), los atados al propio expediente.
    const contactoLocal = contact?.accountContact && !contact.accountContact.deletedAt ? contact.accountContact : null;
    let contactos: AccountContactRow[] = [];
    if (socioId) {
      try {
        contactos = await obtenerContactosDeCuenta(socioId, clientType, { todos: true });
      } catch (err) {
        if (!(err instanceof SinContactosError)) throw err;
      }
    }
    if (isNatural && !contactos.length) contactos = await obtenerContactosDeDD(recordId, socioId);

    // 3. Contacto del expediente: en la natural, el Contacto estándar (Contacto_est_ndar),
    // no el lookup Nombre_de_contacto. La jurídica no requiere contacto.
    let principal: AccountContactRow | null = null;
    let ddContacto: AccountContactRow | null;
    if (isNatural) {
      if (!contactos.length) {
        return NextResponse.json(
          {
            success: false,
            code: "SIN_CONTACTO",
            error: "Ni el Socio de Negocio ni el expediente tienen contactos: vincule el Contacto estándar para generar su enlace.",
            crmId: recordId,
          },
          { status: 422, headers: corsHeaders }
        );
      }
      principal = contactoPrincipal(socioId ?? recordId, contactos); // lanza ContactoEstandarError
      ddContacto = principal;
      // El estándar identificado queda en el lookup Nombre_de_contacto del expediente
      if (idDe(ddRecord[DD_CONTACT_FIELD]) !== principal.crmId) {
        try {
          await zoho.service.setDDContacto(recordId, principal.crmId);
        } catch (err) {
          console.error(`[API Generar Enlace ZDK Warning] No se pudo escribir ${DD_CONTACT_FIELD} en ${recordId}:`, err);
        }
      }
    } else {
      ddContacto = (await contactoDelLookupZoho({ clientType, ddRecord })) ?? contactoLocal;
    }
    const clasif: ClasificacionContactos = socioId
      ? await clasificarContactosNaturales(socioId, contactos)
      : { faltantes: [], existentes: [], eliminadosEnZoho: [] };

    // 4. Registro local del expediente y su contacto
    const enlaceExistente = contact
      ? await prisma.draft.findFirst({
          where: { crmContactId: contact.id, role: "PRINCIPAL" },
          orderBy: { createdAt: "desc" },
          select: { id: true, data: true },
        })
      : null;
    let contactoActualizado: { anterior: string | null; actual: string } | null = null;

    if (!contact) {
      const crmData = await leerDatosExpediente(recordId);
      contact = await prisma.crmContact.create({
        data: {
          crmId: recordId,
          firstName: isNatural ? principal?.firstName || crmData.firstName : crmData.clientName,
          lastName: isNatural ? principal?.lastName ?? "" : "",
          email: crmData.email,
          accountCrmId: socioId,
          accountContactId: ddContacto?.id,
        },
        include: { accountContact: true },
      });
    } else if (ddContacto && contact.accountContactId !== ddContacto.id) {
      // El Contact del expediente cambió en Zoho: solo si el formulario principal sigue en borrador
      const enviado = await prisma.form.count({
        where: { crmContactId: contact.id, role: "PRINCIPAL", deletedAt: null },
      });
      if (enviado) {
        return NextResponse.json(
          {
            success: false,
            code: "CONTACTO_CAMBIADO",
            error: "El contacto del expediente cambió en Zoho, pero su formulario ya fue enviado: no se puede cambiar.",
            crmId: recordId,
            contactId: ddContacto.crmId,
            previousContactId: contactoLocal?.crmId ?? null,
          },
          { status: 409, headers: corsHeaders }
        );
      }
      contactoActualizado = { anterior: contactoLocal?.crmId ?? null, actual: ddContacto.crmId };
      contact = await prisma.crmContact.update({
        where: { id: contact.id },
        data: { accountContactId: ddContacto.id, ...(socioId && !contact.accountCrmId ? { accountCrmId: socioId } : {}) },
        include: { accountContact: true },
      });
      if (enlaceExistente) {
        await prisma.draft.update({
          where: { id: enlaceExistente.id },
          data: { data: { ...((enlaceExistente.data as Record<string, any>) ?? {}), [DD_CONTACT_FIELD]: ddContacto.crmId } },
        });
      }
      await logAuditEvent({
        action: "LINK_CONTACT_UPDATE_ZDK",
        entityName: "CrmContact",
        entityId: contact.id,
        details: { crmId: recordId, previousContactCrmId: contactoActualizado.anterior, contactCrmId: ddContacto.crmId },
      });
    }

    // 5. Jurídica de antes: expediente natural del Representante Legal (DD_relacionado) ya usado
    let ddRepresentanteAnterior: string | null = null;
    if (!isNatural) {
      const relatedCrmId = idDe(ddRecord.dd_relacionado ?? ddRecord.DD_relacionado ?? ddRecord.DD_Relacionado);
      if (relatedCrmId && relatedCrmId !== recordId) {
        const local = await prisma.crmContact.findUnique({
          where: { crmId: relatedCrmId },
          select: { _count: { select: { drafts: true, forms: true } } },
        });
        if (local && local._count.drafts + local._count.forms > 0) ddRepresentanteAnterior = relatedCrmId;
      }
    }

    // 6. Qué falta
    const plan = await planificarEnlaces({
      isNatural,
      contactos,
      principal,
      clasif,
      existenteCrmId: recordId,
      crmContact: contact,
      ddRepresentanteAnterior,
      seleccion: null,
    });
    const representanteLegal = isNatural
      ? ""
      : texto(account?.Nombre_Extranjero_No_en_Peachtree) || texto(ddRecord.Nombre_natural);
    // Sin Representante Legal y confirmado por el usuario: solo el enlace de la jurídica (ni representante ni contactos)
    if (!isNatural && !representanteLegal && body.sinRepresentante === true) {
      plan.faltaRepresentante = false;
    }
    if (plan.faltaRepresentante && !representanteLegal) {
      // Requiere confirmación del usuario: se reenvía con sinRepresentante: true
      return NextResponse.json(
        {
          success: false,
          code: "SIN_REPRESENTANTE_LEGAL",
          requiereConfirmacion: true,
          error: "El Socio de Negocio no tiene Representante Legal. ¿Generar solo el enlace de Persona Jurídica?",
          crmId: recordId,
        },
        { status: 422, headers: corsHeaders }
      );
    }

    const vincular = () => vincularContactosDelSocio({ ddCrmId: recordId, plan, contactos, principal });

    // Ya existe todo
    if (enlaceExistente && !plan.faltaRepresentante && !plan.porRelacionar.length) {
      const contactosVinculados = await vincular();
      if (contactoActualizado) {
        return NextResponse.json(
          {
            success: true,
            status: "contact_updated",
            code: "CONTACT_UPDATED",
            message: `Contacto actualizado: ${nombreDe(ddContacto!)}`,
            crmId: recordId,
            contactId: contactoActualizado.actual,
            previousContactId: contactoActualizado.anterior,
            contactosVinculados,
            ...plan.extra,
          },
          { headers: corsHeaders }
        );
      }
      return NextResponse.json(
        {
          success: false,
          status: "already_exists",
          code: "ALREADY_EXISTS",
          error: isNatural
            ? "El enlace de este expediente y los de todos los contactos ya fueron creados."
            : "El enlace de este expediente, el del Representante Legal y los de todos los contactos ya fueron creados.",
          crmId: recordId,
          contactosVinculados,
          ...plan.extra,
        },
        { status: 409, headers: corsHeaders }
      );
    }

    const host = request.headers.get("host") || "debida-diligencia.duckdns.org";
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

    // 7. Enlace PRINCIPAL (si aún no lo tiene)
    let principalCreado: { tokenUuid: string; clientUrl: string; expiresAt: Date } | null = null;
    const crmData = await leerDatosExpediente(recordId);
    const projectName = crmData.projectName;
    if (!enlaceExistente) {
      principalCreado = await crearEnlaceConBorrador({
        contactId: contact.id,
        crmId: recordId,
        isNatural,
        appUrl,
        contactCrmId: ddContacto?.crmId,
        draftData: {
          crmContactId: recordId,
          nombreProyecto: projectName,
          ...(isNatural
            ? { firstName: crmData.firstName || "", lastName: crmData.lastName || "", email: crmData.email }
            : { razonSocial: crmData.clientName, ...(representanteLegal ? { rlNombre: representanteLegal } : {}) }),
          // Contact de Zoho del expediente (lookup Nombre_de_contacto): viaja en form.data
          ...(ddContacto ? { [DD_CONTACT_FIELD]: ddContacto.crmId } : {}),
        },
      });

      try {
        await zoho.service.updateClientFormLink(recordId, crmData.module || modulo, principalCreado.clientUrl, principalCreado.expiresAt, "Activo");
        await zoho.service.createNote(
          recordId,
          `Enlace Generado (${isNatural ? "Persona Natural" : "Persona Jurídica"})`,
          `Se ha generado el enlace de acceso del expediente desde Zoho CRM.\n\n` +
          `Tipo de Formulario: ${isNatural ? "Persona Natural" : "Persona Jurídica"}\n` +
          (ddContacto ? `Contacto: ${nombreDe(ddContacto)} (${ddContacto.crmId})\n` : "") +
          `Enlace del Formulario: ${principalCreado.clientUrl}\n` +
          `Vigencia del Enlace: ${principalCreado.expiresAt.toLocaleString()}\n` +
          `Estado del Enlace: Activo\n` +
          `Timestamp: ${new Date().toLocaleString()}`
        );
      } catch (crmErr) {
        console.error(`[API Generar Enlace ZDK Warning] Error al actualizar Zoho CRM:`, crmErr);
      }

      await logAuditEvent({
        action: "LINK_GENERATE_ZDK",
        entityName: "Token",
        entityId: principalCreado.tokenUuid,
        details: { crmId: recordId, type: clientType, clientUrl: principalCreado.clientUrl, contactCrmId: ddContacto?.crmId ?? null, socioId },
      });
    }

    // 8. Representante Legal (jurídica) y contactos relacionados
    const generados = await generarEnlacesRelacionados({
      crmContact: contact,
      plan,
      representanteLegal,
      principal,
      appUrl,
      projectName,
      socioId,
    });
    const contactosVinculados = await vincular();

    return NextResponse.json(
      {
        success: true,
        status: "success",
        message: mensajeEnlaces({
          principal: principalCreado ? `Enlace de ${isNatural ? "Persona Natural" : "Persona Jurídica"} generado` : undefined,
          generados,
        }),
        crmId: recordId,
        tipo: clientType,
        clientUrl: principalCreado?.clientUrl ?? null,
        expiresAt: principalCreado?.expiresAt ?? null,
        contactId: ddContacto?.crmId ?? null,
        ...(contactoActualizado ? { previousContactId: contactoActualizado.anterior } : {}),
        ...(generados.representante ? { representante: generados.representante } : {}),
        ...(generados.relacionados.length ? { relacionados: generados.relacionados } : {}),
        contactosVinculados,
        ...plan.extra,
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error("[API Generar Enlace ZDK Error]:", error);
    if (error instanceof SinContactosError) {
      return NextResponse.json(
        { success: false, error: error.message, code: "SIN_CONTACTOS", socioId: error.accountCrmId },
        { status: 422, headers: corsHeaders }
      );
    }
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

/** Datos del expediente en Zoho para el borrador del enlace principal (vacíos si Zoho falla). */
async function leerDatosExpediente(recordId: string) {
  let crmData: any = {};
  try {
    crmData = (await zoho.service.getContact(recordId)) ?? {};
  } catch (err) {
    console.warn(`[API Generar Enlace ZDK] No se obtuvieron datos de CRM para ${recordId}:`, err);
  }
  const firstName = crmData.firstName || crmData.contactoNombre || "";
  const lastName = crmData.lastName || crmData.contactoApellido || "";
  const rawEmail = String(crmData.email || crmData.contactoEmail || "").trim();
  return {
    firstName,
    lastName,
    clientName: crmData.razonSocial || `${firstName} ${lastName}`.trim() || "Cliente UDG",
    email: rawEmail || "cliente@udg.com",
    projectName: crmData.nombreProyecto || crmData.projectName,
    module: crmData.module as string | undefined,
  };
}
