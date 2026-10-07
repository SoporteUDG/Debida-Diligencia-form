(function () {
  "use strict";

  var tbody = document.getElementById("tabla-body");
  var btnAgregar = document.getElementById("btn-agregar");
  var btnCancelar = document.getElementById("btn-cancelar");
  var aviso = document.getElementById("aviso");

  var registros = [];
  var puedeSolicitar = false;
  var mensaje = "";
  var cerrando = false;

  // ---------- Helpers ----------
  function escapeHtml(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // Busca el campo sin importar mayúsculas/minúsculas (Name / name, type / Type...)
  function campo(obj, nombre) {
    if (!obj) return "";
    var key = Object.keys(obj).find(function (k) { return k.toLowerCase() === nombre.toLowerCase(); });
    var val = key ? obj[key] : "";
    // Campos lookup de Zoho vienen como { name, id }
    if (val && typeof val === "object") return val.name || val.display_value || "";
    return val == null ? "" : val;
  }

  function claseEstado(estado) {
    var s = String(estado || "").toLowerCase();
    if (/(aprob|valid|complet|vigente|activo|ok)/.test(s)) return "ok";
    if (/(pend|proceso|revisi)/.test(s)) return "warn";
    if (/(rechaz|vencid|inval|error|bloque)/.test(s)) return "error";
    return "";
  }

  // El Client Script envía { data: popupData }; Zoho puede envolverlo en
  // uno o más niveles de { data: ... } o enviarlo como string.
  function normalizar(payload) {
    var d = payload;
    for (var n = 0; n < 5; n++) {
      if (typeof d === "string") { try { d = JSON.parse(d); } catch (e) { break; } }
      if (d && typeof d === "object" && !Array.isArray(d) &&
          d.registros === undefined && d.data !== undefined) {
        d = d.data;
      } else {
        break;
      }
    }

    if (!d || typeof d !== "object" || Array.isArray(d)) {
      return { lista: Array.isArray(d) ? d : [], puede: false, mensaje: "" };
    }
    return {
      lista: Array.isArray(d.registros) ? d.registros : [],
      puede: d.puedeSolicitar === true || d.puedeSolicitar === "true",
      mensaje: d.mensaje || ""
    };
  }

  // ---------- Render ----------
  function filaHtml(r) {
    var nombre = escapeHtml(campo(r, "nombre"));
    var enlace = campo(r, "enlace");
    var estado = campo(r, "estado");
    return "<tr>" +
      "<td>" + (enlace
        ? '<a href="' + escapeHtml(enlace) + '" target="_blank" rel="noopener">' + nombre + "</a>"
        : nombre) + "</td>" +
      "<td>" + escapeHtml(campo(r, "tipo")) + "</td>" +
      '<td><span class="estado ' + claseEstado(estado) + '">' + escapeHtml(estado || "—") + "</span></td>" +
      "<td>" + (campo(r, "registro") ? "Creado" : "Pendiente") + "</td>" +
      "</tr>";
  }

  function render() {
    tbody.innerHTML = registros.length
      ? registros.map(filaHtml).join("")
      : '<tr><td colspan="4" class="dd-vacio">No hay registros para mostrar.</td></tr>';

    btnAgregar.disabled = !puedeSolicitar;
    btnCancelar.disabled = false;
    btnAgregar.title = puedeSolicitar ? "" : "No es posible solicitar en este momento";

    if (puedeSolicitar) {
      aviso.hidden = true;
    } else {
      aviso.textContent = mensaje || "No se puede agregar una nueva solicitud con el estado actual de la debida diligencia.";
      aviso.hidden = false;
    }
  }

  // ---------- Cerrar popup ----------
  // Lo enviado a $Client.close() es lo que retorna `await ZDK.Client.openPopup(...)`
  // en el Client Script. No se usa ZOHO.CRM.UI.Popup.close(): cierra el popup sin
  // responder, la promesa queda pendiente y el widget no vuelve a abrir.
  //
  // $Client lo define el script ZDK que el SDK 1.2 carga de forma asíncrona
  // durante init(), así que puede no existir aún en PageLoad: se espera.
  var ESPERA_CLIENT_MS = 5000;

  function esperarClient() {
    return new Promise(function (resolve, reject) {
      var inicio = Date.now();
      (function revisar() {
        if (typeof $Client !== "undefined" && $Client.close) return resolve($Client);
        if (Date.now() - inicio > ESPERA_CLIENT_MS) return reject(new Error("$Client no disponible"));
        setTimeout(revisar, 100);
      })();
    });
  }

  function cerrar(resultado) {
    if (cerrando) return; // evita dobles clics
    cerrando = true;
    btnAgregar.disabled = true;
    btnCancelar.disabled = true;

    esperarClient()
      .then(function (client) { client.close(resultado); })
      .catch(function (e) {
        console.error("No se pudo cerrar el popup", e);
        cerrando = false;
        render();
        aviso.textContent = "No se pudo cerrar la ventana. Ciérrela con la X.";
        aviso.hidden = false;
      });
  }


  btnAgregar.addEventListener("click", function () {
    if (!puedeSolicitar) return;
    cerrar({ accion: "agregar" });
  });

  // ---------- Tamaño ----------
  // Si Zoho no aplica el height de openPopup, el iframe queda en el tamaño por
  // defecto del navegador (150px). Se pide el tamaño explícitamente.
  var ALTO = "625";
  var ANCHO = "390";

  function ajustarTamano() {
    try {
      if (ZOHO.CRM && ZOHO.CRM.UI && ZOHO.CRM.UI.Resize) {
        ZOHO.CRM.UI.Resize({ height: ALTO, width: ANCHO }).catch(function (e) {
          console.warn("No se pudo redimensionar el widget", e);
        });
      }
    } catch (e) {
      console.warn("No se pudo redimensionar el widget", e);
    }
  }

  // ---------- Init Zoho ----------
  // PageLoad se dispara en cada apertura; se reinicia el estado por si Zoho
  // reutiliza el iframe del widget.
  ZOHO.embeddedApp.on("PageLoad", function (payload) {
    console.log("PageLoad payload:", payload, "$Client disponible:", typeof $Client !== "undefined");
    ajustarTamano();
    var n = normalizar(payload);
    registros = n.lista;
    puedeSolicitar = n.puede;
    mensaje = n.mensaje;
    cerrando = false;
    render();
  });

  ZOHO.embeddedApp.init();
})();
