// ==========================================
// Crear Socio de Negocio y contacto (botón del módulo Debida Diligencia)
//
// Para expedientes creados desde /registro/* que aún no tienen Socio de Negocio:
// crea el Contact (Persona Natural) y el Socio de Negocio con los datos que el
// cliente capturó en su enlace, igual que al completar un enlace temporal, y
// después asocia el expediente (renombra, mueve carpetas, Estado "En borrador").
//
// Antes de crear nada valida (el portal lo vuelve a validar):
// - que el expediente aún no tenga Socio de Negocio,
// - que tenga un enlace creado (con nombre y RUC / ID tributaria del cliente),
// - que el RUC / ID tributaria no exista ya en Zoho,
// - y la confirmación del usuario.
// ==========================================

var API_CREAR = "https://debida-diligencia.udggroup.com/api/crear-socio-contacto";
var API_ASOCIAR = "https://debida-diligencia.udggroup.com/api/asociar-socio";

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

async function llamar(url) {
  var response = await ZDK.HTTP.request({
    url: url,
    method: "POST",
    content: JSON.stringify({ recordId: $Page.record_id }),
    headers: { "Content-Type": "application/json" }
  });
  var statusCode = await response.getStatusCode();
  var respuesta = await response.getResponse();
  log(url + " -> HTTP " + statusCode + ": " + respuesta);
  return { status: statusCode, json: leerJson(respuesta) };
}

async function crearSocioContacto() {
  var record = $Page.record;
  var juridica = esJuridica(record.Tipo_de_Persona);

  // 1. Validaciones locales (rápidas; el portal valida de nuevo)
  if (record.Socio_de_Negocios) {
    ZDK.Client.showMessage("El expediente ya tiene un Socio de Negocio.", { type: "info" });
    return;
  }
  if (!record.Enlace_Debida_Diligencia && !record.Enlace_Formulario && !record.Client_Form_Link) {
    ZDK.Client.showMessage("El expediente no tiene un enlace creado: genere su enlace primero.", { type: "warning" });
    return;
  }

  // 2. Confirmación del usuario
  var continuar = ZDK.Client.showConfirmation(
    "Se creará " + (juridica ? "el Socio de Negocio" : "el Contacto y el Socio de Negocio") +
    " con los datos que el cliente capturó en su enlace, y se asociarán a este expediente " +
    "(se renombrará, sus carpetas pasarán a la del socio y su estado a \"En borrador\").\n\n" +
    "Antes se verificará que el RUC / ID tributaria no exista ya en Zoho.\n\n¿Desea continuar?",
    "Confirmar",
    "Volver"
  );
  if (!continuar) return;

  ZDK.Client.showLoader({
    type: "page",
    template: "vertical-bar",
    message: "Creando el Socio de Negocio, por favor espere..."
  });

  try {
    // 3. Crear (el portal valida enlace, nombre, RUC / ID tributaria y duplicados)
    var creado = await llamar(API_CREAR);
    if (creado.status !== 200 && creado.status !== 201) {
      ZDK.Client.hideLoader();
      var tipoMsg = creado.status === 409 || creado.status === 422 ? "warning" : "error";
      ZDK.Client.showMessage(creado.json.error || "No se pudo crear el Socio de Negocio (status " + creado.status + ").", { type: tipoMsg });
      return;
    }

    // 4. Asociar el expediente al socio recién creado
    var asociado = await llamar(API_ASOCIAR);
    ZDK.Client.hideLoader();
    if (asociado.status === 200 || asociado.status === 201) {
      ZDK.Client.showMessage(asociado.json.message || "¡Socio de Negocio creado y expediente asociado!", { type: "success" });
    } else {
      // El socio ya existe y está atado al expediente; falta renombrar / mover carpetas
      ZDK.Client.showMessage(
        "El Socio de Negocio se creó, pero el expediente aún no se asoció: " +
        (asociado.json.error || "status " + asociado.status) +
        " Use el botón Asociar socio cuando el socio tenga su carpeta de documentos.",
        { type: "warning" }
      );
    }
    $Client.refresh();
  } catch (error) {
    ZDK.Client.hideLoader();
    log("Error ZDK: " + error.message);
    ZDK.Client.showMessage("Error: " + error.message, { type: "error" });
  }
}

crearSocioContacto();
