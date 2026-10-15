// ==========================================
// Validar Debida Diligencia (módulo Trámites)
//
// Muestra en el widget las DD del Socio de Negocio del trámite y,
// solo si faltan, permite solicitar su creación.
// ==========================================

var API_URL = "https://debida-diligencia.udggroup.com/api/generar-expediente";
var WIDGET_API_NAME = "Validaci_n_Debida_Diligencia";
var RELATED_DD = "Etiqueta_de_lista_relacionada_3";

// El Socio de Negocio sale del lookup del trámite
function obtenerAccountId() {
    return $Page.record.Nombre_Sociedad_Lookup_Id;
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

function esNatural(tipo) {
    return texto(tipo).toLowerCase() === "natural";
}

function esJuridica(tipo) {
    var t = texto(tipo).toLowerCase();
    return t === "jurídica" || t === "juridica";
}

function nombreContacto(contacto, porDefecto) {
    return contacto.Full_Name || contacto.Name || contacto.Last_Name || porDefecto;
}

function nombreProyecto() {
    return texto($Page.record.Proyecto);
}

function obtenerDDsDelContacto(ddRecords, contactId) {
    return (ddRecords || []).filter(function (dd) {
        var ddContactoId = dd.Nombre_de_contacto_Lookup_Id;
        return ddContactoId && String(ddContactoId) === String(contactId);
    });
}

function enlaceDe(dd) {
    return dd ? texto(dd.Enlace_de_Formulario) || null : null;
}

function obtenerDDsDelAccount(accountId) {
    var params = new Map();
    params.set("fields", "id,Name,Estado,Tipo_de_Persona,Nombre_de_contacto,Enlace_de_Formulario");
    return ZDK.Apps.CRM.Accounts.fetchRelatedRecords(accountId, RELATED_DD, params) || [];
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

        var tipoPersona = account.Tipo_de_Persona;
        if (!tipoPersona) {
            ZDK.Client.showAlert("El Socio de Negocio no tiene definido el Tipo de Persona.");
            return;
        }

        var params = new Map();
        params.set("fields", "id,Full_Name");
        var contactos = ZDK.Apps.CRM.Accounts.fetchRelatedRecords(accountId, "Contacts", params);
        if (!contactos || contactos.length === 0) {
            ZDK.Client.showAlert("Este Socio de Negocio no tiene contactos asociados.");
            return;
        }

        var socioNombre = account.Account_Name || account.Name || "Socio de Negocio";
        var ddRecords = obtenerDDsDelAccount(accountId);

        var popupData;
        if (esNatural(tipoPersona)) {
            popupData = prepararNatural(contactos, ddRecords);
        } else if (esJuridica(tipoPersona)) {
            popupData = prepararJuridica(contactos, ddRecords);
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
                accountId: accountId
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

// ---------- Persona Natural ----------
// Una DD por contacto. Un contacto con DD (con o sin enlace) ya está creado.

function prepararNatural(contactos, ddRecords) {
    var registros = [];
    var faltantes = [];

    contactos.forEach(function (contacto, i) {
        var contactId = contacto.id || contacto._id;
        var nombre = nombreContacto(contacto, "Contacto " + (i + 1));
        var dds = obtenerDDsDelContacto(ddRecords, contactId);

        // Preferimos la DD que ya tiene enlace de formulario
        var dd = dds.find(function (d) { return enlaceDe(d); }) || dds[0] || null;

        registros.push({
            nombre: nombre,
            tipo: dd ? texto(dd.Tipo_de_Persona) || "Natural" : "Natural",
            estado: dd ? texto(dd.Estado) || "—" : "—",
            registro: !!dd,
            contactId: contactId,
            ddId: dd ? dd.id : null,
            enlace: enlaceDe(dd)
        });

        if (!dd) faltantes.push({ id: contactId, nombre: nombre });
    });

    var puedeSolicitar = faltantes.length > 0;

    return {
        tipoPersona: "natural",
        registros: registros,
        faltantes: faltantes,
        puedeSolicitar: puedeSolicitar,
        mensaje: puedeSolicitar
            ? ""
            : "Todos los contactos ya tienen su Debida Diligencia creada."
    };
}

// ---------- Persona Jurídica ----------
// Un único contacto con dos DD: una Natural y una Jurídica.
// Se crean juntas, así que solo se puede solicitar si no existe ninguna.

function prepararJuridica(contactos, ddRecords) {
    if (contactos.length > 1) {
        ZDK.Client.showAlert(
            "El Socio de Negocio tiene " + contactos.length + " contactos asociados.\n\n" +
            "El proceso para Personas Jurídicas solo está disponible cuando existe un único contacto."
        );
        return null;
    }

    var contacto = contactos[0];
    var contactId = contacto.id || contacto._id;
    var nombre = nombreContacto(contacto, "Contacto");
    var dds = obtenerDDsDelContacto(ddRecords, contactId);

    var naturales = dds.filter(function (dd) { return esNatural(dd.Tipo_de_Persona); });
    var juridicas = dds.filter(function (dd) { return esJuridica(dd.Tipo_de_Persona); });

    if (dds.length > 2 || naturales.length > 1 || juridicas.length > 1) {
        ZDK.Client.showAlert(
            "Se encontraron " + dds.length + " registros de Debida Diligencia " +
            "para el contacto \"" + nombre + "\" " +
            "(" + naturales.length + " Natural, " + juridicas.length + " Jurídica).\n\n" +
            "Para una Persona Jurídica solo deben existir dos registros: uno Natural y uno Jurídica."
        );
        return null;
    }

    var ddNatural = naturales[0] || null;
    var ddJuridica = juridicas[0] || null;

    function fila(dd, tipo, nombreFila) {
        return {
            nombre: nombreFila,
            tipo: tipo,
            estado: dd ? texto(dd.Estado) || "—" : "—",
            registro: !!dd,
            contactId: contactId,
            ddId: dd ? dd.id : null,
            enlace: enlaceDe(dd)
        };
    }

    var registros = [
        fila(ddNatural, "Natural", nombre),
        fila(ddJuridica, "Jurídica", nombre + " (Representante Legal)")
    ];

    var faltantes = registros
        .filter(function (r) { return !r.registro; })
        .map(function (r) { return { id: contactId, nombre: nombre, tipo: r.tipo }; });

    var puedeSolicitar = !ddNatural && !ddJuridica;

    var mensaje = "";
    if (!puedeSolicitar) {
        mensaje = faltantes.length === 0
            ? "Los registros de Debida Diligencia ya fueron creados."
            : "Ya existe un registro de Debida Diligencia para este contacto; " +
              "no se pueden crear más. Falta el registro " + faltantes[0].tipo + ".";
    }

    return {
        tipoPersona: "juridica",
        registros: registros,
        faltantes: faltantes,
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
        proyecto: nombreProyecto()
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
        log("HTTP Status: " + statusCode);
        log("Response Body: " + await response.getResponse());

        if (statusCode === 200 || statusCode === 201) {
            ZDK.Client.showMessage("¡Documentos de Debida diligencia generados exitosamente!", { type: "success" });
            $Client.refresh();
        } else {
            ZDK.Client.showMessage("El servidor devolvió status: " + statusCode, { type: "error" });
        }
    } catch (error) {
        ZDK.Client.hideLoader();
        log("Error ZDK: " + error.message);
        ZDK.Client.showMessage("Error: " + error.message, { type: "error" });
    }
}

validarDebidaDiligencia();
