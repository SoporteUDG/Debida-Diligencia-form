import { getAccessToken, executeWithRetry } from "./zohoAuthService";

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
  const workdriveBaseUrl =
    process.env.ZOHO_WORKDRIVE_BASE_URL || "https://www.zohoapis.com/workdrive/api/v1";
  
  // Use filter[type]=folder to only list directories and limit to max allowed (50) per page
  let url = `${workdriveBaseUrl}/files/${parentId}/files?filter[type]=folder&page[limit]=50`;
  const targetName = folderName.trim().toLowerCase();

  while (url) {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        Accept: "application/vnd.api+json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Error al listar carpetas en el directorio padre ${parentId}: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const result = await response.json();
    const files = result.data || [];

    // Search case-insensitively in the current page
    const found = files.find(
      (item: any) =>
        item.attributes?.name?.trim().toLowerCase() === targetName ||
        item.attributes?.display_attr_name?.trim().toLowerCase() === targetName
    );

    if (found) {
      return found.id;
    }

    // Traverse next page link if it exists
    url = result.links?.next || null;
  }

  return null;
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
 * Creates or reuses the Zoho WorkDrive folder structure:
 * /DD/{AÑO}/{MES}/{APELLIDO_NOMBRE_ID}/
 * And creates the specified subfolders (e.g. document types) inside it.
 * 
 * The operation is completely idempotent and will not create duplicate folders if run repeatedly.
 * 
 * @param year The year string (e.g. "2026")
 * @param month The month string (e.g. "07")
 * @param apellidoNombreId The identifier folder name for the client (e.g. "Perez_Juan_12345678")
 * @param documentTypes Array of document types representing the subfolders to be created
 * @returns An object containing IDs for each layer of the folder hierarchy
 */
export async function getOrCreateFolderStructure(
  year: string,
  month: string,
  apellidoNombreId: string,
  documentTypes: string[],
  passedToken?: string
): Promise<{
  rootFolderId: string;
  ddFolderId: string;
  yearFolderId: string;
  monthFolderId: string;
  clientFolderId: string;
  subfolders: Record<string, string>;
}> {
  const accessToken = passedToken || await getAccessToken();
  const rootFolderId = process.env.ZOHO_WORKDRIVE_ROOT_FOLDER_ID;

  if (!rootFolderId) {
    throw new Error(
      "Falta la variable de entorno ZOHO_WORKDRIVE_ROOT_FOLDER_ID. No se puede determinar la carpeta raíz de destino."
    );
  }

  console.log(`[WorkDrive Service] Iniciando sincronización de estructura de carpetas: /DD/${year}/${month}/${apellidoNombreId}`);

  // 1. Get or create '/DD' folder in Root
  let ddFolderId = await findFolderInParent(rootFolderId, "DD", accessToken);
  if (!ddFolderId) {
    console.log("[WorkDrive Service] Carpeta 'DD' no encontrada. Creándola...");
    ddFolderId = await createFolderInParent(rootFolderId, "DD", accessToken);
  } else {
    console.log(`[WorkDrive Service] Carpeta 'DD' ya existe (ID: ${ddFolderId}).`);
  }

  // 2. Get or create '{AÑO}' folder under 'DD'
  let yearFolderId = await findFolderInParent(ddFolderId, year, accessToken);
  if (!yearFolderId) {
    console.log(`[WorkDrive Service] Carpeta del año '${year}' no encontrada. Creándola...`);
    yearFolderId = await createFolderInParent(ddFolderId, year, accessToken);
  } else {
    console.log(`[WorkDrive Service] Carpeta del año '${year}' ya existe (ID: ${yearFolderId}).`);
  }

  // 3. Get or create '{MES}' folder under '{AÑO}'
  let monthFolderId = await findFolderInParent(yearFolderId, month, accessToken);
  if (!monthFolderId) {
    console.log(`[WorkDrive Service] Carpeta del mes '${month}' no encontrada. Creándola...`);
    monthFolderId = await createFolderInParent(yearFolderId, month, accessToken);
  } else {
    console.log(`[WorkDrive Service] Carpeta del mes '${month}' ya existe (ID: ${monthFolderId}).`);
  }

  // 4. Get or create '{APELLIDO_NOMBRE_ID}' folder under '{MES}'
  let clientFolderId = await findFolderInParent(monthFolderId, apellidoNombreId, accessToken);
  if (!clientFolderId) {
    console.log(`[WorkDrive Service] Carpeta del cliente '${apellidoNombreId}' no encontrada. Creándola...`);
    clientFolderId = await createFolderInParent(monthFolderId, apellidoNombreId, accessToken);
  } else {
    console.log(`[WorkDrive Service] Carpeta del cliente '${apellidoNombreId}' ya existe (ID: ${clientFolderId}).`);
  }

  // 5. Get or create each document type subfolder under '{APELLIDO_NOMBRE_ID}'
  const subfolders: Record<string, string> = {};
  for (const docType of documentTypes) {
    const trimmedDocType = docType.trim();
    if (!trimmedDocType) continue;

    let subfolderId = await findFolderInParent(clientFolderId, trimmedDocType, accessToken);
    if (!subfolderId) {
      console.log(`[WorkDrive Service] Subcarpeta de documento '${trimmedDocType}' no encontrada. Creándola...`);
      subfolderId = await createFolderInParent(clientFolderId, trimmedDocType, accessToken);
    } else {
      console.log(`[WorkDrive Service] Subcarpeta de documento '${trimmedDocType}' ya existe (ID: ${subfolderId}).`);
    }
    subfolders[trimmedDocType] = subfolderId;
  }

  console.log("[WorkDrive Service] Estructura de carpetas sincronizada exitosamente.");

  return {
    rootFolderId,
    ddFolderId,
    yearFolderId,
    monthFolderId,
    clientFolderId,
    subfolders,
  };
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
  const uploadBaseUrl = process.env.ZOHO_UPLOAD_BASE_URL || "https://upload.zoho.com";
  const url = `${uploadBaseUrl}/workdrive-api/v1/stream/upload`;
  const uploadId = crypto.randomUUID();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Zoho-oauthtoken ${accessToken}`,
      "x-filename": encodeURIComponent(fileName),
      "x-parent_id": parentId,
      "upload-id": uploadId,
      "x-streammode": "1",
      "Content-Type": "application/octet-stream",
    },
    body: fileBuffer as any,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Error en Zoho Stream Upload para "${fileName}": ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const result = await response.json();
  if (!result.data || !result.data.id) {
    throw new Error(
      `Estructura de respuesta inesperada en Zoho Stream Upload: ${JSON.stringify(result)}`
    );
  }

  return result.data.id;
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
