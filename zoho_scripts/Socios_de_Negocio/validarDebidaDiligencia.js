// ==========================================
// Validar Debida Diligencia (módulo Socios de Negocio)
//
// Muestra en el widget las DD del Socio de Negocio actual y,
// solo si faltan, permite solicitar su creación.
//
// - Jurídica: una sola DD, la Jurídica. El Representante Legal (campo
//   Representante_legal) recibe un enlace relacionado sin contacto sobre ella
//   (siempre que falte), y cada contacto del socio un enlace relacionado con
//   su casilla. Los que ya tienen enlace (o una DD propia anterior) quedan
//   bloqueados.
// - Natural: una sola DD, la del contacto estándar (Contacto_est_ndar; debe
//   haber exactamente uno), que es la principal. Los demás contactos reciben
//   un enlace relacionado sobre esa misma DD, cada uno con su casilla. Los que
//   ya tienen enlace (o una DD propia anterior) quedan bloqueados.
// ==========================================

var API_URL = "https://debida-diligencia.udggroup.com/api/generar-expediente";
var ENLACES_URL = "https://debida-diligencia.udggroup.com/api/generar-adicional";
var CAMPO_ESTANDAR = "Contacto_est_ndar";
var WIDGET_API_NAME = "Validaci_n_Debida_Diligencia";
var RELATED_DD = "Etiqueta_de_lista_relacionada_3";

// El registro actual es el Socio de Negocio
function obtenerAccountId() {
    return $Page.record_id;
}

// ---------- Helpers ----------

// Valor de texto de un campo (los lookups/picklists pueden venir como objeto)
function texto(valor) {
    if (valor === null || valor === undefined) return "";
    if (typeof valor === "object") {
        return String(valor.name || valor.display_value || valor.value || "").trim();
    }
    return String(valor).trim();
}

// ID de un lookup: ZDK lo entrega como Campo_Lookup_Id o como { id, name }
function idLookup(registro, campo) {
    if (!registro) return "";
    var plano = registro[campo + "_Lookup_Id"];
    if (plano) return String(plano);
    var valor = registro[campo];
    if (valor && typeof valor === "object") return String(valor.id || "");
    return "";
}

function esVerdadero(v) {
    return v === true || String(v).toLowerCase() === "true";
}

function esNatural(tipo) {
    var t = texto(tipo).toLowerCase();
    return t.includes("nat") || t === "natural";
}

function esJuridica(tipo) {
    var t = texto(tipo).toLowerCase();
    return t.includes("jur") || t === "juridico";
}

// Retirado (anulado): no cuenta como DD principal existente
function esRetirada(dd) {
    var marca = dd.retirado;
    return marca === true || String(marca).toLowerCase() === "true" || texto(dd.Estado) === "Anulado";
}

function nombreContacto(contacto, porDefecto) {
    return contacto.Full_Name || contacto.Name || contacto.Last_Name || porDefecto;
}

function nombreProyecto() {
    return texto($Page.record.Proyecto);
}

function contactoDe(dd) {
    return idLookup(dd, "Nombre_de_contacto");
}

function relacionadoDe(dd) {
    return idLookup(dd, "DD_relacionado");
}

function enlaceDe(dd) {
    return dd ? texto(dd.Enlace_de_Formulario) || null : null;
}

function obtenerDDsDelAccount(accountId) {
    var params = new Map();
    params.set("fields", "id,Name,Estado,Persona_de_Tipo,Nombre_de_contacto,Enlace_de_Formulario,retirado,DD_relacionado");
    return ZDK.Apps.CRM.Accounts.fetchRelatedRecords(accountId, RELATED_DD, params) || [];
}

function fila(dd, datos) {
    return {
        nombre: datos.nombre,
        tipo: datos.tipo,
        estado: dd ? texto(dd.Estado) || "—" : "—",
        registro: !!dd,
        contactId: datos.contactId || null,
        ddId: dd ? dd.id : null,
        enlace: enlaceDe(dd),
        principal: !!datos.principal,
        // Solo los contactos sin DD se pueden marcar; empiezan marcados
        seleccionable: !datos.principal && !dd,
        seleccionado: !datos.principal && !dd
    };
}

