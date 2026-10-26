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

  // Contacto del socio al que aún no se le creó enlace: solo se le puede cambiar el nivel de riesgo
  function esSinEnlace(r) {
    return String(campo(r, "rol")).toLowerCase() === "sinenlace";
  }

  function rolHtml(r) {
    if (esSinEnlace(r)) return '<span class="rol">Contacto</span>';
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
    if (esSinEnlace(r)) return '<td class="acciones valor">—</td>';
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
    if (esSinEnlace(r)) {
      return '<td class="valor">—</td><td class="valor">—</td><td class="valor sin-enlace">Enlace no creado</td>';
    }
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
    var token = obtenerToken(r);
    // El enlace principal es el del expediente: no se borra aquí y se reactiva sin token
    var principal = esPrincipal(r);

    if (tipo === "ver") {
      // Misma URL que abría el botón de Zoho
      window.open(PORTAL + "/expediente?link=" + encodeURIComponent(campo(r, "enlace")), "_blank", "noopener");
      return;
    }
    if (tipo === "reactivar") return ejecutar("Enlace reactivado.", function () { return reactivar(principal ? null : token); });
    if (tipo === "delete" && !principal) return ejecutar("Enlace eliminado.", function () { return eliminar(token); });
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

  // ---------- Portal (antes lo hacía el botón manageOtrosDocumentos.js) ----------

  var PORTAL = "https://debida-diligencia.udggroup.com";
  var CONEXION = "dd_portal"; // Conexión de Zoho con la API key del portal (eliminar-adicional)
  var recordId = "";

  // Cuerpo de la respuesta como objeto (Zoho entrega texto, o ya un objeto)
  function leerJson(r) {
    var v = r && r.data !== undefined ? r.data : r && r.response !== undefined ? r.response : r;
    if (typeof v === "string") { try { return JSON.parse(v); } catch (e) { return { error: v }; } }
    return v || {};
  }

  function usuarioActual() {
    return ZOHO.CRM.CONFIG.getCurrentUser().then(function (r) { return (r && r.users && r.users[0]) || {}; });
  }

  var avisoTimer = null;
  function aviso(texto, tipo) {
    var el = document.getElementById("aviso");
    el.textContent = texto;
    el.className = "aviso aviso-" + (tipo || "info");
    el.hidden = false;
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(function () { el.hidden = true; }, 6000);
  }

  // Overlay + acción + aviso + recarga de la lista
  function ejecutar(exito, accion) {
    setOcupado(true);
    return accion().then(function () {
      aviso(exito, "ok");
    }).catch(function (e) {
      console.error(e);
      aviso((e && e.message) || "No se pudo completar la acción.", "error");
    }).then(function () {
      return cargar(true);
    });
  }

  function reactivar(token) {
    return usuarioActual().then(function (u) {
      var cuerpo = {
        recordId: recordId,
        modulo: "Debida_Diligencia",
        usuario: (u.profile && u.profile.name) || u.full_name || ""
      };
      if (token) cuerpo.token = token;
      return ZOHO.CRM.HTTP.post({
        url: PORTAL + "/api/reactivar",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo)
      });
    }).then(function (resp) {
      var json = leerJson(resp);
      if (json.success === false || json.error) throw new Error(json.error || "No se pudo reactivar el enlace.");
    });
  }

  function eliminar(token) {
    return usuarioActual().then(function (u) {
      return ZOHO.CRM.CONNECTION.invoke(CONEXION, {
        url: PORTAL + "/api/eliminar-adicional",
        method: "POST",
        parameters: { token: token, userId: u.id, reason: "Eliminado desde Zoho CRM (widget de enlaces)" },
        headers: { "Content-Type": "application/json" },
        param_type: 2
      });
    }).then(function (resp) {
      // La conexión envuelve la respuesta: details.statusMessage (objeto o texto)
      var sm = resp && resp.details && resp.details.statusMessage;
      if (typeof sm === "string") { try { sm = JSON.parse(sm); } catch (e) { sm = { error: sm }; } }
      sm = sm || leerJson(resp);
      if (!sm.success) throw new Error(sm.error || "No se pudo eliminar el enlace.");
    });
  }

  // Fila del widget a partir de un enlace del portal
  function aFila(link) {
    return {
      nombre: link.name,
      enlace: link.clientUrl,
      estado: link.linkStatus,
      vigencia: link.expiresAt ? new Date(link.expiresAt).toLocaleDateString("es-ES") : "",
      token: link.token,
      contactId: link.contactId || "",
      rol: link.role === "PRINCIPAL" ? "principal"
        : link.representante ? "representante"
        : link.role === "RELATED" ? "relacionado" : "adicional"
    };
  }

  // "Enlaces de Contactos": principal + relacionados + contactos del socio sin enlace.
  // "Enlaces adicionales": los de generar-adicional.
  function cargar(recarga) {
    setOcupado(true);
    return ZOHO.CRM.HTTP.get({
      url: PORTAL + "/api/generar-adicional",
      params: { crmId: recordId }
    }).then(function (resp) {
      var data = leerJson(resp);
      if (data.success === false) throw new Error(data.error || "El portal no pudo listar los enlaces.");
      var contactos = (data.contactLinks || []).map(aFila);
      (data.contactsWithoutLink || []).forEach(function (c) {
        contactos.push({ nombre: c.name, enlace: "", estado: "Enlace no creado", vigencia: "", token: "", contactId: c.contactId, rol: "sinEnlace" });
      });
      secciones.contactos.registros = contactos;
      secciones.adicionales.registros = (data.links || []).map(aFila);
      if (recarga) riesgos = {}; // vuelve a leer los niveles de riesgo
    }).catch(function (e) {
      console.error(e);
      secciones.contactos.registros = [];
      secciones.adicionales.registros = [];
      aviso((e && e.message) || "No se pudieron cargar los enlaces.", "error");
    }).then(function () {
      setOcupado(false);
      confirmar = null;
      render();
      cargarRiesgos();
    });
  }

  // Columnas de ancho ajustable: colgroup con anchos iniciales (%) y un asa en cada encabezado.
  // Al arrastrar, los anchos pasan a px y la tabla se ensancha (la lista hace scroll horizontal).
  var ANCHOS = {
    "tabla-contactos": [16, 13, 11, 22, 11, 11, 16],
    "tabla-adicionales": [20, 30, 14, 16, 20]
  };
  function columnasAjustables(tbodyId) {
    var tabla = document.getElementById(tbodyId).closest("table");
    var ths = tabla.querySelectorAll("thead th");
    var grupo = document.createElement("colgroup");
    var cols = [];
    ths.forEach(function (th, n) {
      var col = document.createElement("col");
      col.style.width = ANCHOS[tbodyId][n] + "%";
      grupo.appendChild(col);
      cols.push(col);
      if (n === ths.length - 1) return; // la última no tiene a quién ceder ancho
      var asa = document.createElement("span");
      asa.className = "col-asa";
      asa.addEventListener("pointerdown", function (ev) {
        ev.preventDefault();
        // Congela todos los anchos en px antes de arrastrar
        var anchos = Array.prototype.map.call(ths, function (t) { return t.getBoundingClientRect().width; });
        cols.forEach(function (c, i) { c.style.width = anchos[i] + "px"; });
        var total = anchos.reduce(function (a, b) { return a + b; }, 0);
        tabla.style.width = total + "px";
        var inicioX = ev.clientX, inicio = anchos[n];
        asa.classList.add("activa");
        document.body.classList.add("redimensionando");
        asa.setPointerCapture(ev.pointerId);
        function mover(e) {
          var ancho = Math.max(60, inicio + e.clientX - inicioX);
          cols[n].style.width = ancho + "px";
          tabla.style.width = total - inicio + ancho + "px";
        }
        function soltar() {
          asa.classList.remove("activa");
          document.body.classList.remove("redimensionando");
          asa.removeEventListener("pointermove", mover);
          asa.removeEventListener("pointerup", soltar);
          asa.removeEventListener("pointercancel", soltar);
        }
        asa.addEventListener("pointermove", mover);
        asa.addEventListener("pointerup", soltar);
        asa.addEventListener("pointercancel", soltar);
      });
      th.appendChild(asa);
    });
    tabla.insertBefore(grupo, tabla.firstChild);
  }
  columnasAjustables("tabla-contactos");
  columnasAjustables("tabla-adicionales");

  // Related list del canvas: el payload trae el registro de Debida Diligencia (EntityId)
  ZOHO.embeddedApp.on("PageLoad", function (payload) {
    console.log("PageLoad payload:", payload);
    var id = payload && (payload.EntityId !== undefined ? payload.EntityId : payload.entityId);
    recordId = String(Array.isArray(id) ? id[0] : id || "");
    if (!recordId) { aviso("No se recibió el ID del expediente.", "error"); return; }
    cargar();
  });
  ZOHO.embeddedApp.init();
})();
