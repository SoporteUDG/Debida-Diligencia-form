# Botón "Ver expediente" (Canvas) → Web Tab `/view`

Los Web Tabs de Zoho CRM no aceptan parámetros dinámicos (sólo de usuario y
organización), así que el registro viaja por un **traspaso** de corta vida:

```
Botón (Deluge)  -- POST /api/zoho-view {recordId, user, ts, sig} -->  servidor guarda recordId para "user" (2 min, un solo uso)
Botón (Deluge)  -- openUrl(Web Tab) -->  Web Tab carga /view?zuser=<email del usuario>
/view           -- getFormView {zohoUser} -->  reclama el traspaso y muestra el expediente
```

`sig = HMAC-SHA256(ZOHO_VIEW_SECRET, "<recordId>.<ts>")`, `ts` en milisegundos;
vale 10 minutos. Sin `ZOHO_VIEW_SECRET` en el servidor el acceso desde Zoho queda deshabilitado.

## 1. Servidor

`.env`: `ZOHO_VIEW_SECRET=<cadena aleatoria larga>` (la misma que va en el Deluge).

## 2. Web Tab

URL `https://<dominio>/view?zuser=${Usuarios.Correo electrónico}` (o `/view` con
**Append Parameters** `zuser` = *Usuario → Email*). Si Zoho no sustituye el campo,
`/view` lo indica en pantalla.

## 3. Función standalone (Deluge)

El botón del Canvas ejecuta Client Script (JS en el navegador): el secreto **no**
puede ir ahí. La firma y el traspaso los hace esta función, que el JS invoca.

*Setup → Developer Hub → Functions → New Function* · categoría **Standalone** ·
nombre `preparar_vista_expediente` · argumento `recordId` (String).

```deluge
string standalone.preparar_vista_expediente(String recordId)
{
	secret = "<ZOHO_VIEW_SECRET>";
	appUrl = "https://<dominio>";

	ts = zoho.currenttime.toLong().toString();
	sig = zoho.encryption.hmacsha256(secret, recordId + "." + ts, "base64");

	payload = Map();
	payload.put("recordId", recordId);
	payload.put("user", zoho.loginuserid);
	payload.put("ts", ts);
	payload.put("sig", sig);

	resp = invokeurl
	[
		url :appUrl + "/api/zoho-view"
		type :POST
		parameters:payload.toString()
		headers:{"Content-Type":"application/json"}
	];

	result = Map();
	result.put("success", resp.get("success") == true);
	result.put("error", ifnull(resp.get("error"), ""));
	// Respaldo: vista directa firmada, por si se prefiere abrir fuera del Web Tab.
	result.put("directUrl", appUrl + "/view?record_id=" + recordId + "&ts=" + ts + "&sig=" + zoho.encryption.urlEncode(sig));
	return result.toString();
}
```

## 4. Client Script del botón (Canvas)

*Setup → Developer Hub → Client Script → New* · página **Canvas / Detail** del
módulo · evento **Button → onClick** del botón.

```js
const WEB_TAB_URL = "https://crm.zoho.com/crm/<org>/tab/WebTab<N>"; // URL del Web Tab abierto en el navegador

ZDK.Client.showLoader({ type: "page", template: "spinner", message: "Abriendo expediente..." });
let res;
try {
  const resp = ZDK.Apps.CRM.Functions.execute("preparar_vista_expediente", { recordId: $Page.record_id });
  res = JSON.parse(resp.details.output);
} catch (e) {
  res = { success: false, error: "No se pudo contactar la función de Zoho." };
}
ZDK.Client.hideLoader();

if (res.success) {
  ZDK.Client.openURL(WEB_TAB_URL);
} else {
  ZDK.Client.showAlert("No se pudo abrir el expediente: " + (res.error || "error desconocido"));
}
```

Notas:

- `$Page.record_id` debe ser el mismo ID que usa "Generar enlace" (`CrmContact.crmId`).
- El traspaso se reclama por email: el `zoho.loginuserid` de la función y el
  parámetro `zuser` del Web Tab tienen que ser del mismo usuario (lo son: quien pulsa el botón).
- Para abrir la vista fuera de Zoho, cambie `openURL(WEB_TAB_URL)` por `openURL(res.directUrl)`.
