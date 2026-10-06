import { getAccessToken } from "./zohoAuthService";
import { zoho } from "./zohoService";
import { getDocumentLabel } from "./documentFields";

/**
 * Zoho rechaza a nivel de servidor (Tomcat) cualquier URL que lleve corchetes
 * sin codificar en el query string: responde un HTTP 400 con una página HTML,
 * sin llegar nunca a la API. Los enlaces de paginación que devuelve la propia
 * API vienen con los corchetes sin codificar, así que hay que normalizarlos.
 */
function encodeCorchetesEnQuery(url: string): string {
  const idx = url.indexOf("?");
  if (idx === -1) return url;
  const query = url.slice(idx + 1).replace(/\[/g, "%5B").replace(/\]/g, "%5D");
  return `${url.slice(0, idx)}?${query}`;
}

/**
 * Resume el cuerpo de un error de Zoho. Cuando la petición es rechazada por el
 * contenedor la respuesta es una página HTML completa, inútil en los logs.
 */
function resumirErrorZoho(errorText: string): string {
  const texto = (errorText || "").trim();
  if (!texto.startsWith("<")) return texto;

  const titulo = texto.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim();
  return `respuesta HTML del servidor${titulo ? ` ("${titulo}")` : ""}. La petición fue rechazada antes de llegar a la API de WorkDrive; normalmente indica una URL mal formada.`;
}

/**
 * Searches for a folder with a specific name under a given parent folder.
 * Operates case-insensitively. Handles API pagination to search beyond the first 50 results.
 * 
 * @param parentId The ID of the parent folder in WorkDrive
 * @param folderName The name of the folder we are looking for
 * @param accessToken A valid Zoho access token
 * @returns The ID of the found folder, or null if it doesn't exist
 */
export async function findFolderInParent(
  parentId: string,
  folderName: string,
  accessToken: string
): Promise<string | null> {
  const targetName = folderName.trim().toLowerCase();
  return buscarCarpetaEnPadre(parentId, (nombre) => nombre === targetName, accessToken);
}

/** Como findFolderInParent, pero busca la carpeta cuyo nombre termina con `sufijo` (sin distinguir mayúsculas). */
export async function findFolderEndingWith(
  parentId: string,
  sufijo: string,
  accessToken: string
): Promise<string | null> {
  const fin = sufijo.trim().toLowerCase();
  return buscarCarpetaEnPadre(parentId, (nombre) => nombre.endsWith(fin), accessToken);
}

async function buscarCarpetaEnPadre(
  parentId: string,
  coincide: (nombreEnMinusculas: string) => boolean,
  accessToken: string
): Promise<string | null> {
  const workdriveBaseUrl =
    process.env.ZOHO_WORKDRIVE_BASE_URL || "https://www.zohoapis.com/workdrive/api/v1";

  // Use filter[type]=folder to only list directories and limit to max allowed (50) per page.
  // URLSearchParams codifica los corchetes (filter%5Btype%5D), obligatorio para Zoho.
  const queryParams = new URLSearchParams({ "filter[type]": "folder", "page[limit]": "50" });
  let url: string | null = `${workdriveBaseUrl}/files/${parentId}/files?${queryParams.toString()}`;

  while (url) {
    const response: Response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        Accept: "application/vnd.api+json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Error al listar carpetas en el directorio padre ${parentId}: ${response.status} ${response.statusText} - ${resumirErrorZoho(errorText)}`
      );
    }

    const result: any = await response.json();
    const files = result.data || [];

    // Search case-insensitively in the current page
    const found = files.find(
      (item: any) =>
        coincide(String(item.attributes?.name ?? "").trim().toLowerCase()) ||
        coincide(String(item.attributes?.display_attr_name ?? "").trim().toLowerCase())
    );

    if (found) {
      return found.id;
    }

    // Traverse next page link if it exists (Zoho lo devuelve sin codificar)
    const siguiente = result.links?.next;
    url = siguiente ? encodeCorchetesEnQuery(siguiente) : null;
  }

  return null;
}