// ---------- Flujo principal ----------

async function validarDebidaDiligencia() {
    try {
        var accountId = obtenerAccountId();
        if (!accountId) {
            ZDK.Client.showAlert("No se pudo obtener el Socio de Negocio actual.");
            return;
        }

        var account = ZDK.Apps.CRM.Accounts.fetchById(accountId);
        if (!account) {
            ZDK.Client.showAlert("No se pudo obtener la información del Socio de Negocio.");
            return;
        }

        var tipoPersona = account.Persona_de_Tipo;
        if (!tipoPersona) {
            ZDK.Client.showAlert("El Socio de Negocio no tiene definido el Tipo de Persona.");
            return;
        }

        var params = new Map();
        params.set("fields", "id,Full_Name," + CAMPO_ESTANDAR);
        var contactos = ZDK.Apps.CRM.Accounts.fetchRelatedRecords(accountId, "Contacts", params) || [];

        var socioNombre = account.Account_Name || account.Name || "Socio de Negocio";
        var ddRecords = obtenerDDsDelAccount(accountId);

        var popupData;
        if (esNatural(tipoPersona)) {
            if (contactos.length === 0) {
                ZDK.Client.showAlert("Este Socio de Negocio no tiene contactos asociados.");
                return;
            }
            popupData = await prepararNatural(contactos, ddRecords);
        } else if (esJuridica(tipoPersona)) {
            popupData = await prepararJuridica(socioNombre, texto(account.Nombre_Extranjero_No_en_Peachtree), contactos, ddRecords);
        } else {
            ZDK.Client.showAlert("Tipo de persona no reconocido: " + texto(tipoPersona));
            return;
        }

        // Validación fallida: ya se mostró la alerta
        if (!popupData) return;

        popupData.socioDeNegocio = socioNombre;
        popupData.accountId = accountId;

        var resultado = await abrirWidget(popupData);

        if (resultado && resultado.accion === "agregar" && popupData.puedeSolicitar) {
            await enviarSolicitud({
                name: socioNombre,
                tipo: popupData.tipoPersona,
                accountId: accountId,
                contactos: Array.isArray(resultado.contactos) ? resultado.contactos : []
            });
        } else {
            // "cancelar", o el popup se cerró con la X
            ZDK.Client.showMessage("No se realizó ninguna solicitud.", { type: "info" });
        }
    } catch (error) {
        console.error("Error:", error);
        ZDK.Client.showAlert("Ocurrió un error al validar las Debidas Diligencias.");
    }
}

// ---------- Contactos (natural y jurídica) ----------
// Cada contacto recibe un enlace relacionado sobre la DD del socio. Un contacto
// con DD propia (anterior a este esquema) se respeta.

// Enlaces de contactos de una DD en el portal ({ contactId, role, representante, linkStatus, clientUrl }).
// Si la DD aún no está en el portal (404) o falla, no hay enlaces.
async function obtenerEnlacesDeContactos(ddId) {
    try {
        var response = await ZDK.HTTP.request({
            url: ENLACES_URL,
            method: "GET",
            parameters: { crmId: ddId }
        });
        var statusCode = await response.getStatusCode();
        if (statusCode !== 200) return [];
        var cuerpo = await response.getResponse();
        var json = typeof cuerpo === "string" ? JSON.parse(cuerpo) : cuerpo;
        return (json && json.contactLinks) || [];
    } catch (e) {
        log("No se pudieron leer los enlaces de la DD " + ddId + ": " + (e && e.message));
        return [];
    }
}

// La DD de un contacto: preferimos la vigente con enlace de formulario
function ddDelContacto(ddNaturales, contactId) {
    var dds = ddNaturales.filter(function (dd) { return contactoDe(dd) === String(contactId); });
    var vigentes = dds.filter(function (d) { return !esRetirada(d); });
    return vigentes.find(function (d) { return enlaceDe(d); }) || vigentes[0] ||
        dds.find(function (d) { return enlaceDe(d); }) || dds[0] || null;
}

