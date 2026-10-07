async function reactivarEnlace() {
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
            usuario: usuarioCompleto.profile.name
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

reactivarEnlace();

