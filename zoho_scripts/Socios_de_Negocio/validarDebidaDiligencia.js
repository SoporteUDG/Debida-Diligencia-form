// ==========================================
// Validar Debida Diligencia (módulo Socios de Negocio)
//
// Muestra en el widget las DD del Socio de Negocio actual y,
// solo si faltan, permite solicitar su creación.
//
// - Jurídica: siempre muestra sus dos DD principales (Jurídica y la Natural
//   del Representante Legal, del campo Representante_legal) y debajo los
//   contactos del socio, cada uno con su casilla.
// - Natural: los contactos del socio, cada uno con su casilla.
// Cada contacto marcado recibe su propia DD de Persona Natural. Los que ya
// tienen DD quedan bloqueados.
// ==========================================

var API_URL = "https://debida-diligencia.udggroup.com/api/generar-expediente";
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
        params.set("fields", "id,Full_Name");
        var contactos = ZDK.Apps.CRM.Accounts.fetchRelatedRecords(accountId, "Contacts", params) || [];

        var socioNombre = account.Account_Name || account.Name || "Socio de Negocio";
        var ddRecords = obtenerDDsDelAccount(accountId);

        var popupData;
        if (esNatural(tipoPersona)) {
            if (contactos.length === 0) {
                ZDK.Client.showAlert("Este Socio de Negocio no tiene contactos asociados.");
                return;
            }
            popupData = prepararNatural(contactos, ddRecords);
        } else if (esJuridica(tipoPersona)) {
            popupData = prepararJuridica(socioNombre, texto(account.Representante_legal), contactos, ddRecords);
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
// Una DD de Persona Natural por contacto. Un contacto con DD (con o sin
// enlace, aunque esté retirada) ya está creado.

function filasDeContactos(contactos, ddNaturales) {
    return contactos.map(function (contacto, i) {
        var contactId = contacto.id || contacto._id;
        var dds = ddNaturales.filter(function (dd) {
            return contactoDe(dd) === String(contactId);
        });
        // Preferimos la DD que ya tiene enlace de formulario
        var dd = dds.find(function (d) { return enlaceDe(d); }) || dds[0] || null;
        return fila(dd, {
            nombre: nombreContacto(contacto, "Contacto " + (i + 1)),
            tipo: "Natural (Contacto)",
            contactId: contactId
        });
    });
}

function prepararNatural(contactos, ddRecords) {
    var registros = filasDeContactos(contactos, ddRecords);
    var puedeSolicitar = registros.some(function (r) { return r.seleccionable; });

    return {
        tipoPersona: "natural",
        registros: registros,
        faltanPrincipales: false,
        puedeSolicitar: puedeSolicitar,
        mensaje: puedeSolicitar
            ? ""
            : "Todos los contactos ya tienen su Debida Diligencia creada."
    };
}

// ---------- Persona Jurídica ----------
// Dos DD principales: la Jurídica y la Natural del Representante Legal
// (relacionadas por DD_relacionado, sin contacto). Las retiradas no cuentan.

function prepararJuridica(socioNombre, representanteLegal, contactos, ddRecords) {
    var vigentes = ddRecords.filter(function (dd) { return !esRetirada(dd); });
    var juridicas = vigentes.filter(function (dd) { return esJuridica(dd.Persona_de_Tipo); });
    var naturales = vigentes.filter(function (dd) { return esNatural(dd.Persona_de_Tipo); });
    var idsJuridicas = ddRecords
        .filter(function (dd) { return esJuridica(dd.Persona_de_Tipo); })
        .map(function (dd) { return String(dd.id); });

    var ddJuridica = juridicas[0] || null;

    // Representante Legal: la natural relacionada a la jurídica (en cualquier
    // sentido); si no hay vínculo, la natural sin contacto o que apunta a una
    // jurídica del socio
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

    if (juridicas.length > 1 || candidatas.length > 1) {
        ZDK.Client.showAlert(
            "Se encontraron " + juridicas.length + " registros de Debida Diligencia Jurídica y " +
            candidatas.length + " del Representante Legal vigentes.\n\n" +
            "Para una Persona Jurídica solo debe existir uno de cada uno."
        );
        return null;
    }
    var ddRepresentante = candidatas[0] || null;

    var registros = [
        fila(ddJuridica, { nombre: socioNombre, tipo: "Jurídica", principal: true }),
        fila(ddRepresentante, {
            nombre: representanteLegal || "(Sin Representante Legal)",
            tipo: "Natural (Representante Legal)",
            principal: true
        })
    ];

    // Contactos: sus DD naturales (la jurídica no es de un contacto)
    var ddNaturales = ddRecords.filter(function (dd) { return !esJuridica(dd.Persona_de_Tipo); });
    registros = registros.concat(filasDeContactos(contactos, ddNaturales));

    var faltanPrincipales = !ddJuridica || !ddRepresentante;
    var hayContactos = registros.some(function (r) { return r.seleccionable; });

    var puedeSolicitar = faltanPrincipales || hayContactos;
    var mensaje = "";
    if (faltanPrincipales && !representanteLegal) {
        // Sin Representante Legal no se puede crear su DD: se bloquea la solicitud
        puedeSolicitar = false;
        mensaje = "El Socio de Negocio no tiene Representante Legal: complete el campo " +
            "\"Representante legal\" para generar sus Debidas Diligencias.";
    } else if (!puedeSolicitar) {
        mensaje = "Los registros de Debida Diligencia ya fueron creados.";
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

async function enviarSolicitud(data) {
    var body = {
        name: String(data.name).trim(),
        type: data.tipo,
        socioId: String(data.accountId).trim(),
        proyecto: nombreProyecto(),
        // Contactos marcados en el widget: cada uno recibe su DD de Persona Natural
        contactos: data.contactos
    };

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
            ZDK.Client.showMessage("¡Documentos de Debida diligencia generados exitosamente!", { type: "success" });
            $Client.refresh();
        } else {
            // El servidor explica el motivo en "error" (p. ej. falta el Representante Legal)
            var detalle = "";
            try {
                var json = typeof respuesta === "string" ? JSON.parse(respuesta) : respuesta;
                detalle = (json && json.error) || "";
            } catch (e) {
                // Respuesta no JSON
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