// Enlace vigente (no anulado) de un contacto en la lista del portal
function enlaceDelContacto(enlaces, contactId) {
    return enlaces.find(function (l) {
        return l.role === "RELATED" && String(l.contactId) === String(contactId) && l.linkStatus !== "Anulado";
    }) || null;
}

// Filas de los contactos relacionados (todos menos `excluirId`) sobre la DD `ddSocio`
function filasRelacionadas(contactos, excluirId, ddNaturales, enlaces, ddSocio) {
    var filas = [];
    contactos.forEach(function (contacto, i) {
        var contactId = String(contacto.id || contacto._id);
        if (excluirId && contactId === excluirId) return;
        var nombre = nombreContacto(contacto, "Contacto " + (i + 1));

        // DD propia (anterior a la DD única del socio): se respeta
        var ddPropia = ddDelContacto(ddNaturales, contactId);
        if (ddPropia) {
            filas.push(fila(ddPropia, { nombre: nombre, tipo: "Natural (Contacto)", contactId: contactId }));
            return;
        }

        var enlace = enlaceDelContacto(enlaces, contactId);
        filas.push({
            nombre: nombre,
            tipo: "Natural (Relacionado)",
            estado: enlace ? enlace.linkStatus : "—",
            registro: !!enlace,
            contactId: contactId,
            ddId: ddSocio ? ddSocio.id : null,
            enlace: enlace ? enlace.clientUrl : null,
            principal: false,
            relacionado: true,
            seleccionable: !enlace,
            seleccionado: !enlace
        });
    });
    return filas;
}

// ---------- Persona Natural ----------
// Una DD principal (la del contacto estándar) y un enlace relacionado sobre
// ella por cada otro contacto.

async function prepararNatural(contactos, ddRecords) {
    var estandares = contactos.filter(function (c) { return esVerdadero(c[CAMPO_ESTANDAR]); });
    if (estandares.length !== 1) {
        ZDK.Client.showAlert(estandares.length
            ? "Hay " + estandares.length + " contactos marcados como Contacto estándar (" +
              estandares.map(function (c) { return nombreContacto(c, c.id); }).join(", ") + ").\n\n" +
              "Solo uno puede serlo: es el que lleva la Debida Diligencia principal."
            : "Ningún contacto del Socio de Negocio está marcado como Contacto estándar.\n\n" +
              "Marque al contacto principal para generar su Debida Diligencia.");
        return null;
    }
    var principal = estandares[0];
    var principalId = String(principal.id || principal._id);

    var ddNaturales = ddRecords.filter(function (dd) { return !esJuridica(dd.Persona_de_Tipo); });
    var ddPrincipal = ddDelContacto(ddNaturales, principalId);
    var enlaces = ddPrincipal ? await obtenerEnlacesDeContactos(ddPrincipal.id) : [];

    var registros = [
        fila(ddPrincipal, {
            nombre: nombreContacto(principal, "Contacto estándar"),
            tipo: "Natural (Principal)",
            contactId: principalId,
            principal: true
        })
    ];

    registros = registros.concat(filasRelacionadas(contactos, principalId, ddNaturales, enlaces, ddPrincipal));

    var faltanPrincipales = !ddPrincipal;
    var puedeSolicitar = faltanPrincipales || registros.some(function (r) { return r.seleccionable; });

    return {
        tipoPersona: "natural",
        registros: registros,
        faltanPrincipales: faltanPrincipales,
        puedeSolicitar: puedeSolicitar,
        mensaje: puedeSolicitar
            ? ""
            : "La Debida Diligencia principal ya existe y todos los contactos tienen su enlace."
    };
}

// ---------- Persona Jurídica ----------
// Una sola DD (la Jurídica). Sobre ella: el enlace del Representante Legal
// (relacionado sin contacto, del campo Representante_legal) y un enlace
// relacionado por cada contacto del socio. Las DD retiradas no cuentan.
// Socios anteriores pueden tener la DD Natural del Representante Legal
// (DD_relacionado): se respeta y no se genera su enlace.