/**
 * Extrae el ID de carpeta de WorkDrive de un enlace de la app web, p. ej.:
 *   https://workdrive.zoho.com/folder/{id}
 *   https://workdrive.zoho.com/home/{team}/teams/{team}/ws/{ws}/folders/{id}
 * También acepta el ID solo. Los enlaces públicos (zohoexternal.com) no
 * contienen el ID de la carpeta y no sirven para crear subcarpetas por API.
 */
export function extractFolderIdFromLink(link: string): string | null {
  const valor = (link || "").trim();
  if (!valor) return null;

  const esId = (v: string) => /^[a-z0-9]{20,}$/i.test(v);
  if (esId(valor)) return valor;

  let segmentos: string[];
  try {
    const url = new URL(valor);
    if (url.hostname.includes("zohoexternal")) return null;
    segmentos = url.pathname.split("/").filter(Boolean);
  } catch {
    return null;
  }

  // Preferir el segmento que sigue a "folder"/"folders"; si no, el último con forma de ID.
  for (let i = segmentos.length - 2; i >= 0; i--) {
    if (/^folders?$/i.test(segmentos[i]) && esId(segmentos[i + 1])) return segmentos[i + 1];
  }
  return [...segmentos].reverse().find(esId) || null;
}

/**
 * Resuelve la carpeta de documentos del Socio de Negocio al que pertenece el
 * expediente (Debida_Diligencia.Socio_de_Negocios -> Accounts.Link_documentos).
 * Si el expediente no tiene socio, o el socio no tiene un enlace con ID de
 * carpeta, se usa la carpeta raíz configurada en ZOHO_WORKDRIVE_ROOT_FOLDER_ID.
 *
 * @param ddId ID del registro de Debida_Diligencia en Zoho CRM
 * @returns El ID de la carpeta del socio y el nombre del expediente
 */
export async function findFolderSocio(
  ddId: string
): Promise<{ socioFolderId: string; ddName: string }> {
  const { ddName, socioId, linkDocumentos } = await zoho.service.getSocioDocumentsLink(ddId);

  const socioFolderId = extractFolderIdFromLink(linkDocumentos);
  if (socioFolderId) return { socioFolderId, ddName };

  const motivo = !socioId
    ? `el expediente ${ddId} no tiene Socio de Negocio asignado (Socio_de_Negocios)`
    : !linkDocumentos
      ? `el Socio de Negocio ${socioId} no tiene enlace Link_documentos`
      : `el enlace Link_documentos del Socio de Negocio ${socioId} ("${linkDocumentos}") no contiene un ID de carpeta de WorkDrive (¿enlace público?)`;

  // La carpeta raíz se configura explícitamente y no se adivina: escribir los
  // expedientes en una carpeta distinta a la configurada es peor que fallar.
  const rootFolderId = process.env.ZOHO_WORKDRIVE_ROOT_FOLDER_ID;
  if (!rootFolderId || rootFolderId === "placeholder_root_folder_id") {
    throw new Error(
      `No se pudo ubicar la carpeta del socio (${motivo}) y falta la variable de entorno ZOHO_WORKDRIVE_ROOT_FOLDER_ID como carpeta alternativa.`
    );
  }

  console.warn(`[WorkDrive Service] Se usa la carpeta raíz ZOHO_WORKDRIVE_ROOT_FOLDER_ID: ${motivo}.`);
  return { socioFolderId: rootFolderId, ddName };
}

/** WorkDrive no admite estos caracteres en nombres de carpeta. */
function sanitizeFolderName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
}


/**
 * Creates a folder with the specified name under the given parent folder.
 * 
 * @param parentId The ID of the parent folder in WorkDrive
 * @param folderName The name of the new folder
 * @param accessToken A valid Zoho access token
 * @returns The ID of the newly created folder
 */
