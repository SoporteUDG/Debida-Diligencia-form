(function () {
  "use strict";

  // Dos secciones: "Enlaces de Contactos" (principal + relacionados) y
  // "Enlaces adicionales" (generar-adicional). Cada una con su tabla y sus filas.
  var secciones = {
    contactos: { tbody: document.getElementById("tabla-contactos"), columnas: 6, registros: [] },
    adicionales: { tbody: document.getElementById("tabla-adicionales"), columnas: 5, registros: [] }
  };

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

  function esPrincipal(r) {
    return String(campo(r, "rol")).toLowerCase() === "principal";
  }

  // Jurídica: enlace del Representante Legal (relacionado sin contacto)
  function esRepresentante(r) {
    return String(campo(r, "rol")).toLowerCase() === "representante";
  }

  function rolHtml(r) {
    if (esPrincipal(r)) return '<span class="rol rol-principal">Principal</span>';
    if (esRepresentante(r)) return '<span class="rol rol-representante">Representante Legal</span>';
    return '<span class="rol">Relacionado</span>';
  }

  function claseEstado(estado) {
    var s = String(estado || "").toLowerCase();
    if (/(activ|vigente)/.test(s) && !/inactiv/.test(s)) return "estado-ok";
    if (/(vencid|inactiv|expir|cancel|anulad)/.test(s)) return "estado-error";
    return "";
  }

  // Busca la primera lista dentro de un objeto
  function lista(d) {
    if (Array.isArray(d)) return d;
    if (d && typeof d === "object") {
      var l = d.registros || d.records || d.items || d.enlaces;
      if (Array.isArray(l)) return l;
      var k = Object.keys(d).find(function (x) { return Array.isArray(d[x]); });
      return k ? d[k] : [];
    }
    return [];
  }

  // Acepta: { contactos: [...], adicionales: [...] }  (envuelto o no en { data })
  // y, por compatibilidad, una sola lista: son los enlaces adicionales.
  function normalizar(payload) {
    var d = payload;
    for (var n = 0; n < 5; n++) {
      if (typeof d === "string") { try { d = JSON.parse(d); } catch (e) { break; } }
      if (d && typeof d === "object" && !Array.isArray(d) &&
          d.contactos === undefined && d.adicionales === undefined && d.data !== undefined) {
        d = d.data;
      } else {
        break;
      }
    }
    if (d && typeof d === "object" && !Array.isArray(d) &&
        (d.contactos !== undefined || d.adicionales !== undefined)) {
      return {
        contactos: Array.isArray(d.contactos) ? d.contactos : [],
        adicionales: Array.isArray(d.adicionales) ? d.adicionales : []
      };
    }
    return { contactos: [], adicionales: lista(d) };
  }

  var confirmar = null; // { seccion, i } de la fila que espera confirmación de borrado

  function celdaAcciones(seccion, i, r) {
    var attrs = ' data-s="' + seccion + '" data-i="' + i + '"';
    if (confirmar && confirmar.seccion === seccion && confirmar.i === i) {
      return '<td class="acciones">' +
        '<span class="confirmar-texto">¿Borrar este enlace?</span>' +
        '<button type="button" class="btn btn-borrar"' + attrs + ' data-type="confirmar-borrar">Sí, borrar</button>' +
        '<button type="button" class="btn btn-reactivar"' + attrs + ' data-type="cancelar-borrar">Cancelar</button>' +
        "</td>";
    }
    var activo = claseEstado(campo(r, "estado")) === "estado-ok";
    // Un enlace anulado no se reactiva aquí (extendería un token sobre algo archivado)
    var anulado = /anulad/i.test(String(campo(r, "estado")));
    // El enlace principal es el del expediente: se elimina con el expediente, no aquí
    var borrar = esPrincipal(r)
      ? ""
      : '<button type="button" class="btn btn-borrar"' + attrs + ' data-type="borrar">Borrar</button>';
    return '<td class="acciones">' +
      '<button type="button" class="btn btn-reactivar" ' + (activo || anulado ? "disabled" : "") +
        (anulado ? ' title="Enlace anulado"' : "") + attrs + ' data-type="reactivar">Reactivar</button>' +
      '<button type="button" class="btn btn-ver"' + attrs + ' data-type="ver">Ver</button>' +
      borrar +
      "</td>";
  }

  function celdasEnlace(r) {
    var enlace = campo(r, "enlace");
    var estado = campo(r, "estado");
    return '<td><a class="enlace" href="' + escapeHtml(enlace) + '" target="_blank" rel="noopener" title="' + escapeHtml(enlace) + '">' + escapeHtml(enlace || "—") + "</a></td>" +
      '<td class="valor">' + escapeHtml(campo(r, "vigencia") || "—") + "</td>" +
      '<td class="valor ' + claseEstado(estado) + '">' + escapeHtml(estado || "—") + "</td>";
  }

  function filaContacto(r, i) {
    return "<tr>" +
      "<td>" + escapeHtml(campo(r, "nombre") || "No definido") + "</td>" +
      "<td>" + rolHtml(r) + "</td>" +
      celdasEnlace(r) +
      celdaAcciones("contactos", i, r) +
      "</tr>";
  }

  function filaAdicional(r, i) {
    return "<tr>" +
      "<td>" + escapeHtml(campo(r, "nombre") || "No definido") + "</td>" +
      celdasEnlace(r) +
      celdaAcciones("adicionales", i, r) +
      "</tr>";
  }

  function renderSeccion(nombre, filaHtml, vacio) {
    var s = secciones[nombre];
    s.tbody.innerHTML = s.registros.length
      ? s.registros.map(filaHtml).join("")
      : '<tr><td colspan="' + s.columnas + '" class="vacio">' + vacio + "</td></tr>";
  }

  function render() {
    renderSeccion("contactos", filaContacto, "No hay enlaces de contactos para mostrar.");
    renderSeccion("adicionales", filaAdicional, "No hay enlaces adicionales para mostrar.");

    // Foco en la opción segura al pedir confirmación
    var cancelar = document.querySelector('[data-type="cancelar-borrar"]');
    if (cancelar) cancelar.focus();
  }

  function alHacerClic(ev) {
    var btn = ev.target.closest("button[data-type]");
    if (!btn || btn.disabled) return;

    var tipo = btn.getAttribute("data-type");
    var seccion = btn.getAttribute("data-s");
    var i = Number(btn.getAttribute("data-i"));

    if (tipo === "borrar")          { confirmar = { seccion: seccion, i: i }; render(); return; }
    if (tipo === "cancelar-borrar") { confirmar = null; render(); return; }

    if (tipo === "confirmar-borrar") tipo = "delete";
    var r = secciones[seccion].registros[i];
    cerrar({
      token: obtenerToken(r),
      type: tipo,
      seccion: seccion,
      rol: esPrincipal(r) ? "principal" : esRepresentante(r) ? "representante" : (seccion === "contactos" ? "relacionado" : "adicional")
    });
  }
  secciones.contactos.tbody.addEventListener("click", alHacerClic);
  secciones.adicionales.tbody.addEventListener("click", alHacerClic);

  // Lo enviado a $Client.close() es lo que retorna `await ZDK.Client.openPopup(...)`
  function cerrar(resultado) {
    try {
      if (typeof $Client !== "undefined" && $Client.close) { $Client.close(resultado); return; }
    } catch (e) { console.warn("$Client.close no disponible", e); }
    try { ZOHO.CRM.UI.Popup.close(); } catch (e) { console.error("No se pudo cerrar el popup", e); }
  }

  ZOHO.embeddedApp.on("PageLoad", function (payload) {
    console.log("PageLoad payload:", payload);
    var n = normalizar(payload);
    secciones.contactos.registros = n.contactos;
    secciones.adicionales.registros = n.adicionales;
    confirmar = null;
    render();
  });
  ZOHO.embeddedApp.init();
})();
