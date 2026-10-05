/**
 * Botón "Eliminar" del Canvas de Debida_Diligencia (Zoho CRM > Canvas > botón >
 * acción "Client Script").
 *
 * Requisitos en Zoho:
 *  - Conexión (Setup > Developer Hub > Connections > Custom Service, tipo API Key)
 *    llamada "dd_portal" que envía el encabezado  x-api-key: <ZOHO_BUTTON_API_KEY>.
 *    La llave vive en la conexión, no en este script.
 *  - El dominio del portal agregado a las URLs permitidas de la conexión.
 *
 * El servidor valida la llave, lee el perfil del usuario desde Zoho y solo
 * elimina si es "Gerente Gestión Inmobiliaria" o "Administrador" y el
 * formulario nunca se envió.
 */
var PORTAL_URL = "https://debida-diligencia.duckdns.org/api/eliminar-expediente";
var CONEXION = "dd_portal";

var recordId = $Page.record_id;
var userId = $Crm.user.id;

var ok = ZDK.Client.showConfirmation(
  "¿Eliminar este expediente de Debida Diligencia?\n\n" +
  "Se eliminarán el registro, su carpeta de WorkDrive y los archivos subidos. " +
  "Solo es posible si el formulario nunca fue enviado."
);

if (ok) {
  ZDK.Client.showLoader({ type: "page", template: "spinner", message: "Eliminando expediente..." });

  // invoke(conexion, url, método, tipo de parámetro (2 = cuerpo JSON), parámetros, encabezados)
  var resp = ZDK.Apps.CRM.Connections.invoke(
    CONEXION,
    PORTAL_URL,
    "POST",
    2,
    { crmId: recordId, userId: userId },
    { "Content-Type": "application/json" }
  );

  ZDK.Client.hideLoader();

  var cuerpo = {};
  try { cuerpo = JSON.parse(resp.response || resp.data || "{}"); } catch (e) {}

  if (cuerpo.success) {
    ZDK.Client.showMessage("Expediente eliminado.", { type: "success" });
    // El registro ya no existe: volver a la lista del módulo
    ZDK.Client.navigateTo("/crm/tab/" + $Page.module);
  } else {
    ZDK.Client.showAlert(cuerpo.error || "No se pudo eliminar el expediente.", "Eliminar expediente");
  }
}
