// ==========================================
// Generar enlace (botón del módulo Debida Diligencia)
//
// Para expedientes creados a mano en Zoho: crea los enlaces que le faltan al
// expediente (nunca crea otro registro). El portal hace el mismo análisis que
// al generar desde el Socio de Negocio:
// - Natural: enlace principal del Contacto estándar (el expediente debe tenerlo
//   en Nombre de contacto) y un enlace relacionado por cada otro contacto.
// - Jurídica: enlace principal, el del Representante Legal y uno relacionado
//   por cada contacto del Socio de Negocio. No requiere contacto.
// ==========================================

var API_URL = "https://debida-diligencia.udggroup.com/api/generar-enlace";

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

async function generarEnlace() {
  var tipo = $Page.record.Tipo_de_Persona;
  var juridica = esJuridica(tipo);

  if (juridica) {
    var continuar = ZDK.Client.showConfirmation(
      "Se generará el enlace de Persona Jurídica, el del Representante Legal y el de cada contacto del Socio de Negocio, " +
      "todos sobre este mismo registro.",
      "Confirmar",
      "Volver"
    );
    if (!continuar) return;
  }

  ZDK.Client.showLoader({
    type: "page",
    template: "vertical-bar",
    message: "Generando enlaces de debida diligencia, por favor espere..."
  });

  try {
    var response = await ZDK.HTTP.request({
      url: API_URL,
      method: "POST",
      content: {
        recordId: $Page.record_id,
        modulo: "Debida_Diligencia",
        tipo: tipo
      },
      headers: { "Content-Type": "application/json" }
    });
    ZDK.Client.hideLoader();

    var statusCode = await response.getStatusCode();
    var respuesta = await response.getResponse();
    log("HTTP Status: " + statusCode);
    log("Response Body: " + respuesta);

    var json = leerJson(respuesta);
    if (statusCode === 200 || statusCode === 201) {
      ZDK.Client.showMessage(json.message || "¡Enlaces generados exitosamente!", { type: "success" });
      $Client.refresh();
    } else if (statusCode === 409 && json.code === "ALREADY_EXISTS") {
      ZDK.Client.showMessage(json.error || "Los enlaces de este expediente ya fueron creados.", { type: "info" });
    } else if (statusCode === 409 || statusCode === 422) {
      // El portal explica el motivo (sin contacto, contacto no estándar, sin Representante Legal, anulado...)
      ZDK.Client.showMessage(json.error || "No se pudo generar el enlace (status " + statusCode + ").", { type: "warning" });
    } else {
      ZDK.Client.showMessage(json.error || "El servidor devolvió status: " + statusCode, { type: "error" });
    }
  } catch (error) {
    ZDK.Client.hideLoader();
    log("Error ZDK: " + error.message);
    ZDK.Client.showMessage("Error: " + error.message, { type: "error" });
  }
}

generarEnlace();
