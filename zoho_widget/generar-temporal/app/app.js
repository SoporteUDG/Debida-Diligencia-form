(function () {
  "use strict";

  /**
   * Widget "Enlaces temporales": lo abre el botón de la vista personalizada
   * (custom view) del módulo. No depende de ningún registro.
   *
   * - Lista los enlaces temporales activos (sin completar y sin vencer) de
   *   /api/temporales, con su enlace para copiarlo.
   * - "Crear enlace adicional" desbloquea el formulario: Persona de Tipo
   *   (Persona_de_Tipo del Socio de Negocio que se creará), Proyecto e ID SAP
   *   de la unidad. La unidad se valida en Zoho (exactamente un registro de
   *   MODULO_UNIDADES con ese ID_SAP; si no, no se envía nada) y su id va a
   *   /api/generar-temporal como Unidad_Vendida1. Al completarse el enlace se
   *   crean el Socio de Negocio y la Debida Diligencia.
   *
   * Requisitos en Zoho:
   *  - Conexión "dd_portal" (Custom Service, tipo API Key) que envía el
   *    encabezado  x-api-key: <ZOHO_BUTTON_API_KEY>, agregada al widget.
   *  - El dominio del portal agregado en Setup > Security Control > Trusted Domains.
   */
  var PORTAL = "https://debida-diligencia.udggroup.com/api";
  var CONEXION = "dd_portal"; // nombre de enlace (Link Name) exacto de la conexión
  // API name del módulo al que apunta el lookup Unidad_Vendida1 de Accounts
  // (Setup > Desarrollador > API > Nombres de API). VERIFICAR antes de publicar.
  var MODULO_UNIDADES = "Products";
  var CAMPO_ID_SAP = "ID_SAP";
  var SIN_PROYECTO = "";
  // Opciones del picklist Proyecto de Accounts (las mismas que valida el portal)
  var PROYECTOS = [
    "Altos del Parque", "Caminos de Centennial", "Deici", "Guayacán", "Living73",
    "New West I", "New West II", "Paramount", "Spotlight", "The Hub"
  ];

  var el = {
    crear: document.getElementById("crear"),
    formulario: document.getElementById("formulario"),
    tipo: document.getElementById("persona-de-tipo"),
    proyecto: document.getElementById("proyecto"),
    idSap: document.getElementById("id-sap"),
    mensaje: document.getElementById("mensaje"),
    generar: document.getElementById("generar"),
    cancelar: document.getElementById("cancelar"),
    resultado: document.getElementById("resultado"),
    enlace: document.getElementById("enlace"),
    vence: document.getElementById("vence"),
    unidadNombre: document.getElementById("unidad-nombre"),
    copiar: document.getElementById("copiar"),
    tabla: document.getElementById("tabla-temporales"),
    errorLista: document.getElementById("error-lista"),
    cerrarBtn: document.getElementById("cerrar")
  };

  var modulo = ""; // módulo de la vista donde está el botón (informativo para el portal)
  var temporales = [];

  function escapeHtml(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function fecha(v) {
    if (!v) return "—";
    var d = new Date(v);
    return isNaN(d.getTime()) ? "—" : d.toLocaleString();
  }

  el.proyecto.innerHTML = '<option value="' + SIN_PROYECTO + '">-Ninguno-</option>' +
    PROYECTOS.map(function (p) { return '<option value="' + escapeHtml(p) + '">' + escapeHtml(p) + "</option>"; }).join("");

  // ---------- Portal ----------

  // Zoho envuelve la respuesta del portal (details.statusMessage, _details,
  // response o data según la versión); el cuerpo puede venir como texto
  function cuerpoDe(resp) {
    var crudo = resp;
    if (resp && resp.details && resp.details.statusMessage !== undefined) crudo = resp.details.statusMessage;
    else if (resp && resp._details && resp._details.statusMessage !== undefined) crudo = resp._details.statusMessage;
    else if (resp && resp.response !== undefined) crudo = resp.response;
    else if (resp && resp.data !== undefined) crudo = resp.data;
    if (typeof crudo === "string") {
      try { return JSON.parse(crudo); } catch (e) { return { error: crudo }; }
    }
    return crudo || {};
  }

  // POST al portal por la conexión; devuelve el cuerpo ya interpretado
  function portal(ruta, parametros) {
    return ZOHO.CRM.CONNECTION.invoke(CONEXION, {
      url: PORTAL + ruta,
      method: "POST",
      param_type: 2, // cuerpo JSON
      headers: { "Content-Type": "application/json" },
      parameters: parametros || {}
    }).then(function (resp) {
      console.log("[enlaces temporales] " + ruta + ":", resp);
      return cuerpoDe(resp);
    });
  }

  function mensajeDe(e, porDefecto) {
    var texto = e && e.message ? e.message : (typeof e === "string" ? e : "");
    return texto || porDefecto;
  }

  // ---------- Lista de enlaces activos ----------

  function claseTipo(tipo) {
    return tipo === "JURIDICA" ? "tipo tipo-juridica" : "tipo tipo-natural";
  }

  function fila(t, i) {
    var enlace = t.url
      ? '<a class="enlace" href="' + escapeHtml(t.url) + '" target="_blank" rel="noopener" title="' + escapeHtml(t.url) + '">' + escapeHtml(t.url) + "</a>"
      : '<span class="sin-enlace" title="Creado antes de guardarse el enlace">No disponible</span>';
    var copiar = t.url
      ? '<button type="button" class="btn btn-sec" data-i="' + i + '">Copiar</button>'
      : "";
    return "<tr>" +
      '<td><span class="' + claseTipo(t.tipo) + '">' + (t.tipo === "JURIDICA" ? "Jurídica" : "Natural") + "</span></td>" +
      "<td>" + escapeHtml(t.proyecto || "—") + "</td>" +
      "<td>" + escapeHtml(t.unidad || "—") + "</td>" +
      '<td class="nowrap">' + escapeHtml(fecha(t.createdAt)) + "</td>" +
      '<td class="nowrap">' + escapeHtml(fecha(t.expiresAt)) + "</td>" +
      "<td>" + enlace + "</td>" +
      '<td class="acciones">' + copiar + "</td>" +
      "</tr>";
  }

  function renderLista() {
    el.tabla.innerHTML = temporales.length
      ? temporales.map(fila).join("")
      : '<tr><td colspan="7" class="vacio">No hay enlaces temporales activos.</td></tr>';
  }

  function cargarLista() {
    el.errorLista.hidden = true;
    return portal("/temporales")
      .then(function (cuerpo) {
        if (!cuerpo.success) throw new Error(cuerpo.error || "Respuesta inesperada del portal.");
        temporales = Array.isArray(cuerpo.temporales) ? cuerpo.temporales : [];
        renderLista();
      })
      .catch(function (e) {
        console.error("[enlaces temporales] lista", e);
        temporales = [];
        el.tabla.innerHTML = '<tr><td colspan="7" class="vacio">—</td></tr>';
        el.errorLista.textContent = "No se pudieron cargar los enlaces: " + mensajeDe(e, "error desconocido.");
        el.errorLista.hidden = false;
      });
  }

  // ---------- Copiar ----------

  function copiarTexto(texto, boton) {
    var listo = function () {
      var original = boton.textContent;
      boton.textContent = "¡Copiado!";
      setTimeout(function () { boton.textContent = original; }, 1500);
    };
    var respaldo = function () {
      var area = document.createElement("textarea");
      area.value = texto;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(area);
      if (ok) listo();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(listo).catch(respaldo);
    } else {
      respaldo();
    }
  }

  el.tabla.addEventListener("click", function (ev) {
    var btn = ev.target.closest("button[data-i]");
    if (!btn) return;
    var t = temporales[Number(btn.getAttribute("data-i"))];
    if (t && t.url) copiarTexto(t.url, btn);
  });

  el.copiar.addEventListener("click", function () {
    el.enlace.select();
    copiarTexto(el.enlace.value, el.copiar);
  });

  // ---------- Formulario (bloqueado tras "Crear enlace adicional") ----------

  function abrirFormulario() {
    el.formulario.reset();
    el.mensaje.hidden = true;
    el.resultado.hidden = true;
    el.formulario.hidden = false;
    el.crear.disabled = true;
    el.idSap.focus();
  }

  function cerrarFormulario() {
    el.formulario.hidden = true;
    el.crear.disabled = false;
    ocupado(false);
  }

  function mostrarError(texto) {
    el.mensaje.textContent = texto;
    el.mensaje.hidden = false;
  }

  function ocupado(si, texto) {
    el.generar.disabled = si;
    el.cancelar.disabled = si;
    el.generar.textContent = si ? texto : "Generar";
  }

  // Valor para un criterio de búsqueda de Zoho: paréntesis y comas van escapados
  function valorCriterio(valor) {
    return String(valor).replace(/([(),\\])/g, "\\$1");
  }

  // Unidades (registros de MODULO_UNIDADES) cuyo ID_SAP es exactamente `idSap`
  function unidadesPorIdSap(idSap) {
    return ZOHO.CRM.API.searchRecord({
      Entity: MODULO_UNIDADES,
      Type: "criteria",
      Query: "(" + CAMPO_ID_SAP + ":equals:" + valorCriterio(idSap) + ")"
    }).then(function (resp) {
      // Sin resultados Zoho responde vacío (204)
      var registros = resp && Array.isArray(resp.data) ? resp.data : [];
      // La búsqueda no distingue mayúsculas: se confirma la coincidencia exacta
      return registros.filter(function (r) { return String(r[CAMPO_ID_SAP] || "").trim() === idSap; });
    });
  }

  function usuarioActual() {
    return ZOHO.CRM.CONFIG.getCurrentUser().then(function (r) {
      return r && r.users && r.users[0] ? String(r.users[0].id) : null;
    }).catch(function () { return null; });
  }

  function mostrarResultado(cuerpo, unidad) {
    el.enlace.value = cuerpo.url;
    el.vence.textContent = cuerpo.expiresAt ? " (vence el " + fecha(cuerpo.expiresAt) + ")" : "";
    el.unidadNombre.textContent = unidad.name;
    el.resultado.hidden = false;
    el.enlace.focus();
    el.enlace.select();
  }

  el.crear.addEventListener("click", abrirFormulario);
  el.cancelar.addEventListener("click", cerrarFormulario);

  el.formulario.addEventListener("submit", function (ev) {
    ev.preventDefault();
    el.mensaje.hidden = true;

    var personaDeTipo = el.tipo.value;
    var proyecto = el.proyecto.value;
    var idSap = el.idSap.value.trim();
    if (!personaDeTipo) { mostrarError("Seleccione la Persona de Tipo (Natural o Jurídica)."); return; }
    if (!idSap) { mostrarError("El ID SAP de la unidad es requerido."); el.idSap.focus(); return; }

    var unidad;
    ocupado(true, "Validando la unidad…");
    unidadesPorIdSap(idSap)
      .then(function (coincidencias) {
        if (!coincidencias.length) {
          throw new Error("No existe ninguna unidad con ID SAP \"" + idSap + "\". Revise el valor e intente de nuevo.");
        }
        if (coincidencias.length > 1) {
          throw new Error("Hay " + coincidencias.length + " unidades con ID SAP \"" + idSap + "\". Corrija el duplicado en Zoho.");
        }
        unidad = { id: String(coincidencias[0].id), name: String(coincidencias[0].Name || idSap).trim() };
        ocupado(true, "Generando enlace…");
        return usuarioActual();
      })
      .then(function (userId) {
        return portal("/generar-temporal", {
          persona_de_tipo: personaDeTipo,
          modulo: modulo,
          userId: userId,
          // Lookup Unidad_Vendida1 y Name "nombre-unidad-proyecto" de lo que se crea
          unidad_vendida: unidad,
          proyecto: proyecto
        });
      })
      .then(function (cuerpo) {
        if (!cuerpo.success || !cuerpo.url) {
          throw new Error(cuerpo.error || "Respuesta inesperada del portal.");
        }
        cerrarFormulario();
        mostrarResultado(cuerpo, unidad);
        return cargarLista();
      })
      .catch(function (e) {
        console.error("[enlaces temporales] generar", e);
        mostrarError(mensajeDe(e, "No se pudo generar el enlace."));
        ocupado(false);
      });
  });

  el.cerrarBtn.addEventListener("click", function () {
    try { ZOHO.CRM.UI.Popup.close(); } catch (e) { console.error("No se pudo cerrar el popup", e); }
  });

  ZOHO.embeddedApp.on("PageLoad", function (payload) {
    console.log("PageLoad payload:", payload);
    modulo = payload && payload.Entity ? String(payload.Entity) : "";
    cargarLista();
  });
  ZOHO.embeddedApp.init();
})();
