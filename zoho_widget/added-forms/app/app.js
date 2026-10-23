(function () {
  "use strict";

  // Dos secciones: "Enlaces de Contactos" (principal + relacionados) y
  // "Enlaces adicionales" (generar-adicional). Cada una con su tabla y sus filas.
  var secciones = {
    contactos: { tbody: document.getElementById("tabla-contactos"), columnas: 8, registros: [] },
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

  var riesgos = {};   // contactId -> Nivel_de_Riesgo ("" si está vacío)
  var guardando = {}; // contactId -> true mientras se envía a Zoho
  var errores = {};   // contactId -> mensaje del último intento fallido

  function cargarRiesgos() {
    secciones.contactos.registros.forEach(function (r) {
      var id = campo(r, "contactId");
      if (!id || riesgos[id] !== undefined) return;
      ZOHO.CRM.API.getRecord({ Entity: "Contacts", RecordID: id }).then(function (resp) {
        var rec = resp && resp.data && resp.data[0];
        riesgos[id] = rec && rec.Nivel_de_Riesgo ? rec.Nivel_de_Riesgo : "";
      }).catch(function (e) {
        console.error("No se pudo leer Nivel_de_Riesgo de " + id, e);
        riesgos[id] = "";
        errores[id] = "No se pudo leer el nivel";
      }).then(render);
    });
  }

  function guardarRiesgo(i, nivel) {
    var id = campo(secciones.contactos.registros[i], "contactId");
    var previo = riesgos[id];
    guardando[id] = true;
    delete errores[id];
    riesgos[id] = nivel;
    setOcupado(true);
    render();
    ZOHO.CRM.API.updateRecord({ Entity: "Contacts", APIData: { id: id, Nivel_de_Riesgo: nivel }, Trigger: [] })
      .then(function (resp) {
        var d = resp && resp.data && resp.data[0];
        if (!d || d.code !== "SUCCESS") throw new Error((d && d.message) || "Respuesta inesperada");
      })
      .catch(function (e) {
        console.error("No se pudo guardar Nivel_de_Riesgo de " + id, e);
        riesgos[id] = previo;
        errores[id] = "No se pudo guardar";
      })
      .then(function () { delete guardando[id]; setOcupado(false); render(); });
  }

  secciones.contactos.tbody.addEventListener("change", function (ev) {
    var sel = ev.target.closest("select.riesgo");
    if (sel) guardarRiesgo(Number(sel.getAttribute("data-i")), sel.value);
  });

  var confirmar = null; // { seccion, i } del enlace que espera confirmación de borrado (diálogo sobre la lista)

  var ICONOS = {
    reactivar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"/></svg>',
    ver: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    borrar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14M10 11v6M14 11v6"/></svg>'
  };

  function botonIcono(clase, tipo, titulo, attrs, extra) {
    return '<button type="button" class="btn-icono ' + clase + '"' + attrs + ' data-type="' + tipo + '"' +
      ' title="' + titulo + '" aria-label="' + titulo + '"' + (extra || "") + ">" + ICONOS[tipo] + "</button>";
  }

  function celdaAcciones(seccion, i, r) {
    var attrs = ' data-s="' + seccion + '" data-i="' + i + '"';
    var activo = claseEstado(campo(r, "estado")) === "estado-ok";
    // Un enlace anulado no se reactiva aquí (extendería un token sobre algo archivado)
    var anulado = /anulad/i.test(String(campo(r, "estado")));
    // El enlace principal es el del expediente: se elimina con el expediente, no aquí
    var borrar = esPrincipal(r) ? "" : botonIcono("icono-borrar", "borrar", "Borrar enlace", attrs);
    return '<td class="acciones">' +
      botonIcono("icono-reactivar", "reactivar", anulado ? "Enlace anulado" : "Reactivar enlace", attrs, activo || anulado ? " disabled" : "") +
      botonIcono("icono-ver", "ver", "Ver enlace", attrs) +
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

  var NIVELES = ["Alto", "Medio", "Bajo"];

  // Select de Nivel_de_Riesgo del Contact; sin contacto (empresa, representante) no aplica
  function celdaRiesgo(r, i) {
    var id = campo(r, "contactId");
    if (!id) return '<td class="valor">—</td>';
    var actual = riesgos[id];
    if (actual === undefined) return '<td class="valor">…</td>';
    var opciones = (NIVELES.indexOf(actual) < 0 ? ['<option value="">—</option>'] : []).concat(
      NIVELES.map(function (n) {
        return '<option value="' + n + '"' + (n === actual ? " selected" : "") + ">" + n + "</option>";
      })
    ).join("");
    var err = errores[id] ? '<span class="riesgo-error">' + escapeHtml(errores[id]) + "</span>" : "";
    return '<td><select class="riesgo" data-i="' + i + '"' + (guardando[id] ? " disabled" : "") + ">" + opciones + "</select>" + err + "</td>";
  }

  function filaContacto(r, i) {
    var id = campo(r, "contactId");
    return "<tr>" +
      "<td>" + escapeHtml(campo(r, "nombre") || "No definido") + "</td>" +
      "<td>" + rolHtml(r) + "</td>" +
      celdaRiesgo(r, i) +
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

    document.getElementById("dialogo-borrar").hidden = !confirmar;
    // Foco en la opción segura al pedir confirmación
    if (confirmar) document.getElementById("borrar-cancelar").focus();
  }

  // Overlay con loader mientras se guarda el riesgo o se envía una acción
  function setOcupado(v) {
    document.getElementById("cargando").hidden = !v;
  }

  function alHacerClic(ev) {
    var btn = ev.target.closest("button[data-type]");
    if (!btn || btn.disabled) return;

    var tipo = btn.getAttribute("data-type");
    var seccion = btn.getAttribute("data-s");
    var i = Number(btn.getAttribute("data-i"));

    if (tipo === "borrar") { confirmar = { seccion: seccion, i: i }; render(); return; }
    enviarAccion(tipo, seccion, i);
  }

  function enviarAccion(tipo, seccion, i) {
    confirmar = null;
    render();
    var r = secciones[seccion].registros[i];
    setOcupado(true);
    cerrar({
      token: obtenerToken(r),
      type: tipo,
      seccion: seccion,
      rol: esPrincipal(r) ? "principal" : esRepresentante(r) ? "representante" : (seccion === "contactos" ? "relacionado" : "adicional")
    });
  }
  secciones.contactos.tbody.addEventListener("click", alHacerClic);
  secciones.adicionales.tbody.addEventListener("click", alHacerClic);

  function cancelarBorrar() { confirmar = null; render(); }
  document.getElementById("borrar-cancelar").addEventListener("click", cancelarBorrar);
  document.getElementById("borrar-confirmar").addEventListener("click", function () {
    if (confirmar) enviarAccion("delete", confirmar.seccion, confirmar.i);
  });
  document.getElementById("dialogo-borrar").addEventListener("click", function (ev) {
    if (ev.target === this) cancelarBorrar();
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && confirmar) cancelarBorrar();
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
    var n = normalizar(payload);
    secciones.contactos.registros = n.contactos;
    secciones.adicionales.registros = n.adicionales;
    confirmar = null;
    render();
    cargarRiesgos();
  });
  ZOHO.embeddedApp.init();
})();
