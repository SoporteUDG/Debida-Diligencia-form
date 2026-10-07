if ($Page.record.Tipo_de_Persona == "Jurídica") {

  var isProceed = ZDK.Client.showConfirmation('Al crear un formulario de tipo entidad jurídica, se creará un registro relacionado de tipo persona natural.', 'Confirmar', 'Volver');
  if (isProceed) {
    ZDK.Client.showLoader({
      type: 'page',
      template: 'vertical-bar',
      message: 'Generando enlace Persona Jurídica, por favor espere...'
    });

    try {
      var payload = {
        recordId: $Page.record_id,
        modulo: "Debida_Diligencia",
        tipo: $Page.record.Tipo_de_Persona,
      };
      var response = await ZDK.HTTP.request({
        url: "https://debida-diligencia.udggroup.com/api/generar-expediente",
        method: "POST",
        content: payload,
        headers: {
          "Content-Type": "application/json"
        }
      });

      ZDK.Client.hideLoader();

      var statusCode = await response.getStatusCode();
      var responseBody = await response.getResponse();

      log("HTTP Status: " + statusCode);
      log("Response Body: " + responseBody);
      

      if (statusCode === 200 || statusCode === 201) {
        ZDK.Client.showMessage("¡Enlace Persona Jurídica generado exitosamente!", { type: "success" });
        $Client.refresh();
      } else {
        if (statusCode === 422) {
          ZDK.Client.showMessage("No hay contacto anexado, añadalo en la vista de edicion.", { type: "warning" });
        } else {
          ZDK.Client.showMessage("El servidor devolvió status: " + statusCode, { type: "error" });
        }
      }
    } catch (error) {
      ZDK.Client.hideLoader();
      log("Error ZDK: " + error.message);
      ZDK.Client.showMessage("Error: " + error.message, { type: "error" });
    }
  } else {
    ZDK.Client.hideLoader();
  }

} else {
  ZDK.Client.showLoader({
      type: 'page',
      template: 'vertical-bar',
      message: 'Generando enlace Persona Jurídica, por favor espere...'
    });

    try {
      var payload = {
        recordId: $Page.record_id,
        modulo: "Debida_Diligencia",
        tipo: $Page.record.Tipo_de_Persona,
      };
      var response = await ZDK.HTTP.request({
        url: "https://debida-diligencia.udggroup.com/api/generar-enlace",
        method: "POST",
        content: payload,
        headers: {
          "Content-Type": "application/json"
        }
      });

      ZDK.Client.hideLoader();

      var statusCode = await response.getStatusCode();
      var responseBody = await response.getResponse();

      log("HTTP Status: " + statusCode);
      log("Response Body: " + responseBody);
      if (statusCode === 422) {
        ZDK.Client.showMessage("No hay contacto anexado, añadalo en la vista de edicion.", { type: "warning" });
      }

      if (statusCode === 200 || statusCode === 201) {
        ZDK.Client.showMessage("¡Enlace Persona Jurídica generado exitosamente!", { type: "success" });
        $Client.refresh();
      } else {
        if (statusCode === 422) {
          ZDK.Client.showMessage("No hay contacto anexado, añadalo en la vista de edicion.", { type: "warning" });
        } else {
          ZDK.Client.showMessage("El servidor devolvió status: " + statusCode, { type: "error" });
        }
      }
    } catch (error) {
      ZDK.Client.hideLoader();
      log("Error ZDK: " + error.message);
      ZDK.Client.showMessage("Error: " + error.message, { type: "error" });
    }
}

