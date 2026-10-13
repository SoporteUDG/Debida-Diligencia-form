import PDFDocument from "pdfkit";
import { isFieldVisible, muestraBloquePep, muestraBloqueTercero } from "./conditionalFields";
import { DOCUMENT_LABELS } from "./documentFields";

/**
 * Generador único del expediente de Debida Diligencia en PDF.
 * Usa PDFKit (Node.js), sin navegador ni DOM, y devuelve un Buffer.
 *
 * Lo usan tanto el consolidado que se archiva en WorkDrive
 * (completeDossierService) como la descarga desde el portal
 * (/api/documents/expediente-pdf, que llama lib/pdfGenerator en el cliente).
 */

/** Documento adjunto tal como lo conocen Document y la vista de consulta. */
export interface PdfDocumento {
  name: string;
  fileType?: string;
  documentType?: string | null;
  personType?: string | null;
  personId?: string | null;
  status?: string | null;
}

// ===== ESTILOS =====
const NAVY = "#002b49";
const GOLD = "#c8a788";
const GRAY = "#6b7280";
const DARK = "#1f2937";
const LABEL = "#4b5563";
const LIGHT_BG = "#f3f4f6";
const BORDER = "#e5e7eb";
const OK = "#059669";
const FAIL = "#dc2626";

// Área útil de la página A4 (595.28 x 841.89 pt) con márgenes de 40 pt.
const LEFT = 40;
const RIGHT = 555;
const WIDTH = RIGHT - LEFT;
const PAGE_HEIGHT = 841.89;
const PAGE_BOTTOM = 770;
const FOOTER_Y = 800;

// ===== TEXTOS DEL FORMULARIO =====
// Copiados de src/messages/es.json para que el PDF diga lo mismo que vio el cliente.

const LEY_TITULO = "EN CUMPLIMIENTO DE LA LEY 23 DEL 27 DE ABRIL DE 2015";
const LEY_TEXTO =
  "Este formulario y la documentación solicitada constituyen los requisitos legales mínimos de debida diligencia para perfilarlo como cliente y establecer una relación comercial con nuestra empresa. Tenga en cuenta que en el proceso podríamos requerir información o documentos adicionales a los aquí presentados.";

const PREGUNTA_PROPIETARIO = "¿Es propietario, accionista o mantiene participación dentro de esta sociedad?";
const PREGUNTA_FONDOS_SOCIEDAD = "¿Los fondos utilizados en la relación comercial provendrán de dicha sociedad?";
const PREGUNTA_MAS_UNIDADES = "¿Tiene previsto adquirir más de una unidad inmobiliaria durante los próximos 12 meses?";
const PREGUNTA_NOMBRE_TERCERO = "¿Está adquiriendo el bien inmueble a nombre de otra persona?";
const PREGUNTA_AML =
  "Indique si el Representante Legal, Apoderado o la Sociedad misma son o han sido objeto de investigación, indagación, condena por actividad ilícita, delitos de blanqueo de capitales o financiamiento de terrorismo, fraude o corrupción pública o algunos de los delitos establecidos en el ART.254-A del código penal.";
const PREGUNTA_PEP =
  "¿Alguna de las personas naturales mencionadas anteriormente en este formulario desempeña, o ha desempeñado en los últimos 2 años, algún cargo público que la catalogue como Persona Expuesta Políticamente (PEP) según el artículo 4, numeral 18, de la Ley 23 de 2015? Asimismo, ¿es cónyuge, mantiene un parentesco dentro del segundo grado de consanguinidad o primero de afinidad, o tiene una relación estrecha con una PEP?";

const pepDefinicion = (persona: string) =>
  `La legislación de Panamá define como Persona Políticamente Expuesta (PEP) a toda persona ${persona} nacional o extranjera que desempeñe o haya desempeñado funciones públicas de alto nivel o con mando y jurisdicción en un Estado, como son: Los Jefes de Estado o de un gobierno; políticos de alto perfil; funcionarios gubernamentales, judiciales o militares de alta jerarquía; los altos ejecutivos de corporaciones que pertenecen al Estado; los funcionarios públicos que ocupen cargos de elección popular, entre otros que ejerzan la toma de decisiones en las entidades públicas. También aquellas personas que cumplen o a quienes se les ha confiado funciones importantes por una organización internacional, como los miembros de la alta gerencia, es decir, directores, subdirectores y miembros de la junta directiva o funciones equivalentes. El concepto de PEP debe extenderse a sus familiares cercanos entendiéndose por estos el cónyuge, los padres, los hermanos y los hijos del PEP; y a sus estrechos colaboradores, entendiéndose por estos, las personas conocidas por su íntima relación con respecto al PEP, incluyendo a quienes están en posición de realizar transacciones financieras, comerciales o de cualquier naturaleza, ya sea locales e internacionales, en nombre del PEP. Lo anteriormente expuesto no persigue cubrir personas de rango medio o más bajo que las categorías señaladas.`;
const PEP_DEFINICION_NATURAL = pepDefinicion("natural");
const PEP_DEFINICION_JURIDICA = pepDefinicion("Jurídica");

