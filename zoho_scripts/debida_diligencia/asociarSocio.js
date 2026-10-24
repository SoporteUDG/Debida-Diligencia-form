// ==========================================
// Asociar socio (Client Script del módulo Debida Diligencia)
//
//   Client Script > Canvas de detalle > Evento de Campo > onBeforeUpdate,
//   campo "Socio_de_Negocios".
//
// Este script solo PIDE CONFIRMACIÓN y refresca la página. La sincronización la hace el
// workflow "Asociar socio" (asociarSocioWorkflow.deluge), que corre cuando ya se guardó
// el Socio de Negocio nuevo: valida que el socio no tenga otra Debida Diligencia, mueve
// las carpetas, ata los contactos y, si lo rechaza, restaura el socio anterior y deja el
// motivo como nota del expediente.
// ==========================================

// Segundos que se espera antes de refrescar, para que el workflow alcance a terminar
var ESPERA_REFRESCO = 8;

// ID de un lookup (objeto con id, función o texto); "" si está vacío
function idDe(lookup) {
  var v = typeof lookup === "function" ? lookup() : lookup;
  return v && typeof v === "object" ? String(v.id || "") : String(v || "");
}

function confirmarCambio() {
  var anterior = idDe($Page.record.Socio_de_Negocios);
  var mensaje =
    "Al cambiar el Socio de Negocio se sincronizará el expediente:\n" +
    "- Las carpetas de documentos pasarán a la carpeta del nuevo socio.\n" +
    "- Los contactos del nuevo socio se asociarán a este registro.\n" +
    "- El Socio de Negocio no puede tener otra Debida Diligencia: si la tiene, el cambio se revierte" +
    (anterior ? " y se restaura el socio anterior.\n" : ".\n") +
    "\n¿Desea continuar?";
  return ZDK.Client.showConfirmation(mensaje, "Confirmar", "Cancelar");
}

if (!confirmarCambio()) {
  return false; // cancela el cambio de socio
}

ZDK.Client.showMessage("Sincronizando el Socio de Negocio, la página se actualizará en unos segundos...", { type: "info" });
try {
  setTimeout(function () {
    $Client.refresh();
  }, ESPERA_REFRESCO * 1000);
} catch (e) {
  log("No se pudo programar el refresco: " + e.message);
}
return true;
