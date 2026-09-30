import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { zoho } from "@/lib/zohoService";
import { logAuditEvent } from "@/lib/auditService";
import { crearEnlaceConBorrador, prepararExpedienteRelacionado } from "@/lib/enlaceService";

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

    // 1. Registro en Zoho CRM con el Name "name-unidad-proyecto"
    const created = await zoho.service.createDebidaDiligenciaRecord({
      accountCrmId: socioId,
      clientType,
      name,
      projectName,
      overRideName: name,
      ...(isNatural ? {} : { razonSocial: name }),
    });
    if (!created.debidaId) throw new Error("Zoho CRM no devolvió el ID del expediente creado");
    const crmId = created.debidaId;
    console.log(`[API Generar Expediente] Expediente ${crmId} creado.`);

    // 2. Contacto local
    const contact = await prisma.crmContact.upsert({
      where: { crmId },
      update: {},
      create: {
        crmId,
        firstName: name,
        lastName: "",
        email: `cliente@udg.com`,
      },
    });

    // URL base del portal (enlace principal y enlace del relacionado)
    const host = request.headers.get("host") || "debida-diligencia.duckdns.org";
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

    // 3. Si es jurídica: expediente de Persona Natural (Representante Legal)
    // enlazado en ambos sentidos por DD_relacionado, con el mismo socio.
    let related: { crmId: string; clientUrl: string | null } | null = null;
    if (!isNatural) {
      try {
        related = await prepararExpedienteRelacionado({
          juridicaCrmId: crmId,
          clientName: name,
          projectName,
          appUrl,
          socioId,
          overRideName: `Representante Legal ${name}`,
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
      draftData: {
        crmContactId: crmId,
        nombreProyecto: projectName,
        ...(isNatural ? { firstName: "", lastName: "", email: "" } : { razonSocial: name }),
      },
    });

    // 5. Enlace en Zoho CRM
    try {
      await zoho.service.updateClientFormLink(crmId, "Debida_Diligencia", clientUrl, expiresAt, "Activo");
      await zoho.service.createNote(
        crmId,
        `Enlace Generado (${isNatural ? "Persona Natural" : "Persona Jurídica"})`,
        `Se ha generado un nuevo expediente con su enlace de acceso.\n\n` +
        `Tipo de Formulario: ${isNatural ? "Persona Natural" : "Persona Jurídica"}\n` +
        `Enlace del Formulario: ${clientUrl}\n` +
        `Vigencia del Enlace: ${expiresAt.toLocaleString()}\n` +
        `Estado del Enlace: Activo\n` +
        (related
          ? `Expediente Relacionado (Persona Natural): ${related.crmId}\n` +
            (related.clientUrl ? `Enlace del Relacionado: ${related.clientUrl}\n` : "")
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
        name,
        socioId,
        ...(related ? { relatedCrmId: related.crmId, relatedClientUrl: related.clientUrl } : {}),
      },
    });

    return NextResponse.json(
      {
        success: true,
        status: "success",
        message: `¡Expediente de ${isNatural ? "Persona Natural" : "Persona Jurídica"} generado exitosamente!`,
        crmId,
        clientUrl,
        expiresAt,
        ...(related ? { relatedCrmId: related.crmId, relatedClientUrl: related.clientUrl } : {}),
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error("[API Generar Expediente Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error interno del servidor" },
      { status: 500, headers: corsHeaders }
    );
  }
}
