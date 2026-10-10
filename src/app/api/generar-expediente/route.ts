import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { zoho, DD_CONTACT_FIELD, type ZohoDDResumen } from "@/lib/zohoService";
import { logAuditEvent } from "@/lib/auditService";
import { crearEnlaceConBorrador, prepararExpedienteRelacionado } from "@/lib/enlaceService";
import {
  obtenerContactosDeCuenta,
  clasificarContactosNaturales,
  clasificarExpedientesJuridica,
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
    { message: "El endpoint de generación de expedientes está activo y listo." },
    { headers: corsHeaders }
  );
}

type ClientType = "NATURAL" | "JURIDICA";

/** Valor de texto de un campo de Zoho (los lookups/picklists pueden venir como objeto). */
const texto = (v: any): string =>
  String((v && typeof v === "object" ? v.name ?? v.display_value ?? v.value : v) ?? "").trim();

/**
 * Crea los expedientes de Debida_Diligencia que le faltan a un Socio de Negocio,
 * con su enlace al formulario. Solo se crea lo que falta (como valida el widget
 * validarDebidaDiligencia).
 *
 * Body:
 * - name (requerido): nombre que sustituye al del Socio de Negocio en el Name
 *   del expediente ("name-unidad-proyecto"), para que no quede igual al socio.
 * - type (requerido): "natural" o "juridica".
 * - socioId / recordId (requerido): Socio de Negocio (Accounts) al que se
 *   vincula; de él salen la unidad, el proyecto y la carpeta de documentos.
 * - proyecto (opcional): proyecto a usar si el Socio de Negocio no tiene uno.
 * - contactos (opcional): IDs de los Contacts de Zoho del socio marcados en el
 *   widget. A cada uno (si aún no lo tiene) se le crea un expediente de Persona
 *   Natural vinculado por Nombre_de_contacto. Sin la lista: en la natural se
 *   generan todos los que falten; en la jurídica, ninguno.
 *
 * Persona Jurídica: sus dos expedientes principales son el jurídico y el natural
 * del Representante Legal (campo de texto Representante_legal del socio, que se
 * escribe en Nombre_natural de ambos), relacionados por DD_relacionado. Ninguno
 * lleva Contact: los datos del representante quedan en los campos del expediente.
 * Se buscan los vigentes (no retirados):
 *   · Falta el jurídico y/o el natural: se crea solo lo que falta, relacionado
 *     al existente. Sin Representante_legal en el socio: 422.
 *   · Existen ambos: no se crean (se asegura el DD_relacionado).
 *   · Más de un jurídico, o varios naturales sin vínculo: 409 (DUPLICADOS).
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

    // URL base del portal (enlace principal y enlace del relacionado)
    const host = request.headers.get("host") || "debida-diligencia.duckdns.org";
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

    // ---------- 1. Validación: qué existe y qué falta (antes de crear nada) ----------

    // Jurídica: expedientes principales (jurídico + Representante Legal)
    let principales: Awaited<ReturnType<typeof clasificarExpedientesJuridica>> | null = null;
    let representanteLegal = "";
    if (!isNatural) {
      principales = await clasificarExpedientesJuridica(socioId);
      if (principales.duplicados) {
        return NextResponse.json(
          {
            success: false,
            code: "DUPLICADOS",
            error:
              `El Socio de Negocio tiene ${principales.juridicas.length} expediente(s) Jurídica y ${principales.naturales.length} de Representante Legal vigentes: ` +
              "para una Persona Jurídica solo debe existir uno de cada uno.",
            juridicas: principales.juridicas.map((d) => d.id),
            naturales: principales.naturales.map((d) => d.id),
          },
          { status: 409, headers: corsHeaders }
        );
      }
      if (!principales.juridica || !principales.natural) {
        representanteLegal = texto((await zoho.service.getAccountRecord(socioId))?.Nombre_Extranjero_No_en_Peachtree);
        if (!representanteLegal) {
          return NextResponse.json(
            {
              success: false,
              code: "SIN_REPRESENTANTE_LEGAL",
              error: "El Socio de Negocio no tiene Representante Legal: complete el campo Representante legal para generar sus expedientes.",
              socioId,
            },
            { status: 422, headers: corsHeaders }
          );
        }
      }
    }

    // Contactos del socio: un expediente natural por contacto (solo los que no lo tienen)
    let clasif: ClasificacionContactos = { faltantes: [], existentes: [], eliminadosEnZoho: [] };
    if (isNatural || seleccion?.length) {
      const contactos = await obtenerContactosDeCuenta(socioId, clientType, { todos: true });
      clasif = await clasificarContactosNaturales(socioId, contactos);
    }
    const porContacto = seleccion ? clasif.faltantes.filter((c) => seleccion.includes(c.crmId)) : clasif.faltantes;
    // Marcados que no se generan: ya tienen expediente o no son contactos del socio
    const omitidos = (seleccion ?? []).filter((id) => !porContacto.some((c) => c.crmId === id));

    if (isNatural && !porContacto.length && clasif.faltantes.length) {
      return NextResponse.json(
        {
          success: false,
          code: "SIN_SELECCION",
          error: "No se seleccionó ningún contacto pendiente de Debida Diligencia.",
          ...(omitidos.length ? { contactosOmitidos: omitidos } : {}),
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // ---------- 2. Creación ----------

    async function generarExpediente(opts: {
      tipo: ClientType;
      accountContact: AccountContactRow | null;
      nombre: string;
      /** Jurídica: natural del Representante Legal que ya existe (solo se relaciona). */
      naturalExistenteId?: string;
    }) {
      const { tipo, accountContact, nombre, naturalExistenteId } = opts;
      const esNatural = tipo === "NATURAL";

      // 1. Registro en Zoho CRM con el Name "nombre-unidad-proyecto"
      const created = await zoho.service.createDebidaDiligenciaRecord({
        accountCrmId: socioId,
        clientType: tipo,
        name: nombre,
        projectName,
        overRideName: nombre,
        contactCrmId: accountContact?.crmId,
        ...(esNatural ? {} : { razonSocial: name, nombreNatural: representanteLegal }),
        ...(naturalExistenteId ? { relatedDDId: naturalExistenteId } : {}),
      });
      if (!created.debidaId) throw new Error("Zoho CRM no devolvió el ID del expediente creado");
      const crmId = created.debidaId;
      console.log(`[API Generar Expediente] Expediente ${crmId} (${tipo}) creado.`);

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

      // 3. Jurídica: expediente natural del Representante Legal, enlazado en ambos
      // sentidos por DD_relacionado. Si ya existía solo se relaciona (el jurídico ya
      // nació apuntándolo).
      let related: { crmId: string; clientUrl: string | null } | null = null;
      if (naturalExistenteId) {
        related = { crmId: naturalExistenteId, clientUrl: null };
        try {
          await zoho.service.setRelatedDD(naturalExistenteId, crmId);
        } catch (relErr) {
          console.error(`[API Generar Expediente Warning] No se pudo relacionar el natural ${naturalExistenteId} con ${crmId}:`, relErr);
        }
      } else if (!esNatural) {
        try {
          related = await prepararExpedienteRelacionado({
            juridicaCrmId: crmId,
            clientName: nombre,
            projectName,
            appUrl,
            socioId,
            overRideName: `Representante Legal (${representanteLegal})`,
            representanteLegal,
          });
        } catch (relErr) {
          console.error(`[API Generar Expediente Warning] Error al crear el expediente natural relacionado de ${crmId}:`, relErr);
        }
      }

      // 4. Token de 30 días, URL del formulario y borrador
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

      // 5. Enlace en Zoho CRM
      try {
        await zoho.service.updateClientFormLink(crmId, "Debida_Diligencia", clientUrl, expiresAt, "Activo");
        await zoho.service.createNote(
          crmId,
          `Enlace Generado (${esNatural ? "Persona Natural" : "Persona Jurídica"})`,
          `Se ha generado un nuevo expediente con su enlace de acceso.\n\n` +
          `Tipo de Formulario: ${esNatural ? "Persona Natural" : "Persona Jurídica"}\n` +
          (accountContact ? `Contacto: ${accountContact.firstName} ${accountContact.lastName} (${accountContact.crmId})\n` : "") +
          (esNatural ? "" : `Representante Legal: ${representanteLegal}\n`) +
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
          type: tipo,
          clientUrl,
          name: nombre,
          socioId,
          ...(accountContact ? { contactCrmId: accountContact.crmId } : {}),
          ...(esNatural ? {} : { representanteLegal }),
          ...(related ? { relatedCrmId: related.crmId, relatedClientUrl: related.clientUrl } : {}),
        },
      });

      return {
        crmId,
        tipo,
        clientUrl,
        expiresAt,
        ...(accountContact ? { contactId: accountContact.crmId } : {}),
        ...(related ? { relatedCrmId: related.crmId, relatedClientUrl: related.clientUrl } : {}),
      };
    }

    /** Jurídica existente sin Representante Legal: solo se crea el natural, relacionado a ella. */
    async function generarSoloRepresentante(juridica: ZohoDDResumen) {
      const related = await prepararExpedienteRelacionado({
        juridicaCrmId: juridica.id,
        clientName: name,
        projectName,
        appUrl,
        socioId,
        overRideName: `Representante Legal (${representanteLegal})`,
        representanteLegal,
        // Su DD_relacionado actual (si lo hay) está retirado: no se reutiliza
        crearNuevo: !!juridica.relatedCrmId && principales!.retirados.includes(juridica.relatedCrmId),
      });
      console.log(`[API Generar Expediente] Natural ${related.crmId} creado para el jurídico existente ${juridica.id}.`);

      try {
        await zoho.service.createNote(
          juridica.id,
          "Expediente Relacionado Generado (Persona Natural)",
          `Se ha generado el expediente del Representante Legal relacionado a este expediente.\n\n` +
          `Representante Legal: ${representanteLegal}\n` +
          `Expediente Relacionado (Persona Natural): ${related.crmId}\n` +
          (related.clientUrl ? `Enlace del Relacionado: ${related.clientUrl}\n` : "") +
          `Timestamp: ${new Date().toLocaleString()}`
        );
      } catch (crmErr) {
        console.error(`[API Generar Expediente Warning] Error al crear la nota en ${juridica.id}:`, crmErr);
      }

      await logAuditEvent({
        action: "LINK_GENERATE_ZDK",
        entityName: "CrmContact",
        entityId: related.crmId,
        details: {
          crmId: juridica.id,
          type: clientType,
          socioId,
          representanteLegal,
          relatedCrmId: related.crmId,
          relatedClientUrl: related.clientUrl,
          soloRelacionado: true,
        },
      });

      return { crmId: juridica.id, tipo: "JURIDICA" as const, relatedCrmId: related.crmId, relatedClientUrl: related.clientUrl };
    }

    const expedientes: any[] = [];
    let principalesExistentes: { crmId: string; relatedCrmId: string } | null = null;

    // Jurídica: primero los principales (jurídico + Representante Legal)
    if (principales) {
      const { juridica, natural } = principales;
      if (juridica && natural) {
        // Ambos existen: solo se asegura el vínculo en ambos sentidos
        try {
          if (juridica.relatedCrmId !== natural.id) await zoho.service.setRelatedDD(juridica.id, natural.id);
          if (natural.relatedCrmId !== juridica.id) await zoho.service.setRelatedDD(natural.id, juridica.id);
        } catch (relErr) {
          console.error(`[API Generar Expediente Warning] No se pudo relacionar ${juridica.id} con ${natural.id}:`, relErr);
        }
        principalesExistentes = { crmId: juridica.id, relatedCrmId: natural.id };
      } else if (juridica) {
        expedientes.push(await generarSoloRepresentante(juridica));
      } else {
        // Falta el jurídico (y el natural, si tampoco existe)
        expedientes.push(
          await generarExpediente({ tipo: "JURIDICA", accountContact: null, nombre: name, naturalExistenteId: natural?.id })
        );
      }
    }

    // Contactos marcados: un expediente natural cada uno, con el nombre del contacto
    for (const accountContact of porContacto) {
      expedientes.push(
        await generarExpediente({
          tipo: "NATURAL",
          accountContact,
          nombre: `${accountContact.firstName} ${accountContact.lastName}`.trim() || name,
        })
      );
    }

    // Información de lo que no se generó
    const extra = {
      ...(principalesExistentes ? { principales: principalesExistentes } : {}),
      ...(clasif.existentes.length
        ? {
            existentes: clasif.existentes.map((e) => ({ contactId: e.contact.crmId, crmId: e.ddCrmId, fuente: e.fuente })),
          }
        : {}),
      ...(omitidos.length ? { contactosOmitidos: omitidos } : {}),
      ...(clasif.eliminadosEnZoho.length
        ? { contactosEliminadosEnZoho: clasif.eliminadosEnZoho.map((c) => c.crmId) }
        : {}),
    };

    // Todo existía ya: no se crea nada
    if (expedientes.length === 0) {
      return NextResponse.json(
        {
          success: true,
          status: "already_exists",
          message: isNatural
            ? "Todos los contactos del Socio de Negocio ya tienen su expediente de Debida Diligencia."
            : "Los expedientes de Persona Jurídica y del Representante Legal ya existen, y no se seleccionó ningún contacto pendiente.",
          ...(principalesExistentes ?? {}),
          ...extra,
        },
        { headers: corsHeaders }
      );
    }

    // El primero (en la jurídica, el principal si se generó) va en la raíz como
    // siempre; con varios, además la lista completa en "expedientes".
    const [primero] = expedientes;
    const deContacto = porContacto.length;
    const mensajePrincipal = !principales || principalesExistentes
      ? ""
      : principales.juridica
        ? "Expediente del Representante Legal generado y relacionado al expediente jurídico existente"
        : "Expediente de Persona Jurídica generado";
    const mensajeContactos = deContacto
      ? `${deContacto} expediente${deContacto > 1 ? "s" : ""} de Persona Natural de contacto${deContacto > 1 ? "s" : ""} generado${deContacto > 1 ? "s" : ""}`
      : "";
    return NextResponse.json(
      {
        success: true,
        status: "success",
        message: `¡${[mensajePrincipal, mensajeContactos].filter(Boolean).join(" y ")} exitosamente!`,
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