async function prepararJuridica(socioNombre, representanteLegal, contactos, ddRecords) {
    var vigentes = ddRecords.filter(function (dd) { return !esRetirada(dd); });
    var juridicas = vigentes.filter(function (dd) { return esJuridica(dd.Persona_de_Tipo); });
    var naturales = vigentes.filter(function (dd) { return esNatural(dd.Persona_de_Tipo); });
    var idsJuridicas = ddRecords
        .filter(function (dd) { return esJuridica(dd.Persona_de_Tipo); })
        .map(function (dd) { return String(dd.id); });

    if (juridicas.length > 1) {
        ZDK.Client.showAlert(
            "Se encontraron " + juridicas.length + " registros de Debida Diligencia Jurídica vigentes.\n\n" +
            "Para una Persona Jurídica solo debe existir uno."
        );
        return null;
    }
    var ddJuridica = juridicas[0] || null;

    // DD Natural del Representante Legal de antes (relacionada a la jurídica en
    // cualquier sentido; si no hay vínculo, la única natural sin contacto o que
    // apunta a una jurídica del socio)
    var vinculada = ddJuridica
        ? naturales.find(function (n) {
            return String(n.id) === relacionadoDe(ddJuridica) || relacionadoDe(n) === String(ddJuridica.id);
        }) || null
        : null;
    var candidatas = vinculada
        ? [vinculada]
        : naturales.filter(function (n) {
            return !contactoDe(n) || idsJuridicas.indexOf(relacionadoDe(n)) !== -1;
        });
    var ddRepresentanteAnterior = candidatas.length === 1 ? candidatas[0] : null;

    var enlaces = ddJuridica ? await obtenerEnlacesDeContactos(ddJuridica.id) : [];
    var enlaceRepresentante = enlaces.find(function (l) {
        return l.representante && l.linkStatus !== "Anulado";
    }) || null;

    var registros = [fila(ddJuridica, { nombre: socioNombre, tipo: "Jurídica", principal: true })];
    if (ddRepresentanteAnterior) {
        registros.push(fila(ddRepresentanteAnterior, {
            nombre: representanteLegal || "(Sin Representante Legal)",
            tipo: "Natural (Representante Legal)",
            principal: true
        }));
    } else {
        // Se genera siempre que falte (sin casilla), como la DD jurídica
        registros.push({
            nombre: representanteLegal || "(Sin Representante Legal)",
            tipo: "Representante Legal (Relacionado)",
            estado: enlaceRepresentante ? enlaceRepresentante.linkStatus : "—",
            registro: !!enlaceRepresentante,
            contactId: null,
            ddId: ddJuridica ? ddJuridica.id : null,
            enlace: enlaceRepresentante ? enlaceRepresentante.clientUrl : null,
            principal: true,
            relacionado: true,
            seleccionable: false,
            seleccionado: false
        });
    }

    // Contactos: un enlace relacionado cada uno (la DD Natural del Representante
    // Legal de antes no es de un contacto)
    var ddNaturales = ddRecords.filter(function (dd) {
        return !esJuridica(dd.Persona_de_Tipo) && dd !== ddRepresentanteAnterior;
    });
    registros = registros.concat(filasRelacionadas(contactos, null, ddNaturales, enlaces, ddJuridica));

    var faltanPrincipales = !ddJuridica || (!ddRepresentanteAnterior && !enlaceRepresentante);
    var hayContactos = registros.some(function (r) { return r.seleccionable; });

    var puedeSolicitar = faltanPrincipales || hayContactos;
    var mensaje = "";
    if (faltanPrincipales && !representanteLegal && !ddRepresentanteAnterior) {
        // Sin Representante Legal no se puede crear su enlace: se bloquea la solicitud
        puedeSolicitar = false;
        mensaje = "El Socio de Negocio no tiene Representante Legal: complete el campo " +
            "\"Representante legal\" para generar su Debida Diligencia.";
    } else if (!puedeSolicitar) {
        mensaje = "La Debida Diligencia Jurídica ya existe, con el enlace del Representante Legal y de todos los contactos.";
    }

    return {
        tipoPersona: "juridica",
        registros: registros,
        faltanPrincipales: faltanPrincipales,
        puedeSolicitar: puedeSolicitar,
        mensaje: mensaje
    };
}

