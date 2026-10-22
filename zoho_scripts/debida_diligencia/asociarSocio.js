// ==========================================
// Asociar socio (botón del módulo Debida Diligencia)
//
// Para expedientes creados desde /registro/* (Estado "Sin Asociar"): cuando ya
// tienen un Socio de Negocio, el portal lo guarda en su base, renombra el
// registro, mueve sus carpetas de WorkDrive a la del socio y el Estado pasa a
// "En borrador". En la natural, además, toma el Contacto estándar (lo guarda en
// Nombre de contacto) y le copia los datos del cliente si ya completó el formulario.
// ==========================================

var API_URL = "https://debida-diligencia.udggroup.com/api/asociar-socio";

function esJuridica(tipo) {
  return String(tipo || "").toLowerCase().indexOf("jur") !== -1;
}

// Cuerpo de la respuesta como objeto (Zoho puede entregarlo como texto)
function leerJson(cuerpo) {
  try {
    return typeof cuerpo === "string" ? JSON.parse(cuerpo) : (cuerpo || {});
  } catch (e) {
    return {};
  }
}

async function asociarSocio() {
  if ($Page.record.Estado !== "Sin Asociar") {
    ZDK.Client.showMessage("El expediente no está en estado \"Sin Asociar\".", { type: "info" });
    return;
  }
  if (!$Page.record.Socio_de_Negocios) {
    ZDK.Client.showMessage("Asigne primero el Socio de Negocio al expediente.", { type: "warning" });
    return;
  }

  var mensaje =
    "Se asociará este expediente al Socio de Negocio:\n" +
    "- El registro se renombrará a \"nombre-unidad-proyecto\" y su estado pasará a \"En borrador\".\n" +
    "- Las carpetas de documentos se moverán a la carpeta del Socio de Negocio.\n";
  if (!esJuridica($Page.record.Tipo_de_Persona)) {
    mensaje +=
      "- Se tomará el Contacto estándar del Socio de Negocio (o, si no tiene contactos, el de este expediente) " +
      "y se guardará en Nombre de contacto.\n" +
      "- Si el cliente ya completó su formulario, sus datos personales se copiarán a ese contacto " +
      "(también quedan en este registro). Si aún no lo completa, al hacerlo se guardarán en ese contacto.\n";
  }
  var continuar = ZDK.Client.showConfirmation(mensaje + "\n¿Desea continuar?", "Confirmar", "Volver");
  if (!continuar) return;

  ZDK.Client.showLoader({
    type: "page",
    template: "vertical-bar",
    message: "Asociando el expediente al Socio de Negocio, por favor espere..."
  });

  try {
    var response = await ZDK.HTTP.request({
      url: API_URL,
      method: "POST",
      content: JSON.stringify({ recordId: $Page.record_id }),
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
    } else if (statusCode === 409 || statusCode === 422) {
      // El portal explica el motivo (sin socio, sin Contacto estándar, anulado...)
      ZDK.Client.showMessage(json.error || "No se pudo asociar el expediente (status " + statusCode + ").", { type: "warning" });
    } else {
      ZDK.Client.showMessage(json.error || "El servidor devolvió status: " + statusCode, { type: "error" });
    }
  } catch (error) {
    ZDK.Client.hideLoader();
    log("Error ZDK: " + error.message);
    ZDK.Client.showMessage("Error: " + error.message, { type: "error" });
  }
}

asociarSocio();
