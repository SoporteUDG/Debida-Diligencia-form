import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { zoho, DD_CONTACT_FIELD } from "@/lib/zohoService";
import { logAuditEvent } from "@/lib/auditService";
import { crearEnlaceConBorrador, prepararExpedienteRelacionado } from "@/lib/enlaceService";
import { obtenerContactosDeCuenta, clasificarContactosNaturales, SinContactosError, type AccountContactRow } from "@/lib/accountContactService";

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
    { message: "El endpoint de generación de expedientes está activo y listo." },
    { headers: corsHeaders }
  );
}

/**
 * Crea un expediente nuevo de Debida_Diligencia y su enlace al formulario.
 * Si es de Persona Jurídica crea también el expediente de Persona Natural del
 * Representante Legal, relacionado en ambos sentidos (como /api/generar-enlace).
 *
 * Body:
 * - name (requerido): nombre que sustituye al del Socio de Negocio en el Name
 *   del expediente ("name-unidad-proyecto"), para que no quede igual al socio.
 * - type (requerido): "natural" o "juridica".
 * - socioId / recordId (requerido): Socio de Negocio (Accounts) al que se
 *   vincula; de él salen la unidad, el proyecto y la carpeta de documentos.
 * - proyecto (opcional): proyecto a usar si el Socio de Negocio no tiene uno.
 *
 * Contactos: se buscan los Contacts de Zoho vinculados al Socio de Negocio.
 * Persona Natural: un expediente (con su enlace) por cada contacto. Persona
 * Jurídica: un solo expediente, con el contacto vinculado más antiguo. Al
 * completarse el formulario se actualizan el Contact y el expediente.
 */
