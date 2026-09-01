import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

const loadPdfLib = (): Promise<void> => {
  return new Promise((resolve) => {
    if ((window as any).PDFLib) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js";
    script.onload = () => resolve();
    document.body.appendChild(script);
  });
};

export async function generatePDF(
  type: "natural" | "juridica",
  data: any,
  id: string,
  dateStr: string,
  documents?: any[]
) {
  const isNatural = type === "natural";
  const clientName = isNatural 
    ? `${data.firstName || ""} ${data.lastName || ""}`.trim() || "Cliente Natural"
    : data.razonSocial || "Empresa Registrada";

  // Create temporary offscreen element for pdf generation
  const element = document.createElement("div");
  element.style.position = "absolute";
  element.style.left = "-9999px";
  element.style.top = "-9999px";
  element.style.width = "800px";
  element.style.padding = "40px";
  element.style.backgroundColor = "#ffffff";
  element.style.color = "#1f2937";
  element.style.fontFamily = "sans-serif";

  // Generate detailed sections based on client type
  let contentHtml = "";

  if (isNatural) {
    contentHtml = `
      <!-- Section 1: General Info -->
      <div style="margin-bottom: 20px;">
        <h3 style="color: #002b49; font-size: 11px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 8px;">
          1. Información del Solicitante
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 9px; line-height: 1.6;">
          <tr>
            <td style="width: 25%; font-weight: bold; color: #4b5563; padding: 4px 0;">Nombre Completo:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.firstName || ""} ${data.lastName || ""}</td>
            <td style="width: 25%; font-weight: bold; color: #4b5563; padding: 4px 0;">Nacionalidad:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.nationality || "-"}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Identificación:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.tipoIdentificacion || "Cédula"}: ${data.idNumber || "-"}</td>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Vencimiento ID:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.fechaVencimientoId ? `${data.fechaVencimientoId} ${new Date(data.fechaVencimientoId) < new Date() ? "(⚠️ VENCIDO)" : ""}` : "No registrada"}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Fecha Nacimiento:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.fechaNacimiento || "-"}</td>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">País Residencia Fiscal:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.paisResidenciaFiscal || "-"}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">NIF / ID Tributaria:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.idTributaria || "-"}</td>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Correo Electrónico:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.email || "-"}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Teléfono / Celular:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.telefono || ""} / ${data.celular || ""}</td>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Profesión / Ocupación:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.profession || "-"}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Patrono / Empleador:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.employer || "-"}</td>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Cargo Desempeñado:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.cargoDesempena || "-"}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Dirección Laboral:</td>
            <td colspan="3" style="color: #1f2937; padding: 4px 0;">${data.direccionLaboral || "-"}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Dirección Residencial:</td>
            <td colspan="3" style="color: #1f2937; padding: 4px 0;">${data.direccionResidencial || "-"}, ${data.ciudad || ""}, ${data.provincia || ""}, ${data.paisResidencial || ""}</td>
          </tr>
        </table>
      </div>

      <!-- Section 2: Financial Info & PEP -->
      <div style="margin-bottom: 20px;">
        <h3 style="color: #002b49; font-size: 11px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 8px;">
          2. Perfil Financiero y Origen de Fondos
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 9px; line-height: 1.6;">
          <tr>
            <td style="width: 25%; font-weight: bold; color: #4b5563; padding: 4px 0;">Ingresos Mensuales Promedio:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.ingresosMensuales || "-"}</td>
            <td style="width: 25%; font-weight: bold; color: #4b5563; padding: 4px 0;">Fuente de Fondos:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.fuenteFondosInmueble || "-"}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Monto Servicios Anuales:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.montoServiciosAnuales || "-"}</td>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Destino de Fondos:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.destinoInmueble || "Adquisición de Inmueble"}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">¿Persona PEP? (Expuesta Políticamente):</td>
            <td style="color: #1f2937; padding: 4px 0; font-weight: bold;">${data.esPep || "No"}</td>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">¿Adquiere a Nombre de Tercero?:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.adquiereNombreTercero || "No"}</td>
          </tr>
          ${data.esPep === "Sí" ? `
          <tr>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Detalles PEP:</td>
            <td colspan="3" style="color: #1f2937; padding: 4px 0;">
              <strong>Nombre:</strong> ${data.pepNombre || "-"} | 
              <strong>Cargo:</strong> ${data.pepCargo || "-"} | 
              <strong>Institución:</strong> ${data.pepInstitucion || "-"} | 
              <strong>Relación:</strong> ${data.pepRelacion || "-"}
            </td>
          </tr>
          ` : ""}
          <tr>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Actividad Económica Principal:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.actEconPrincipal || "-"}</td>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">% Dedicación:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.pctDedicacionPrincipal || "100"}%</td>
          </tr>
          <tr>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Jurisdicción Principal:</td>
            <td colspan="3" style="color: #1f2937; padding: 4px 0;">${data.jurisdiccionPrincipal || "-"}</td>
          </tr>
        </table>
      </div>
    `;
  } else {
    // Corporativa/Jurídica
    contentHtml = `
      <!-- Section 1: Empresa -->
      <div style="margin-bottom: 20px;">
        <h3 style="color: #002b49; font-size: 11px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 8px;">
          1. Información de la Empresa / Sociedad
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 9px; line-height: 1.6;">
          <tr>
            <td style="width: 25%; font-weight: bold; color: #4b5563; padding: 4px 0;">Razón Social:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.razonSocial || "-"}</td>
            <td style="width: 25%; font-weight: bold; color: #4b5563; padding: 4px 0;">R.U.C. / Registro:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.ruc || "-"}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Fecha Constitución:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.fechaConstitucion || "-"}</td>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">País de Inscripción:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.paisInscripcion || "-"}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">País donde Opera:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.paisOpera || "-"}</td>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Tipo de Sociedad:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.tipoSociedad || "-"}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Tipo de Cliente:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.tipoCliente || "-"}</td>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Actividad Principal:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.actividadPrincipal || "-"} (${data.porcentajeActividad || "100"}%)</td>
          </tr>
          <tr>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">País Tributación:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.paisTributacion || "-"}</td>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">NIF / ID Tributaria:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.numeroIdTributaria || "-"}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Teléfono Oficina:</td>
            <td style="color: #1f2937; padding: 4px 0;">(${data.empresaTelefonoCodigo || ""}) ${data.empresaTelefono || ""}</td>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Celular Contacto:</td>
            <td style="color: #1f2937; padding: 4px 0;">(${data.empresaCelularCodigo || ""}) ${data.empresaCelular || ""}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Correo Empresa:</td>
            <td colspan="3" style="color: #1f2937; padding: 4px 0;">${data.empresaEmail || "-"}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Dirección Oficina (Física):</td>
            <td colspan="3" style="color: #1f2937; padding: 4px 0;">${data.empresaDireccion || "-"}, ${data.empresaCiudad || ""}, ${data.empresaProvincia || ""}, ${data.empresaPais || ""}</td>
          </tr>
        </table>
      </div>

      <!-- Section 2: Representante Legal -->
      <div style="margin-bottom: 20px;">
        <h3 style="color: #002b49; font-size: 11px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 8px;">
          2. Información del Representante Legal (RL)
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 9px; line-height: 1.6;">
          <tr>
            <td style="width: 25%; font-weight: bold; color: #4b5563; padding: 4px 0;">Nombre Completo RL:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.rlNombre || "-"}</td>
            <td style="width: 25%; font-weight: bold; color: #4b5563; padding: 4px 0;">Identificación RL:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.rlNoIdentificacion || data.numeroDocumento || "-"}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Vencimiento ID:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.fechaVencimientoId ? `${data.fechaVencimientoId} ${new Date(data.fechaVencimientoId) < new Date() ? "(⚠️ VENCIDO)" : ""}` : "No registrada"}</td>
          <tr>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Fecha Nacimiento RL:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.rlFechaNacimiento || "-"}</td>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Profesión RL:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.rlProfesionOcupacion || "-"}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Profesión RL:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.rlProfesionOcupacion || "-"}</td>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Actividad Económica RL:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.rlActividadEconomica || "-"}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Teléfono RL:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.rlTelefono || "-"}</td>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">País Residencia RL:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.rlPaisResidencia || "-"}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Dirección RL:</td>
            <td colspan="3" style="color: #1f2937; padding: 4px 0;">${data.rlDireccion || "-"}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Propósito de la Relación:</td>
            <td colspan="3" style="color: #1f2937; padding: 4px 0;">${data.rlObjetoInvestigacion || "-"}</td>
          </tr>
        </table>
      </div>

      <!-- Section 3: Junta Directiva -->
      <div style="margin-bottom: 20px;">
        <h3 style="color: #002b49; font-size: 11px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 8px;">
          3. Gobierno Corporativo / Junta Directiva
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 8px; line-height: 1.5;">
          <thead>
            <tr style="background-color: #f3f4f6; border-bottom: 1px solid #e5e7eb;">
              <th style="padding: 4px; text-align: left; font-weight: bold; color: #4b5563; width: 15%;">Cargo</th>
              <th style="padding: 4px; text-align: left; font-weight: bold; color: #4b5563; width: 25%;">Nombre y Apellidos</th>
              <th style="padding: 4px; text-align: left; font-weight: bold; color: #4b5563; width: 15%;">Identificación</th>
              <th style="padding: 4px; text-align: left; font-weight: bold; color: #4b5563; width: 15%;">Nacionalidad</th>
              <th style="padding: 4px; text-align: left; font-weight: bold; color: #4b5563; width: 30%;">Dirección</th>
            </tr>
          </thead>
          <tbody>
            ${data.gjcMembers && data.gjcMembers.length > 0 ? data.gjcMembers.map((m: any) => `
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 4px; font-weight: bold;">${m.cargo || "-"}</td>
                <td style="padding: 4px;">${m.nombre || ""} ${m.apellidos || ""}</td>
                <td style="padding: 4px;">${m.nroId || "-"}</td>
                <td style="padding: 4px;">${m.nacionalidad || "-"}</td>
                <td style="padding: 4px;">${m.direccion || "-"}</td>
              </tr>
            `).join("") : `
              <tr>
                <td colspan="5" style="padding: 8px; text-align: center; color: #9ca3af; font-style: italic;">Ningún miembro registrado en la Junta Directiva.</td>
              </tr>
            `}
          </tbody>
        </table>
      </div>

      <!-- Section 4: Beneficiarios Finales -->
      <div style="margin-bottom: 20px;">
        <h3 style="color: #002b49; font-size: 11px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 8px;">
          4. Beneficiarios Finales (>10% Participación)
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 8px; line-height: 1.5;">
          <thead>
            <tr style="background-color: #f3f4f6; border-bottom: 1px solid #e5e7eb;">
              <th style="padding: 4px; text-align: left; font-weight: bold; color: #4b5563; width: 35%;">Nombre Completo</th>
              <th style="padding: 4px; text-align: left; font-weight: bold; color: #4b5563; width: 20%;">Identificación</th>
              <th style="padding: 4px; text-align: left; font-weight: bold; color: #4b5563; width: 15%;">% Participación</th>
              <th style="padding: 4px; text-align: left; font-weight: bold; color: #4b5563; width: 30%;">Dirección</th>
            </tr>
          </thead>
          <tbody>
            ${data.bfMembers && data.bfMembers.length > 0 ? data.bfMembers.map((m: any) => `
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 4px; font-weight: bold;">${m.nombreCompleto || "-"}</td>
                <td style="padding: 4px;">${m.noIdentificacion || "-"}</td>
                <td style="padding: 4px;">${m.porcentajeParticipacion || m.porcentaje || "-"}%</td>
                <td style="padding: 4px;">${m.direccion || "-"}</td>
              </tr>
            `).join("") : `
              <tr>
                <td colspan="4" style="padding: 8px; text-align: center; color: #9ca3af; font-style: italic;">Ningún beneficiario final registrado.</td>
              </tr>
            `}
          </tbody>
        </table>
      </div>

      <!-- Section 5: Perfil Financiero Empresa -->
      <div style="margin-bottom: 20px;">
        <h3 style="color: #002b49; font-size: 11px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 8px;">
          5. Perfil Financiero y de Cumplimiento
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 9px; line-height: 1.6;">
          <tr>
            <td style="width: 25%; font-weight: bold; color: #4b5563; padding: 4px 0;">Ingresos Mensuales Promedio:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.ingresosMensuales || "-"}</td>
            <td style="width: 25%; font-weight: bold; color: #4b5563; padding: 4px 0;">Volumen Ventas Anual:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.volumenVentas || "-"}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Banco de Referencia:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.bancoReferencia || "-"}</td>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Monto Servicios Anuales:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.montoServiciosAnuales || "-"}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Fuente de Fondos:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.origenFondos || "-"}</td>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Destino de Fondos:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.destinoFondos || "-"}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">¿Persona PEP? (Junta/Propietarios):</td>
            <td style="color: #1f2937; padding: 4px 0; font-weight: bold;">${data.esPep || "No"}</td>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Actividad Comercial:</td>
            <td style="color: #1f2937; padding: 4px 0;">${data.actividadComercial || "-"}</td>
          </tr>
          ${data.esPep === "Sí" ? `
          <tr>
            <td style="font-weight: bold; color: #4b5563; padding: 4px 0;">Detalles PEP:</td>
            <td colspan="3" style="color: #1f2937; padding: 4px 0;">
              <strong>Nombre:</strong> ${data.pepNombre || "-"} | 
              <strong>Cargo:</strong> ${data.pepCargo || "-"} | 
              <strong>Institución:</strong> ${data.pepInstitucion || "-"} | 
              <strong>Relación:</strong> ${data.pepRelacion || "-"}
            </td>
          </tr>
          ` : ""}
        </table>
      </div>
    `;
  }

  element.innerHTML = `
    <!-- Header -->
    <div style="border-bottom: 2px solid #002b49; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <h1 style="color: #002b49; font-size: 20px; font-weight: bold; margin: 0; letter-spacing: 0.5px; text-transform: uppercase;">
          Urban Development Group
        </h1>
        <p style="font-size: 10px; color: #c8a788; margin: 2px 0 0 0; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">
          Expediente de Debida Diligencia
        </p>
      </div>
      <div style="text-align: right;">
        <span style="background-color: #002b49; color: #ffffff; padding: 4px 10px; border-radius: 4px; font-size: 9px; font-weight: bold;">
          ID: ${id}
        </span>
        <p style="font-size: 9px; color: #6b7280; margin: 4px 0 0 0;">Fecha: ${dateStr}</p>
      </div>
    </div>

    <!-- Info Block -->
    <div style="background-color: #f3f4f6; border-left: 4px solid #c8a788; padding: 12px; margin-bottom: 20px; border-radius: 0 8px 8px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
        <tr>
          <td style="width: 15%; font-weight: bold; color: #4b5563; padding: 2px 0;">Cliente:</td>
          <td style="font-weight: bold; color: #002b49; padding: 2px 0;">${clientName}</td>
          <td style="width: 15%; font-weight: bold; color: #4b5563; padding: 2px 0;">Proyecto:</td>
          <td style="font-weight: bold; color: #002b49; padding: 2px 0;">${data.nombreProyecto || "General UDG"}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; color: #4b5563; padding: 2px 0;">Tipo:</td>
          <td style="color: #374151; padding: 2px 0; text-transform: capitalize;">Persona ${isNatural ? "Natural" : "Jurídica"}</td>
          <td style="font-weight: bold; color: #4b5563; padding: 2px 0;">Medio de Pago:</td>
          <td style="color: #374151; padding: 2px 0;">${data.medioPago || "-"}</td>
        </tr>
      </table>
    </div>

    <!-- Dynamic Sections based on Client Type -->
    ${contentHtml}

    <!-- Section 6: Documents Attached -->
    <div style="margin-bottom: 20px;">
      <h3 style="color: #002b49; font-size: 11px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 8px;">
        Documentos Adjuntados y Verificados
      </h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 9px; line-height: 1.6;">
        <thead>
          <tr style="background-color: #fafafa; border-bottom: 1px solid #e5e7eb;">
            <th style="padding: 4px; text-align: left; font-weight: bold; color: #4b5563;">Requisito Documental</th>
            <th style="padding: 4px; text-align: center; font-weight: bold; color: #4b5563; width: 20%;">Adjuntado</th>
            <th style="padding: 4px; text-align: left; font-weight: bold; color: #4b5563; width: 40%;">Nombre de Archivo</th>
          </tr>
        </thead>
        <tbody>
          ${isNatural ? `
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 4px;">Copia del Documento de Identidad Personal (Cédula o Pasaporte)</td>
              <td style="padding: 4px; text-align: center; font-weight: bold; color: ${data.idFile ? "#059669" : "#dc2626"};">${data.idFile ? "SÍ" : "NO"}</td>
              <td style="padding: 4px; color: #6b7280; font-size: 8px;">${data.idFile || "-"}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 4px;">Origen de Fondos (Carta Laboral, Declaración de Renta, etc.)</td>
              <td style="padding: 4px; text-align: center; font-weight: bold; color: ${data.origenFondosFile ? "#059669" : "#dc2626"};">${data.origenFondosFile ? "SÍ" : "NO"}</td>
              <td style="padding: 4px; color: #6b7280; font-size: 8px;">${data.origenFondosFile || "-"}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 4px;">Comprobante de Domicilio (Recibo de Agua, Luz, Telefonía)</td>
              <td style="padding: 4px; text-align: center; font-weight: bold; color: ${data.proofAddressFile ? "#059669" : "#dc2626"};">${data.proofAddressFile ? "SÍ" : "NO"}</td>
              <td style="padding: 4px; color: #6b7280; font-size: 8px;">${data.proofAddressFile || "-"}</td>
            </tr>
          ` : `
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 4px;">Copia del Pacto Social Registrado y Enmiendas</td>
              <td style="padding: 4px; text-align: center; font-weight: bold; color: ${data.pactoSocialFile ? "#059669" : "#dc2626"};">${data.pactoSocialFile ? "SÍ" : "NO"}</td>
              <td style="padding: 4px; color: #6b7280; font-size: 8px;">${data.pactoSocialFile || "-"}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 4px;">Aviso de Operaciones de la Empresa (si aplica)</td>
              <td style="padding: 4px; text-align: center; font-weight: bold; color: ${data.avisoOperacionesFile ? "#059669" : "#6b7280"};">${data.avisoOperacionesFile ? "SÍ" : "NO"}</td>
              <td style="padding: 4px; color: #6b7280; font-size: 8px;">${data.avisoOperacionesFile || "-"}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 4px;">Factura de Servicios Públicos que acredite Dirección Física</td>
              <td style="padding: 4px; text-align: center; font-weight: bold; color: ${data.serviciosPublicosFile ? "#059669" : "#dc2626"};">${data.serviciosPublicosFile ? "SÍ" : "NO"}</td>
              <td style="padding: 4px; color: #6b7280; font-size: 8px;">${data.serviciosPublicosFile || "-"}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 4px;">Certificación de Cuenta Bancaria o Referencia</td>
              <td style="padding: 4px; text-align: center; font-weight: bold; color: ${data.certBancariaFile ? "#059669" : "#dc2626"};">${data.certBancariaFile ? "SÍ" : "NO"}</td>
              <td style="padding: 4px; color: #6b7280; font-size: 8px;">${data.certBancariaFile || "-"}</td>
            </tr>
          `}
        </tbody>
      </table>
    </div>

    <!-- Section 7: Cumplimiento y Notas -->
    <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; background-color: #fafafa; margin-bottom: 20px;">
      <h3 style="color: #002b49; font-size: 10px; font-weight: bold; text-transform: uppercase; margin-top: 0; margin-bottom: 6px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">
        Conclusiones de Cumplimiento (Solo Oficial de Cumplimiento)
      </h3>
      <p style="font-size: 9px; color: #374151; margin: 0; padding: 4px; background-color: #ffffff; border: 1px dashed #d1d5db; border-radius: 4px; min-height: 40px;">
        ${data.conclusionesVerificacion || "Registro formalizado y archivado satisfactoriamente por el oficial de cumplimiento."}
      </p>
    </div>

    <!-- Section 8: Signature -->
    <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; page-break-inside: avoid;">
      <h3 style="color: #002b49; font-size: 10px; font-weight: bold; text-transform: uppercase; margin-top: 0; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">
        Declaración Jurada y Firma Electrónica
      </h3>
      <p style="font-size: 7.5px; color: #6b7280; margin: 0 0 12px 0; text-align: justify; line-height: 1.4;">
        El firmante comprador o representante debidamente acreditado declara solemnemente bajo fe de juramento que todas las informaciones entregadas para este registro son veraces y correctas. Autoriza expresamente a UDG Group a realizar los análisis de cumplimiento necesarios.
      </p>
      
      <div style="display: flex; justify-content: space-between; align-items: flex-end; gap: 20px;">
        <div style="width: 50%;">
          <p style="font-size: 8px; font-weight: bold; margin: 0 0 2px 0; color: #4b5563;">Nombre del Firmante:</p>
          <p style="font-size: 9px; margin: 0 0 8px 0; font-weight: bold; color: #002b49; border-bottom: 1px solid #e5e7eb; padding-bottom: 2px;">
            ${data.signerName || clientName}
          </p>
          <p style="font-size: 8px; font-weight: bold; margin: 0 0 2px 0; color: #4b5563;">Fecha de Firma:</p>
          <p style="font-size: 9px; margin: 0; color: #374151;">
            ${data.signatureDate || dateStr}
          </p>
        </div>

        <div style="width: 45%; text-align: center;">
          <p style="font-size: 8px; font-weight: bold; margin: 0 0 4px 0; color: #4b5563; text-align: left;">Firma Electrónica Autorizada:</p>
          <div style="border: 1px solid #d1d5db; border-radius: 4px; background-color: #fafafa; padding: 6px; height: 60px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
            ${data.firmaImage ? `
              <img src="${data.firmaImage}" style="max-height: 100%; max-width: 100%; object-fit: contain;" />
            ` : `
              <span style="font-size: 8px; color: #9ca3af; font-style: italic; line-height: 48px;">Firma registrada digitalmente</span>
            `}
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 8px; text-align: center; font-size: 8px; color: #9ca3af;">
      Documento digital seguro generado bajo normativas societarias de Urban Development Group. Confidencialidad garantizada.
    </div>
  `;

  document.body.appendChild(element);

  const typePrefix = isNatural ? "Natural" : "Juridica";

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL("image/png");
    
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    const imgWidth = 210;
    const pageHeight = 295;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // Merge attachments if provided
    if (documents && documents.length > 0) {
      const activeDocuments = documents.filter(doc => doc.zohoFileId && doc.status !== "DELETED");
      
      if (activeDocuments.length > 0) {
        console.log(`[PDF Generator] Preparando para combinar ${activeDocuments.length} anexos...`);
        await loadPdfLib();
        const { PDFDocument } = (window as any).PDFLib;
        
        const mainPdfArrayBuffer = pdf.output("arraybuffer");
        const mergedPdf = await PDFDocument.load(mainPdfArrayBuffer);
        
        // Retrieve draft uuid token or admin cookie context implicitly
        const draftToken = localStorage.getItem("udg_draft_token") || "";

        for (const doc of activeDocuments) {
          try {
            console.log(`[PDF Generator] Cargando anexo: ${doc.name} (ID: ${doc.zohoFileId})`);
            const proxyUrl = `/api/documents/download?fileId=${doc.zohoFileId}&token=${draftToken}`;
            const fileRes = await fetch(proxyUrl);
            
            if (!fileRes.ok) {
              console.warn(`[PDF Generator] No se pudo descargar anexo "${doc.name}":`, fileRes.statusText);
              continue;
            }
            
            const fileBytes = await fileRes.arrayBuffer();
            const lowerName = doc.name.toLowerCase();
            
            if (lowerName.endsWith(".pdf") || doc.fileType === "application/pdf") {
              const attachmentPdf = await PDFDocument.load(fileBytes);
              const copiedPages = await mergedPdf.copyPages(attachmentPdf, attachmentPdf.getPageIndices());
              copiedPages.forEach((page: any) => mergedPdf.addPage(page));
              console.log(`[PDF Generator] PDF combinado: ${doc.name}`);
            } else if (
              lowerName.endsWith(".jpg") || 
              lowerName.endsWith(".jpeg") || 
              doc.fileType === "image/jpeg"
            ) {
              const image = await mergedPdf.embedJpg(fileBytes);
              const page = mergedPdf.addPage();
              const { width, height } = page.getSize();
              
              // Scale image to fit within A4 limits with margins
              const scale = Math.min((width - 40) / image.width, (height - 40) / image.height);
              const x = (width - image.width * scale) / 2;
              const y = (height - image.height * scale) / 2;
              
              page.drawImage(image, {
                x,
                y,
                width: image.width * scale,
                height: image.height * scale,
              });
              console.log(`[PDF Generator] Imagen combinada: ${doc.name}`);
            }
          } catch (docErr) {
            console.error(`[PDF Generator Error] Falló al combinar anexo "${doc.name}":`, docErr);
          }
        }
        
        const mergedPdfBytes = await mergedPdf.save();
        const blob = new Blob([mergedPdfBytes], { type: "application/pdf" });
        const blobUrl = URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = `Expediente_UDG_${typePrefix}_${id}.pdf`;
        link.click();
        
        console.log(`[PDF Generator] Descarga del expediente combinado iniciada.`);
        return;
      }
    }

    // Default download fallback (only main form PDF)
    pdf.save(`Expediente_UDG_${typePrefix}_${id}.pdf`);
  } catch (error) {
    console.error("Error generating PDF:", error);
    alert("Hubo un error al generar el PDF.");
  } finally {
    document.body.removeChild(element);
  }
}