export async function createFolderInParent(
  parentId: string,
  folderName: string,
  accessToken: string
): Promise<string> {


  const workdriveBaseUrl =
    process.env.ZOHO_WORKDRIVE_BASE_URL || "https://www.zohoapis.com/workdrive/api/v1";
  const url = `${workdriveBaseUrl}/files`;

  const body = {
    data: {
      attributes: {
        name: folderName.trim(),
        parent_id: parentId,
      },
      type: "files",
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/vnd.api+json",
      Accept: "application/vnd.api+json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Error al crear la carpeta "${folderName}" bajo el padre ${parentId}: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const result = await response.json();
  if (!result.data || !result.data.id) {
    throw new Error(
      `Estructura de respuesta inesperada al crear la carpeta "${folderName}": ${JSON.stringify(
        result
      )}`
    );
  }

  return result.data.id;
}

/**
 * Expediente adicional: su carpeta vive DENTRO de la carpeta del expediente principal
 *   /{Socio}/DD/{FORMTYPE}-{DD}/{TIPO}-{nombre dado}-{DD} ({token8})/
 * con la misma estructura interna (subcarpetas por documento) que la principal.
 * Los 8 primeros caracteres del token identifican la carpeta: se busca por ese
 * sufijo, así que el nombre puede cambiar (el cliente edita el suyo) sin perderla.
 */
export interface AdicionalCarpeta {
  token: string;
  /** Nombre dado al adicional (cliente / razón social) */
  nombre: string;
  /** Tipo del adicional ("NATURAL" | "JURIDICA"); el del expediente principal va en `formType` */
  tipo: string;
}

const sufijoAdicional = (token: string) => `(${token.slice(0, 8)})`;

function nombreCarpetaAdicional(a: AdicionalCarpeta, ddName: string): string {
  return sanitizeFolderName(`${a.tipo}-${a.nombre || "Adicional"}-${ddName} ${sufijoAdicional(a.token)}`);
}

/** Resoluciones en curso de la carpeta del expediente, por ruta. */
const carpetasExpedienteEnCurso = new Map<string, Promise<{ ddFolderId: string; clientFolderId: string }>>();
/** Resoluciones en curso de la carpeta de un adicional, por token. */
const carpetasAdicionalEnCurso = new Map<string, Promise<string>>();

/**
 * Creates or reuses the Zoho WorkDrive folder structure inside the Socio de
 * Negocio's documents folder (Accounts.Link_documentos):
 *   /{Socio}/DD/{FORMTYPE}-{Nombre del expediente}/{Nombre legible del documento}/
 *
 * The operation is completely idempotent and will not create duplicate folders if run repeatedly.
 *
 * @param ddId ID del registro de Debida_Diligencia en Zoho CRM (CrmContact.crmId)
 * @param formType Tipo de formulario del expediente principal ("NATURAL" | "JURIDICA")
 * @param documentTypes Ranuras documentales (p. ej. "copiaIdFile"); cada una se
 *   crea como subcarpeta con su nombre legible
 * @param adicional Si se indica, `clientFolderId` y las subcarpetas son las de esa
 *   carpeta adicional (dentro de la del expediente principal); `expedienteFolderId` es la principal
 * @returns IDs of the hierarchy; `subfolders` is keyed by the documentTypes received
 */
export async function getOrCreateFolderStructure(
  ddId: string,
  formType: string,
  documentTypes: string[],
  passedToken?: string,
  adicional?: AdicionalCarpeta | null
): Promise<{
  socioFolderId: string;
  ddFolderId: string;
  clientFolderId: string;
  expedienteFolderId: string;
  subfolders: Record<string, string>;
}> {
  const accessToken = passedToken || await getAccessToken();

  const { socioFolderId, ddName } = await findFolderSocio(ddId);
  const clientFolderName = sanitizeFolderName(`${formType}-${ddName}`);

  console.log(`[WorkDrive Service] Iniciando sincronización de estructura de carpetas: /${socioFolderId}/DD/${clientFolderName}`);

  const getOrCreate = async (parentId: string, name: string, descripcion: string) => {
    let folderId = await findFolderInParent(parentId, name, accessToken);
    if (!folderId) {
      console.log(`[WorkDrive Service] ${descripcion} '${name}' no encontrada. Creándola...`);
      folderId = await createFolderInParent(parentId, name, accessToken);
    } else {
      console.log(`[WorkDrive Service] ${descripcion} '${name}' ya existe (ID: ${folderId}).`);
    }
    return folderId;
  };

  // 1 y 2. '/DD' dentro de la carpeta del socio y '{FORMTYPE}-{Nombre del
  // expediente}' dentro de '/DD'. Al enviar el formulario la sincronización con
  // CRM y con WorkDrive corren en paralelo y ambas resuelven esta carpeta: se
  // comparte la resolución en curso para no crear la carpeta dos veces.
  const clave = `${socioFolderId}/${clientFolderName}`;
  let enCurso = carpetasExpedienteEnCurso.get(clave);
  if (!enCurso) {
    enCurso = (async () => {
      const ddFolderId = await getOrCreate(socioFolderId, "DD", "Carpeta");
      const clientFolderId = await getOrCreate(ddFolderId, clientFolderName, "Carpeta del expediente");
      return { ddFolderId, clientFolderId };
    })().finally(() => carpetasExpedienteEnCurso.delete(clave));
    carpetasExpedienteEnCurso.set(clave, enCurso);
  }
  const { ddFolderId, clientFolderId: expedienteFolderId } = await enCurso;

  // 2b. Adicional: su carpeta dentro de la del expediente principal (se busca por el
  // sufijo del token; si no existe se crea con el nombre dado)
  let clientFolderId = expedienteFolderId;
  if (adicional) {
    let adicionalEnCurso = carpetasAdicionalEnCurso.get(adicional.token);
    if (!adicionalEnCurso) {
      adicionalEnCurso = (async () => {
        const existente = await findFolderEndingWith(expedienteFolderId, sufijoAdicional(adicional.token), accessToken);
        return existente ?? createFolderInParent(expedienteFolderId, nombreCarpetaAdicional(adicional, ddName), accessToken);
      })().finally(() => carpetasAdicionalEnCurso.delete(adicional.token));
      carpetasAdicionalEnCurso.set(adicional.token, adicionalEnCurso);
    }
    clientFolderId = await adicionalEnCurso;
  }

  // 3. Una subcarpeta con nombre legible por cada tipo de documento
  const subfolders: Record<string, string> = {};
  for (const docType of documentTypes) {
    const trimmedDocType = docType.trim();
    if (!trimmedDocType) continue;

    const folderName = sanitizeFolderName(getDocumentLabel(trimmedDocType));
    subfolders[trimmedDocType] = await getOrCreate(clientFolderId, folderName, "Subcarpeta de documento");
  }

  console.log("[WorkDrive Service] Estructura de carpetas sincronizada exitosamente.");

  return {
    socioFolderId,
    ddFolderId,
    clientFolderId,
    expedienteFolderId,
    subfolders,
  };
}

/**
 * Enlace de la app web de WorkDrive a una carpeta (requiere sesión en Zoho, no
 * es público). Se usa el `permalink` que devuelve la API, que respeta el
 * dominio de la cuenta; si no viene, se arma el enlace estándar /folder/{id}.
 */
export async function getFolderPermalink(folderId: string, accessToken: string): Promise<string> {
  const workdriveBaseUrl =
    process.env.ZOHO_WORKDRIVE_BASE_URL || "https://www.zohoapis.com/workdrive/api/v1";
  const fallback = `https://workdrive.zoho.com/folder/${folderId}`;

  try {
    const response = await fetch(`${workdriveBaseUrl}/files/${folderId}`, {
      method: "GET",
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        Accept: "application/vnd.api+json",
      },
    });
    if (!response.ok) return fallback;
    const result = await response.json();
    return result.data?.attributes?.permalink || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Enlace directo a la carpeta del expediente
 * (/{Socio}/DD/{FORMTYPE}-{Nombre del expediente}/), creándola si no existe.
 * A diferencia de Link_documentos del Socio, sólo contiene este expediente.
 */
export async function getClientFolderLink(
  ddId: string,
  formType: string,
  accessToken: string
): Promise<string> {
  const { clientFolderId } = await getOrCreateFolderStructure(ddId, formType, [], accessToken);
  return getFolderPermalink(clientFolderId, accessToken);
}

/**
 * Uploads a file buffer to a specific folder in Zoho WorkDrive using the Stream Upload API.
 * 
 * @param parentId The ID of the target folder in WorkDrive
 * @param fileName The name of the file to create in WorkDrive
 * @param fileBuffer The binary content of the file
 * @param accessToken A valid Zoho access token
 * @returns The ID of the uploaded file
 */
export async function uploadFileToWorkDrive(
  parentId: string,
  fileName: string,
  fileBuffer: Buffer,
  accessToken: string
): Promise<string> {
  // Se usa el endpoint multipart del dominio de la API (el mismo que el resto
  // de llamadas de WorkDrive). El stream upload de upload.zoho.com responde
  // 401 INVALID_OAUTHSCOPE con el scope WorkDrive.files.ALL.
  const workdriveBaseUrl =
    process.env.ZOHO_WORKDRIVE_BASE_URL || "https://www.zohoapis.com/workdrive/api/v1";
  const query = new URLSearchParams({
    filename: fileName,
    parent_id: parentId,
    "override-name-exist": "true",
  });
  const url = `${workdriveBaseUrl}/upload?${query.toString()}`;

  const formData = new FormData();
  formData.append("content", new Blob([new Uint8Array(fileBuffer)]), fileName);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      // Sin Content-Type: fetch fija el multipart/form-data con su boundary.
      "Authorization": `Zoho-oauthtoken ${accessToken}`,
      "Accept": "application/vnd.api+json",
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Error en Zoho Upload para "${fileName}": ${response.status} ${response.statusText} - ${resumirErrorZoho(errorText)}`
    );
  }

  const result = await response.json();
  // Respuesta: { data: [ { attributes: { resource_id, FileName, parent_id } } ] }
  const resourceId = result.data?.[0]?.attributes?.resource_id;
  if (!resourceId) {
    throw new Error(
      `Estructura de respuesta inesperada en Zoho Upload: ${JSON.stringify(result)}`
    );
  }

  return resourceId;
}

/**
 * Creates an external public shareable link for a file or folder in Zoho WorkDrive.
 * 
 * @param resourceId The ID of the file or folder to share
 * @param accessToken A valid Zoho access token
 * @returns The sharing URL
 */
export async function createShareLink(
  resourceId: string,
  accessToken: string
): Promise<string> {
  const workdriveBaseUrl =
    process.env.ZOHO_WORKDRIVE_BASE_URL || "https://www.zohoapis.com/workdrive/api/v1";
  const url = `${workdriveBaseUrl}/links`;

  const body = {
    data: {
      type: "links",
      attributes: {
        resource_id: resourceId,
        link_name: "Enlace Publico Debida Diligencia",
        request_user_data: false,
        allow_download: true,
      },
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/vnd.api+json",
      "Accept": "application/vnd.api+json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Error al crear enlace compartido para recurso ${resourceId}: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const result = await response.json();
  if (!result.data || !result.data.attributes || !result.data.attributes.link) {
    throw new Error(
      `Estructura de respuesta inesperada en Zoho Create Link: ${JSON.stringify(result)}`
    );
  }

  return result.data.attributes.link;
}

/**
 * Deletes a file or folder from Zoho WorkDrive.
 * 
 * @param resourceId The ID of the file or folder to delete in WorkDrive
 * @param accessToken A valid Zoho access token
 */
export async function deleteFileFromWorkDrive(
  resourceId: string,
  accessToken: string
): Promise<void> {
  const workdriveBaseUrl =
    process.env.ZOHO_WORKDRIVE_BASE_URL || "https://www.zohoapis.com/workdrive/api/v1";
  const url = `${workdriveBaseUrl}/files/${resourceId}`;

  console.log(`[WorkDrive Service] Intentando eliminar recurso de WorkDrive con ID: ${resourceId}`);

  // WorkDrive no borra con DELETE (responde 401 R008): se mueve a la papelera
  // con PATCH status="51". El recurso queda recuperable desde la papelera.
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      "Authorization": `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/vnd.api+json",
      "Accept": "application/vnd.api+json",
    },
    body: JSON.stringify({
      data: {
        attributes: { status: "51" },
        type: "files",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Error al eliminar recurso ${resourceId} de WorkDrive: ${response.status} ${response.statusText} - ${resumirErrorZoho(errorText)}`
    );
  }

  console.log(`[WorkDrive Service] Recurso ${resourceId} movido a la papelera de WorkDrive.`);
}



/**
 * Mueve un archivo o carpeta a otra carpeta de WorkDrive (conserva su contenido
 * y su ID).
 */
export async function moveFolder(resourceId: string, newParentId: string, accessToken: string): Promise<void> {
  const workdriveBaseUrl =
    process.env.ZOHO_WORKDRIVE_BASE_URL || "https://www.zohoapis.com/workdrive/api/v1";
  const response = await fetch(`${workdriveBaseUrl}/files/${resourceId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/vnd.api+json",
      Accept: "application/vnd.api+json",
    },
    body: JSON.stringify({ data: { attributes: { parent_id: newParentId }, type: "files" } }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Error al mover ${resourceId} a la carpeta ${newParentId}: ${response.status} ${response.statusText} - ${resumirErrorZoho(errorText)}`
    );
  }
  console.log(`[WorkDrive Service] Recurso ${resourceId} movido a la carpeta ${newParentId}.`);
}

/**
 * Ubica (sin crear nada) la carpeta del expediente
 * /{Socio}/DD/{FORMTYPE}-{Nombre del expediente}. `clientFolderId` es null si aún no existe.
 * Con `adicionalToken` (`formType` sigue siendo el del expediente principal), `clientFolderId`
 * es la carpeta de ese adicional dentro de la principal (`expedienteFolderId`).
 */
export async function localizarCarpetaExpediente(
  ddId: string,
  formType: string,
  accessToken: string,
  adicionalToken?: string | null
): Promise<{
  socioFolderId: string;
  ddFolderId: string | null;
  clientFolderId: string | null;
  expedienteFolderId: string | null;
}> {
  const { socioFolderId, ddName } = await findFolderSocio(ddId);
  const ddFolderId = await findFolderInParent(socioFolderId, "DD", accessToken);
  if (!ddFolderId) return { socioFolderId, ddFolderId: null, clientFolderId: null, expedienteFolderId: null };
  const expedienteFolderId = await findFolderInParent(ddFolderId, sanitizeFolderName(`${formType}-${ddName}`), accessToken);
  if (!adicionalToken || !expedienteFolderId) {
    return { socioFolderId, ddFolderId, clientFolderId: adicionalToken ? null : expedienteFolderId, expedienteFolderId };
  }
  const clientFolderId = await findFolderEndingWith(expedienteFolderId, sufijoAdicional(adicionalToken), accessToken);
  return { socioFolderId, ddFolderId, clientFolderId, expedienteFolderId };
}

/** Nombre de la carpeta, dentro de /{Socio}/DD, donde se archivan los expedientes anulados. */
export const CARPETA_RETIRADOS = "_Retirados";

/** Obtiene (o crea) /{Socio}/DD/_Retirados. */
export async function getOrCreateCarpetaRetirados(ddFolderId: string, accessToken: string): Promise<string> {
  return (
    (await findFolderInParent(ddFolderId, CARPETA_RETIRADOS, accessToken)) ??
    (await createFolderInParent(ddFolderId, CARPETA_RETIRADOS, accessToken))
  );
}