export async function POST(request: NextRequest) {
  try {
    let body: any = {};
    try {
      body = JSON.parse(await request.text());
    } catch (e) {
      // Ignorar si no es JSON válido
    }

    const name = (body.name ?? "").toString().trim();
    const type = (body.type ?? "").toString().trim().toLowerCase();
    const socioId = (body.socioId || body.recordId || "").toString().trim();
    const projectName = (body.proyecto || body.projectName || "").toString().trim() || undefined;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "El nombre del expediente (name) es requerido" },
        { status: 400, headers: corsHeaders }
      );
    }
    if (!type) {
      return NextResponse.json(
        { success: false, error: "El tipo de persona (type) es requerido" },
        { status: 400, headers: corsHeaders }
      );
    }
    if (!socioId) {
      return NextResponse.json(
        { success: false, error: "El Socio de Negocio (socioId) es requerido" },
        { status: 400, headers: corsHeaders }
      );
    }

    const isNatural = !type.includes("jur");
    const clientType = isNatural ? "NATURAL" : "JURIDICA";

    console.log(`[API Generar Expediente] Solicitud: name="${name}", tipo=${clientType}, socio=${socioId}`);

    // URL base del portal (enlace principal y enlace del relacionado)
    const host = request.headers.get("host") || "debida-diligencia.duckdns.org";
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

    // Contactos de Zoho vinculados al Socio de Negocio. Natural: un expediente por
    // contacto; sin contactos es un error. Jurídica: solo el más antiguo; sin
    // contactos se genera un expediente sin contacto vinculado.
    const contactos = await obtenerContactosDeCuenta(socioId, clientType);
    let porContacto: Array<AccountContactRow | null> = contactos.length ? contactos : [null];
    let yaExistentes: Awaited<ReturnType<typeof clasificarContactosNaturales>>["existentes"] = [];
    let eliminadosEnZoho: Awaited<ReturnType<typeof clasificarContactosNaturales>>["eliminadosEnZoho"] = [];
    if (isNatural) {
      // Solo se genera para los contactos que aún no tienen expediente (Zoho y luego Prisma)
      const clasif = await clasificarContactosNaturales(socioId, contactos);
      porContacto = clasif.faltantes;
      yaExistentes = clasif.existentes;
      eliminadosEnZoho = clasif.eliminadosEnZoho;
    }

    const expedientes: any[] = [];
    for (const accountContact of porContacto) {
      expedientes.push(
        await generarExpediente({
          accountContact,
          // Natural: cada expediente lleva el nombre de su contacto
          nombre: isNatural && accountContact
            ? `${accountContact.firstName} ${accountContact.lastName}`.trim() || name
            : name,
        })
      );
    }

    async function generarExpediente(opts: { accountContact: AccountContactRow | null; nombre: string }) {
      const { accountContact, nombre } = opts;

      // 1. Registro en Zoho CRM con el Name "nombre-unidad-proyecto"
      const created = await zoho.service.createDebidaDiligenciaRecord({
        accountCrmId: socioId,
        clientType,
        name: nombre,
        projectName,
        overRideName: nombre,
        contactCrmId: accountContact?.crmId,
        ...(isNatural ? {} : { razonSocial: name }),
      });
      if (!created.debidaId) throw new Error("Zoho CRM no devolvió el ID del expediente creado");
      const crmId = created.debidaId;
      console.log(`[API Generar Expediente] Expediente ${crmId} creado.`);

      // 2. Contacto local, vinculado al Contact de Zoho
      const contact = await prisma.crmContact.upsert({
        where: { crmId },
        update: { accountCrmId: socioId, accountContactId: accountContact?.id ?? null },
        create: {
          crmId,
          firstName: isNatural && accountContact?.firstName ? accountContact.firstName : nombre,
          lastName: isNatural && accountContact?.firstName ? accountContact.lastName : "",
          email: `cliente@udg.com`,
          accountCrmId: socioId,
          accountContactId: accountContact?.id,
        },
      });

      // 3. Si es jurídica: expediente de Persona Natural (Representante Legal)
      // enlazado en ambos sentidos por DD_relacionado, con el mismo socio y contacto.
      let related: { crmId: string; clientUrl: string | null } | null = null;
      if (!isNatural) {
        try {
          related = await prepararExpedienteRelacionado({
            juridicaCrmId: crmId,
            clientName: nombre,
            projectName,
            appUrl,
            socioId,
            overRideName: `Representante Legal ${nombre}`,
            accountContact: accountContact ?? undefined,
          });
        } catch (relErr) {
          console.error(`[API Generar Expediente Warning] Error al crear el expediente natural relacionado de ${crmId}:`, relErr);
        }
      }

      // 4. Token de 30 días, URL del formulario y borrador
      const { tokenUuid, clientUrl, expiresAt } = await crearEnlaceConBorrador({
        contactId: contact.id,
        crmId,
        isNatural,
        appUrl,
        contactCrmId: accountContact?.crmId,
        draftData: {
          crmContactId: crmId,
          nombreProyecto: projectName,
          ...(isNatural ? { firstName: "", lastName: "", email: "" } : { razonSocial: name }),
          // Contact de Zoho del expediente (lookup Nombre_de_contacto): viaja en form.data
          ...(accountContact ? { [DD_CONTACT_FIELD]: accountContact.crmId } : {}),
        },
      });

      // 5. Enlace en Zoho CRM
      try {
        await zoho.service.updateClientFormLink(crmId, "Debida_Diligencia", clientUrl, expiresAt, "Activo");
        await zoho.service.createNote(
          crmId,
          `Enlace Generado (${isNatural ? "Persona Natural" : "Persona Jurídica"})`,
          `Se ha generado un nuevo expediente con su enlace de acceso.

` +
          `Tipo de Formulario: ${isNatural ? "Persona Natural" : "Persona Jurídica"}
` +
          (accountContact ? `Contacto: ${accountContact.firstName} ${accountContact.lastName} (${accountContact.crmId})
` : "") +
          `Enlace del Formulario: ${clientUrl}
` +
          `Vigencia del Enlace: ${expiresAt.toLocaleString()}
` +
          `Estado del Enlace: Activo
` +
          (related
            ? `Expediente Relacionado (Persona Natural): ${related.crmId}
` +
              (related.clientUrl ? `Enlace del Relacionado: ${related.clientUrl}
` : "")
            : "") +
          `Timestamp: ${new Date().toLocaleString()}`
        );
      } catch (crmErr) {
        console.error(`[API Generar Expediente Warning] Error al actualizar el enlace de ${crmId}:`, crmErr);
      }

      // 6. Auditoría
      await logAuditEvent({
        action: "LINK_GENERATE_ZDK",
        entityName: "Token",
        entityId: tokenUuid,
        details: {
          crmId,
          type: clientType,
          clientUrl,
          name: nombre,
          socioId,
          ...(accountContact ? { contactCrmId: accountContact.crmId } : {}),
          ...(related ? { relatedCrmId: related.crmId, relatedClientUrl: related.clientUrl } : {}),
        },
      });

      return {
        crmId,
        clientUrl,
        expiresAt,
        ...(accountContact ? { contactId: accountContact.crmId } : {}),
        ...(related ? { relatedCrmId: related.crmId, relatedClientUrl: related.clientUrl } : {}),
      };
    }

    // Información de contactos que no se generaron (solo Persona Natural)
    const extra = {
      ...(yaExistentes.length
        ? {
            existentes: yaExistentes.map((e) => ({ contactId: e.contact.crmId, crmId: e.ddCrmId, fuente: e.fuente })),
          }
        : {}),
      ...(eliminadosEnZoho.length
        ? { contactosEliminadosEnZoho: eliminadosEnZoho.map((c) => c.crmId) }
        : {}),
    };

    // Todos los contactos ya tenían expediente: no se crea nada
    if (expedientes.length === 0) {
      return NextResponse.json(
        {
          success: true,
          status: "already_exists",
          message: "Todos los contactos del Socio de Negocio ya tienen su expediente de Debida Diligencia.",
          ...extra,
        },
        { headers: corsHeaders }
      );
    }

    // Un solo expediente: misma respuesta de siempre. Varios (natural con
    // varios contactos): además la lista completa en "expedientes".
    const [primero] = expedientes;
    return NextResponse.json(
      {
        success: true,
        status: "success",
        message:
          expedientes.length > 1
            ? `¡${expedientes.length} expedientes de Persona Natural generados exitosamente!`
            : `¡Expediente de ${isNatural ? "Persona Natural" : "Persona Jurídica"} generado exitosamente!`,
        ...primero,
        ...(expedientes.length > 1 ? { expedientes } : {}),
        ...extra,
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error("[API Generar Expediente Error]:", error);
    if (error instanceof SinContactosError) {
      return NextResponse.json(
        { success: false, error: error.message, code: "SIN_CONTACTOS", socioId: error.accountCrmId },
        { status: 422, headers: corsHeaders }
      );
    }
    return NextResponse.json(
      { success: false, error: error.message || "Error interno del servidor" },
      { status: 500, headers: corsHeaders }
    );
  }
}
