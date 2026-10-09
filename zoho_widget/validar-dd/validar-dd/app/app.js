(function () {
  "use strict";

  var tbody = document.getElementById("tabla-body");
  var btnAgregar = document.getElementById("btn-agregar");
  var aviso = document.getElementById("aviso");

  var registros = [];
  var faltanPrincipales = false;
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
      return { lista: Array.isArray(d) ? d : [], principales: false, puede: false, mensaje: "" };
    }
    return {
      lista: Array.isArray(d.registros) ? d.registros : [],
      principales: esVerdadero(d.faltanPrincipales),
      puede: esVerdadero(d.puedeSolicitar),
      mensaje: d.mensaje || ""
    };
  }

  function esVerdadero(v) {
    return v === true || v === "true";
  }

  // Contactos marcados (los únicos que se envían)
  function contactosMarcados() {
    return registros
      .filter(function (r) { return esVerdadero(campo(r, "seleccionable")) && r.seleccionado && campo(r, "contactId"); })
      .map(function (r) { return String(campo(r, "contactId")); });
  }

  // Se puede agregar si faltan los principales (jurídica) o hay algún contacto marcado
  function hayAlgoQueAgregar() {
    return puedeSolicitar && (faltanPrincipales || contactosMarcados().length > 0);
  }

  // ---------- Render ----------
  // Casilla: los contactos sin DD se pueden marcar; los ya creados quedan
  // marcados y bloqueados; las DD principales (jurídica) no llevan casilla.
  function casillaHtml(r, i) {
    if (esVerdadero(campo(r, "principal"))) return '<span class="dd-principal" title="Se genera siempre que falte">—</span>';
    var creado = esVerdadero(campo(r, "registro"));
    var habilitada = puedeSolicitar && esVerdadero(campo(r, "seleccionable"));
    return '<input type="checkbox" class="dd-check" data-i="' + i + '"' +
      (creado || r.seleccionado ? " checked" : "") +
      (habilitada ? "" : " disabled") +
      ' title="' + (creado ? "Ya tiene su Debida Diligencia" : "Generar su Debida Diligencia") + '">';
  }

  function filaHtml(r, i) {
    var nombre = escapeHtml(campo(r, "nombre"));
    var enlace = campo(r, "enlace");
    var estado = campo(r, "estado");
    return '<tr class="' + (esVerdadero(campo(r, "principal")) ? "dd-fila-principal" : "") + '">' +
      '<td class="dd-col-check">' + casillaHtml(r, i) + "</td>" +
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
      : '<tr><td colspan="5" class="dd-vacio">No hay registros para mostrar.</td></tr>';

    actualizarBoton();

    if (puedeSolicitar) {
      aviso.hidden = true;
    } else {
      aviso.textContent = mensaje || "No se puede agregar una nueva solicitud con el estado actual de la debida diligencia.";
      aviso.hidden = false;
    }
  }

  function actualizarBoton() {
    var habilitado = hayAlgoQueAgregar();
    btnAgregar.disabled = cerrando || !habilitado;
    btnAgregar.title = habilitado
      ? ""
      : puedeSolicitar
        ? "Marque al menos un contacto"
        : "No es posible solicitar en este momento";
  }

  tbody.addEventListener("change", function (e) {
    var el = e.target;
    if (!el || !el.classList || !el.classList.contains("dd-check")) return;
    var r = registros[Number(el.getAttribute("data-i"))];
    if (r) r.seleccionado = el.checked;
    actualizarBoton();
  });

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
    if (!hayAlgoQueAgregar()) return;
    cerrar({ accion: "agregar", contactos: contactosMarcados() });
  });

  // ---------- Tamaño ----------
  // Si Zoho no aplica el height de openPopup, el iframe queda en el tamaño por
  // defecto del navegador (150px). Solo en ese caso se pide el tamaño con
  // Resize, que le da al modal y al iframe el mismo tamaño: la cabecera del
  // modal (68px) deja el final del iframe fuera de la vista, así que la clase
  // "dd-redimensionado" reserva ese espacio (ver style.css).
  var ALTO = "400";
  var ANCHO = "650";
  var ALTO_POR_DEFECTO_IFRAME = 150;

  function ajustarTamano() {
    if (window.innerHeight > ALTO_POR_DEFECTO_IFRAME) return; // Zoho ya lo dimensionó
    try {
      if (ZOHO.CRM && ZOHO.CRM.UI && ZOHO.CRM.UI.Resize) {
        document.documentElement.classList.add("dd-redimensionado");
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
    registros = n.lista.map(function (r) {
      // Copia: el estado de la casilla se guarda en la fila
      var copia = {};
      Object.keys(r || {}).forEach(function (k) { copia[k] = r[k]; });
      copia.seleccionado = esVerdadero(campo(r, "seleccionable")) && campo(r, "seleccionado") !== false && campo(r, "seleccionado") !== "false";
      return copia;
    });
    faltanPrincipales = n.principales;
    puedeSolicitar = n.puede;
    mensaje = n.mensaje;
    cerrando = false;
    render();
  });

  ZOHO.embeddedApp.init();
})();
