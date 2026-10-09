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
const PAGE_BOTTOM = 770;
const FOOTER_Y = 800;

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
        margins: { top: 40, bottom: 40, left: LEFT, right: 40 },
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

      // ===== INFO BLOCK =====
      // El recuadro se mide antes de pintarlo: un valor largo (p. ej. varios
      // medios de pago) lo agranda en lugar de salirse por debajo.
      let y = dividerY + 10;
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
        y = drawFieldRow(doc, y, "Nacionalidad", data.nationality || "-", "Identificación", `${data.tipoIdentificacion || "Cédula"}: ${data.idNumber || "-"}`);
        y = drawFieldRow(doc, y, "Fecha Nacimiento", data.fechaNacimiento || "-", "Vencimiento ID", vencimientoId(data.fechaVencimientoId));
        y = drawField(doc, y, "País Residencia Fiscal", data.paisResidenciaFiscal || "-");
        y = drawFieldRow(doc, y, "Correo Electrónico", data.email || "-", "Teléfono / Celular", `${telefono(data.telefonoCodigo, data.telefono)} / ${telefono(data.celularCodigo, data.celular)}`);
        y = drawFieldRow(doc, y, "Estado Civil", data.estadoCivil || "-", "", "");
        y = drawField(doc, y, "Dirección Residencial", direccion(data.direccionResidencial, data.ciudad, data.provinciaEstado, data.paisResidencial));
        y = drawField(doc, y, "Medio de Contacto", medioContacto);

        y += 5;
        y = checkPageBreak(doc, y, 80);
        y = drawSectionTitle(doc, y, "2. Datos Laborales");
        y = drawFieldRow(doc, y, "Profesión / Ocupación", conOtros(data.profession, data.profesionOtros), "Jurisdicción Donde Opera", data.paisActividadLaboral || "-");
        y = drawFieldRow(doc, y, "Patrono / Empleador", data.employer || "-", "Actividad del Patrono", conOtros(data.actividadLaboral, data.actividadLaboralOtros));
        y = drawFieldRow(doc, y, "Dirección Laboral", data.direccionLaboral || "-", "Cargo en la Entidad", data.cargoDesempena || "-");
        y = drawFieldRow(
          doc, y,
          "Participación en la Entidad", data.esPropietario || "-",
          isFieldVisible("natural", "usaFondos", data) ? "Fondos de la Entidad" : "",
          data.usaFondos || "-"
        );

        y += 5;
        y = checkPageBreak(doc, y, 100);
        y = drawSectionTitle(doc, y, "3. Perfil Financiero y Origen de Fondos");
        y = drawFieldRow(doc, y, "Act. Económica Principal", conOtros(data.actEconPrincipal, data.otroActEcon), "% Dedicación", `${data.pctDedicacionPrincipal || "100"}%`);
        y = drawField(doc, y, "Jurisdicción Principal", data.jurisdiccionPrincipal || "-");
        if (data.actEconSecundaria) {
          y = drawFieldRow(doc, y, "Otra Actividad Económica", data.actEconSecundaria, "% Dedicación", `${data.pctDedicacionSecundaria || "0"}%`);
          y = drawField(doc, y, "Jurisdicción de Otra Actividad", data.jurisdiccionSecundaria || "-");
        }
        y = drawFieldRow(doc, y, "Ingresos Mensuales Promedio", data.ingresosMensuales || "-", "Fuente de Fondos", data.fuenteFondosInmueble || "-");
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
        y = drawField(
          doc, y, "¿Previsto >1 Unidad (12m)?",
          `${data.montoServiciosAnuales || "No"}${isFieldVisible("natural", "cantidadServiciosAnuales", data) && data.cantidadServiciosAnuales ? ` (${data.cantidadServiciosAnuales} unidades)` : ""}`
        );
        y = drawFieldRow(doc, y, "¿A Nombre de Tercero?", data.adquiereNombreTercero || "No", "Propósito del Inmueble", data.destinoInmueble || "-");
        if (isFieldVisible("natural", "nombreTercero", data)) {
          y = checkPageBreak(doc, y, 30);
          y = drawField(doc, y, "Nombre del Tercero", data.nombreTercero || "-");
        }
        y = drawField(doc, y, "¿Persona PEP?", data.esPep || "No");
        if (muestraBloquePep(data)) {
          y = drawField(doc, y, "Detalles PEP", detallesPep(data));
        }
      } else {
        // JURÍDICA
        y = drawSectionTitle(doc, y, "1. Información de la Empresa / Sociedad");
        y = drawFieldRow(doc, y, "Razón Social", data.razonSocial || "-", "R.U.C. / Registro", data.numeroIdTributaria || "-");
        y = drawFieldRow(doc, y, "Tipo de Documento", data.tipoDocumentoIdentidad || "-", "Vencimiento Documento", vencimientoId(data.fechaVencimientoId));
        y = drawFieldRow(doc, y, "Fecha Constitución", data.fechaConstitucion || "-", "País de Inscripción", data.paisInscripcion || "-");
        y = drawFieldRow(doc, y, "País donde Opera", data.paisOpera || "-", "Tipo de Sociedad", data.tipoSociedad || "-");
        y = drawFieldRow(doc, y, "Estado de la Sociedad", data.estadoSociedad || "-", "Tipo de Cliente", data.tipoCliente || "-");
        y = drawFieldRow(doc, y, "Actividad Principal", `${data.actividadPrincipal || "-"}`, "País Tributación", data.paisTributacion || "-");
        y = drawField(doc, y, "Correo Empresa", data.empresaEmail || "-");
        y = drawFieldRow(doc, y, "Teléfono Oficina", telefono(data.empresaTelefonoCodigo, data.empresaTelefono), "Celular Contacto", telefono(data.empresaCelularCodigo, data.empresaCelular));
        y = drawField(doc, y, "Dirección Oficina", direccion(data.empresaDireccion, data.empresaCiudad, data.empresaProvincia, data.empresaPais));
        y = drawField(doc, y, "Medio de Contacto", medioContacto);

        y += 5;
        y = checkPageBreak(doc, y, 100);
        y = drawSectionTitle(doc, y, "2. Representante Legal");
        y = drawFieldRow(doc, y, "Nombre Completo", data.rlNombre || "-", "Identificación", data.rlNoIdentificacion || "-");
        y = drawFieldRow(doc, y, "Nacionalidad", data.rlNacionalidad || "-", "Fecha Nacimiento", data.rlFechaNacimiento || "-");
        y = drawFieldRow(doc, y, "Estado Civil", data.rlEstadoCivil || "-", "Profesión", data.rlProfesionOcupacion || "-");
        y = drawFieldRow(doc, y, "Actividad Económica", data.rlActividadEconomica || "-", "Teléfono", data.rlTelefono || "-");
        y = drawFieldRow(doc, y, "País Residencia", data.rlPaisResidencia || "-", "Investigado por AML", data.rlObjetoInvestigacion || "-");
        y = drawField(doc, y, "Dirección", data.rlDireccion || "-");

        // Junta Directiva
        y += 5;
        y = checkPageBreak(doc, y, 80);
        y = drawSectionTitle(doc, y, "3. Gobierno Corporativo / Junta Directiva");
        const gjc = Array.isArray(data.gjcMembers) ? data.gjcMembers : [];
        if (gjc.length > 0) {
          const cols = [0.16, 0.24, 0.16, 0.16, 0.28];
          y = drawTableHeader(doc, y, ["Cargo", "Nombre y Apellidos", "Identificación", "Nacionalidad", "Dirección"], cols);
          for (const m of gjc) {
            y = drawTableRow(doc, y, [m.cargo || "-", nombreGjc(m), m.nroId || "-", m.nacionalidad || "-", m.direccion || "-"], cols);
          }
        } else {
          y = drawEmpty(doc, y, "Ningún miembro registrado en la Junta Directiva.");
        }

        // Beneficiarios Finales
        y += 5;
        y = checkPageBreak(doc, y, 80);
        y = drawSectionTitle(doc, y, "4. Beneficiarios Finales (>10% Participación)");
        const bf = Array.isArray(data.bfMembers) ? data.bfMembers : [];
        if (bf.length > 0) {
          const cols = [0.32, 0.2, 0.14, 0.34];
          y = drawTableHeader(doc, y, ["Nombre Completo", "Identificación", "% Participación", "Dirección"], cols);
          for (const m of bf) {
            y = drawTableRow(doc, y, [
              m.nombreCompleto || "-",
              m.noIdentificacion || "-",
              `${m.porcentajeParticipacion || m.porcentaje || "-"}%`,
              m.direccion || "-",
            ], cols);
          }
        } else {
          y = drawEmpty(doc, y, "Ningún beneficiario final registrado.");
        }

        // Perfil Financiero Empresa
        y += 5;
        y = checkPageBreak(doc, y, 80);
        y = drawSectionTitle(doc, y, "5. Perfil Financiero y de Cumplimiento");
        y = drawField(doc, y, "Ingresos Mensuales", data.ingresosMensuales || "-");
        y = drawFieldRow(doc, y, "Medio de Pago", data.medioPago || "-", "Fondos de Adquisición", data.fuenteFondosInmueble || "-");
        if (muestraBloqueTercero("juridica", data)) {
          y = drawField(doc, y, "Aportante Tercero", `Nombre: ${data.terceroNombre || "-"} | Nac: ${data.terceroNacionalidad || "-"} | Vínculo: ${data.terceroVinculo || "-"} | Fuente: ${data.terceroFuenteFondos || "-"}`);
        }
        y = drawField(doc, y, "¿Previsto >1 Unidad (12m)?", `${data.adquiereMasUnidades || "No"}${isFieldVisible("juridica", "cantidadUnidadesInmobiliarias", data) && data.cantidadUnidadesInmobiliarias ? ` (${data.cantidadUnidadesInmobiliarias} unidades)` : ""}`);
        y = drawField(doc, y, "¿Persona PEP? (Junta/Propietarios)", data.esPep || "No");
        if (muestraBloquePep(data)) {
          y = drawField(doc, y, "Detalles PEP", detallesPep(data));
        }
      }

      // ===== DOCUMENTS SECTION =====
      // El listado de documentos siempre arranca en página nueva: evita que el
      // índice de anexos quede partido justo antes de los anexos combinados.
      y = forcePageBreak(doc);
      y = drawSectionTitle(doc, y, "Documentos Adjuntados y Verificados");

      const requisitos = requisitosDocumentales(type, data, documents || []);
      const cols = [0.45, 0.12, 0.43];
      y = drawTableHeader(doc, y, ["Requisito Documental", "Adjuntado", "Nombre de Archivo"], cols);
      for (const req of requisitos) {
        y = drawDocumentRow(doc, y, req, cols);
      }

      // ===== CONCLUSIONS =====
      y += 10;
      y = checkPageBreak(doc, y, 60);
      y = drawSectionTitle(doc, y, "Conclusiones de Cumplimiento (Solo Oficial de Cumplimiento)");
      doc.fontSize(8).fillColor(DARK).font("Helvetica")
        .text(data.conclusionesVerificacion || "Registro formalizado y archivado satisfactoriamente por el oficial de cumplimiento.", 48, y, { width: 500 });
      y = doc.y + 12;

      // ===== SIGNATURE =====
      const SIG_H = 100;
      y = checkPageBreak(doc, y, SIG_H + 10);
      const boxTop = y;
      doc.roundedRect(LEFT, boxTop, WIDTH, SIG_H, 4).lineWidth(0.8).strokeColor(BORDER).stroke();
      y += 8;
      doc.fontSize(9).fillColor(NAVY).font("Helvetica-Bold")
        .text("DECLARACIÓN JURADA Y FIRMA ELECTRÓNICA", 48, y, { width: 500 });
      y += 13;
      doc.fontSize(7).fillColor(GRAY).font("Helvetica")
        .text(
          "El firmante comprador o representante debidamente acreditado declara solemnemente bajo fe de juramento que todas las informaciones entregadas para este registro son veraces y correctas. Autoriza expresamente a UDG Group a realizar los análisis de cumplimiento necesarios.",
          48, y, { width: 500, align: "justify" }
        );
      y = doc.y + 8;

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

