import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { zoho, DD_CONTACT_FIELD } from "@/lib/zohoService";
import { logAuditEvent } from "@/lib/auditService";
import { crearEnlaceConBorrador } from "@/lib/enlaceService";
import {
  planificarEnlaces,
  generarEnlacesRelacionados,
  vincularContactosDelSocio,
  mensajeEnlaces,
  nombreDe,
} from "@/lib/enlacesSocioService";
import { expedienteRetirado, MENSAJE_RETIRADO } from "@/lib/ddRetireService";
import {
  obtenerContactosDeCuenta,
  clasificarContactosNaturales,
  clasificarExpedientesJuridica,
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

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { message: "El endpoint de generación de expedientes está activo y listo." },
    { headers: corsHeaders }
  );
}

type ClientType = "NATURAL" | "JURIDICA";

/** Valor de texto de un campo de Zoho (los lookups/picklists pueden venir como objeto). */
const texto = (v: any): string =>
  String((v && typeof v === "object" ? v.name ?? v.display_value ?? v.value : v) ?? "").trim();

/**
 * Crea el expediente de Debida_Diligencia de un Socio de Negocio (si falta) y
 * los enlaces de sus contactos sobre él. Solo se crea lo que falta (como valida
 * el widget validarDebidaDiligencia). Un Socio de Negocio tiene UN solo
 * expediente; cada enlace tiene un rol (ver LinkRole):
 *
 * - PRINCIPAL: el del expediente. Natural: el del contacto estándar
 *   (Contacto_est_ndar; debe haber exactamente uno, si no 422 CONTACTO_ESTANDAR),
 *   vinculado por Nombre_de_contacto. Jurídica: el de la empresa.
 * - RELATED: uno por cada otro contacto del socio (en la natural, todos menos el
 *   estándar; en la jurídica, todos). Al completarse solo actualizan su Contact.
 * - Jurídica: el Representante Legal (campo Representante_legal del socio) recibe
 *   un enlace RELATED SIN contacto sobre el mismo expediente: ya no se crea un
 *   expediente natural aparte. Al completarse solo escribe los campos exclusivos
 *   del representante (ver mapRepresentanteToDDPayload).
 *
 * Además cada contacto queda atado al expediente en Zoho (lookup
 * Contacts.Debida_Diligencia), también cuando ya existía todo.
 *
 * Body:
 * - name (requerido): nombre que sustituye al del Socio de Negocio en el Name
 *   del expediente ("name-unidad-proyecto"). En la natural el Name lleva el
 *   nombre del contacto estándar.
 * - type (requerido): "natural" o "juridica".
 * - socioId / recordId (requerido): Socio de Negocio (Accounts) al que se
 *   vincula; de él salen la unidad, el proyecto y la carpeta de documentos.
 * - proyecto (opcional): proyecto a usar si el Socio de Negocio no tiene uno.
 * - contactos (opcional): IDs de los Contacts de Zoho marcados en el widget: los
 *   que reciben su enlace relacionado. Sin la lista, todos los que falten.
 *
 * Respuestas:
 *   · Contactos con su propio expediente (anterior a este esquema) se respetan
 *     y no reciben enlace. Lo mismo un Representante Legal con expediente natural
 *     relacionado (DD_relacionado) de antes.
 *   · Jurídica sin Representante_legal y su enlace falta: 422 SIN_REPRESENTANTE_LEGAL.
 *   · Más de un expediente jurídico vigente: 409 DUPLICADOS.
 *   · Expediente anulado y hay enlaces por crear: 409 RETIRADO.
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
    const seleccion: string[] | null = Array.isArray(body.contactos)
      ? body.contactos.map((c: any) => String(c ?? "").trim()).filter(Boolean)
      : null;

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
    const clientType: ClientType = isNatural ? "NATURAL" : "JURIDICA";

    console.log(
      `[API Generar Expediente] Solicitud: name="${name}", tipo=${clientType}, socio=${socioId}, contactos=${seleccion ? seleccion.join(",") || "(ninguno)" : "(todos)"}`
    );

    // URL base del portal
    const host = request.headers.get("host");
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

    // ---------- 1. Validación: qué existe y qué falta (antes de crear nada) ----------

    const account = await zoho.service.getAccountRecord(socioId);

    // Contactos del socio (natural: sin contactos lanza SinContactosError) y,
    // en la natural, su contacto estándar (lanza ContactoEstandarError)
    const contactos = await obtenerContactosDeCuenta(socioId, clientType, { todos: true });
    const principal = isNatural ? contactoPrincipal(socioId, contactos) : null;
    const clasif = await clasificarContactosNaturales(socioId, contactos);

    // Expediente del socio que ya existe
    let existenteCrmId: string | null = null;
    let ddRepresentanteAnterior: string | null = null;
    if (principal) {
      existenteCrmId = clasif.existentes.find((e) => e.contact.id === principal.id)?.ddCrmId ?? null;
    } else {
      const juridica = await clasificarExpedientesJuridica(socioId);
      if (juridica.juridicas.length > 1) {
        return NextResponse.json(
          {
            success: false,
            code: "DUPLICADOS",
            error:
              `El Socio de Negocio tiene ${juridica.juridicas.length} expedientes Jurídica vigentes: ` +
              "para una Persona Jurídica solo debe existir uno.",
            juridicas: juridica.juridicas.map((d) => d.id),
          },
          { status: 409, headers: corsHeaders }
        );
      }
      existenteCrmId = juridica.juridica?.id ?? null;
      // Esquema anterior: expediente natural del Representante Legal (DD_relacionado)
      ddRepresentanteAnterior = juridica.natural?.id ?? null;
    }

    let crmContact = existenteCrmId ? await prisma.crmContact.findUnique({ where: { crmId: existenteCrmId } }) : null;

    // Qué enlaces faltan (Representante Legal y contactos relacionados)
    const plan = await planificarEnlaces({
      isNatural,
      contactos,
      principal,
      clasif,
      existenteCrmId,
      crmContact,
      ddRepresentanteAnterior,
      seleccion,
    });
    const representanteLegal = isNatural ? "" : texto(account?.Nombre_Extranjero_No_en_Peachtree);
    if (plan.faltaRepresentante && !representanteLegal) {
      return NextResponse.json(
        {
          success: false,
          code: "SIN_REPRESENTANTE_LEGAL",
          error: "El Socio de Negocio no tiene Representante Legal: complete el campo Representante legal para generar su enlace.",
          socioId,
        },
        { status: 422, headers: corsHeaders }
      );
    }

    // Contactos atados a cada expediente en Zoho (Contacts.Debida_Diligencia)
    const vincularContactos = (ddCrmId: string) => vincularContactosDelSocio({ ddCrmId, plan, contactos, principal });
    const extra = plan.extra;

    // Nada que crear
    if (existenteCrmId && !plan.faltaRepresentante && !plan.porRelacionar.length) {
      if (seleccion && plan.pendientes.length) {
        return NextResponse.json(
          {
            success: false,
            code: "SIN_SELECCION",
            error: "No se seleccionó ningún contacto pendiente de su enlace de Debida Diligencia.",
            ...extra,
          },
          { status: 400, headers: corsHeaders }
        );
      }
      const contactosVinculados = await vincularContactos(existenteCrmId);
      return NextResponse.json(
        {
          success: true,
          status: "already_exists",
          message: isNatural
            ? "El expediente principal ya existe y todos los contactos del Socio de Negocio tienen su enlace."
            : "El expediente jurídico ya existe, con el enlace del Representante Legal y de todos los contactos.",
          crmId: existenteCrmId,
          contactosVinculados,
          ...extra,
        },
        { headers: corsHeaders }
      );
    }

    // Expediente existente: no admite enlaces nuevos si está anulado
    if (existenteCrmId) {
      let ddRecord: Record<string, any> | null = null;
      try {
        ddRecord = await zoho.service.getDDRecord(existenteCrmId);
      } catch (err) {
        console.warn(`[API Generar Expediente] No se pudo leer el expediente ${existenteCrmId} en Zoho; se usa solo el estado del portal:`, err);
      }
      if (expedienteRetirado(ddRecord, crmContact)) {
        return NextResponse.json(
          { success: false, code: "RETIRADO", error: MENSAJE_RETIRADO, crmId: existenteCrmId, ...extra },
          { status: 409, headers: corsHeaders }
        );
      }
    }

    // ---------- 2. Creación ----------

    const Unidad = account?.Unidad_Vendida1;
    const esNatural = isNatural;

    /** Registro en Zoho, contacto local, enlace PRINCIPAL y nota. */
    async function generarExpediente(accountContact: AccountContactRow | null, nombre: string) {
      // 1. Registro en Zoho CRM con el Name "nombre-unidad-proyecto"
      const created = await zoho.service.createDebidaDiligenciaRecord({
        accountCrmId: socioId,
        clientType,
        name: nombre,
        unidad: Unidad,
        projectName,
        overRideName: nombre,
        contactCrmId: accountContact?.crmId,
        ...(esNatural ? {} : { razonSocial: name, nombreNatural: representanteLegal }),
      });
      if (!created.debidaId) throw new Error("Zoho CRM no devolvió el ID del expediente creado");
      const crmId = created.debidaId;
      console.log(`[API Generar Expediente] Expediente ${crmId} (${clientType}) creado.`);

      // 2. Contacto local, vinculado al Contact de Zoho (la jurídica no lleva)
      const contact = await prisma.crmContact.upsert({
        where: { crmId },
        update: { accountCrmId: socioId, accountContactId: accountContact?.id ?? null },
        create: {
          crmId,
          firstName: esNatural && accountContact?.firstName ? accountContact.firstName : nombre,
          lastName: esNatural && accountContact?.firstName ? accountContact.lastName : "",
          email: `cliente@udg.com`,
          accountCrmId: socioId,
          accountContactId: accountContact?.id,
        },
      });

      // 3. Token de 30 días, URL del formulario y borrador
      const { tokenUuid, clientUrl, expiresAt } = await crearEnlaceConBorrador({
        contactId: contact.id,
        crmId,
        isNatural: esNatural,
        appUrl,
        contactCrmId: accountContact?.crmId,
        draftData: {
          crmContactId: crmId,
          nombreProyecto: projectName,
          ...(esNatural ? { firstName: "", lastName: "", email: "" } : { razonSocial: name, rlNombre: representanteLegal }),
          // Contact de Zoho del expediente (lookup Nombre_de_contacto): viaja en form.data
          ...(accountContact ? { [DD_CONTACT_FIELD]: accountContact.crmId } : {}),
        },
      });

      // 4. Enlace en Zoho CRM
      try {
        await zoho.service.updateClientFormLink(crmId, "Debida_Diligencia", clientUrl, expiresAt, "Activo");
        await zoho.service.createNote(
          crmId,
          `Enlace Generado (${esNatural ? "Persona Natural" : "Persona Jurídica"})`,
          `Se ha generado un nuevo expediente con su enlace de acceso.\n\n` +
          `Tipo de Formulario: ${esNatural ? "Persona Natural" : "Persona Jurídica"}\n` +
          (accountContact ? `Contacto: ${nombreDe(accountContact)} (${accountContact.crmId})\n` : "") +
          (esNatural ? "" : `Representante Legal: ${representanteLegal}\n`) +
          `Enlace del Formulario: ${clientUrl}\n` +
          `Vigencia del Enlace: ${expiresAt.toLocaleString()}\n` +
          `Estado del Enlace: Activo\n` +
          `Timestamp: ${new Date().toLocaleString()}`
        );
      } catch (crmErr) {
        console.error(`[API Generar Expediente Warning] Error al actualizar el enlace de ${crmId}:`, crmErr);
      }

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
          ...(esNatural ? {} : { representanteLegal }),
        },
      });

      return { contact, resultado: { crmId, tipo: clientType, clientUrl, expiresAt, ...(accountContact ? { contactId: accountContact.crmId } : {}) } };
    }

    // 1. Expediente (si falta)
    let principalCreado: Awaited<ReturnType<typeof generarExpediente>>["resultado"] | null = null;
    if (!existenteCrmId) {
      const generado = await generarExpediente(principal, principal ? nombreDe(principal) || name : name);
      principalCreado = generado.resultado;
      crmContact = generado.contact;
    } else if (!crmContact) {
      // Existe en Zoho pero nunca pasó por el portal: se registra para colgarle los enlaces
      crmContact = await prisma.crmContact.create({
        data: {
          crmId: existenteCrmId,
          firstName: principal ? principal.firstName || name : name,
          lastName: principal?.lastName ?? "",
          email: `cliente@udg.com`,
          accountCrmId: socioId,
          accountContactId: principal?.id,
        },
      });
    }
    const crmId = crmContact.crmId;

    // 2. Enlaces del Representante Legal (jurídica) y de los contactos relacionados
    const generados = await generarEnlacesRelacionados({
      crmContact,
      plan,
      representanteLegal,
      principal,
      appUrl,
      projectName,
      socioId,
    });

    // 3. Contactos atados al expediente en Zoho
    const contactosVinculados = await vincularContactos(crmId);

    return NextResponse.json(
      {
        success: true,
        status: "success",
        message: mensajeEnlaces({
          principal: principalCreado ? `Expediente de ${isNatural ? "Persona Natural" : "Persona Jurídica"} generado` : undefined,
          generados,
        }),
        ...(principalCreado ?? { crmId, tipo: clientType }),
        ...(generados.representante ? { representante: generados.representante } : {}),
        ...(generados.relacionados.length ? { relacionados: generados.relacionados } : {}),
        contactosVinculados,
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
