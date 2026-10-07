/**
 * Botón "Eliminar" del Canvas de Debida_Diligencia (Zoho CRM > Canvas > botón >
 * acción "Client Script").

 * El servidor valida la llave, lee el perfil del usuario desde Zoho y solo
 * elimina si es "Gerente Gestión Inmobiliaria" o "Administrador" y el
 * formulario nunca se envió.
 */
var PORTAL_URL = "https://debida-diligencia.udggroup.com/api/eliminar-expediente";
var CONEXION = "dd_portal"; 

function mostrarResultado(resp) {
  log("[eliminar DD] respuesta: " + JSON.stringify(resp));

  // Según la versión, la respuesta llega como texto en .response / .data, o ya como objeto
  var crudo = resp && (resp.response !== undefined ? resp.response : (resp.data !== undefined ? resp.data : resp));
  var cuerpo = crudo;
  if (typeof crudo === "string") {
    try { cuerpo = JSON.parse(crudo); } catch (e) { cuerpo = { error: crudo }; }
  }
  cuerpo = cuerpo || {};

    if (cuerpo._details.statusMessage.success) {
    ZDK.Client.hideLoader();
        ZDK.Client.showAlert("Expediente eliminado. Vuelva a la lista de Debida Diligencia.", "Eliminar expediente");
        ZDK.Client.navigateTo('record_list', {
          module: 'Debida_Diligencia'
        });
    } else {
    ZDK.Client.hideLoader();
    ZDK.Client.showAlert(
      cuerpo._details.statusMessage.error || ("Respuesta inesperada: " + JSON.stringify(resp)),
      "Eliminar expediente"
    );
  }
}

try {
  var recordId = $Page.record_id;
  var userId = $Crm.user.id;

  var ok = ZDK.Client.showConfirmation(
    "¿Eliminar este expediente de Debida Diligencia?\n\n" +
    "Si el formulario no ha sido enviado, se eliminarán el registro, su carpeta de WorkDrive y los archivos subidos. " +
    "De lo contrario se archivaran los documentos ya creados bajo otra carpeta."
  );

    if (ok) {
    ZDK.Client.showLoader({
        type: 'page',
        template: 'vertical-bar',
        message: 'Intentando eliminar registro...'
    });

    // invoke(conexion, url, método, tipo de parámetro (2 = cuerpo JSON), parámetros, encabezados)
    var resp = ZDK.Apps.CRM.Connections.invoke(
      CONEXION,
      PORTAL_URL,
      "POST",
      2,
      { crmId: recordId, userId: userId },
      { "Content-Type": "application/json" }
    );

    if (resp && typeof resp.then === "function") {
      resp.then(mostrarResultado).catch(function (e) {
        ZDK.Client.showAlert("Error al llamar al portal: " + JSON.stringify(e), "Eliminar expediente");
      });
    } else {
      mostrarResultado(resp);
    }
  }
} catch (e) {
  ZDK.Client.showAlert("Error en el botón: " + (e && e.message ? e.message : JSON.stringify(e)), "Eliminar expediente");
}

