
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

        var linkList = []
        data.links.map((link) => {
            const fechatp = new Date(link.expiresAt);
            const fecha = fechatp.toLocaleDateString('es-ES'); 

            const newLink = {
                enlace: link.clientUrl,
                estado: link.linkStatus,
                vigencia: fecha,
                token: link.token,
            }
            linkList.push(newLink);
        });
        data.forms.map((form) => {
            const fechatp = new Date(form.expiresAt);
            const fecha = fechatp.toLocaleDateString('es-ES'); 
            const newLink = {
                enlace: form.clientUrl,
                estado: form.linkStatus,
                vigencia: fecha,
                token: form.token,
            }
            linkList.push(newLink);
        });

        log(linkList);
        var resultadoPopup = null;
        try {
            resultadoPopup = ZDK.Client.openPopup({
                api_name: "Adicionales_Debida_Diligencia",
                type: "popup",
                type: "widget",
                header: "Documentos de Debida Diligencia",
                animation_type: 1,
                height: "450px",
                width: "1100px",
                left: "center"
            }, {

                data: linkList

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
                await reactivarDocumentoAdicional(resultadoPopup.token);

            } break;
            case "ver": {
                ZDK.Client.showMessage("¡Ir a visitar enlace!", { type: "success" });
                const getLink = linkList.find((link) => link.token === resultadoPopup.token);
                $Client.openURL("https://debida-diligencia.udggroup.com/expediente?link=" + getLink.enlace);
            } break;
            case "delete": {
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
            "¿Eliminar este documento adicional de Debida Diligencia?\n\n" +
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
            token: token,
        };

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