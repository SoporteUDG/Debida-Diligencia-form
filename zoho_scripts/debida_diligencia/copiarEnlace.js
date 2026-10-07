log("Botón presionado");

// 1. Extraer la URL del registro
var urlEnlace = $Page.record.Enlace_de_Formulario || "";

log("URL encontrada: " + urlEnlace);

if (urlEnlace) {
    // 2. Intentar escribir al portapapeles con la API global
    if (typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(urlEnlace).then(function() {
            ZDK.Client.showMessage("¡Enlace copiado al portapapeles!", {
                type: "success"
            });
        }).catch(function(err) {
            // Si el sandbox bloquea el portapapeles, mostrar modal para copiar con un clic
            ZDK.Client.showAlert("Copia el siguiente enlace:\n\n" + urlEnlace);
        });
    } else {
        // Fallback nativo dentro de ZDK
        ZDK.Client.showAlert("Copia el siguiente enlace:\n\n" + urlEnlace);
    }
} else {
    ZDK.Client.showMessage("El campo 'Enlace de Formulario' está vacío.", {
        type: "error"
    });
}