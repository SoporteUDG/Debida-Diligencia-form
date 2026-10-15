
/**
 * log("sample logging statement") --> can be used to print any data in the browser console.
 * ZDK module can be used for customising the UI and other functionalities.
 * return false to prevent <SAVE> action
**/

// Crea un enlace ADICIONAL sobre este expediente (/api/generar-adicional): se
// muestra en "Enlaces adicionales" y su información no se escribe en Zoho.
// No crea registros en Zoho ni enlaces de contactos (esos los crea
// "Generar enlace" o la validación desde el Socio de Negocio).

// Valor de texto de un campo (los lookups/picklists pueden venir como objeto)
function texto(valor) {
    if (valor === null || valor === undefined) return "";
    if (typeof valor === "object") {
        return String(valor.name || valor.display_value || valor.value || "").trim();
    }
    return String(valor).trim();
}

// ID del Socio de Negocio (lookup); "" si no se puede leer. El portal no lo necesita.
function socioDelExpediente() {
    try {
        var socio = typeof $Page.record.Socio_de_Negocios === "function"
            ? $Page.record.Socio_de_Negocios()
            : $Page.record.Socio_de_Negocios;
        return socio && socio.id ? String(socio.id).trim() : "";
    } catch (e) {
        return "";
    }
}

async function CrearOtroDocumento() {
    // 📌 Usamos la confirmación nativa de Zoho
    var confirmacion = ZDK.Client.showConfirmation("¿Deseas crear otro formulario?", "Sí", "No");
    if (confirmacion !== true) {
        return;
    }

    // Nombre
    var formulario = ZDK.Client.getInput([
    {
        type: 'text',
        label: 'Nombre'
    },
    {
        type: 'picklist',
        label: 'Persona de formulario',
        list_options: [{
            actual_value: "Natural",
            display_value: "Persona Natural"
        },
        {
            actual_value: "Jurídica",
            display_value: "Persona Jurídica"
        }],
        default_value: "Natural"
    }

    ], 'Información para el formulario', 'Enviar', 'Cancelar');
    if (formulario === undefined) {
        log("El usuario canceló el formulario.");
        return;
    }

    if (!formulario[0] || String(formulario[0]).trim() == "") {
        ZDK.Client.showAlert("El nombre es requerido.");
        return;
    }

    var name = String(formulario[0]);
    var type = formulario[1] || "Natural";
    var ddId = $Page.record_id;

    // Body
    var body = {
        crmId: ddId,
        name: name.trim(),
        type: type,
        socioId: socioDelExpediente(),
        proyecto: texto($Page.record.Proyecto),
    };

    ZDK.Client.showLoader({
      type: 'page',
      template: 'vertical-bar',
      message: 'Generando enlace adicional de debida diligencia, por favor espere...'
    });

    try {
        var response = await ZDK.HTTP.request({
            url: "https://debida-diligencia.udggroup.com/api/generar-adicional",
            method: "POST",
            content: body,
            headers: {
            "Content-Type": "application/json"
            }
        });

        ZDK.Client.hideLoader();
        var statusCode = await response.getStatusCode();
        var responseBody = await response.getResponse();
        log("HTTP Status: " + statusCode);
        log("Response Body: " + responseBody);

        // El portal explica el motivo en "error" (p. ej. expediente anulado o inexistente)
        var json = {};
        try {
            json = typeof responseBody === "string" ? JSON.parse(responseBody) : (responseBody || {});
        } catch (e) {
            // Respuesta no JSON
        }

        if (statusCode === 200 || statusCode === 201) {
            ZDK.Client.showMessage(json.message || "¡Enlace de debida diligencia generado exitosamente!", { type: "success" });
            $Client.refresh();
        } else {
            ZDK.Client.showMessage(json.error || ("El servidor devolvió status: " + statusCode), { type: "error" });
        }

    } catch (error) {
        ZDK.Client.hideLoader();
        log("Error ZDK: " + error.message);
        ZDK.Client.showMessage("Error: " + error.message, { type: "error" });
    }
}

CrearOtroDocumento()