function detallesPep(data: any): string {
  return `Nombre: ${data.pepNombre || "-"} | Cargo: ${data.pepCargo || "-"} | Institución: ${data.pepInstitucion || "-"} | Relación: ${data.pepRelacion || "-"}`;
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

/** Fila de tabla con alto variable: crece con la celda más alta. */
function drawTableRow(doc: PDFKit.PDFDocument, y: number, values: string[], cols: number[]): number {
  const cs = columnas(cols);
  doc.fontSize(7).font("Helvetica");
  const alto = Math.max(
    10,
    ...values.map((v, i) => doc.heightOfString(v, { width: cs[i].w - CELL_PAD * 2 }))
  ) + 5;

  y = checkPageBreak(doc, y, alto);
  cs.forEach((c, i) => {
    doc.fontSize(7).fillColor(DARK).font(i === 0 ? "Helvetica-Bold" : "Helvetica")
      .text(values[i], c.x + CELL_PAD, y + 2, { width: c.w - CELL_PAD * 2 });
  });
  doc.moveTo(TABLE_LEFT, y + alto).lineTo(RIGHT, y + alto).strokeColor(BORDER).lineWidth(0.3).stroke();
  return y + alto + 2;
}

/** Fila del índice de documentos: requisito, SÍ/NO y los archivos numerados. */
function drawDocumentRow(doc: PDFKit.PDFDocument, y: number, req: RequisitoDocumental, cols: number[]): number {
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

  y = checkPageBreak(doc, y, alto);
  doc.fontSize(7.5).fillColor(DARK).font("Helvetica")
    .text(req.titulo, cReq.x + CELL_PAD, y + 3, { width: cReq.w - CELL_PAD * 2 });
  doc.fontSize(7.5).fillColor(adjuntado ? OK : req.opcional ? GRAY : FAIL).font("Helvetica-Bold")
    .text(adjuntado ? "SÍ" : "NO", cOk.x, y + 3, { width: cOk.w, align: "center" });
  doc.fontSize(7).fillColor(GRAY).font("Helvetica")
    .text(archivos, cArch.x + CELL_PAD, y + 3, { width: cArch.w - CELL_PAD * 2 });
  doc.moveTo(TABLE_LEFT, y + alto).lineTo(RIGHT, y + alto).strokeColor(BORDER).lineWidth(0.3).stroke();
  return y + alto + 1;
}
