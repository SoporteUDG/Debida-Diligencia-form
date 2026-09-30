import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { zoho } from "../zohoService";
import { 
  getOrCreateFolderStructure, 
  uploadFileToWorkDrive, 
  createShareLink,
  findFolderInParent,
  createFolderInParent,
  deleteFileFromWorkDrive,
  extractFolderIdFromLink
} from "../workdriveService";
import { clearCache } from "../zohoAuthService";

describe("Zoho CRM & WorkDrive Integration Mocks", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    clearCache();
    // Configure valid-looking mock tokens so it avoids placeholder mode
    process.env.ZOHO_CLIENT_ID = "valid_client_id_999";
    process.env.ZOHO_CLIENT_SECRET = "valid_client_secret_999";
    process.env.ZOHO_REFRESH_TOKEN = "valid_refresh_token_999";
    process.env.ZOHO_OAUTH_BASE_URL = "https://accounts.zoho.com";
    process.env.ZOHO_CRM_BASE_URL = "https://www.zohoapis.com/crm/v2";
    process.env.ZOHO_WORKDRIVE_BASE_URL = "https://www.zohoapis.com/workdrive/api/v1";
    process.env.ZOHO_WORKDRIVE_ROOT_FOLDER_ID = "root_folder_12345";
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  describe("Zoho CRM API Integrations", () => {
    const tokenResponse = {
      ok: true,
      json: async () => ({ access_token: "token_abc", expires_in: 3600 }),
    } as any;

    it("getContact - should map and return the record from Debida_Diligencia when present", async () => {
      const spyFetch = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("/oauth/v2/token")) return tokenResponse;
        if (urlStr.includes("/Debida_Diligencia/crm-debida-id-1")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [{
                Name: "María González",
                Tipo_de_Persona: "Natural",
                Proyecto: "Ocean Reef Phase 2",
                Email: "maria.gonzalez@example.com",
                Celular: "50769998888",
                RUC_NIT: "PE-123456",
              }],
            }),
          } as any;
        }
        return { ok: false, status: 404 } as any;
      });

      const result = await zoho.service.getContact("crm-debida-id-1");

      expect(result.type).toBe("NATURAL");
      expect(result.nombreProyecto).toBe("Ocean Reef Phase 2");
      expect(result.email).toBe("maria.gonzalez@example.com");
      expect(result.idNumber).toBe("PE-123456");
      expect(result.module).toBe("Debida_Diligencia");
      expect(spyFetch).toHaveBeenCalled();
    });

    it("getContact - should not fall back to Accounts when the record is not in Debida_Diligencia", async () => {
      const spyFetch = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("/oauth/v2/token")) return tokenResponse;
        if (urlStr.includes("/Accounts/crm-account-id-2")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: [{ Account_Name: "Mock Corp S.A." }] }),
          } as any;
        }
        return { ok: false, status: 404, text: async () => "Not Found" } as any;
      });

      await expect(zoho.service.getContact("crm-account-id-2")).rejects.toThrow("crm-account-id-2");
      expect(spyFetch.mock.calls.some(([u]) => String(u).includes("/Accounts/"))).toBe(false);
    });

    it("getContact - should throw when the record is in neither Debida_Diligencia nor Accounts", async () => {
      const spyFetch = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("/oauth/v2/token")) return tokenResponse;
        return { ok: false, status: 404, text: async () => "Not Found" } as any;
      });

      await expect(zoho.service.getContact("unknown-id")).rejects.toThrow(
        "No se pudo encontrar ningún Expediente de Debida Diligencia o Socio de Negocio con el ID de CRM"
      );
      const urls = spyFetch.mock.calls.map(([u]) => String(u));
      expect(urls.some((u) => u.includes("/Contacts/") || u.includes("/Leads/"))).toBe(false);
    });

    it("updateContact - should update the Debida_Diligencia record with the mapped payload", async () => {
      const spyFetch = vi.spyOn(global, "fetch").mockImplementation(async (url, init) => {
        const urlStr = String(url);
        if (urlStr.includes("/oauth/v2/token")) return tokenResponse;
        if (urlStr.includes("/Debida_Diligencia/crm-debida-id-1") && (init as any)?.method === "GET") {
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: [{ id: "crm-debida-id-1", Socio_de_Negocios: { id: "acc-1", name: "Socio" } }] }),
          } as any;
        }
        if (urlStr.includes("/Debida_Diligencia/crm-debida-id-1")) {
          return {
            ok: true,
            json: async () => ({
              data: [{ status: "success", code: "SUCCESS", message: "record updated" }],
            }),
          } as any;
        }
        return { ok: false, status: 404 } as any;
      });

      const result = await zoho.service.updateContact("crm-debida-id-1", "JURIDICA", {
        razonSocial: "Mock Corp S.A.",
      });

      expect(result.success).toBe(true);
      expect(result.crmId).toBe("crm-debida-id-1");
      const put = spyFetch.mock.calls.find(
        ([u, init]) => String(u).includes("/Debida_Diligencia/crm-debida-id-1") && (init as any)?.method === "PUT"
      )!;
      expect(put).toBeDefined();
      const body = JSON.parse((put[1] as any).body).data[0];
      expect(body.Raz_n_social).toBe("Mock Corp S.A.");
      expect(body).not.toHaveProperty("Name");
    });

    /** Expediente dd-socio con proyecto "Proyecto Viejo" y Socio acc-1 (`socio` = registro de Accounts). */
    const mockNameFetch = (socio: Record<string, unknown>) =>
      vi.spyOn(global, "fetch").mockImplementation(async (url, init) => {
        const urlStr = String(url);
        if (urlStr.includes("/oauth/v2/token")) return tokenResponse;
        if (urlStr.includes("/Debida_Diligencia/dd-socio") && (init as any)?.method === "GET") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [{ id: "dd-socio", Proyecto: "Proyecto Viejo", Unidad: null, Socio_de_Negocios: { id: "acc-1", name: "Socio" } }],
            }),
          } as any;
        }
        if (urlStr.includes("/Accounts/acc-1")) {
          return { ok: true, status: 200, json: async () => ({ data: [{ id: "acc-1", ...socio }] }) } as any;
        }
        if (urlStr.includes("/Debida_Diligencia/dd-socio")) {
          return {
            ok: true,
            json: async () => ({ data: [{ status: "success", code: "SUCCESS", message: "record updated" }] }),
          } as any;
        }
        return { ok: false, status: 404 } as any;
      });

    const sentPayload = (spyFetch: ReturnType<typeof mockNameFetch>) => {
      const put = spyFetch.mock.calls.find(
        ([u, init]) => String(u).includes("/Debida_Diligencia/dd-socio") && (init as any)?.method === "PUT"
      )!;
      return JSON.parse((put[1] as any).body).data[0];
    };

    it("updateContact - no renombra el expediente aunque el Socio de Negocio tenga proyecto", async () => {
      const spyFetch = mockNameFetch({ Account_Name: "Inversiones ABC", Unidad: "T1-502", Proyecto: "Altos del Parque" });

      await zoho.service.updateContact("dd-socio", "NATURAL", { firstName: "Ana", lastName: "Ruiz", nombreProyecto: "Otro" });

      expect(sentPayload(spyFetch)).not.toHaveProperty("Name");
    });

    it("updateContact - sin proyecto en el Socio de Negocio no cambia el Name", async () => {
      const spyFetch = mockNameFetch({ Account_Name: "Inversiones ABC", Unidad: "T1-502" });

      await zoho.service.updateContact("dd-socio", "NATURAL", { firstName: "Ana", lastName: "Ruiz", nombreProyecto: "Otro" });

      expect(sentPayload(spyFetch)).not.toHaveProperty("Name");
    });

    it("updateContact - envía Carpeta_formulario con el enlace a la carpeta del expediente", async () => {
      const socioFolderId = "socio0folder0id0abcdefghij12345";
      const spyFetch = vi.spyOn(global, "fetch").mockImplementation(async (url, init) => {
        const urlStr = String(url);
        if (urlStr.includes("/oauth/v2/token")) return tokenResponse;
        if (urlStr.includes("/Debida_Diligencia/dd-carpeta") && (init as any)?.method === "GET") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [{ id: "dd-carpeta", Name: "Ana Ruiz", Socio_de_Negocios: { id: "acc-9", name: "Socio" } }],
            }),
          } as any;
        }
        if (urlStr.includes("/Accounts/acc-9")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [{ id: "acc-9", Link_documentos: `https://workdrive.zoho.com/folder/${socioFolderId}` }],
            }),
          } as any;
        }
        if (urlStr.includes(`/files/${socioFolderId}/files`)) {
          return { ok: true, json: async () => ({ data: [{ id: "dd_id", attributes: { name: "DD" } }] }) } as any;
        }
        if (urlStr.includes("/files/dd_id/files")) {
          return {
            ok: true,
            json: async () => ({ data: [{ id: "client_id", attributes: { name: "NATURAL-Ana Ruiz" } }] }),
          } as any;
        }
        if (urlStr.endsWith("/files/client_id")) {
          return {
            ok: true,
            json: async () => ({ data: { id: "client_id", attributes: { permalink: "https://workdrive.zoho.com/folder/client_id" } } }),
          } as any;
        }
        if (urlStr.includes("/Debida_Diligencia/dd-carpeta")) {
          return {
            ok: true,
            json: async () => ({ data: [{ status: "success", code: "SUCCESS", message: "record updated" }] }),
          } as any;
        }
        return { ok: false, status: 404, text: async () => "" } as any;
      });

      await zoho.service.updateContact("dd-carpeta", "NATURAL", { firstName: "Ana", lastName: "Ruiz" });

      const put = spyFetch.mock.calls.find(
        ([u, init]) => String(u).includes("/Debida_Diligencia/dd-carpeta") && (init as any)?.method === "PUT"
      )!;
      expect(JSON.parse((put[1] as any).body).data[0].Carpeta_formulario).toBe(
        "https://workdrive.zoho.com/folder/client_id"
      );
    });

    it("updateContact - should throw when the record does not exist in Debida_Diligencia", async () => {
      const spyFetch = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("/oauth/v2/token")) return tokenResponse;
        if (urlStr.includes("/Debida_Diligencia/crm-missing-id")) {
          return {
            ok: false,
            status: 400,
            text: async () => JSON.stringify({ code: "INVALID_DATA", message: "the id given seems to be invalid" }),
          } as any;
        }
        return { ok: false, status: 404 } as any;
      });

      await expect(zoho.service.updateContact("crm-missing-id", "NATURAL", {})).rejects.toThrow(
        "No se encontró el registro crm-missing-id en el módulo Debida_Diligencia"
      );
      const urls = spyFetch.mock.calls.map(([u]) => String(u));
      expect(urls.some((u) => u.includes("/Contacts/") || u.includes("/Leads/"))).toBe(false);
    });

    it("updateContact - should throw without updating when the record has no Socio de Negocio", async () => {
      const spyFetch = vi.spyOn(global, "fetch").mockImplementation(async (url, init) => {
        const urlStr = String(url);
        if (urlStr.includes("/oauth/v2/token")) return tokenResponse;
        if (urlStr.includes("/Debida_Diligencia/dd-sin-socio") && (init as any)?.method === "GET") {
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: [{ id: "dd-sin-socio", Socio_de_Negocios: null }] }),
          } as any;
        }
        return { ok: false, status: 404 } as any;
      });

      await expect(zoho.service.updateContact("dd-sin-socio", "NATURAL", {})).rejects.toThrow(
        "no tiene Socio de Negocio"
      );
      const put = spyFetch.mock.calls.find(([, init]) => (init as any)?.method === "PUT");
      expect(put).toBeUndefined();
    });
  });

  describe("Zoho WorkDrive API Integrations", () => {
    it("findFolderInParent - should handle paginated search of directory names", async () => {
      let fetchCount = 0;
      vi.spyOn(global, "fetch").mockImplementation(async () => {
        fetchCount++;
        if (fetchCount === 1) {
          // Page 1
          return {
            ok: true,
            json: async () => ({
              data: [
                { id: "other_id", attributes: { name: "OtherFolder" } },
              ],
              links: {
                next: "https://www.zohoapis.com/workdrive/api/v1/files/parent_id/files?page=2",
              },
            }),
          } as any;
        } else {
          // Page 2
          return {
            ok: true,
            json: async () => ({
              data: [
                { id: "target_folder_id", attributes: { name: "TargetFolder" } },
              ],
              links: {},
            }),
          } as any;
        }
      });

      const folderId = await findFolderInParent("parent_id", "TargetFolder", "token_123");
      expect(folderId).toBe("target_folder_id");
      expect(fetchCount).toBe(2);
    });

    it("extractFolderIdFromLink - should read the folder ID from WorkDrive links", () => {
      const id = "socio0folder0id0abcdefghij12345";
      expect(extractFolderIdFromLink(`https://workdrive.zoho.com/folder/${id}`)).toBe(id);
      expect(
        extractFolderIdFromLink(`https://workdrive.zoho.com/home/team123/teams/team123/ws/ws456/folders/${id}`)
      ).toBe(id);
      expect(extractFolderIdFromLink(id)).toBe(id);
      expect(extractFolderIdFromLink("https://workdrive.zohoexternal.com/external/abcdefghijklmnopqrstuvwxyz")).toBeNull();
      expect(extractFolderIdFromLink("")).toBeNull();
    });

    it("getOrCreateFolderStructure - should resolve the Socio folder and idempotently return hierarchy", async () => {
      const socioFolderId = "socio0folder0id0abcdefghij12345";
      // Mock successive resolutions (all folders already exist)
      vi.spyOn(global, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("/oauth/v2/token")) {
          return { ok: true, json: async () => ({ access_token: "token_abc", expires_in: 3600 }) } as any;
        }
        if (urlStr.includes("/Debida_Diligencia/dd_123")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [{ id: "dd_123", Name: "Carlos Mendoza", Socio_de_Negocios: { id: "acc_456", name: "Socio" } }],
            }),
          } as any;
        }
        if (urlStr.includes("/Accounts/acc_456")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [{ id: "acc_456", Link_documentos: `https://workdrive.zoho.com/folder/${socioFolderId}` }],
            }),
          } as any;
        }
        if (urlStr.includes(`/files/${socioFolderId}/files`)) {
          return { ok: true, json: async () => ({ data: [{ id: "dd_id", attributes: { name: "DD" } }] }) } as any;
        }
        if (urlStr.includes("/files/dd_id/files")) {
          return {
            ok: true,
            json: async () => ({ data: [{ id: "client_id", attributes: { name: "NATURAL-Carlos Mendoza" } }] }),
          } as any;
        }
        if (urlStr.includes("/files/client_id/files")) {
          return {
            ok: true,
            json: async () => ({
              data: [{ id: "sub_cedula_id", attributes: { name: "Copia del Documento de Identidad" } }],
            }),
          } as any;
        }
        return { ok: false, status: 404, text: async () => "" } as any;
      });

      const structure = await getOrCreateFolderStructure("dd_123", "NATURAL", ["idFile"], "token_123");

      expect(structure.socioFolderId).toBe(socioFolderId);
      expect(structure.ddFolderId).toBe("dd_id");
      expect(structure.clientFolderId).toBe("client_id");
      expect(structure.subfolders["idFile"]).toBe("sub_cedula_id");
    });

    it("getOrCreateFolderStructure - should fall back to ZOHO_WORKDRIVE_ROOT_FOLDER_ID when the DD has no Socio", async () => {
      vi.spyOn(global, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("/oauth/v2/token")) {
          return { ok: true, json: async () => ({ access_token: "token_abc", expires_in: 3600 }) } as any;
        }
        if (urlStr.includes("/Debida_Diligencia/dd_sin_socio")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: [{ id: "dd_sin_socio", Name: "Ana Ruiz", Socio_de_Negocios: null }] }),
          } as any;
        }
        if (urlStr.includes("/files/root_folder_12345/files")) {
          return { ok: true, json: async () => ({ data: [{ id: "dd_id", attributes: { name: "DD" } }] }) } as any;
        }
        if (urlStr.includes("/files/dd_id/files")) {
          return {
            ok: true,
            json: async () => ({ data: [{ id: "client_id", attributes: { name: "JURIDICA-Ana Ruiz" } }] }),
          } as any;
        }
        return { ok: false, status: 404, text: async () => "" } as any;
      });

      const structure = await getOrCreateFolderStructure("dd_sin_socio", "JURIDICA", [], "token_123");

      expect(structure.socioFolderId).toBe("root_folder_12345");
      expect(structure.ddFolderId).toBe("dd_id");
      expect(structure.clientFolderId).toBe("client_id");
    });

    it("uploadFileToWorkDrive - should upload a file buffer via the multipart upload API", async () => {
      const spyFetch = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              type: "files",
              attributes: {
                resource_id: "uploaded_file_id_555",
                FileName: "Test_Document.pdf",
                parent_id: "parent_folder_id",
              },
            },
          ],
        }),
      } as any);

      const fileId = await uploadFileToWorkDrive(
        "parent_folder_id",
        "Test_Document.pdf",
        Buffer.from("dummy-pdf-content"),
        "token_123"
      );

      expect(fileId).toBe("uploaded_file_id_555");
      expect(spyFetch).toHaveBeenCalled();
      const [url, requestInit] = spyFetch.mock.calls[0];
      // Mismo dominio que el resto de la API: upload.zoho.com responde INVALID_OAUTHSCOPE
      expect(String(url)).toContain("https://www.zohoapis.com/workdrive/api/v1/upload");
      expect(String(url)).toContain("parent_id=parent_folder_id");
      expect(String(url)).toContain("filename=Test_Document.pdf");
      expect(requestInit?.method).toBe("POST");
      expect(requestInit?.body).toBeInstanceOf(FormData);
      // El Content-Type lo fija fetch con el boundary del multipart
      expect((requestInit?.headers as any)["Content-Type"]).toBeUndefined();
    });

    it("createShareLink - should call Zoho API and return public sharing URL link", async () => {
      const spyFetch = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            type: "links",
            attributes: {
              link: "https://workdrive.zohoexternal.com/file/shared_link_9999",
            },
          },
        }),
      } as any);

      const linkUrl = await createShareLink("uploaded_file_id_555", "token_123");

      expect(linkUrl).toBe("https://workdrive.zohoexternal.com/file/shared_link_9999");
      expect(spyFetch).toHaveBeenCalled();
      const [url, requestInit] = spyFetch.mock.calls[0];
      expect(String(url)).toContain("https://www.zohoapis.com/workdrive/api/v1/links");
      expect(requestInit?.method).toBe("POST");
      expect(requestInit?.body).toContain("resource_id");
      expect(requestInit?.body).toContain("allow_download");
    });

    it("deleteFileFromWorkDrive - should move the resource to trash via PATCH status 51", async () => {
      const spyFetch = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: "file_id_to_delete", type: "files" } }),
      } as any);

      await expect(deleteFileFromWorkDrive("file_id_to_delete", "token_123")).resolves.not.toThrow();
      expect(spyFetch).toHaveBeenCalled();
      const [url, requestInit] = spyFetch.mock.calls[0];
      expect(String(url)).toContain("https://www.zohoapis.com/workdrive/api/v1/files/file_id_to_delete");
      // DELETE responde 401 R008: WorkDrive borra moviendo a la papelera
      expect(requestInit?.method).toBe("PATCH");
      expect(JSON.parse(String(requestInit?.body))).toEqual({
        data: { attributes: { status: "51" }, type: "files" },
      });
    });

    it("deleteFileFromWorkDrive - should throw when Zoho rejects the request", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "",
        text: async () => JSON.stringify({ errors: [{ id: "R008", title: "Unauthorized access" }] }),
      } as any);

      await expect(deleteFileFromWorkDrive("file_id_to_delete", "token_123")).rejects.toThrow(
        /Error al eliminar recurso file_id_to_delete/
      );
    });

    it("createNote - should first resolve module type and then send POST to /Notes API", async () => {
      let callCount = 0;
      const spyFetch = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
        callCount++;
        const urlStr = String(url);
        if (urlStr.includes("oauth/v2/token")) {
          return {
            ok: true,
            json: async () => ({
              access_token: "token_abc",
              expires_in: 3600,
            }),
          } as any;
        } else if (urlStr.includes("/Debida_Diligencia/crm-contact-id")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [
                {
                  id: "crm-contact-id",
                  Name: "Juan Perez",
                  Email: "test@example.com",
                },
              ],
            }),
          } as any;
        } else if (urlStr.includes("/Notes")) {
          return {
            ok: true,
            json: async () => ({
              data: [
                {
                  status: "success",
                  code: "SUCCESS",
                  details: {
                    id: "note-id-123",
                  },
                },
              ],
            }),
          } as any;
        }
        return {
          ok: false,
          status: 404,
          text: async () => "Not Found",
          json: async () => ({ error: "Not Found" }),
        } as any;
      });

      // Temporarily bypass isPlaceholder by setting token envs to non-placeholders
      process.env.ZOHO_CLIENT_ID = "real_id";
      process.env.ZOHO_CLIENT_SECRET = "real_secret";
      process.env.ZOHO_REFRESH_TOKEN = "real_token";

      const noteRes = await zoho.service.createNote(
        "crm-contact-id",
        "Formulario Completado",
        "El cliente ha completado el formulario."
      );

      expect(noteRes.success).toBe(true);
      expect(noteRes.noteId).toBe("note-id-123");
      // token + GET Debida_Diligencia (resolución del módulo) + POST /Notes
      expect(spyFetch).toHaveBeenCalledTimes(3);

      // Verify the POST arguments
      const noteCall = spyFetch.mock.calls.find(call => String(call[0]).includes("/Notes"));
      expect(noteCall).toBeDefined();
      const [noteUrl, noteInit] = noteCall!;
      expect(noteInit?.method).toBe("POST");
      const body = JSON.parse(noteInit?.body as string);
      expect(body.data[0].Note_Title).toBe("Formulario Completado");
      expect(body.data[0].$se_module).toBe("Debida_Diligencia");
    });

    it("getContact - should fetch and map record successfully in Debida_Diligencia module", async () => {
      const spyFetch = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("/oauth/v2/token")) {
          return {
            ok: true,
            json: async () => ({ access_token: "token_abc", expires_in: 3600 }),
          } as any;
        }
        if (urlStr.includes("/Debida_Diligencia/crm-debida-id")) {
          return {
            ok: true,
            json: async () => ({
              data: [{
                Name: "Expediente Test",
                Tipo_de_Persona: "Jurídica",
                RUC_NIT: "8-999-9999",
                Proyecto: { name: "Ocean Reef Phase 2" },
                Email: "juridica@test.com",
                Tel_fono: "50766667777",
              }],
            }),
          } as any;
        }
        return { ok: false, status: 404, text: async () => "Not Found" } as any;
      });

      const result = await zoho.service.getContact("crm-debida-id");

      expect(result.type).toBe("JURIDICA");
      expect(result.nombreProyecto).toBe("Ocean Reef Phase 2");
      expect(result.razonSocial).toBe("");
      // Name ("Socio-unidad-proyecto") no se usa para precargar nombres
      expect(result.contactoNombre).toBe("");
      expect(result.firstName).toBe("Cliente");
      expect(result.module).toBe("Debida_Diligencia");
      expect(spyFetch).toHaveBeenCalled();
    });

    it("updateContact - should update record successfully in Debida_Diligencia module", async () => {
      const spyFetch = vi.spyOn(global, "fetch").mockImplementation(async (url, init) => {
        const urlStr = String(url);
        if (urlStr.includes("/oauth/v2/token")) {
          return {
            ok: true,
            json: async () => ({ access_token: "token_abc", expires_in: 3600 }),
          } as any;
        }
        if (urlStr.includes("/Debida_Diligencia/crm-debida-id") && (init as any)?.method === "GET") {
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: [{ id: "crm-debida-id", Socio_de_Negocios: { id: "acc-1", name: "Socio" } }] }),
          } as any;
        }
        if (urlStr.includes("/Debida_Diligencia/crm-debida-id")) {
          return {
            ok: true,
            json: async () => ({
              data: [{
                status: "success",
                code: "SUCCESS",
                message: "Record updated successfully",
              }],
            }),
          } as any;
        }
        return { ok: false, status: 404, text: async () => "Not Found" } as any;
      });

      const result = await zoho.service.updateContact(
        "crm-debida-id",
        "JURIDICA",
        { razonSocial: "Inversiones S.A.", numeroDocumento: "8-999-9999" }
      );

      expect(result.success).toBe(true);
      expect(result.crmId).toBe("crm-debida-id");
      expect(spyFetch).toHaveBeenCalled();
    });

    it("uploadAttachment - should upload file buffer as attachment to CRM record", async () => {
      const spyFetch = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("/oauth/v2/token")) {
          return {
            ok: true,
            json: async () => ({ access_token: "token_abc", expires_in: 3600 }),
          } as any;
        }
        if (urlStr.includes("/Debida_Diligencia/crm-debida-id/Attachments")) {
          return {
            ok: true,
            json: async () => ({
              data: [{
                status: "success",
                code: "SUCCESS",
                details: { id: "att-12345", File_Name: "Expediente.pdf" },
                message: "attachment added successfully",
              }],
            }),
          } as any;
        }
        return { ok: false, status: 404, text: async () => "Not Found" } as any;
      });

      const buffer = Buffer.from("mock pdf content");
      const result = await zoho.service.uploadAttachment("crm-debida-id", "Expediente.pdf", buffer, "Debida_Diligencia");

      expect(result.success).toBe(true);
      expect(result.attachmentId).toBe("att-12345");
      expect(spyFetch).toHaveBeenCalled();
    });

    it("searchContacts - should search only the Debida_Diligencia module", async () => {
      const spyFetch = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("/oauth/v2/token")) {
          return {
            ok: true,
            json: async () => ({ access_token: "token_abc", expires_in: 3600 }),
          } as any;
        }
        if (urlStr.includes("/Debida_Diligencia/search?word=Test")) {
          return {
            ok: true,
            json: async () => ({
              data: [{
                id: "debida-search-1",
                Name: "Expediente Test",
                Tipo_de_Persona: "Natural",
                Email: "test@debida.com",
                Tel_fono: "50761110000",
                Proyecto: "Altos del Parque",
              }],
            }),
          } as any;
        }
        if (urlStr.includes("/Accounts/search?word=Test")) {
          return {
            ok: true,
            json: async () => ({
              data: [{
                id: "account-search-1",
                Account_Name: "Inversiones Test S.A.",
                Tipo_de_Persona: "Jurídica",
                Correo_electr_nico: "info@testcorp.com",
                Phone: "5073009999",
                Proyecto: "Ocean Reef",
              }],
            }),
          } as any;
        }
        return { ok: false, status: 404, text: async () => "Not Found" } as any;
      });

      const results = await zoho.service.searchContacts("Test");

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: "debida-search-1",
        name: "Expediente Test",
        email: "test@debida.com",
        phone: "50761110000",
        module: "Debida_Diligencia",
        type: "NATURAL",
        projectInterest: "Altos del Parque",
      });
      expect(spyFetch.mock.calls.some(([u]) => String(u).includes("/Accounts/"))).toBe(false);
    });

    it("createDebidaDiligenciaRecord - should throw without Socio de Negocio", async () => {
      const spyFetch = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
        if (String(url).includes("/oauth/v2/token")) {
          return { ok: true, json: async () => ({ access_token: "token_abc", expires_in: 3600 }) } as any;
        }
        return { ok: false, status: 404, text: async () => "Not Found" } as any;
      });

      await expect(
        zoho.service.createDebidaDiligenciaRecord({ clientType: "NATURAL", name: "Juan Perez" })
      ).rejects.toThrow("sin Socio de Negocio");
      expect(spyFetch.mock.calls.some(([u]) => String(u).endsWith("/Debida_Diligencia"))).toBe(false);
    });

    it("createDebidaDiligenciaRecord - should send POST to /Debida_Diligencia and return created record ID", async () => {
      const spyFetch = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("/oauth/v2/token")) {
          return {
            ok: true,
            json: async () => ({ access_token: "token_abc", expires_in: 3600 }),
          } as any;
        }
        if (urlStr.includes("/Debida_Diligencia")) {
          return {
            ok: true,
            json: async () => ({
              data: [{
                status: "success",
                code: "SUCCESS",
                details: { id: "new-debida-record-777" },
                message: "record added successfully",
              }],
            }),
          } as any;
        }
        return { ok: false, status: 404, text: async () => "Not Found" } as any;
      });

      const expires = new Date("2026-10-01T12:00:00Z");
      const result = await zoho.service.createDebidaDiligenciaRecord({
        accountCrmId: "acc-1",
        clientType: "NATURAL",
        name: "Juan Perez",
        projectName: "Costa del Este",
        email: "juan@example.com",
        phone: "50766665555",
        idNumber: "8-888-8888",
        estadoCivil: "Soltero/a",
        formLink: "https://portal.udg.com.pa/persona-natural?token=abc.xyz",
        expiresAt: expires,
        advisorName: "Adviser John",
      });

      expect(result.success).toBe(true);
      expect(result.debidaId).toBe("new-debida-record-777");

      const debidaPostCall = spyFetch.mock.calls.find(call => String(call[0]).endsWith("/Debida_Diligencia"));
      expect(debidaPostCall).toBeDefined();
      const [_, init] = debidaPostCall!;
      expect(init?.method).toBe("POST");
      const body = JSON.parse(init?.body as string);
      // Sin Socio de Negocio: Name con los datos del formulario ("nombre-proyecto")
      expect(body.data[0].Name).toBe("Juan Perez-Costa del Este");
      expect(body.data[0].Tipo_de_Persona).toBe("Natural");
      expect(body.data[0].Estado_del_enlace).toBe("Activo");
      expect(body.data[0].Estado).toBe("En Proceso");
      expect(body.data[0].Email).toBe("juan@example.com");
      expect(body.data[0].RUC_NIT).toBe("8-888-8888");
      expect(body.data[0].Estado_Civil).toBe("Soltero/a");
      expect(body.data[0].Proyecto).toBe("Costa del Este");
      expect(body.data[0].Asesor).toBe("Adviser John");
      expect(body.data[0].Enlace_de_Formulario).toBe("https://portal.udg.com.pa/persona-natural?token=abc.xyz");
    });
  });
});
