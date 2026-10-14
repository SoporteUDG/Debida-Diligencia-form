
/** 
 * log("sample logging statement") --> can be used to print any data in the browser console.
 * ZDK module can be used for customising the UI and other functionalities.
 * return false to prevent <SAVE> action
**/

async function mostrarDocumentosAdicionales() {

    //api/generar - adicional ? crmId = <ID del expediente en Zoho>
    var debidaDiligenciaId = $Page.record_id;
    log(debidaDiligenciaId);

    ZDK.Client.showLoader({
      type: 'page',
      template: 'vertical-bar',
      message: 'Generando enlace de debida diligencia, por favor espere...'
    });

    try {
        var response = await ZDK.HTTP.request({
            url: "https://debida-diligencia.udggroup.com/api/generar-adicional",
            method: "GET",
            parameters: {
                crmId: debidaDiligenciaId,
                }
        });

        ZDK.Client.hideLoader();
        var statusCode = response.getStatusCode();
        var responseBody = response.getResponse();
        log("HTTP Status: " + statusCode);
        log("Response Body: " + responseBody);

        const data = JSON.parse(responseBody);
      
        if (statusCode === 200 || statusCode === 201) {
            
        } else {
            ZDK.Client.showMessage("El servidor devolvió status: " + statusCode, { type: "error" });
            return;
            }

        // Fila del widget a partir de un enlace del portal
        function aFila(link) {
            return {
                nombre: link.name,
                enlace: link.clientUrl,
                estado: link.linkStatus,
                vigencia: link.expiresAt ? new Date(link.expiresAt).toLocaleDateString('es-ES') : "",
                token: link.token,
                rol: link.role === "PRINCIPAL" ? "principal"
                    : link.representante ? "representante"
                    : link.role === "RELATED" ? "relacionado" : "adicional",
            };
        }

        // "Enlaces de Contactos": principal + relacionados. "Enlaces adicionales": los de generar-adicional.
        // (data.forms son los mismos enlaces ya enviados: no se agregan otra vez)
        var contactos = (data.contactLinks || []).map(aFila);
        var adicionales = (data.links || []).map(aFila);
        var linkList = contactos.concat(adicionales);

        log(linkList);
        var resultadoPopup = null;
        try {
            // openPopup puede devolver una promesa: se espera (sin await la acción elegida se perdería)
            resultadoPopup = await ZDK.Client.openPopup({
                api_name: "Adicionales_Debida_Diligencia",
                type: "popup",
                type: "widget",
                header: "Documentos de Debida Diligencia",
                animation_type: 1,
                height: "450px",
                width: "1100px",
                left: "center"
            }, {

                data: { contactos: contactos, adicionales: adicionales }

            });
        } catch (e) {
            // X button or popup dismissed: treat as "no action"
            console.log("Popup closed without a response", e);
            return;
        }
        
        console.log(
            "Resultado del Widget:",
            resultadoPopup
        );

        // X can also resolve with undefined/null, or with something that isn't our payload
        if (!resultadoPopup || typeof resultadoPopup !== "object" || !resultadoPopup.type) return;

        switch (resultadoPopup && resultadoPopup.type) {

            case "reactivar": {
                // El enlace principal se reactiva como el expediente (sin token: su último enlace)
                await reactivarDocumentoAdicional(resultadoPopup.rol === "principal" ? null : resultadoPopup.token);

            } break;
            case "ver": {
                ZDK.Client.showMessage("¡Ir a visitar enlace!", { type: "success" });
                const getLink = linkList.find((link) => link.token === resultadoPopup.token);
                $Client.openURL("https://debida-diligencia.udggroup.com/expediente?link=" + getLink.enlace);
            } break;
            case "delete": {
                // El widget no ofrece borrar el principal (se elimina con el expediente)
                if (resultadoPopup.rol === "principal") return;
                await eliminarDocumentoAdicional(resultadoPopup.token);
            } break;
            default: return;
        }

    } catch(error) {
        ZDK.Client.hideLoader();
        log("Error ZDK: " + error.message);
        ZDK.Client.showMessage("Error: " + error.message, { type: "error" });
    }
}


//helpers 
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
        ZDK.Client.showAlert("Expediente eliminado.", "Eliminar expediente");
        $Client.refresh();
  } else {
    ZDK.Client.showAlert(
      cuerpo._details.statusMessage.error || ("Respuesta inesperada: " + JSON.stringify(resp)),
      "Eliminar expediente"
    );
  }
}
async function eliminarDocumentoAdicional(token) {
    var PORTAL_URL = "https://debida-diligencia.udggroup.com/api/eliminar-adicional";
    var CONEXION = "dd_portal"; 
    try {
        var recordId = token;
        var userId = $Crm.user.id;

        var ok = ZDK.Client.showConfirmation(
            "¿Eliminar este enlace de Debida Diligencia?\n\n" +
            "Si el formulario nunca fue enviado se eliminan el enlace, su carpeta de WorkDrive y los archivos subidos. " +
            "Si ya fue enviado se anula y su carpeta pasa a Eliminados."
        );

        if (ok) {

            // invoke(conexion, url, método, tipo de parámetro (2 = cuerpo JSON), parámetros, encabezados)
            var resp = ZDK.Apps.CRM.Connections.invoke(
                CONEXION,
                PORTAL_URL,
                "POST",
                2,
                { token: recordId, userId: userId, reason: "…" },
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

}

async function reactivarDocumentoAdicional(token) {
    ZDK.Client.showLoader({
        type: 'page',
        template: 'vertical-bar',
        message: 'Reactivando enlace, por favor espere...'
    });

    try {

        var usuarioCompleto = ZDK.Apps.CRM.Users.fetchById($Crm.user.id);
        const payload = {
            recordId: $Page.record_id,
            modulo: "Debida_Diligencia",
            usuario: usuarioCompleto.profile.name,
        };
        if (token) payload.token = token;

        const response = await ZDK.HTTP.request({
            url: "https://debida-diligencia.udggroup.com/api/reactivar", 
            method: "POST",
            content: JSON.stringify(payload),
            headers: {
                "Content-Type": "application/json"
            }
        });

        ZDK.Client.hideLoader();

        const statusCode = await response.getStatusCode();
        const responseBody = await response.getResponse();
        
        log("HTTP Status: " + statusCode);
        log("Response Body: " + responseBody);

        if (statusCode === 200 || statusCode === 201) {
            ZDK.Client.showMessage("¡Enlace reactivado exitosamente!", { type: "success" });
            $Client.refresh();
        } else {
            ZDK.Client.showMessage("El servidor no pudo procesar la solicitud (Status: " + statusCode + ")", { type: "error" });
        }

    } catch (error) {
        ZDK.Client.hideLoader();
        log("Error en VPS: " + error.message);
        ZDK.Client.showMessage("Error al conectar: " + error.message, { type: "error" });
    }
}


//ejecucion
mostrarDocumentosAdicionales();