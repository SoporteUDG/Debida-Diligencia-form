(function () {
  "use strict";

  var tbody = document.getElementById("tabla-body");
  var registros = [];

  function escapeHtml(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // Lee un campo sin importar mayúsculas/minúsculas; resuelve lookups { name, id }
  function campo(obj, nombre) {
    if (!obj) return "";
    var key = Object.keys(obj).find(function (k) { return k.toLowerCase() === nombre.toLowerCase(); });
    var val = key ? obj[key] : "";
    if (val && typeof val === "object") return val.name || val.display_value || "";
    return val == null ? "" : val;
  }

  // Si el registro no trae "token", lo extrae del parámetro ?token= del enlace
  function obtenerToken(r) {
    var t = campo(r, "token");
    if (t) return String(t);
    try { return new URL(campo(r, "enlace")).searchParams.get("token") || ""; }
    catch (e) { return ""; }
  }

  function claseEstado(estado) {
    var s = String(estado || "").toLowerCase();
    if (/(activ|vigente)/.test(s) && !/inactiv/.test(s)) return "estado-ok";
    if (/(vencid|inactiv|expir|cancel)/.test(s)) return "estado-error";
    return "";
  }

  // Acepta: [ ... ]  |  { registros: [ ... ] }  |  { data: ... }
  function normalizar(payload) {
    var d = payload;
    if (d && d.data !== undefined && !Array.isArray(d)) d = d.data;
    if (typeof d === "string") { try { d = JSON.parse(d); } catch (e) {} }
    if (Array.isArray(d)) return d;
    if (d && typeof d === "object") {
      var lista = d.registros || d.records || d.items || d.enlaces;
      if (Array.isArray(lista)) return lista;
      var k = Object.keys(d).find(function (x) { return Array.isArray(d[x]); });
      return k ? d[k] : [];
    }
    return [];
  }

  var confirmIdx = null; // index of the row waiting for delete confirmation

  function celdaAcciones(i, estado) {
    if (i === confirmIdx) {
      return '<td class="acciones">' +
        '<span class="confirmar-texto">¿Borrar este enlace?</span>' +
        '<button type="button" class="btn btn-borrar" data-i="' + i + '" data-type="confirmar-borrar">Sí, borrar</button>' +
        '<button type="button" class="btn btn-reactivar" data-i="' + i + '" data-type="cancelar-borrar">Cancelar</button>' +
        "</td>";
    }
    var activo = claseEstado(estado) === "estado-ok";
    return '<td class="acciones">' +
      '<button type="button" class="btn btn-reactivar" ' + (activo ? "disabled" : "") + ' data-i="' + i + '" data-type="reactivar">Reactivar</button>' +
      '<button type="button" class="btn btn-ver" data-i="' + i + '" data-type="ver">Ver</button>' +
      '<button type="button" class="btn btn-borrar" data-i="' + i + '" data-type="borrar">Borrar</button>' +
      "</td>";
  }

  function render() {
    if (!registros.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="vacio">No hay enlaces para mostrar.</td></tr>';
      return;
    }
    tbody.innerHTML = registros.map(function (r, i) {
    var nombre = campo(r, "nombre");
    var enlace = campo(r, "enlace");
    var estado = campo(r, "estado");
      return "<tr>" +
        "<td>" + escapeHtml(nombre || "No definido") + "</td>" +
        '<td><a class="enlace" href="' + escapeHtml(enlace) + '" target="_blank" rel="noopener" title="' + escapeHtml(enlace) + '">' + escapeHtml(enlace || "—") + "</a></td>" +
        '<td class="valor">' + escapeHtml(campo(r, "vigencia") || "—") + "</td>" +
        '<td class="valor ' + claseEstado(estado) + '">' + escapeHtml(estado || "—") + "</td>" +
        celdaAcciones(i, estado) +
        "</tr>";
    }).join("");

    // Put keyboard focus on the safe option when asking for confirmation
    var cancelar = tbody.querySelector('[data-type="cancelar-borrar"]');
    if (cancelar) cancelar.focus();
  }

  tbody.addEventListener("click", function (ev) {
    var btn = ev.target.closest("button[data-type]");
    if (!btn || btn.disabled) return;

    var tipo = btn.getAttribute("data-type");
    var i = Number(btn.getAttribute("data-i"));

    if (tipo === "borrar")          { confirmIdx = i;    render(); return; }
    if (tipo === "cancelar-borrar") { confirmIdx = null; render(); return; }

    if (tipo === "confirmar-borrar") tipo = "delete";
    cerrar({ token: obtenerToken(registros[i]), type: tipo });
  });
  // Lo enviado a $Client.close() es lo que retorna `await ZDK.Client.openPopup(...)`
  function cerrar(resultado) {
    try {
      if (typeof $Client !== "undefined" && $Client.close) { $Client.close(resultado); return; }
    } catch (e) { console.warn("$Client.close no disponible", e); }
    try { ZOHO.CRM.UI.Popup.close(); } catch (e) { console.error("No se pudo cerrar el popup", e); }
  }

  ZOHO.embeddedApp.on("PageLoad", function (payload) {
    console.log("PageLoad payload:", payload);
    registros = normalizar(payload);
    render();
  });
  ZOHO.embeddedApp.init();
})();
