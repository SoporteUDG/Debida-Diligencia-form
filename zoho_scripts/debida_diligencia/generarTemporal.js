/**
 * Botón "Generar temporal" del Canvas de Debida_Diligencia (Zoho CRM > Canvas >
 * botón > acción "Client Script").
 *
 * Genera un enlace temporal con las secciones I a III del formulario (sin
 * documentos ni firma) y lo copia al portapapeles (o lo muestra para copiarlo).
 * Generar otro invalida el anterior. Envía la unidad vendida y el proyecto del
 * registro: con ellos se nombran ("nombre-unidad-proyecto") el Socio de
 * Negocio y la Debida Diligencia que se crean al completarse.
 *
 * Requisitos en Zoho (los mismos del botón Eliminar):
 *  - Conexión "dd_portal" (Custom Service, tipo API Key) que envía el
 *    encabezado  x-api-key: <ZOHO_BUTTON_API_KEY>. La llave vive en la conexión.
 *  - El dominio del portal agregado en Setup > Security Control > Trusted Domains.
 */
var PORTAL_URL = "https://debida-diligencia.udggroup.com/api/generar-temporal";
var CONEXION = "dd_portal"; // nombre de enlace (Link Name) exacto de la conexión
var TITULO = "Generar enlace temporal";
// API names en el registro del Canvas (el primero que tenga valor)
var CAMPOS_UNIDAD = ["Unidad_Vendida", "Unidad_Vendida1"];
var CAMPO_PROYECTO = "Proyecto";

// Texto de un campo (los lookups/picklists pueden venir como objeto)
function texto(valor) {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "object") return String(valor.name || valor.display_value || valor.value || "").trim();
  return String(valor).trim();
}

// Lookup de la unidad vendida como { id, name }: ZDK lo entrega como
// Campo_Lookup_Id (+ el nombre en el campo) o como { id, name }
function unidadVendida(registro) {
  for (var i = 0; i < CAMPOS_UNIDAD.length; i++) {
    var campo = CAMPOS_UNIDAD[i];
    var valor = registro[campo];
    var id = registro[campo + "_Lookup_Id"] || (valor && typeof valor === "object" ? valor.id : "");
    if (id) return { id: String(id), name: texto(valor) };
  }
  return null;
}

// Zoho envuelve la respuesta del portal: { _details: { statusMessage: <cuerpo> } }
// (según la versión también en .response / .data, o ya como objeto)
function cuerpoDe(resp) {
  var crudo = resp;
  if (resp && resp._details && resp._details.statusMessage !== undefined) crudo = resp._details.statusMessage;
  else if (resp && resp.response !== undefined) crudo = resp.response;
  else if (resp && resp.data !== undefined) crudo = resp.data;
  if (typeof crudo === "string") {
    try { return JSON.parse(crudo); } catch (e) { return { error: crudo }; }
  }
  return crudo || {};
}

function mostrarEnlace(url, vence) {
  var texto = "Enlace temporal (vence el " + vence + "):\n\n" + url;
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(url).then(function () {
      ZDK.Client.showAlert("¡Copiado al portapapeles!\n\n" + texto, TITULO);
    }).catch(function () {
      ZDK.Client.showAlert("Copie el siguiente enlace:\n\n" + texto, TITULO);
    });
  } else {
    ZDK.Client.showAlert("Copie el siguiente enlace:\n\n" + texto, TITULO);
  }
}

function mostrarResultado(resp) {
  ZDK.Client.hideLoader();
  log("[generar temporal] respuesta: " + JSON.stringify(resp));
  var cuerpo = cuerpoDe(resp);
  if (cuerpo.success && cuerpo.url) {
    var vence = cuerpo.expiresAt ? new Date(cuerpo.expiresAt).toLocaleString() : "";
    mostrarEnlace(cuerpo.url, vence);
  } else {
    ZDK.Client.showAlert(cuerpo.error || ("Respuesta inesperada: " + JSON.stringify(resp)), TITULO);
  }
}

try {
  var ok = ZDK.Client.showConfirmation(
    "Se generará un enlace temporal con las secciones I a III del formulario. " +
    "Si ya existía uno pendiente para este registro, dejará de funcionar.",
    "Generar",
    "Cancelar"
  );

  if (ok) {
    ZDK.Client.showLoader({ type: "page", template: "vertical-bar", message: "Generando enlace temporal..." });

    // invoke(conexion, url, método, tipo de parámetro (2 = cuerpo JSON), parámetros, encabezados)
    var resp = ZDK.Apps.CRM.Connections.invoke(
      CONEXION,
      PORTAL_URL,
      "POST",
      2,
      {
        recordId: $Page.record_id,
        modulo: "Debida_Diligencia",
        tipo: $Page.record.Tipo_de_Persona || "",
        userId: $Crm.user.id,
        // Name "nombre-unidad-proyecto" del Socio de Negocio y la DD que se crean
        unidad_vendida: unidadVendida($Page.record),
        proyecto: texto($Page.record[CAMPO_PROYECTO])
      },
      { "Content-Type": "application/json" }
    );

    if (resp && typeof resp.then === "function") {
      resp.then(mostrarResultado).catch(function (e) {
        ZDK.Client.hideLoader();
        ZDK.Client.showAlert("Error al llamar al portal: " + JSON.stringify(e), TITULO);
      });
    } else {
      mostrarResultado(resp);
    }
  }
} catch (e) {
  ZDK.Client.hideLoader();
  ZDK.Client.showAlert("Error en el botón: " + (e && e.message ? e.message : JSON.stringify(e)), TITULO);
}
