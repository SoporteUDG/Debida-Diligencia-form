/**
 * Botón "Generar temporal" de la vista de lista (Zoho CRM > módulo > vista de
 * lista > botón > acción "Client Script"). No depende de ningún registro: el
 * enlace crea un Socio de Negocio y una Debida Diligencia nuevos al completarse.
 *
 * Pide en un formulario emergente la Persona de Tipo (Natural / Jurídica, la
 * del Socio de Negocio que se creará), el proyecto y la unidad; genera un
 * enlace temporal con las secciones I a III del formulario (sin documentos ni
 * firma) y lo copia al portapapeles (o lo muestra para copiarlo). Con la unidad
 * y el proyecto se nombran ("nombre-unidad-proyecto") el Socio de Negocio y la
 * Debida Diligencia que se crean.
 *
 * Requisitos en Zoho (los mismos del botón Eliminar):
 *  - Conexión "dd_portal" (Custom Service, tipo API Key) que envía el
 *    encabezado  x-api-key: <ZOHO_BUTTON_API_KEY>. La llave vive en la conexión.
 *  - El dominio del portal agregado en Setup > Security Control > Trusted Domains.
 */
var PORTAL_URL = "https://debida-diligencia.udggroup.com/api/generar-temporal";
var CONEXION = "dd_portal"; // nombre de enlace (Link Name) exacto de la conexión
var TITULO = "Generar enlace temporal";
var SIN_PROYECTO = "-Ninguno-";
// Opciones del picklist Proyecto de Accounts (las mismas que valida el portal)
var PROYECTOS = [
  "Altos del Parque", "Caminos de Centennial", "Deici", "Guayacán", "Living73",
  "New West I", "New West II", "Paramount", "Spotlight", "The Hub"
];

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

// Formulario emergente; undefined si el usuario cancela
function pedirDatos() {
  return ZDK.Client.getInput([
    {
      type: "picklist",
      label: "Persona de Tipo",
      list_options: [
        { actual_value: "Natural", display_value: "Persona Natural" },
        { actual_value: "Jurídica", display_value: "Persona Jurídica" }
      ],
      default_value: "Natural"
    },
    {
      type: "picklist",
      label: "Proyecto",
      list_options: [{ actual_value: SIN_PROYECTO, display_value: SIN_PROYECTO }].concat(
        PROYECTOS.map(function (p) { return { actual_value: p, display_value: p }; })
      ),
      default_value: SIN_PROYECTO
    },
    {
      type: "text",
      label: "Unidad (opcional)"
    }
  ], TITULO, "Generar", "Cancelar");
}

// Módulo de la vista de lista donde está el botón (solo informativo para el portal)
function moduloActual() {
  try {
    return (typeof $Page !== "undefined" && $Page && $Page.module) ? String($Page.module) : "";
  } catch (e) {
    return "";
  }
}

try {
  var datos = pedirDatos();

  if (datos === undefined) {
    log("[generar temporal] El usuario canceló el formulario.");
  } else {
    var personaDeTipo = String(datos[0] || "").trim();
    var proyecto = String(datos[1] || "").trim();
    var unidad = String(datos[2] || "").trim();
    if (proyecto === SIN_PROYECTO) proyecto = "";

    if (!personaDeTipo) {
      ZDK.Client.showAlert("Seleccione la Persona de Tipo (Natural o Jurídica).", TITULO);
    } else {
      ZDK.Client.showLoader({ type: "page", template: "vertical-bar", message: "Generando enlace temporal..." });

      // invoke(conexion, url, método, tipo de parámetro (2 = cuerpo JSON), parámetros, encabezados)
      var resp = ZDK.Apps.CRM.Connections.invoke(
        CONEXION,
        PORTAL_URL,
        "POST",
        2,
        {
          persona_de_tipo: personaDeTipo,
          modulo: moduloActual(),
          userId: $Crm.user.id,
          // Name "nombre-unidad-proyecto" del Socio de Negocio y la DD que se crean
          unidad_vendida: unidad ? { name: unidad } : null,
          proyecto: proyecto
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
  }
} catch (e) {
  ZDK.Client.hideLoader();
  ZDK.Client.showAlert("Error en el botón: " + (e && e.message ? e.message : JSON.stringify(e)), TITULO);
}