// ---------- Widget ----------
// Siempre se espera (await) la respuesta: si el popup queda pendiente,
// Zoho no vuelve a abrir el widget hasta recargar la página.

async function abrirWidget(popupData) {
    try {
        return await abrirPopup(popupData);
    } catch (error) {
        // Cerrar con la X del popup rechaza con "widget_closed": es una cancelación
        var detalle = [String(error), error && error.message, error && error.code].join(" ");
        if (detalle.indexOf("widget_closed") !== -1) {
            return { accion: "cancelar" };
        }
        throw error;
    }
}

async function abrirPopup(popupData) {
    return await ZDK.Client.openPopup({
        api_name: WIDGET_API_NAME,
        type: "widget",
        header: "Documentos de Debida Diligencia",
        animation_type: 1,
        height: "450px",
        width: "700px",
        left: "center"
    }, {
        data: popupData
    });
}

// ---------- API ----------

async function enviarSolicitud(data, sinRepresentante) {
    var body = {
        name: String(data.name).trim(),
        type: data.tipo,
        socioId: String(data.accountId).trim(),
        proyecto: nombreProyecto(),
        // Contactos marcados en el widget: cada uno recibe su enlace relacionado en la DD del socio
        contactos: data.contactos
    };
    // Confirmado por el usuario: sin Representante Legal solo se crea el enlace de la jurídica
    if (sinRepresentante) body.sinRepresentante = true;

    ZDK.Client.showLoader({
        type: "page",
        template: "vertical-bar",
        message: "Generando enlace de debida diligencia, por favor espere..."
    });

    try {
        var response = await ZDK.HTTP.request({
            url: API_URL,
            method: "POST",
            content: body,
            headers: { "Content-Type": "application/json" }
        });
        ZDK.Client.hideLoader();

        var statusCode = await response.getStatusCode();
        var respuesta = await response.getResponse();
        log("HTTP Status: " + statusCode);
        log("Response Body: " + respuesta);

        if (statusCode === 200 || statusCode === 201) {
            // El servidor describe lo creado (o "ya existían") en "message"
            var mensajeOk = "";
            try {
                var ok = typeof respuesta === "string" ? JSON.parse(respuesta) : respuesta;
                mensajeOk = (ok && ok.message) || "";
            } catch (e) {
                // Respuesta no JSON
            }
            ZDK.Client.showMessage(mensajeOk || "¡Documentos de Debida diligencia generados exitosamente!", { type: "success" });
            $Client.refresh();
        } else {
            // El servidor explica el motivo en "error" (p. ej. falta el Representante Legal)
            var detalle = "";
            var json = null;
            try {
                json = typeof respuesta === "string" ? JSON.parse(respuesta) : respuesta;
                detalle = (json && json.error) || "";
            } catch (e) {
                // Respuesta no JSON
            }
            if (statusCode === 422 && json && json.code === "SIN_REPRESENTANTE_LEGAL") {
                if (ZDK.Client.showConfirmation(
        "El Socio de Negocio no tiene Representante Legal.\n\nSi continúa, solo se generará el enlace de Persona Jurídica (sin el del Representante Legal ni los de los contactos).",
        "Generar solo el enlace",
        "Cancelar"
      )) {
                    return enviarSolicitud(data, true);
                }
                return;
            }
            ZDK.Client.showMessage(detalle || "El servidor devolvió status: " + statusCode, { type: "error" });
        }
    } catch (error) {
        ZDK.Client.hideLoader();
        log("Error ZDK: " + error.message);
        ZDK.Client.showMessage("Error: " + error.message, { type: "error" });
    }
}

validarDebidaDiligencia();