/** Declaración del último paso del formulario (DeclarationStep / SignatureStep). */
const DECLARACION: { texto: string; titulo?: boolean; sangria?: boolean }[] = [
  { texto: "Declaro de manera voluntaria, libre de cualquier error, fuerza o dolo que todas las afirmaciones y respuestas que he manifestado en este documento son correctas, veraces, completas y autorizo a URBAN DEVELOPMENT GROUP a verificar toda la información detallada. Además, me obligo a informar a URBAN DEVELOPMENT GROUP de cualquier cambio o actualización de información que pueda afectar las afirmaciones y respuestas anotadas en este formulario:" },
  { sangria: true, texto: "1. Declaro y certifico que toda la información brindada en este formulario es correcta, verdadera y que las fotocopias de pasaportes, documentos de identidad personal y otros documentos requeridos en esta solicitud son verdaderos." },
  { sangria: true, texto: "2. Declara el firmante que acepta que nuestra empresa puede verificar la información proporcionada en este formulario, en cualquier momento de la relación comercial." },
  { sangria: true, texto: "3. Declara el firmante que, de acuerdo con lo dispuesto en la Ley 23 del 27 de abril de 2015 y sus reglamentaciones, emitidas por la Superintendencia de Sujetos no Financieros, nuestra empresa solicitará la actualización de esta información anualmente, mientras dure la relación comercial." },
  { sangria: true, texto: "4. Declara el firmante que no ha estado involucrado o no ha sido condenado en Panamá, ni en ningún otro país por la comisión de delitos relacionados al lavado de dinero, tráfico de drogas, terrorismo, fraude o delitos de cualquier naturaleza." },
  { sangria: true, texto: "5. Declara el firmante que los servicios o bienes solicitados a nuestra empresa solo serán utilizados para fines lícitos." },
  { sangria: true, texto: "6. Declara el firmante que reconoce que esta empresa está autorizada a suministrar cualquier información requerida por la Autoridad Competente." },
  { sangria: true, texto: "7. Declara el firmante que exonera a nuestra empresa de cualquier responsabilidad en caso de que una Autoridad competente nos requiera información relacionada con la relación comercial." },
  { sangria: true, texto: "8. Declara el firmante que se compromete a informar a nuestra empresa de cualquier cambio de la información suministrada en el formulario. URBAN DEVELOPMENT GROUP y sus empresas asociadas, de ahora en adelante denominadas El Grupo, manejará los datos personales proporcionados por usted a través de la página web, formularios digitales o físicos, correos electrónicos, aplicaciones móviles o cualquier medio en el cual usted proporcionen sus datos conforme a lo siguiente:" },
  { titulo: true, texto: "a) FINALIDAD DEL TRATAMIENTO DE DATOS PERSONALES:" },
  { sangria: true, texto: "Que mis datos personales serán tratados por UDG, para las siguientes finalidades: a) Remisión de información referente a nuestros proyectos; el trámite de mi solicitud de vinculación como contraparte contractual ii) el proceso de negociación del contrato de compra, iii) la ejecución y el cumplimiento de los contratos que celebre, iv) el control y la prevención del fraude, v) relación con el banco del CLIENTE vi) Efectuar las gestiones pertinentes para el desarrollo del objeto social y actividades empresariales de EL CLIENTE, así como para el giro de sus negocios, proyectos, campañas, contacto, información, ventas, ofertas, e iniciativas de innovación, entre otras;" },
  { sangria: true, texto: "(b) Efectuar las gestiones pertinentes para permitir la completa ejecución de los procesos y deberes precontractuales, contractuales y post contractuales con EL CLIENTE, respecto de cualquiera de los productos, servicios u obligaciones ofrecidos por UDG, que haya o no adquirido, o respecto de cualquier relación negoció subyacente que tenga con ella, incluyendo cobros prejudiciales y judiciales;" },
  { sangria: true, texto: "(c) Realizar campañas, concursos, evaluaciones de calidad de servicios, encuestas de satisfacción, comunicaciones y envío de información al titular relativa a eventos, productos, servicios, ofertas, promociones, publicidad, mercadeo, alianzas, concursos, de desarrollo de servicios, comerciales y contenidos propios, de terceros y/o de sus aliados comerciales, directamente o a través de terceros;" },
  { sangria: true, texto: "(d) Implementar estrategias de relacionamiento con clientes, proveedores, accionistas y otros terceros con los cuales UDG tenga relaciones contractuales o legales;" },
  { sangria: true, texto: "(e) Invitar a eventos, ofertar nuevos productos, y la realización de todas aquellas actividades asociadas a la relación comercial o vínculo existente con UDG o aquel que llegare a tener;" },
  { sangria: true, texto: "(f) Acceder, consultar, comparar, evaluar y reportar toda la información que sobre EL CLIENTE que se encuentre almacenada en las bases de datos de cualquier central de riesgo crediticio, financiero, de antecedentes judiciales o de seguridad, de naturaleza estatal o privada, nacional o extranjera, o cualquier base de datos comercial o de servicios, que permita establecer de manera integral e histórica completa, el comportamiento que como deudor, usuario, cliente, garante, endosante, afiliado, beneficiario, suscriptor, contribuyente, empleado, contratista y/o como titular de servicios financieros, comerciales o de cualquier otra índole, así como listas y bases de datos nacionales e internacionales, propias y de terceros, para la prevención de actividades ilícitas como el lavado de activos y la financiación del terrorismo. Todo lo anterior se realizará en beneficio propio o de terceros aliados;" },
  { sangria: true, texto: "(g) Responder requerimientos judiciales o administrativos y el cumplimiento de mandatos judiciales o legales;" },
  { sangria: true, texto: "(i) Controlar el acceso a las instalaciones, establecer medidas de seguridad, incluyendo la videovigilancia y la grabación de circuito cerrado de televisión y medidas de bioseguridad obligatorias, para proteger la integridad y seguridad de las personas y bienes, el cumplimiento de horarios y obligaciones laborales, entre otros. Estos datos son aquellos: (i) recolectados directamente en las garitas, puntos de seguridad y de atención, (ii) tomados de los documentos que suministran las personas al personal de seguridad y (iii) obtenidos de las videograbaciones que se realizan." },
  { texto: "Declaro de manera voluntaria, libre de cualquier error, fuerza o dolo que todas las afirmaciones y respuestas que he manifestado en este documento son correctas, veraces, completas y autorizo a La Empresa., a verificar toda la información detallada. Además, me obligo a informar a La Empresa, de cualquier cambio o actualización de información que pueda afectar las afirmaciones y respuestas anotadas en este formulario, en un término no mayor a 30 días." },
];

const CASILLA_TERMINOS =
  "Doy consentimiento legal expreso, certifico que la información declarada es verídica e íntegra, y autorizo el análisis conforme a la Ley de Prevención de Capitales.";
const CASILLA_FIRMA =
  "Confirmo que los datos son correctos, acepto la validez de mi firma digital en este acto y me comprometo a proporcionar mi firma física cuando sea requerida.";

