/**
 * Botón "Eliminar" del Canvas de Debida_Diligencia (Zoho CRM > Canvas > botón >
 * acción "Client Script").
 *
 * Requisitos en Zoho:
 *  - Conexión (Setup > Developer Hub > Connections > Custom Service, tipo API Key)
 *    llamada "dd_portal" que envía el encabezado  x-api-key: <ZOHO_BUTTON_API_KEY>.
 *    La llave vive en la conexión, no en este script.
 *  - El dominio del portal agregado en Setup > Security Control > Trusted Domains.
 *
 * El servidor valida la llave, lee el perfil del usuario desde Zoho y solo
 * elimina si es "Gerente Gestión Inmobiliaria" o "Administrador" y el
 * formulario nunca se envió.
 *
 * Versión de diagnóstico: todo va dentro de try/catch y se muestra lo que
 * devuelve Zoho, porque un error dentro del Client Script se traga en silencio.
 */
var PORTAL_URL = "https://debida-diligencia.duckdns.org/api/eliminar-expediente";
var CONEXION = "dd_portal"; // nombre de enlace (Link Name) exacto de la conexión

function mostrarResultado(resp) {
  log("[eliminar DD] respuesta: " + JSON.stringify(resp));

  // Zoho envuelve la respuesta del portal: { status, code, message, _details: { statusMessage: <cuerpo del portal> } }.
  // Según la versión también puede venir en .response / .data, o ya como objeto.
  var crudo = resp;
  if (resp && resp._details && resp._details.statusMessage !== undefined) crudo = resp._details.statusMessage;
  else if (resp && resp.response !== undefined) crudo = resp.response;
  else if (resp && resp.data !== undefined) crudo = resp.data;
  var cuerpo = crudo;
  if (typeof crudo === "string") {
    try { cuerpo = JSON.parse(crudo); } catch (e) { cuerpo = { error: crudo }; }
  }
  cuerpo = cuerpo || {};

  if (cuerpo.success) {
    ZDK.Client.showAlert("Expediente eliminado. Vuelva a la lista de Debida Diligencia.", "Eliminar expediente");
  } else {
    ZDK.Client.showAlert(
      cuerpo.error || ("Respuesta inesperada: " + JSON.stringify(resp)),
      "Eliminar expediente"
    );
  }
}

try {
  var recordId = $Page.record_id;
  var userId = $Crm.user.id;
  log("[eliminar DD] record=" + recordId + " user=" + userId);

  var ok = ZDK.Client.showConfirmation(
    "¿Eliminar este expediente de Debida Diligencia?\n\n" +
    "Se eliminarán el registro, su carpeta de WorkDrive y los archivos subidos. " +
    "Solo es posible si el formulario nunca fue enviado."
  );

  if (ok) {
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
