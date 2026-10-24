import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logAuditEvent } from "@/lib/auditService";
import { zoho } from "@/lib/zohoService";
import { expedienteRetirado, MENSAJE_RETIRADO } from "@/lib/ddRetireService";
import { crearEnlaceConBorrador } from "@/lib/enlaceService";
import { describirEnlaces, enlacesDeContactos } from "@/lib/contactLinkService";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * Contactos del Socio de Negocio del expediente y los atados a él (Contacts.Debida_Diligencia)
 * que no aparecen en `contactLinks`. Nunca lanza: si Zoho falla, solo no se listan.
 */
async function contactosSinEnlace(crmId: string, contactLinks: Array<{ contactId: string | null }>) {
  const conEnlace = new Set(contactLinks.map((l) => l.contactId).filter(Boolean));
  const porId = new Map<string, { contactId: string; name: string; estandar: boolean }>();
  const agregar = (c: { id: string; firstName: string; lastName: string; estandar?: boolean }) => {
    if (!c.id || conEnlace.has(c.id) || porId.has(c.id)) return;
    porId.set(c.id, { contactId: c.id, name: `${c.firstName} ${c.lastName}`.trim(), estandar: !!c.estandar });
  };

  try {
    const dd = await zoho.service.getDDRecord(crmId);
    const socio = dd?.Socio_de_Negocios ?? dd?.Socio_de_Negocio;
    const socioId = String((socio && typeof socio === "object" ? socio.id : socio) ?? "").trim();
    if (socioId) (await zoho.service.searchAccountContacts(socioId)).forEach(agregar);
    (await zoho.service.searchContactsByDD(crmId)).forEach(agregar);
  } catch (err) {
    console.warn(`[API Generar Adicional GET] No se pudieron leer los contactos de Zoho del expediente ${crmId}:`, err);
  }
  return [...porId.values()];
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * Sin parámetros: health check.
 *
 * Con ?crmId=<ID del expediente en Zoho> (también ddId / debidaId): lista los
 * enlaces del expediente en dos secciones (ver LinkRole):
 *
 * - contactLinks ("Enlaces de Contactos"): el enlace PRINCIPAL (contacto estándar,
 *   vinculado al registro de Zoho) y uno RELATED por cada otro contacto del Socio
 *   de Negocio, con `role` y `contactId` (Contact de Zoho). Los RELATED se
 *   reactivan / dan de baja por su `token`; el PRINCIPAL, como el expediente (sin token).
 * - links ("Enlaces adicionales"): un elemento por enlace adicional generado (borrador + token), con
 *   `linkStatus` ("Activo" | "Vencido" | "Utilizado" | "Anulado") y `expiresAt` (vigencia).
 *   "Utilizado" = el token se consumió (formulario enviado) o fue revocado.
 * - forms: formularios adicionales ya enviados; `tokenUuid` es el enlace con el que
 *   se enviaron (el mismo `token` de links) y es lo que /api/reactivar recibe.
 * - contactsWithoutLink: contactos del Socio de Negocio y los atados al expediente (Zoho)
 *   que aún no tienen enlace, para que el widget los muestre ("enlace no creado") y deje
 *   cambiar su nivel de riesgo.
 *
 * Un expediente que el portal no conoce (o eliminado) no es un error: responde 200 con
 * listas de enlaces vacías y, si Zoho los tiene, los contactos sin enlace.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const crmId = (params.get("crmId") || params.get("ddId") || params.get("debidaId") || "").trim();

  if (!crmId) {
    return NextResponse.json(
      { message: "El endpoint de generación de expedientes adicionales está activo y listo." },
      { headers: corsHeaders }
    );
  }

  try {
    const found = await prisma.crmContact.findUnique({ where: { crmId } });
    const contact = found && !found.deletedAt ? found : null;

    const host = request.headers.get("host") || "debida-diligencia.duckdns.org";
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

    const [drafts, forms, contactLinks] = contact
      ? await Promise.all([
          prisma.draft.findMany({
            where: { crmContactId: contact.id, role: "ADITIONAL" },
            orderBy: { createdAt: "desc" },
          }),
          prisma.form.findMany({
            where: { crmContactId: contact.id, role: "ADITIONAL", deletedAt: null },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              type: true,
              status: true,
              clientName: true,
              projectName: true,
              currentVersion: true,
              tokenUuid: true,
              submittedAt: true,
              createdAt: true,
            },
          }),
          enlacesDeContactos(contact.id, appUrl),
        ])
      : [[], [], []];

    const links = await describirEnlaces(drafts, appUrl);
    const contactsWithoutLink = await contactosSinEnlace(crmId, contactLinks);

    return NextResponse.json(
      { success: true, crmId, isAditional: true, contactLinks, links, forms, contactsWithoutLink },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error("[API Generar Adicional GET Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error interno del servidor" },
      { status: 500, headers: corsHeaders }
    );
  }
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
    // Un expediente retirado (anulado) no admite adicionales nuevos: solo se reactiva
    // (se comprueba antes que deletedAt, que la anulación también marca)
    if (contact?.retiredAt) {
      return NextResponse.json(
        { success: false, error: MENSAJE_RETIRADO, code: "RETIRADO", crmId },
        { status: 409, headers: corsHeaders }
      );
    }
    if (!contact || contact.deletedAt) {
      return NextResponse.json(
        { success: false, error: `No existe un expediente ${crmId} en el portal` },
        { status: 404, headers: corsHeaders }
      );
    }
    // Zoho también lo marca (retirado / Estado "Anulado"). Solo se lee: un adicional no escribe en Zoho.
    let ddRecord: Record<string, any> | null = null;
    try {
      ddRecord = await zoho.service.getDDRecord(crmId);
    } catch (err) {
      console.warn(`[API Generar Adicional] No se pudo leer el expediente ${crmId} en Zoho; se usa solo el estado del portal:`, err);
    }
    if (expedienteRetirado(ddRecord, contact)) {
      return NextResponse.json(
        { success: false, error: MENSAJE_RETIRADO, code: "RETIRADO", crmId },
        { status: 409, headers: corsHeaders }
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
        ...(isNatural ? { firstName: name, lastName: "", email: "" } : { razonSocial: name }),
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