export async function generateServerPDF(
  type: "NATURAL" | "JURIDICA",
  data: any,
  formId: string,
  /** Fecha del expediente, o el texto ya formateado que se debe imprimir. */
  submittedAt: Date | string,
  documents?: PdfDocumento[],
  /** Versión del expediente que se está imprimiendo (FormVersion.version). */
  version?: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      data = data || {};
      const doc = new PDFDocument({
        size: "A4",
        // El margen inferior coincide con PAGE_BOTTOM: si un texto largo se parte
        // solo, PDFKit cambia de página antes de llegar al pie, no encima de él.
        margins: { top: 40, bottom: PAGE_HEIGHT - PAGE_BOTTOM, left: LEFT, right: 40 },
        bufferPages: true,
        info: {
          Title: `Expediente Debida Diligencia - ${formId}${version ? ` (v${version})` : ""}`,
          Author: "Urban Development Group",
          Subject: "Formulario de Debida Diligencia",
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const isNatural = type === "NATURAL";
      const vista = isNatural ? "natural" : "juridica";
      const clientName = isNatural
        ? `${data.firstName || ""} ${data.lastName || ""}`.trim() || "Cliente Natural"
        : data.razonSocial || "Empresa Registrada";
      const dateStr =
        typeof submittedAt === "string"
          ? submittedAt
          : submittedAt.toLocaleDateString("es-PA", { year: "numeric", month: "long", day: "numeric" });

      // ===== HEADER =====
      doc.fontSize(18).fillColor(NAVY).font("Helvetica-Bold")
        .text("URBAN DEVELOPMENT GROUP", LEFT, 40, { width: 350 });
      doc.fontSize(9).fillColor(GOLD).font("Helvetica-Bold")
        .text("EXPEDIENTE DE DEBIDA DILIGENCIA", LEFT, 62, { width: 350 });

      // ID badge, fecha y versión apiladas a la derecha
      doc.roundedRect(420, 40, 135, 20, 3).fill(NAVY);
      doc.fontSize(8).fillColor("#ffffff").font("Helvetica-Bold")
        .text(`ID: ${formId.substring(0, 18)}`, 425, 46, { width: 125, align: "center", lineBreak: false });
      doc.fontSize(8).fillColor(GRAY).font("Helvetica")
        .text(`Fecha: ${dateStr}`, 420, 65, { width: 135, align: "center" });
      let headerBottom = doc.y;
      if (version) {
        doc.fontSize(8).fillColor(NAVY).font("Helvetica-Bold")
          .text(`Versión ${version}`, 420, headerBottom + 2, { width: 135, align: "center" });
        headerBottom = doc.y;
      }

      // El divisor va siempre por debajo del bloque de la derecha: antes estaba
      // fijo en y=80 y cortaba el renglón "Versión N".
      const dividerY = Math.max(80, headerBottom + 5);
      doc.moveTo(LEFT, dividerY).lineTo(RIGHT, dividerY).strokeColor(NAVY).lineWidth(2).stroke();

      // ===== LEY 23 (mismo aviso que la pantalla de políticas del formulario) =====
      let y = drawLeyBlock(doc, dividerY + 10);

      // ===== INFO BLOCK =====
      // El recuadro se mide antes de pintarlo: un valor largo (p. ej. varios
      // medios de pago) lo agranda en lugar de salirse por debajo.
      const filasInfo: [string, string, string, string][] = [
        ["Cliente:", clientName, "Proyecto:", data.nombreProyecto || "General UDG"],
        ["Tipo:", `Persona ${isNatural ? "Natural" : "Jurídica"}`, "Medio de Pago:", data.medioPago || "-"],
      ];
      const altosInfo = filasInfo.map((f) => altoInfoRow(doc, ...f));
      const altoInfo = 16 + altosInfo.reduce((a, b) => a + b, 0) + 3 * (filasInfo.length - 1);
      doc.rect(LEFT, y, WIDTH, altoInfo).fill(LIGHT_BG);
      doc.moveTo(LEFT, y).lineTo(LEFT, y + altoInfo).strokeColor(GOLD).lineWidth(3).stroke();

      let yInfo = y + 8;
      filasInfo.forEach((f, i) => {
        drawRow(doc, 48, yInfo, ...f);
        yInfo += altosInfo[i] + 3;
      });

      y += altoInfo + 12;

      const medioContacto = [
        data.formaContacto || "-",
        isFieldVisible(vista, "formaContactoDetalle", data) && data.formaContactoDetalle ? `(${data.formaContactoDetalle})` : "",
        isFieldVisible(vista, "referidoPor", data) && data.referidoPor ? `(Referido por: ${data.referidoPor})` : "",
      ].filter(Boolean).join(" ");

      // ===== DYNAMIC SECTIONS =====
      if (isNatural) {
        y = drawSectionTitle(doc, y, "1. Información del Solicitante");
        y = drawField(doc, y, "Nombre Completo", `${data.firstName || ""} ${data.lastName || ""}`);
        y = drawFieldRow(doc, y, "Estado Civil", data.estadoCivil || "-", "Identificación", `${data.tipoIdentificacion || "Cédula"}: ${data.idNumber || "-"}`);
        y = drawFieldRow(doc, y, "Fecha Nacimiento", data.fechaNacimiento || "-", "Vencimiento ID", vencimientoId(data.fechaVencimientoId));
        y = drawFieldRow(doc, y, "País Nacimiento", data.paisNacimiento || "-", "País Residencia Fiscal", data.paisResidenciaFiscal || "-");
        y = drawFieldRow(doc, y, "Nacionalidad", data.nationality || "-", "Otra Nacionalidad", data.otraNacionalidad || "-");
        y = drawField(doc, y, "Estatus Migratorio", data.estatusMigratorio || "-");
        y = drawFieldRow(doc, y, "Correo Electrónico", data.email || "-", "Teléfono / Celular", `${telefono(data.telefonoCodigo, data.telefono)} / ${telefono(data.celularCodigo, data.celular)}`);
        y = drawField(doc, y, "Dirección Residencial", direccion(data.direccionResidencial));
        y = drawField(doc, y, "Ubicación", direccion(data.ciudad, data.provinciaEstado, data.paisResidencial));
        y = drawField(doc, y, "Medio de Contacto", medioContacto);

        y += 5;
        y = checkPageBreak(doc, y, 80);
        y = drawSectionTitle(doc, y, "2. Datos Laborales");
        y = drawFieldRow(doc, y, "Profesión / Ocupación", conOtros(data.profession, data.profesionOtros), "Jurisdicción Donde Opera", data.paisActividadLaboral || "-");
        y = drawFieldRow(doc, y, "Patrono / Empleador", data.employer || "-", "Actividad del Patrono", conOtros(data.actividadLaboral, data.actividadLaboralOtros));
        y = drawFieldRow(doc, y, "Dirección Laboral", data.direccionLaboral || "-", "Cargo en la Entidad", data.cargoDesempena || "-");
        y = drawQuestion(doc, y, PREGUNTA_PROPIETARIO, data.esPropietario || "-");
        if (isFieldVisible("natural", "usaFondos", data)) {
          y = drawQuestion(doc, y, PREGUNTA_FONDOS_SOCIEDAD, data.usaFondos || "-");
        }

        y += 5;
        y = checkPageBreak(doc, y, 100);
        y = drawSectionTitle(doc, y, "3. Perfil Financiero y Origen de Fondos");
        y = drawFieldRow(doc, y, "Act. Económica Principal", conOtros(data.actEconPrincipal, data.otroActEcon), "% Dedicación", `${data.pctDedicacionPrincipal || "100"}%`);
        y = drawField(doc, y, "Jurisdicción Principal", data.jurisdiccionPrincipal || "-");
        if (data.actEconSecundaria) {
          y = drawFieldRow(doc, y, "Otra Actividad Económica", data.actEconSecundaria, "% Dedicación", `${data.pctDedicacionSecundaria || "0"}%`);
          y = drawField(doc, y, "Jurisdicción de Otra Actividad", data.jurisdiccionSecundaria || "-");
        }
        y = drawFieldRow(doc, y, "Ingresos Mensuales Promedio",`B/.${data.ingresosMensuales}`|| "-", "Fuente de Fondos", data.fuenteFondosInmueble || "-");
        y = drawField(doc, y, "Medio de Pago", data.medioPago || "-");
        // El detalle de "Otros" acompaña a la categoría, no la reemplaza.
        if (isFieldVisible("natural", "ifOtroNombre", data)) {
          y = checkPageBreak(doc, y, 30);
          y = drawField(doc, y, "Otra Fuente (detalle)", data.ifOtroNombre || "-");
        }
        if (muestraBloqueTercero("natural", data)) {
          y = checkPageBreak(doc, y, 30);
          y = drawField(
            doc, y, "Aportante Tercero",
            `Nombre: ${data.ifTerceroNombre || "-"} | Nac: ${data.ifTerceroNacionalidad || "-"} | Fuente: ${data.ifTerceroFuenteDeIngresos || "-"} | Relación: ${data.ifTerceroRelacion || "-"}`
          );
        }
        y = drawQuestion(doc, y, PREGUNTA_MAS_UNIDADES, data.montoServiciosAnuales || "No");
        if (isFieldVisible("natural", "cantidadServiciosAnuales", data) && data.cantidadServiciosAnuales) {
          y = drawField(doc, y, "Cantidad Aprox. de Unidades", String(data.cantidadServiciosAnuales));
        }
        y = drawQuestion(doc, y, PREGUNTA_NOMBRE_TERCERO, data.adquiereNombreTercero || "No");
        if (isFieldVisible("natural", "nombreTercero", data)) {
          y = drawField(doc, y, "Nombre de la Persona", data.nombreTercero || "-");
        }
        y = drawField(doc, y, "Propósito del Inmueble", data.destinoInmueble || "-");

        y = drawPepSubsection(doc, y, data, PEP_DEFINICION_NATURAL);
      } else {
        // JURÍDICA
        y = drawSectionTitle(doc, y, "1. Información de la Empresa / Sociedad");
        y = drawFieldRow(doc, y, "Razón Social", data.razonSocial || "-", "R.U.C. / Registro", data.numeroIdTributaria || "-");
        y = drawFieldRow(doc, y, "Tipo de Documento", data.tipoDocumentoIdentidad || "-", "Vencimiento Documento", vencimientoId(data.fechaVencimientoId));
        y = drawFieldRow(doc, y, "Fecha Constitución", data.fechaConstitucion || "-", "País de Inscripción", data.paisInscripcion || "-");
        y = drawFieldRow(doc, y, "País donde Opera", data.paisOpera || "-", "Tipo de Cliente", data.tipoCliente || "-");
        y = drawFieldRow(doc, y, "Tipo de Sociedad", data.tipoSociedad || "-", "Estado de la Sociedad", data.estadoSociedad || "-");
        y = drawFieldRow(doc, y, "Actividad Principal", `${data.actividadPrincipal || "-"}`, "País Tributación", data.paisTributacion || "-");
        y = drawField(doc, y, "Correo Empresa", data.empresaEmail || "-");
        y = drawFieldRow(doc, y, "Teléfono Oficina", telefono(data.empresaTelefonoCodigo, data.empresaTelefono), "Celular Contacto", telefono(data.empresaCelularCodigo, data.empresaCelular));
        y = drawField(doc, y, "Dirección Oficina", direccion(data.empresaDireccion));
        y = drawField(doc, y, "Ubicación", direccion(data.empresaCiudad, data.empresaProvincia, data.empresaPais));
        y = drawField(doc, y, "Medio de Contacto", medioContacto);

        y += 5;
        y = checkPageBreak(doc, y, 100);
        y = drawSectionTitle(doc, y, "2. Representante Legal");
        y = drawFieldRow(doc, y, "Nombre Completo", data.rlNombre || "-", "Identificación", data.rlNoIdentificacion || "-");
        y = drawFieldRow(doc, y, "Nacionalidad", data.rlNacionalidad || "-", "Fecha Nacimiento", data.rlFechaNacimiento || "-");
        y = drawFieldRow(doc, y, "Estado Civil", data.rlEstadoCivil || "-", "Profesión", data.rlProfesionOcupacion || "-");
        y = drawFieldRow(doc, y, "Actividad Económica", data.rlActividadEconomica || "-", "Teléfono", data.rlTelefono || "-");
        y = drawField(doc, y, "País Residencia", data.rlPaisResidencia || "-");
        y = drawField(doc, y, "Dirección", data.rlDireccion || "-");

        // Pregunta legal AML: subsección sin número, con el texto del formulario.
        y += 4;
        y = drawSubsectionTitle(doc, y, "Pregunta Legal AML");
        y = drawQuestion(doc, y, PREGUNTA_AML, data.rlObjetoInvestigacion || "-");

        y += 5;
        y = checkPageBreak(doc, y, 100);
        y = drawSectionTitle(doc, y, "3. Representante Operativo");
        y = drawFieldRow(doc, y, "Nombre Completo", `${data.contactoNombre || ""} ${data.contactoApellido || ""}`.trim() || "-", "Identificación", data.contactoId || "-");
        // Sin cargo declarado ("No") no hay cargo que mostrar; formularios viejos pueden no traer ifContacto.
        const sinCargo = String(data.ifContacto || "").trim().toLowerCase() === "no";
        y = drawFieldRow(doc, y, "Cargo en la Sociedad", sinCargo ? "No" : data.contactoCargo || "-", "Teléfono", data.contactoTelefono || "-");
        y = drawField(doc, y, "Correo Electrónico", data.contactoEmail || "-");

        // Junta Directiva
        y += 5;
        y = checkPageBreak(doc, y, 80);
        y = drawSectionTitle(doc, y, "4. Gobierno Corporativo / Junta Directiva");
        const gjc = Array.isArray(data.gjcMembers) ? data.gjcMembers : [];
        if (gjc.length > 0) {
          const cols = [0.18, 0.28, 0.18, 0.18, 0.18];
          y = drawTableHeader(doc, y, ["Cargo", "Nombre y Apellidos", "Identificación", "Nacionalidad", "Fecha Nacimiento"], cols);
          for (const m of gjc) {
            y = drawTableRow(
              doc, y,
              [m.cargo || "-", nombreGjc(m), m.nroId || "-", m.nacionalidad || "-", m.fechaNacimiento || "-"],
              cols,
              { label: "Dirección", value: m.direccion || "-" }
            );
          }
        } else {
          y = drawEmpty(doc, y, "Ningún miembro registrado en la Junta Directiva.");
        }

        // Beneficiarios Finales
        y += 5;
        y = checkPageBreak(doc, y, 80);
        y = drawSectionTitle(doc, y, "5. Beneficiarios Finales (>10% Participación)");
        const bf = Array.isArray(data.bfMembers) ? data.bfMembers : [];
        if (bf.length > 0) {
          const cols = [0.24, 0.16, 0.15, 0.15, 0.16, 0.14];
          y = drawTableHeader(doc, y, ["Nombre Completo", "Identificación", "Nacionalidad", "País Nacimiento", "Fecha Adquisición", "% Particip."], cols);
          for (const m of bf) {
            const pct = m.porcentajeParticipacion || m.porcentaje;
            y = drawTableRow(
              doc, y,
              [
                m.nombreCompleto || "-",
                m.noIdentificacion || "-",
                m.nacionalidad || "-",
                m.paisNacimiento || "-",
                m.fechaAdquisicion || "-",
                pct ? `${pct}%` : "-",
              ],
              cols,
              { label: "Dirección", value: m.direccion || "-" }
            );
          }
        } else {
          y = drawEmpty(doc, y, "Ningún beneficiario final registrado.");
        }

        // Perfil Financiero Empresa
        y += 5;
        y = checkPageBreak(doc, y, 80);
        y = drawSectionTitle(doc, y, "6. Perfil Financiero y de Cumplimiento");
        y = drawField(doc, y, "Ingresos Mensuales", `B/.${data.ingresosMensuales}` || "-");
        y = drawFieldRow(doc, y, "Medio de Pago", data.medioPago || "-", "Fondos de Adquisición", data.fuenteFondosInmueble || "-");
        if (muestraBloqueTercero("juridica", data)) {
          y = drawField(doc, y, "Aportante Tercero", `Nombre: ${data.terceroNombre || "-"} | Nac: ${data.terceroNacionalidad || "-"} | Vínculo: ${data.terceroVinculo || "-"} | Fuente: ${data.terceroFuenteFondos || "-"}`);
        }
        y = drawQuestion(doc, y, PREGUNTA_MAS_UNIDADES, data.adquiereMasUnidades || "No");
        if (isFieldVisible("juridica", "cantidadUnidadesInmobiliarias", data) && data.cantidadUnidadesInmobiliarias) {
          y = drawField(doc, y, "Cantidad Aprox. de Unidades", String(data.cantidadUnidadesInmobiliarias));
        }

        y = drawPepSubsection(doc, y, data, PEP_DEFINICION_JURIDICA);
      }

      // ===== DOCUMENTS SECTION =====
      // Continúa en la misma página si cabe el título, la cabecera de la tabla y
      // al menos la primera fila; si no, pasa entero a la página siguiente.
      y += 5;
      y = checkPageBreak(doc, y, 70);
      y = drawSectionTitle(doc, y, "Documentos Adjuntados y Verificados");

      const requisitos = requisitosDocumentales(type, data, documents || []);
      const cols = [0.45, 0.12, 0.43];
      const encabezados = ["Requisito Documental", "Adjuntado", "Nombre de Archivo"];
      y = drawTableHeader(doc, y, encabezados, cols);
      for (const req of requisitos) {
        y = drawDocumentRow(doc, y, req, cols, encabezados);
      }

      // ===== CONCLUSIONS =====
      // Título y texto se miden juntos para no dejar el título solo al pie.
      const conclusiones = data.conclusionesVerificacion || "Registro formalizado y archivado satisfactoriamente por el oficial de cumplimiento.";
      const altoConclusiones = doc.fontSize(8).font("Helvetica").heightOfString(conclusiones, { width: 500 });
      y += 10;
      y = checkPageBreak(doc, y, Math.min(altoConclusiones, PAGE_BOTTOM - 40 - 30) + 30);
      y = drawSectionTitle(doc, y, "Conclusiones de Cumplimiento (Solo Oficial de Cumplimiento)");
      doc.fontSize(8).fillColor(DARK).font("Helvetica").text(conclusiones, 48, y, { width: 500 });

      // ===== FIRMA Y DECLARACIÓN DEL CLIENTE =====
      // Página propia: la declaración completa del último paso del formulario,
      // las casillas aceptadas y el recuadro de firma, todo en una sola hoja.
      const SIG_H = 90;
      y = forcePageBreak(doc);
      y = drawDeclaracion(doc, y, data, PAGE_BOTTOM - SIG_H - 8);

      const boxTop = y;
      doc.roundedRect(LEFT, boxTop, WIDTH, SIG_H, 4).lineWidth(0.8).strokeColor(BORDER).stroke();
      y += 8;
      doc.fontSize(9).fillColor(NAVY).font("Helvetica-Bold")
        .text("FIRMA ELECTRÓNICA", 48, y, { width: 500 });
      y += 15;

      // Izquierda: firmante y fecha. Derecha: recuadro con la firma.
      doc.fontSize(7).fillColor(LABEL).font("Helvetica-Bold").text("Nombre del Firmante:", 48, y);
      doc.fontSize(8).fillColor(NAVY).font("Helvetica-Bold").text(data.signerName || clientName, 48, y + 9, { width: 250 });
      doc.fontSize(7).fillColor(LABEL).font("Helvetica-Bold").text("Fecha de Firma:", 48, y + 24);
      doc.fontSize(8).fillColor(DARK).font("Helvetica").text(data.signatureDate || dateStr, 48, y + 33, { width: 250 });

      const sigX = 330;
      const sigW = 215;
      const sigY = y;
      const sigH = boxTop + SIG_H - 8 - sigY;
      doc.rect(sigX, sigY, sigW, sigH).fillAndStroke("#fafafa", "#d1d5db");
      let firmaDibujada = false;
      if (typeof data.firmaImage === "string" && data.firmaImage.startsWith("data:image")) {
        try {
          const base64Data = data.firmaImage.split(",")[1];
          if (base64Data) {
            doc.image(Buffer.from(base64Data, "base64"), sigX + 4, sigY + 3, {
              fit: [sigW - 8, sigH - 6],
              align: "center",
              valign: "center",
            });
            firmaDibujada = true;
          }
        } catch {
          // La imagen de la firma no se pudo incrustar; se deja el texto.
        }
      }
      if (!firmaDibujada) {
        doc.fontSize(8).fillColor("#9ca3af").font("Helvetica-Oblique")
          .text("Firma registrada digitalmente", sigX, sigY + sigH / 2 - 4, { width: sigW, align: "center" });
      }

      // ===== FOOTER (todas las páginas) =====
      const rango = doc.bufferedPageRange();
      for (let i = rango.start; i < rango.start + rango.count; i++) {
        doc.switchToPage(i);
        // Se escribe dentro del margen inferior: sin esto PDFKit abriría otra página.
        const margenInferior = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc.moveTo(LEFT, FOOTER_Y - 6).lineTo(RIGHT, FOOTER_Y - 6).strokeColor(BORDER).lineWidth(0.5).stroke();
        doc.fontSize(7).fillColor("#9ca3af").font("Helvetica")
          .text(
            "Documento digital seguro generado bajo normativas societarias de Urban Development Group. Confidencialidad garantizada.",
            LEFT, FOOTER_Y, { width: WIDTH - 70, lineBreak: false }
          );
        doc.text(`Página ${i - rango.start + 1} de ${rango.count}`, RIGHT - 70, FOOTER_Y, { width: 70, align: "right", lineBreak: false });
        doc.page.margins.bottom = margenInferior;
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ===== VALORES =====

/** Valor de un selector con opción "Otros" y su campo de texto. */
function conOtros(valor: unknown, otros: unknown): string {
  const v = String(valor || "").trim();
  if (v === "Otros") return String(otros || "").trim() || "Otros";
  return v || "-";
}

function telefono(codigo: unknown, numero: unknown): string {
  const n = String(numero || "").trim();
  if (!n) return "-";
  const c = String(codigo || "").trim();
  return c ? `(${c}) ${n}` : n;
}

function direccion(...partes: unknown[]): string {
  const texto = partes.map((p) => String(p || "").trim()).filter(Boolean).join(", ");
  return texto || "-";
}

/** Fecha de vencimiento con aviso si ya pasó. */
function vencimientoId(fecha: unknown): string {
  const f = String(fecha || "").trim();
  if (!f) return "No registrada";
  const d = new Date(f);
  return !isNaN(d.getTime()) && d < new Date() ? `${f} (VENCIDO)` : f;
}

/** Los miembros de gobierno corporativo se nombran con nombre + apellidos. */
function nombreGjc(m: any): string {
  return `${m?.nombre || ""} ${m?.apellidos || ""}`.trim() || "sin nombre registrado";
}

// ===== DOCUMENTOS =====

/** Etiqueta legible de cada ranura documental. */
const TITULOS_DOCUMENTO = DOCUMENT_LABELS;

/**
 * Agrupa los documentos por ranura para que los campos multi-archivo
 * (Origen de Fondos, Pacto Social, Estados de Cuenta) impriman TODOS sus
 * archivos y no sólo el primero.
 *
 * La fuente principal son las filas de Document; el `data` de la versión se usa
 * como respaldo para no perder archivos que no tengan fila asociada. Los
 * documentos por persona (RL, GJC, BF) no entran aquí: van en su propia fila.
 */
export function agruparDocumentos(
  documents: PdfDocumento[],
  data: any
): { ranura: string; titulo: string; archivos: string[] }[] {
  const porRanura = new Map<string, string[]>();

  const agregar = (ranura: string, nombre: string) => {
    if (!nombre || !nombre.trim()) return;
    const lista = porRanura.get(ranura) || [];
    if (!lista.includes(nombre)) lista.push(nombre);
    porRanura.set(ranura, lista);
  };

  for (const d of documents) {
    if (d.personType) continue;
    agregar(d.documentType || "otrosAdjuntosFile", d.name || "Documento sin nombre");
  }

  // Respaldo desde el snapshot de la versión
  for (const [campo, valor] of Object.entries(data || {})) {
    if (!(campo in TITULOS_DOCUMENTO)) continue;
    if (Array.isArray(valor)) {
      for (const v of valor) if (typeof v === "string") agregar(campo, v);
    } else if (typeof valor === "string") {
      agregar(campo, valor);
    }
  }

  return Array.from(porRanura.entries()).map(([ranura, archivos]) => ({
    ranura,
    titulo: TITULOS_DOCUMENTO[ranura] || ranura,
    archivos,
  }));
}

interface RequisitoDocumental {
  titulo: string;
  archivos: string[];
  /** Un requisito faltante opcional se marca en gris en lugar de rojo. */
  opcional?: boolean;
}

/**
 * Nombre del archivo de identidad de una persona (RL / GJC / BF).
 *
 * El borrador lo guarda en data.personDocuments, pero un expediente ya enviado
 * no lo tiene: el esquema de validación no declara ese campo y Zod lo descarta
 * al persistir el Form. Por eso se recurre a los documentos adjuntos, que sí
 * conservan personType y personId.
 */
function docIdentidad(data: any, documents: PdfDocumento[], personType: string, personId?: string): string[] {
  const coincide = (d: any) =>
    d?.personType === personType && (personId === undefined || d?.personId === personId);

  const enFormulario = Array.isArray(data.personDocuments) ? data.personDocuments : [];
  const local = enFormulario.find(coincide);
  if (local?.fileName) return [local.fileName];

  return documents
    .filter((d) => coincide(d) && d.status !== "DELETED" && d.name)
    .map((d) => d.name);
}

/** Lista de requisitos documentales del expediente, con sus archivos. */
export function requisitosDocumentales(
  type: "NATURAL" | "JURIDICA",
  data: any,
  documents: PdfDocumento[]
): RequisitoDocumental[] {
  data = data || {};
  const grupos = agruparDocumentos(documents, data);
  const usados = new Set<string>();
  const ranura = (clave: string, titulo: string, opcional = false): RequisitoDocumental => {
    usados.add(clave);
    return { titulo, archivos: grupos.find((g) => g.ranura === clave)?.archivos || [], opcional };
  };

  const requisitos: RequisitoDocumental[] = [];

  if (type === "NATURAL") {
    requisitos.push(
      ranura("idFile", "Copia del Documento de Identidad Personal (Cédula o Pasaporte)"),
      ranura("origenFondosFile", "Origen de Fondos (Carta Laboral, Declaración de Renta, etc.)"),
      ranura("hasEstadoCuenta", "Estado de Cuenta Bancario"),
      ranura("hasCertificacionBancaria", "Certificación Bancaria")
    );
  } else {
    requisitos.push({
      titulo: `Documento de Identificación del Representante Legal - ${data.rlNombre || "sin nombre registrado"}`,
      archivos: docIdentidad(data, documents, "RL"),
    });
    for (const m of Array.isArray(data.bfMembers) ? data.bfMembers : []) {
      requisitos.push({
        titulo: `Documento de Identificación de Beneficiario - ${m.nombreCompleto || "sin nombre registrado"}`,
        archivos: docIdentidad(data, documents, "BF", m.id),
      });
    }
    for (const m of Array.isArray(data.gjcMembers) ? data.gjcMembers : []) {
      requisitos.push({
        titulo: `Documento de Identificación de Miembro - ${nombreGjc(m)}`,
        archivos: docIdentidad(data, documents, "GJC", m.id),
      });
    }
    requisitos.push(
      ranura("avisoOperacionesFile", "Certificado de Aviso de Operaciones o Equivalente"),
      ranura("origenFondosFile", "Origen de Fondos", true),
      ranura("pactoSocialFile", "Copia del Pacto Social Registrado y Enmiendas"),
      ranura("certBancariaFile", "Certificación de Cuenta Bancaria o Referencia"),
      ranura("certRegistroFile", "Certificado de Registro Público"),
      ranura("certComprasFile", "Persona Autorizada de Fondos Corporativos")
    );
  }

  return requisitos;
}

// ===== HELPER FUNCTIONS =====

function checkPageBreak(doc: PDFKit.PDFDocument, y: number, needed: number): number {
  if (y + needed > PAGE_BOTTOM) {
    doc.addPage();
    return 40;
  }
  return y;
}

/** Salto de página incondicional. Devuelve la `y` inicial de la página nueva. */
function forcePageBreak(doc: PDFKit.PDFDocument): number {
  doc.addPage();
  return 40;
}

function drawSectionTitle(doc: PDFKit.PDFDocument, y: number, title: string): number {
  doc.fontSize(9).fillColor(NAVY).font("Helvetica-Bold").text(title.toUpperCase(), LEFT, y, { width: WIDTH });
  y = doc.y + 2;
  doc.moveTo(LEFT, y).lineTo(RIGHT, y).strokeColor(BORDER).lineWidth(0.5).stroke();
  return y + 6;
}

/** Subsección sin número dentro de una sección (p. ej. Pregunta Legal AML, PEP). */
function drawSubsectionTitle(doc: PDFKit.PDFDocument, y: number, title: string): number {
  y = checkPageBreak(doc, y, 40);
  doc.rect(48, y, 2.5, 10).fill(GOLD);
  doc.fontSize(8).fillColor(NAVY).font("Helvetica-Bold").text(title.toUpperCase(), 55, y + 1.5, { width: RIGHT - 55 });
  return doc.y + 5;
}

/** Párrafo explicativo tal como aparece en el formulario. */
function drawParrafo(doc: PDFKit.PDFDocument, y: number, texto: string): number {
  doc.fontSize(7.5).font("Helvetica");
  const alto = doc.heightOfString(texto, { width: RIGHT - 48, align: "justify" });
  y = checkPageBreak(doc, y, alto);
  doc.fillColor(GRAY).text(texto, 48, y, { width: RIGHT - 48, align: "justify" });
  return doc.y + 5;
}

/** Pregunta del formulario a la izquierda y la respuesta del cliente a la derecha. */
function drawQuestion(doc: PDFKit.PDFDocument, y: number, pregunta: string, respuesta: string): number {
  const anchoPregunta = 400;
  const xRespuesta = 48 + anchoPregunta + 12;
  doc.fontSize(8).font("Helvetica");
  const alto = Math.max(ALTO_FILA, doc.heightOfString(pregunta, { width: anchoPregunta }) + SEPARACION_FILA);
  y = checkPageBreak(doc, y, alto);
  doc.fillColor(DARK).text(pregunta, 48, y, { width: anchoPregunta });
  doc.fillColor(LABEL).font("Helvetica-Bold").text("Respuesta:", xRespuesta, y, { width: RIGHT - xRespuesta, continued: true })
    .fillColor(NAVY).text(` ${respuesta}`);
  return Math.max(y + alto, doc.y + SEPARACION_FILA);
}

/** Subsección PEP: definición, pregunta, respuesta y, si aplica, los datos de la PEP. */
function drawPepSubsection(doc: PDFKit.PDFDocument, y: number, data: any, definicion: string): number {
  y += 4;
  y = drawSubsectionTitle(doc, y, "Persona Expuesta Políticamente (PEP)");
  y = drawParrafo(doc, y, `DEFINICIÓN – ${definicion}`);
  // Pregunta y detalles van juntos: los detalles no quedan solos en otra página.
  const conDetalles = muestraBloquePep(data);
  if (conDetalles) {
    const altoPregunta = doc.fontSize(8).font("Helvetica").heightOfString(PREGUNTA_PEP, { width: 400 });
    y = checkPageBreak(doc, y, altoPregunta + 50);
  }
  y = drawQuestion(doc, y, PREGUNTA_PEP, data.esPep || "No");
  if (conDetalles) {
    doc.fontSize(8).fillColor(NAVY).font("Helvetica-Bold").text("Detalles PEP", 48, y + 2, { width: 300 });
    y = doc.y + 3;
    y = drawFieldRow(doc, y, "Nombre Completo", data.pepNombre || "-", "Cargo Desempeñado", data.pepCargo || "-");
    y = drawFieldRow(doc, y, "Institución o Entidad", data.pepInstitucion || "-", "Relación o Parentesco", data.pepRelacion || "-");
  }
  return y;
}

/** Aviso de la Ley 23 bajo el encabezado, como en la pantalla de políticas. */
function drawLeyBlock(doc: PDFKit.PDFDocument, y: number): number {
  const ancho = WIDTH - 16;
  doc.fontSize(7.5).font("Helvetica");
  const altoTexto = doc.heightOfString(LEY_TEXTO, { width: ancho, align: "justify" });
  const alto = 8 + 11 + altoTexto + 8;
  doc.roundedRect(LEFT, y, WIDTH, alto, 3).lineWidth(0.8).strokeColor(GOLD).stroke();
  doc.fontSize(8).fillColor(NAVY).font("Helvetica-Bold").text(LEY_TITULO, 48, y + 8, { width: ancho });
  doc.fontSize(7.5).fillColor(DARK).font("Helvetica").text(LEY_TEXTO, 48, y + 19, { width: ancho, align: "justify" });
  return y + alto + 8;
}

/** Casilla marcada (o vacía) dibujada a mano: Helvetica no trae el glifo ✓. */
function drawCasilla(doc: PDFKit.PDFDocument, x: number, y: number, marcada: boolean): void {
  doc.rect(x, y, 8, 8).lineWidth(0.8).strokeColor(marcada ? NAVY : "#9ca3af").stroke();
  if (marcada) {
    doc.moveTo(x + 1.8, y + 4.2).lineTo(x + 3.4, y + 6).lineTo(x + 6.4, y + 2)
      .lineWidth(1.2).strokeColor(NAVY).stroke();
  }
}

/**
 * Página de "Firma y Declaración del Cliente": título, declaración completa y
 * las dos casillas del último paso. El tamaño de letra se reduce lo necesario
 * para que todo quepa por encima de `limite` y la firma quede en la misma hoja.
 */
function drawDeclaracion(doc: PDFKit.PDFDocument, y: number, data: any, limite: number): number {
  const SANGRIA = 10;
  const casillas: [string, boolean][] = [
    [CASILLA_TERMINOS, data.termsAccepted !== false],
    [CASILLA_FIRMA, data.signatureConfirmed !== false],
  ];
  const xCasilla = 48 + 14;
  const anchoCasilla = RIGHT - xCasilla;

  const medir = (fs: number) => {
    let alto = 0;
    for (const p of DECLARACION) {
      const ancho = RIGHT - 48 - (p.sangria ? SANGRIA : 0);
      doc.fontSize(fs).font(p.titulo ? "Helvetica-Bold" : "Helvetica");
      alto += doc.heightOfString(p.texto, { width: ancho, align: "justify" }) + fs * 0.45;
    }
    doc.fontSize(fs + 0.5).font("Helvetica");
    for (const [texto] of casillas) alto += Math.max(10, doc.heightOfString(texto, { width: anchoCasilla })) + 4;
    return alto + 8;
  };

  y = drawSectionTitle(doc, y, "Firma y Declaración del Cliente");
  let fs = 7.5;
  while (fs > 5.5 && y + medir(fs) > limite) fs -= 0.25;

  for (const p of DECLARACION) {
    const x = 48 + (p.sangria ? SANGRIA : 0);
    doc.fontSize(fs).fillColor(p.titulo ? NAVY : DARK).font(p.titulo ? "Helvetica-Bold" : "Helvetica")
      .text(p.texto, x, y, { width: RIGHT - x, align: "justify" });
    y = doc.y + fs * 0.45;
  }

  y += 4;
  for (const [texto, marcada] of casillas) {
    drawCasilla(doc, 48, y, marcada);
    doc.fontSize(fs + 0.5).fillColor(DARK).font("Helvetica").text(texto, xCasilla, y, { width: anchoCasilla });
    y = Math.max(y + 10, doc.y) + 4;
  }
  return y + 4;
}

function drawEmpty(doc: PDFKit.PDFDocument, y: number, texto: string): number {
  doc.fontSize(8).fillColor(GRAY).font("Helvetica-Oblique").text(texto, 48, y, { width: 500 });
  return y + 14;
}

// Alto mínimo de una fila de campo; si el valor se parte en varias líneas la
// fila crece hasta donde terminó el texto, para que la siguiente no lo pise.
const ALTO_FILA = 13;
const SEPARACION_FILA = 3;

/** Campo de ancho completo: la etiqueta en la columna de etiquetas y el valor ocupa el resto de la fila. */
function drawField(doc: PDFKit.PDFDocument, y: number, label: string, value: string): number {
  y = checkPageBreak(doc, y, ALTO_FILA);
  let fin = y;
  doc.fontSize(8).fillColor(LABEL).font("Helvetica-Bold").text(`${label}:`, 48, y, { width: 120 });
  fin = Math.max(fin, doc.y);
  doc.fillColor(DARK).font("Helvetica").text(value, 170, y, { width: RIGHT - 170 });
  fin = Math.max(fin, doc.y);
  return Math.max(y + ALTO_FILA, fin + SEPARACION_FILA);
}

function drawFieldRow(doc: PDFKit.PDFDocument, y: number, l1: string, v1: string, l2: string, v2: string): number {
  y = checkPageBreak(doc, y, ALTO_FILA);
  // Cada columna se parte por su cuenta: la fila termina donde termina la más alta.
  let fin = y;
  doc.fontSize(8).fillColor(LABEL).font("Helvetica-Bold").text(`${l1}:`, 48, y, { width: 120 });
  fin = Math.max(fin, doc.y);
  doc.fillColor(DARK).font("Helvetica").text(v1, 170, y, { width: 130 });
  fin = Math.max(fin, doc.y);
  if (l2) {
    doc.fillColor(LABEL).font("Helvetica-Bold").text(`${l2}:`, 310, y, { width: 115 });
    fin = Math.max(fin, doc.y);
    doc.fillColor(DARK).font("Helvetica").text(v2, 430, y, { width: 125 });
    fin = Math.max(fin, doc.y);
  }
  return Math.max(y + ALTO_FILA, fin + SEPARACION_FILA);
}

function drawRow(doc: PDFKit.PDFDocument, x: number, y: number, l1: string, v1: string, l2: string, v2: string): void {
  doc.fontSize(8).fillColor(LABEL).font("Helvetica-Bold").text(l1, x, y, { width: 60 });
  doc.fillColor(NAVY).font("Helvetica-Bold").text(v1, x + 62, y, { width: 180 });
  doc.fillColor(LABEL).font("Helvetica-Bold").text(l2, x + 260, y, { width: 80 });
  doc.fillColor(NAVY).font("Helvetica-Bold").text(v2, x + 342, y, { width: 150 });
}

/** Alto de una fila del recuadro de información (la columna más alta). */
function altoInfoRow(doc: PDFKit.PDFDocument, l1: string, v1: string, l2: string, v2: string): number {
  doc.fontSize(8).font("Helvetica-Bold");
  return Math.max(
    doc.heightOfString(l1, { width: 60 }),
    doc.heightOfString(v1, { width: 180 }),
    doc.heightOfString(l2, { width: 80 }),
    doc.heightOfString(v2, { width: 150 })
  );
}

const TABLE_LEFT = 48;
const TABLE_WIDTH = RIGHT - TABLE_LEFT;
const CELL_PAD = 4;

function columnas(cols: number[]): { x: number; w: number }[] {
  let x = TABLE_LEFT;
  return cols.map((f) => {
    const w = TABLE_WIDTH * f;
    const col = { x, w };
    x += w;
    return col;
  });
}

function drawTableHeader(doc: PDFKit.PDFDocument, y: number, headers: string[], cols: number[]): number {
  y = checkPageBreak(doc, y, 32);
  doc.rect(TABLE_LEFT, y, TABLE_WIDTH, 14).fill(LIGHT_BG);
  columnas(cols).forEach((c, i) => {
    doc.fontSize(7).fillColor(LABEL).font("Helvetica-Bold")
      .text(headers[i], c.x + CELL_PAD, y + 4, { width: c.w - CELL_PAD * 2, lineBreak: false, ellipsis: true });
  });
  return y + 16;
}

/**
 * Fila de tabla con alto variable: crece con la celda más alta.
 * `detalle` es un renglón opcional a todo el ancho de la tabla, bajo las
 * columnas, para textos largos (p. ej. la dirección) que en una columna
 * angosta se partirían en muchas líneas.
 */
function drawTableRow(
  doc: PDFKit.PDFDocument,
  y: number,
  values: string[],
  cols: number[],
  detalle?: { label: string; value: string }
): number {
  const cs = columnas(cols);
  doc.fontSize(7).font("Helvetica");
  const altoCeldas = Math.max(
    10,
    ...values.map((v, i) => doc.heightOfString(v, { width: cs[i].w - CELL_PAD * 2 }))
  ) + 3;

  const detalleX = TABLE_LEFT + CELL_PAD;
  const detalleW = TABLE_WIDTH - CELL_PAD * 2;
  const detalleTexto = detalle ? `${detalle.label}: ${detalle.value}` : "";
  // Se mide en negrita (más ancha) para no quedarse corto por la etiqueta.
  const altoDetalle = detalle
    ? doc.fontSize(7).font("Helvetica-Bold").heightOfString(detalleTexto, { width: detalleW }) + 2
    : 0;
  const alto = altoCeldas + altoDetalle + 2;

  // Fila y detalle van juntos: nunca se separan entre páginas.
  y = checkPageBreak(doc, y, alto);
  cs.forEach((c, i) => {
    doc.fontSize(7).fillColor(DARK).font(i === 0 ? "Helvetica-Bold" : "Helvetica")
      .text(values[i], c.x + CELL_PAD, y + 2, { width: c.w - CELL_PAD * 2 });
  });
  if (detalle) {
    doc.fontSize(7).fillColor(LABEL).font("Helvetica-Bold")
      .text(`${detalle.label}: `, detalleX, y + 2 + altoCeldas, { width: detalleW, continued: true })
      .fillColor(DARK).font("Helvetica")
      .text(detalle.value);
  }
  doc.moveTo(TABLE_LEFT, y + alto).lineTo(RIGHT, y + alto).strokeColor(BORDER).lineWidth(0.3).stroke();
  return y + alto + 2;
}

/** Fila del índice de documentos: requisito, SÍ/NO y los archivos numerados. */
function drawDocumentRow(
  doc: PDFKit.PDFDocument,
  y: number,
  req: RequisitoDocumental,
  cols: number[],
  /** Si la fila pasa a otra página, la cabecera de la tabla se repite arriba. */
  encabezados?: string[]
): number {
  const [cReq, cOk, cArch] = columnas(cols);
  const adjuntado = req.archivos.length > 0;
  const archivos = !adjuntado
    ? "-"
    : req.archivos.length === 1
      ? req.archivos[0]
      : req.archivos.map((a, i) => `${i + 1}. ${a}`).join("\n");

  doc.fontSize(7.5).font("Helvetica");
  const alto = Math.max(
    10,
    doc.heightOfString(req.titulo, { width: cReq.w - CELL_PAD * 2 }),
    doc.fontSize(7).heightOfString(archivos, { width: cArch.w - CELL_PAD * 2 })
  ) + 6;

  const yAntes = y;
  y = checkPageBreak(doc, y, alto);
  if (encabezados && y < yAntes) y = drawTableHeader(doc, y, encabezados, cols);
  doc.fontSize(7.5).fillColor(DARK).font("Helvetica")
    .text(req.titulo, cReq.x + CELL_PAD, y + 3, { width: cReq.w - CELL_PAD * 2 });
  doc.fontSize(7.5).fillColor(adjuntado ? OK : req.opcional ? GRAY : FAIL).font("Helvetica-Bold")
    .text(adjuntado ? "SÍ" : "NO", cOk.x, y + 3, { width: cOk.w, align: "center" });
  doc.fontSize(7).fillColor(GRAY).font("Helvetica")
    .text(archivos, cArch.x + CELL_PAD, y + 3, { width: cArch.w - CELL_PAD * 2 });
  doc.moveTo(TABLE_LEFT, y + alto).lineTo(RIGHT, y + alto).strokeColor(BORDER).lineWidth(0.3).stroke();
  return y + alto + 1;
}
