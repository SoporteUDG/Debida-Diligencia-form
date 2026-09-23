import PDFDocument from "pdfkit";
import { isFieldVisible, muestraBloquePep, muestraBloqueTercero } from "./conditionalFields";

/**
 * Server-side PDF generator for Debida Diligencia forms.
 * Uses PDFKit (Node.js) - no browser/DOM required.
 * Returns a Buffer containing the PDF bytes.
 */
export async function generateServerPDF(
  type: "NATURAL" | "JURIDICA",
  data: any,
  formId: string,
  submittedAt: Date,
  documents?: { name: string; fileType: string; documentType?: string | null }[],
  /** Versión del expediente que se está imprimiendo (FormVersion.version). */
  version?: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
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
      const clientName = isNatural
        ? `${data.firstName || ""} ${data.lastName || ""}`.trim() || "Cliente Natural"
        : data.razonSocial || "Empresa Registrada";
      const dateStr = submittedAt.toLocaleDateString("es-PA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      // Colors
      const NAVY = "#002b49";
      const GOLD = "#c8a788";
      const GRAY = "#6b7280";
      const DARK = "#1f2937";
      const LIGHT_BG = "#f3f4f6";

      // ===== HEADER =====
      doc.fontSize(18).fillColor(NAVY).font("Helvetica-Bold")
        .text("URBAN DEVELOPMENT GROUP", 40, 40, { width: 350 });
      doc.fontSize(9).fillColor(GOLD).font("Helvetica-Bold")
        .text("EXPEDIENTE DE DEBIDA DILIGENCIA", 40, 62, { width: 350 });

      // ID badge
      doc.roundedRect(420, 40, 135, 20, 3).fill(NAVY);
      doc.fontSize(8).fillColor("#ffffff").font("Helvetica-Bold")
        .text(`ID: ${formId.substring(0, 18)}`, 425, 46, { width: 125, align: "center" });
      doc.fontSize(8).fillColor(GRAY).font("Helvetica")
        .text(`Fecha: ${dateStr}`, 420, 65, { width: 135, align: "center" });
      if (version) {
        doc.fontSize(8).fillColor(NAVY).font("Helvetica-Bold")
          .text(`Versión ${version}`, 420, 76, { width: 135, align: "center" });
      }

      // Divider
      doc.moveTo(40, 80).lineTo(555, 80).strokeColor(NAVY).lineWidth(2).stroke();

      // ===== INFO BLOCK =====
      let y = 90;
      doc.rect(40, y, 515, 35).fill(LIGHT_BG);
      doc.moveTo(40, y).lineTo(40, y + 35).strokeColor(GOLD).lineWidth(3).stroke();

      y += 8;
      drawRow(doc, 48, y, "Cliente:", clientName, "Proyecto:", data.nombreProyecto || "General UDG");
      y += 14;
      drawRow(doc, 48, y, "Tipo:", `Persona ${isNatural ? "Natural" : "Jurídica"}`, "Medio de Pago:", data.medioPago || "-");

      y += 25;

      // ===== DYNAMIC SECTIONS =====
      if (isNatural) {
        y = drawSectionTitle(doc, y, "1. Información del Solicitante", NAVY);
        y = drawField(doc, y, "Nombre Completo", `${data.firstName || ""} ${data.lastName || ""}`);
        y = drawFieldRow(doc, y, "Nacionalidad", data.nationality || "-", "Identificación", `${data.tipoIdentificacion || "Cédula"}: ${data.idNumber || "-"}`);
        y = drawFieldRow(doc, y, "Fecha Nacimiento", data.fechaNacimiento || "-", "Vencimiento ID", data.fechaVencimientoId || "No registrada");
        y = drawFieldRow(doc, y, "País Residencia Fiscal", data.paisResidenciaFiscal || "-", "NIF / ID Tributaria", data.idTributaria || "-");
        y = drawFieldRow(doc, y, "Correo Electrónico", data.email || "-", "Teléfono / Celular", `${data.telefono || ""} / ${data.celular || ""}`);
        y = drawFieldRow(doc, y, "Profesión / Ocupación", data.profession || "-", "Estado Civil", data.estadoCivil || "-");
        y = drawFieldRow(doc, y, "Patrono / Empleador", data.employer || "-", "Cargo Desempeñado", data.cargoDesempena || "-");
        y = drawField(doc, y, "Dirección Laboral", data.direccionLaboral || "-");
        y = drawField(doc, y, "Dirección Residencial", `${data.direccionResidencial || "-"}, ${data.ciudad || ""}, ${data.provinciaEstado || ""}, ${data.paisResidencial || ""}`);
        y = drawFieldRow(doc, y, "Medio de Contacto", `${data.formaContacto || "-"}${isFieldVisible("natural", "referidoPor", data) && data.referidoPor ? ` (Ref: ${data.referidoPor})` : ""}`, "", "");

        y += 5;
        y = checkPageBreak(doc, y, 100);
        y = drawSectionTitle(doc, y, "2. Perfil Financiero y Origen de Fondos", NAVY);
        y = drawFieldRow(doc, y, "Ingresos Mensuales Promedio", data.ingresosMensuales || "-", "Fuente de Fondos", data.fuenteFondosInmueble || "-");
        // El detalle de "Otros" acompaña a la categoría, no la reemplaza.
        if (isFieldVisible("natural", "ifOtroNombre", data)) {
          y = checkPageBreak(doc, y, 30);
          y = drawField(doc, y, "Otra Fuente (detalle)", data.ifOtroNombre || "-");
        }
        y = drawFieldRow(doc, y, "Monto Servicios Anuales", data.montoServiciosAnuales || "-", "Destino de Fondos", data.destinoInmueble || "Adquisición de Inmueble");
        y = drawFieldRow(doc, y, "¿Persona PEP?", data.esPep || "No", "¿A Nombre de Tercero?", data.adquiereNombreTercero || "No");
        if (muestraBloquePep(data)) {
          y = drawField(doc, y, "Detalles PEP", `Nombre: ${data.pepNombre || "-"} | Cargo: ${data.pepCargo || "-"} | Institución: ${data.pepInstitucion || "-"} | Relación: ${data.pepRelacion || "-"}`);
        }
        // Datos del tercero en persona natural: el expediente archivado en
        // WorkDrive los omitía aunque el formulario los pidiera. Se usan las
        // mismas condiciones que el formulario y la vista de consulta.
        if (isFieldVisible("natural", "nombreTercero", data)) {
          y = checkPageBreak(doc, y, 30);
          y = drawField(doc, y, "Nombre del Tercero", data.nombreTercero || "-");
        }
        if (muestraBloqueTercero("natural", data)) {
          y = checkPageBreak(doc, y, 30);
          y = drawField(
            doc,
            y,
            "Aportante Tercero",
            `Nombre: ${data.ifTerceroNombre || "-"} | Nac: ${data.ifTerceroNacionalidad || "-"} | Fuente: ${data.ifTerceroFuenteDeIngresos || "-"} | Relación: ${data.ifTerceroRelacion || "-"}`
          );
        }

        y = drawFieldRow(doc, y, "Act. Económica Principal", data.actEconPrincipal || "-", "% Dedicación", `${data.pctDedicacionPrincipal || "100"}%`);
        y = drawField(doc, y, "Jurisdicción Principal", data.jurisdiccionPrincipal || "-");

      } else {
        // JURÍDICA
        y = drawSectionTitle(doc, y, "1. Información de la Empresa / Sociedad", NAVY);
        y = drawFieldRow(doc, y, "Razón Social", data.razonSocial || "-", "R.U.C. / Registro", data.ruc || "-");
        y = drawFieldRow(doc, y, "Fecha Constitución", data.fechaConstitucion || "-", "País de Inscripción", data.paisInscripcion || "-");
        y = drawFieldRow(doc, y, "País donde Opera", data.paisOpera || "-", "Tipo de Sociedad", data.tipoSociedad || "-");
        y = drawFieldRow(doc, y, "Tipo de Cliente", data.tipoCliente || "-", "Actividad Principal", `${data.actividadPrincipal || "-"} (${data.porcentajeActividad || "100"}%)`);
        y = drawFieldRow(doc, y, "País Tributación", data.paisTributacion || "-", "NIF / ID Tributaria", data.numeroIdTributaria || "-");
        y = drawFieldRow(doc, y, "Teléfono Oficina", `(${data.empresaTelefonoCodigo || ""}) ${data.empresaTelefono || ""}`, "Celular Contacto", `(${data.empresaCelularCodigo || ""}) ${data.empresaCelular || ""}`);
        y = drawField(doc, y, "Correo Empresa", data.empresaEmail || "-");
        y = drawField(doc, y, "Dirección Oficina", `${data.empresaDireccion || "-"}, ${data.empresaCiudad || ""}, ${data.empresaProvincia || ""}, ${data.empresaPais || ""}`);

        y += 5;
        y = checkPageBreak(doc, y, 100);
        y = drawSectionTitle(doc, y, "2. Representante Legal", NAVY);
        y = drawFieldRow(doc, y, "Nombre Completo RL", data.rlNombre || "-", "Identificación RL", data.rlNoIdentificacion || "-");
        y = drawFieldRow(doc, y, "Fecha Nacimiento RL", data.rlFechaNacimiento || "-", "Profesión RL", data.rlProfesionOcupacion || "-");
        y = drawFieldRow(doc, y, "Teléfono RL", data.rlTelefono || "-", "País Residencia RL", data.rlPaisResidencia || "-");
        y = drawField(doc, y, "Dirección RL", data.rlDireccion || "-");
        y = drawField(doc, y, "Propósito de la Relación", data.rlObjetoInvestigacion || "-");

        // Junta Directiva
        y += 5;
        y = checkPageBreak(doc, y, 80);
        y = drawSectionTitle(doc, y, "3. Gobierno Corporativo / Junta Directiva", NAVY);
        if (data.gjcMembers && data.gjcMembers.length > 0) {
          y = drawTableHeader(doc, y, ["Cargo", "Nombre", "Identificación", "Nacionalidad"]);
          for (const m of data.gjcMembers) {
            y = checkPageBreak(doc, y, 15);
            y = drawTableRow(doc, y, [m.cargo || "-", `${m.nombre || ""} ${m.apellidos || ""}`, m.nroId || "-", m.nacionalidad || "-"]);
          }
        } else {
          doc.fontSize(8).fillColor(GRAY).font("Helvetica-Oblique").text("Ningún miembro registrado.", 48, y);
          y += 14;
        }

        // Beneficiarios Finales
        y += 5;
        y = checkPageBreak(doc, y, 80);
        y = drawSectionTitle(doc, y, "4. Beneficiarios Finales (>10% Participación)", NAVY);
        if (data.bfMembers && data.bfMembers.length > 0) {
          y = drawTableHeader(doc, y, ["Nombre Completo", "Identificación", "% Participación", "Dirección"]);
          for (const m of data.bfMembers) {
            y = checkPageBreak(doc, y, 15);
            y = drawTableRow(doc, y, [m.nombreCompleto || "-", m.noIdentificacion || "-", `${m.porcentajeParticipacion || "-"}%`, m.direccion || "-"]);
          }
        } else {
          doc.fontSize(8).fillColor(GRAY).font("Helvetica-Oblique").text("Ningún beneficiario final registrado.", 48, y);
          y += 14;
        }

        // Perfil Financiero Empresa
        y += 5;
        y = checkPageBreak(doc, y, 80);
        y = drawSectionTitle(doc, y, "5. Perfil Financiero y de Cumplimiento", NAVY);
        y = drawFieldRow(doc, y, "Ingresos Mensuales", data.ingresosMensuales || "-", "Volumen Ventas Anual", data.volumenVentas || "-");
        y = drawFieldRow(doc, y, "Medio de Pago", data.medioPago || "-", "Fondos de Adquisición", data.fuenteFondosInmueble || "-");
        if (muestraBloqueTercero("juridica", data)) {
          y = drawField(doc, y, "Aportante Tercero", `Nombre: ${data.terceroNombre || "-"} | Nac: ${data.terceroNacionalidad || "-"} | Vínculo: ${data.terceroVinculo || "-"} | Fuente: ${data.terceroFuenteFondos || "-"}`);
        }
        y = drawFieldRow(doc, y, "¿Previsto >1 Unidad (12m)?", `${data.adquiereMasUnidades || "No"}${isFieldVisible("juridica", "cantidadUnidadesInmobiliarias", data) && data.cantidadUnidadesInmobiliarias ? ` (${data.cantidadUnidadesInmobiliarias} unidades)` : ""}`, "Banco de Referencia", data.bancoReferencia || "-");
        y = drawFieldRow(doc, y, "Fuente / Origen Fondos", data.origenFondos || "-", "Destino de Fondos", data.destinoFondos || "-");
        y = drawFieldRow(doc, y, "¿Persona PEP?", data.esPep || "No", "Actividad Comercial", data.actividadComercial || "-");
        if (muestraBloquePep(data)) {
          y = drawField(doc, y, "Detalles PEP", `Nombre: ${data.pepNombre || "-"} | Cargo: ${data.pepCargo || "-"} | Institución: ${data.pepInstitucion || "-"} | Relación: ${data.pepRelacion || "-"}`);
        }
      }

      // ===== DOCUMENTS SECTION =====
      // El listado de documentos siempre arranca en página nueva: evita que el
      // índice de anexos quede partido justo antes de los anexos combinados.
      y = forcePageBreak(doc);
      y = drawSectionTitle(doc, y, "Documentos Adjuntados", NAVY);

      const grupos = agruparDocumentos(documents || [], data);

      if (grupos.length > 0) {
        for (const grupo of grupos) {
          y = checkPageBreak(doc, y, 26);

          // Título del requisito documental, con el conteo cuando admite varios
          doc.fontSize(8).fillColor(NAVY).font("Helvetica-Bold")
            .text(
              grupo.archivos.length > 1 ? `${grupo.titulo} (${grupo.archivos.length} archivos)` : grupo.titulo,
              48, y, { width: 500 }
            );
          y += 12;

          // Una línea por archivo: los campos multi-archivo se listan completos
          for (const archivo of grupo.archivos) {
            y = checkPageBreak(doc, y, 14);
            doc.fontSize(8).fillColor("#059669").font("Helvetica-Bold").text("✓ ", 60, y, { continued: true });
            doc.fillColor(DARK).font("Helvetica").text(archivo, { width: 470 });
            y += 12;
          }
          y += 4;
        }
      } else {
        doc.fontSize(8).fillColor(GRAY).font("Helvetica-Oblique").text("No se adjuntaron documentos.", 48, y);
        y += 14;
      }

      // ===== CONCLUSIONS =====
      y += 5;
      y = checkPageBreak(doc, y, 50);
      y = drawSectionTitle(doc, y, "Conclusiones de Cumplimiento", NAVY);
      doc.fontSize(8).fillColor(DARK).font("Helvetica")
        .text(data.conclusionesVerificacion || "Registro formalizado y archivado satisfactoriamente.", 48, y, { width: 500 });
      y += 20;

      // ===== SIGNATURE =====
      y = checkPageBreak(doc, y, 80);
      y += 5;
      doc.rect(40, y, 515, 70).stroke(LIGHT_BG);
      y += 8;
      doc.fontSize(9).fillColor(NAVY).font("Helvetica-Bold")
        .text("DECLARACIÓN JURADA Y FIRMA ELECTRÓNICA", 48, y, { width: 500 });
      y += 14;
      doc.fontSize(7).fillColor(GRAY).font("Helvetica")
        .text("El firmante declara bajo fe de juramento que todas las informaciones entregadas son veraces y correctas. Autoriza a UDG Group a realizar los análisis de cumplimiento necesarios.", 48, y, { width: 500 });
      y += 18;
      doc.fontSize(8).fillColor(DARK).font("Helvetica-Bold")
        .text(`Firmante: ${data.signerName || clientName}`, 48, y);
      doc.fontSize(8).fillColor(DARK).font("Helvetica")
        .text(`Fecha de Firma: ${data.signatureDate || dateStr}`, 300, y);

      // Signature image (base64)
      if (data.firmaImage && data.firmaImage.startsWith("data:image")) {
        y += 16;
        try {
          const base64Data = data.firmaImage.split(",")[1];
          if (base64Data) {
            const imgBuffer = Buffer.from(base64Data, "base64");
            doc.image(imgBuffer, 400, y - 12, { width: 120, height: 40 });
          }
        } catch {
          // Signature image could not be embedded, skip
        }
      }

      // ===== FOOTER =====
      const pageCount = doc.bufferedPageRange();
      doc.fontSize(7).fillColor("#9ca3af").font("Helvetica")
        .text(
          "Documento digital seguro generado bajo normativas societarias de Urban Development Group. Confidencialidad garantizada.",
          40, 780, { width: 515, align: "center" }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ===== HELPER FUNCTIONS =====

function checkPageBreak(doc: PDFKit.PDFDocument, y: number, needed: number): number {
  if (y + needed > 760) {
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

/** Etiqueta legible de cada ranura documental. */
const TITULOS_DOCUMENTO: Record<string, string> = {
  idFile: "Copia del Documento de Identidad",
  copiaIdFile: "Copia del Documento de Identidad",
  proofAddressFile: "Prueba de Domicilio",
  origenFondosFile: "Origen de Fondos",
  hasEstadoCuenta: "Estado de Cuenta Bancario",
  hasCertificacionBancaria: "Certificación Bancaria",
  certBancariaFile: "Certificación Bancaria",
  pactoSocialFile: "Pacto Social y sus Adendas",
  avisoOperacionesFile: "Certificado de Aviso de Operaciones",
  serviciosPublicosFile: "Factura de Servicios Públicos",
  certRegistroFile: "Certificado de Registro Público",
  otrosAdjuntosFile: "Otros Adjuntos",
};

/**
 * Agrupa los documentos por ranura para que los campos multi-archivo
 * (Origen de Fondos, Pacto Social, Estados de Cuenta) impriman TODOS sus
 * archivos y no sólo el primero.
 *
 * La fuente principal son las filas de Document; el `data` de la versión se usa
 * como respaldo para no perder archivos que no tengan fila asociada.
 */
export function agruparDocumentos(
  documents: { name: string; fileType: string; documentType?: string | null }[],
  data: any
): { titulo: string; archivos: string[] }[] {
  const porRanura = new Map<string, string[]>();

  const agregar = (ranura: string, nombre: string) => {
    if (!nombre || !nombre.trim()) return;
    const lista = porRanura.get(ranura) || [];
    if (!lista.includes(nombre)) lista.push(nombre);
    porRanura.set(ranura, lista);
  };

  for (const d of documents) {
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
    titulo: TITULOS_DOCUMENTO[ranura] || ranura,
    archivos,
  }));
}

function drawSectionTitle(doc: PDFKit.PDFDocument, y: number, title: string, color: string): number {
  doc.fontSize(9).fillColor(color).font("Helvetica-Bold").text(title.toUpperCase(), 40, y, { width: 515 });
  y += 14;
  doc.moveTo(40, y).lineTo(555, y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
  y += 6;
  return y;
}

// Alto mínimo de una fila de campo; si el valor se parte en varias líneas la
// fila crece hasta donde terminó el texto, para que la siguiente no lo pise.
const ALTO_FILA = 13;
const SEPARACION_FILA = 3;

function drawField(doc: PDFKit.PDFDocument, y: number, label: string, value: string): number {
  doc.fontSize(8).fillColor("#4b5563").font("Helvetica-Bold").text(`${label}:`, 48, y, { continued: true, width: 140 });
  doc.fillColor("#1f2937").font("Helvetica").text(` ${value}`, { width: 400 });
  return Math.max(y + ALTO_FILA, doc.y + SEPARACION_FILA);
}

function drawFieldRow(doc: PDFKit.PDFDocument, y: number, l1: string, v1: string, l2: string, v2: string): number {
  // Cada columna se parte por su cuenta: la fila termina donde termina la más alta.
  let fin = y;
  doc.fontSize(8).fillColor("#4b5563").font("Helvetica-Bold").text(`${l1}:`, 48, y, { width: 120 });
  fin = Math.max(fin, doc.y);
  doc.fillColor("#1f2937").font("Helvetica").text(v1, 170, y, { width: 130 });
  fin = Math.max(fin, doc.y);
  if (l2) {
    doc.fillColor("#4b5563").font("Helvetica-Bold").text(`${l2}:`, 310, y, { width: 120 });
    fin = Math.max(fin, doc.y);
    doc.fillColor("#1f2937").font("Helvetica").text(v2, 430, y, { width: 125 });
    fin = Math.max(fin, doc.y);
  }
  return Math.max(y + ALTO_FILA, fin + SEPARACION_FILA);
}

function drawRow(doc: PDFKit.PDFDocument, x: number, y: number, l1: string, v1: string, l2: string, v2: string): void {
  doc.fontSize(8).fillColor("#4b5563").font("Helvetica-Bold").text(l1, x, y, { width: 60 });
  doc.fillColor("#002b49").font("Helvetica-Bold").text(v1, x + 62, y, { width: 180 });
  doc.fillColor("#4b5563").font("Helvetica-Bold").text(l2, x + 260, y, { width: 80 });
  doc.fillColor("#002b49").font("Helvetica-Bold").text(v2, x + 342, y, { width: 150 });
}

function drawTableHeader(doc: PDFKit.PDFDocument, y: number, headers: string[]): number {
  const colWidth = 500 / headers.length;
  doc.rect(48, y, 507, 14).fill("#f3f4f6");
  headers.forEach((h, i) => {
    doc.fontSize(7).fillColor("#4b5563").font("Helvetica-Bold")
      .text(h, 52 + i * colWidth, y + 3, { width: colWidth - 4 });
  });
  return y + 16;
}

function drawTableRow(doc: PDFKit.PDFDocument, y: number, values: string[]): number {
  const colWidth = 500 / values.length;
  values.forEach((v, i) => {
    doc.fontSize(7).fillColor("#1f2937").font("Helvetica")
      .text(v, 52 + i * colWidth, y + 1, { width: colWidth - 4 });
  });
  doc.moveTo(48, y + 12).lineTo(555, y + 12).strokeColor("#e5e7eb").lineWidth(0.3).stroke();
  return y + 14;
}
