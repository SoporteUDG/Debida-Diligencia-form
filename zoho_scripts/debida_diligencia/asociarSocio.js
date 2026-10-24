// ==========================================
// Asociar socio (Client Script del módulo Debida Diligencia)
//
// Se ejecuta en cada cambio del Socio de Negocio:
//   Client Script > Canvas de detalle > Evento de Campo > onBeforeUpdate,
//   campo "Socio_de_Negocios".
//
// El portal valida que el socio nuevo no tenga otra Debida Diligencia, mueve las
// carpetas de WorkDrive (de la raíz o del socio anterior) a la del socio nuevo, ata
// todos los contactos del socio al expediente y, en la natural, guarda el Contacto
// estándar en Nombre de contacto. Si lo rechaza, el portal restaura el socio anterior
// y este script cancela el cambio. No genera enlaces.
//
// En onBeforeUpdate el registro todavía trae la información ANTERIOR: de ahí sale el
// socio anterior, y el nuevo se consulta de nuevo (ver obtenerSocioNuevo).
// ==========================================

var API_URL = "https://debida-diligencia.udggroup.com/api/asociar-socio";

// Cuerpo de la respuesta como objeto (Zoho puede entregarlo como texto)
function leerJson(cuerpo) {
  try {
    return typeof cuerpo === "string" ? JSON.parse(cuerpo) : (cuerpo || {});
  } catch (e) {
    return {};
  }
}

// ID de un lookup (objeto con id, función o texto); "" si está vacío
function idDe(lookup) {
  var v = typeof lookup === "function" ? lookup() : lookup;
  return v && typeof v === "object" ? String(v.id || "") : String(v || "");
}

// Socio nuevo: se consulta el registro otra vez, porque $Page.record trae el valor anterior
function obtenerSocioNuevo() {
  var registro = ZDK.Apps.CRM.Debida_Diligencia.fetchById($Page.record_id);
  return idDe(registro && registro.Socio_de_Negocios);
}

async function asociarSocio() {
  var socioAnteriorId = idDe($Page.record.Socio_de_Negocios);
  var socioId = obtenerSocioNuevo();
  log("Socio anterior: " + socioAnteriorId + " / nuevo: " + socioId);

  // Sin cambio real (o el nuevo valor aún no se refleja): nada que asociar
  if (!socioId || socioId === socioAnteriorId) return true;

  ZDK.Client.showLoader({
    type: "page",
    template: "vertical-bar",
    message: "Asociando el expediente al Socio de Negocio, por favor espere..."
  });

  try {
    var response = await ZDK.HTTP.request({
      url: API_URL,
      method: "POST",
      content: JSON.stringify({
        recordId: $Page.record_id,
        socioId: socioId,
        socioAnteriorId: socioAnteriorId
      }),
      headers: { "Content-Type": "application/json" }
    });
    ZDK.Client.hideLoader();

    var statusCode = await response.getStatusCode();
    var respuesta = await response.getResponse();
    log("HTTP Status: " + statusCode);
    log("Response Body: " + respuesta);

    var json = leerJson(respuesta);
    if (statusCode === 200 || statusCode === 201) {
      ZDK.Client.showMessage(json.message || "¡Expediente asociado exitosamente!", { type: "success" });
      $Client.refresh();
      return true;
    }
    // Rechazado (socio con otra DD, sin carpeta, sin contacto estándar, anulado...):
    // el portal explica el motivo y, si había socio anterior, ya lo restauró
    ZDK.Client.showMessage(
      json.error || "No se pudo asociar el expediente (status " + statusCode + ").",
      { type: statusCode === 409 || statusCode === 422 ? "warning" : "error" }
    );
    if (json.restaurado) $Client.refresh();
    return false;
  } catch (error) {
    ZDK.Client.hideLoader();
    log("Error ZDK: " + error.message);
    ZDK.Client.showMessage("Error: " + error.message, { type: "error" });
    return false;
  }
}

return await asociarSocio();
