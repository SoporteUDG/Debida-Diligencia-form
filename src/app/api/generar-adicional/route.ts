import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logAuditEvent } from "@/lib/auditService";
import { crearEnlaceConBorrador } from "@/lib/enlaceService";

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
  return NextResponse.json(
    { message: "El endpoint de generación de expedientes adicionales está activo y listo." },
    { headers: corsHeaders }
  );
}

/**
 * Crea un borrador adicional (y, al completarse, un formulario adicional) sobre
 * un expediente de Debida_Diligencia que ya existe. A diferencia de
 * /api/generar-expediente NO crea registros en Zoho CRM ni escribe nada en él:
 * reutiliza el CrmContact local del expediente y marca el borrador y el
 * formulario con isAditional para que su información de cliente no se vincule
 * a Zoho.
 *
 * Body (mismo formato que /api/generar-expediente, más el expediente base):
 * - crmId (requerido): ID del expediente de Debida_Diligencia en Zoho; debe
 *   existir ya como CrmContact en el portal.
 * - name (requerido): nombre del cliente del expediente adicional.
 * - type (requerido): "natural" o "juridica".
 * - socioId / recordId: se acepta por compatibilidad; no se usa.
 * - proyecto (opcional): nombre del proyecto.
 */
export async function POST(request: NextRequest) {
  try {
    let body: any = {};
    try {
      body = JSON.parse(await request.text());
    } catch (e) {
      // Ignorar si no es JSON válido
    }

    const crmId = (body.crmId || body.ddId || body.debidaId || "").toString().trim();
    const name = (body.name ?? "").toString().trim();
    const type = (body.type ?? "").toString().trim().toLowerCase();
    const projectName = (body.proyecto || body.projectName || "").toString().trim() || undefined;

    if (!crmId) {
      return NextResponse.json(
        { success: false, error: "El ID del expediente en Zoho (crmId) es requerido" },
        { status: 400, headers: corsHeaders }
      );
    }
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

    const isNatural = !type.includes("jur");
    const clientType = isNatural ? "NATURAL" : "JURIDICA";

    const contact = await prisma.crmContact.findUnique({ where: { crmId } });
    if (!contact || contact.deletedAt) {
      return NextResponse.json(
        { success: false, error: `No existe un expediente ${crmId} en el portal` },
        { status: 404, headers: corsHeaders }
      );
    }

    console.log(`[API Generar Adicional] Solicitud: crmId=${crmId}, name="${name}", tipo=${clientType}`);

    const host = request.headers.get("host") || "debida-diligencia.duckdns.org";
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

    // Token de 30 días, URL del formulario y borrador adicional (sin Zoho)
    const { tokenUuid, clientUrl, expiresAt } = await crearEnlaceConBorrador({
      contactId: contact.id,
      crmId,
      isNatural,
      appUrl,
      isAditional: true,
      draftData: {
        crmContactId: crmId,
        nombreProyecto: projectName,
        ...(isNatural ? { firstName: "", lastName: "", email: "" } : { razonSocial: name }),
      },
    });

    await logAuditEvent({
      action: "LINK_GENERATE_ADITIONAL",
      entityName: "Token",
      entityId: tokenUuid,
      details: { crmId, type: clientType, clientUrl, name },
    });

    return NextResponse.json(
      {
        success: true,
        status: "success",
        message: `¡Expediente adicional de ${isNatural ? "Persona Natural" : "Persona Jurídica"} generado exitosamente!`,
        crmId,
        clientUrl,
        expiresAt,
        isAditional: true,
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error("[API Generar Adicional Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error interno del servidor" },
      { status: 500, headers: corsHeaders }
    );
  }
}
