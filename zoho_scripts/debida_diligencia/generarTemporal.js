/**
 * Botón "Generar temporal" de la vista de lista (Zoho CRM > módulo > vista de
 * lista > botón > acción "Client Script"). No depende de ningún registro: el
 * enlace crea un Socio de Negocio y una Debida Diligencia nuevos al completarse.
 *
 * Formulario emergente: Persona de Tipo (Natural / Jurídica, la del Socio de
 * Negocio que se creará), Proyecto e ID SAP de la unidad (texto, requerido).
 * Antes de enviar nada, el script busca la unidad por su ID_SAP en
 * MODULO_UNIDADES (el módulo del lookup Accounts.Unidad_Vendida1): debe haber
 * exactamente un registro; su id va al portal como Unidad_Vendida1. Luego
 * genera un enlace temporal con las secciones I a III del formulario (sin
 * documentos ni firma) y lo copia al portapapeles (o lo muestra para copiarlo).
 * Con la unidad y el proyecto se nombran ("nombre-unidad-proyecto") el Socio
 * de Negocio y la Debida Diligencia que se crean.
 *
 * Requisitos en Zoho (los mismos del botón Eliminar):
 *  - Conexión "dd_portal" (Custom Service, tipo API Key) que envía el
 *    encabezado  x-api-key: <ZOHO_BUTTON_API_KEY>. La llave vive en la conexión.
 *  - El dominio del portal agregado en Setup > Security Control > Trusted Domains.
 */
var PORTAL = "https://debida-diligencia.udggroup.com/api";
var CONEXION = "dd_portal"; // nombre de enlace (Link Name) exacto de la conexión
var TITULO = "Generar enlace temporal";
var SIN_PROYECTO = "-Ninguno-";
// API name del módulo al que apunta el lookup Unidad_Vendida1 de Accounts
// (Setup > Desarrollador > API > Nombres de API). VERIFICAR antes de publicar.
var MODULO_UNIDADES = "Products";
var CAMPO_ID_SAP = "ID_SAP";
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

// POST al portal por la conexión; devuelve el cuerpo ya interpretado
async function portal(ruta, parametros) {
  // invoke(conexion, url, método, tipo de parámetro (2 = cuerpo JSON), parámetros, encabezados)
  var resp = await ZDK.Apps.CRM.Connections.invoke(
    CONEXION, PORTAL + ruta, "POST", 2, parametros, { "Content-Type": "application/json" }
  );
  log("[generar temporal] " + ruta + ": " + JSON.stringify(resp));
  return cuerpoDe(resp);
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
      label: "ID SAP de la unidad"
    }
  ], TITULO, "Generar", "Cancelar");
}

// Valor para un criterio de búsqueda de Zoho: paréntesis y comas van escapados
function valorCriterio(valor) {
  return String(valor).replace(/([(),\\])/g, "\\$1");
}

// Unidades (registros de MODULO_UNIDADES) cuyo ID_SAP es exactamente `idSap`
async function unidadesPorIdSap(idSap) {
  var modulo = ZDK.Apps.CRM[MODULO_UNIDADES];
  if (!modulo) throw new Error("No existe el módulo \"" + MODULO_UNIDADES + "\" en ZDK (revise MODULO_UNIDADES).");
  var registros = await modulo.searchByCriteria("(" + CAMPO_ID_SAP + ":equals:" + valorCriterio(idSap) + ")");
  // searchByCriteria no distingue mayúsculas: se confirma la coincidencia exacta
  return (registros || []).filter(function (r) {
    return String(r[CAMPO_ID_SAP] || "").trim() === idSap;
  });
}

// Módulo de la vista de lista donde está el botón (solo informativo para el portal)
function moduloActual() {
  try {
    return (typeof $Page !== "undefined" && $Page && $Page.module) ? String($Page.module) : "";
  } catch (e) {
    return "";
  }
}

async function generarTemporal() {
  var datos = pedirDatos();
  if (datos === undefined) {
    log("[generar temporal] El usuario canceló el formulario.");
    return;
  }
  var personaDeTipo = String(datos[0] || "").trim();
  var proyecto = String(datos[1] || "").trim();
  var idSap = String(datos[2] || "").trim();
  if (proyecto === SIN_PROYECTO) proyecto = "";
  if (!personaDeTipo) {
    ZDK.Client.showAlert("Seleccione la Persona de Tipo (Natural o Jurídica).", TITULO);
    return;
  }
  if (!idSap) {
    ZDK.Client.showAlert("El ID SAP de la unidad es requerido.", TITULO);
    return;
  }

  // Validación de la unidad en Zoho: un único registro con ese ID_SAP (nada se envía si no)
  ZDK.Client.showLoader({ type: "page", template: "vertical-bar", message: "Validando la unidad..." });
  var coincidencias = await unidadesPorIdSap(idSap);
  ZDK.Client.hideLoader();
  if (!coincidencias.length) {
    ZDK.Client.showAlert("No existe ninguna unidad con ID SAP \"" + idSap + "\". Revise el valor e intente de nuevo.", TITULO);
    return;
  }
  if (coincidencias.length > 1) {
    ZDK.Client.showAlert("Hay " + coincidencias.length + " unidades con ID SAP \"" + idSap + "\". Corrija el duplicado en Zoho.", TITULO);
    return;
  }
  var unidad = { id: String(coincidencias[0].id), name: String(coincidencias[0].Name || idSap).trim() };

  ZDK.Client.showLoader({ type: "page", template: "vertical-bar", message: "Generando enlace temporal..." });
  var cuerpo = await portal("/generar-temporal", {
    persona_de_tipo: personaDeTipo,
    modulo: moduloActual(),
    userId: $Crm.user.id,
    // Lookup Unidad_Vendida1 y Name "nombre-unidad-proyecto" de lo que se crea
    unidad_vendida: { id: unidad.id, name: unidad.name },
    proyecto: proyecto
  });
  ZDK.Client.hideLoader();
  if (cuerpo.success && cuerpo.url) {
    var vence = cuerpo.expiresAt ? new Date(cuerpo.expiresAt).toLocaleString() : "";
    mostrarEnlace(cuerpo.url, vence);
  } else {
    ZDK.Client.showAlert(cuerpo.error || ("Respuesta inesperada: " + JSON.stringify(cuerpo)), TITULO);
  }
}

generarTemporal().catch(function (e) {
  ZDK.Client.hideLoader();
  ZDK.Client.showAlert("Error en el botón: " + (e && e.message ? e.message : JSON.stringify(e)), TITULO);
});
