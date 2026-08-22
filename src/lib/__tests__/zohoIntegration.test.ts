import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { zoho } from "../zohoService";
import { 
  getOrCreateFolderStructure, 
  uploadFileToWorkDrive, 
  createShareLink,
  findFolderInParent,
  createFolderInParent,
  deleteFileFromWorkDrive
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
    it("getContact - should map and return Contact from Contacts module when present", async () => {
      const spyFetch = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        // OAuth token endpoint response
        if (urlStr.includes("/oauth/v2/token")) {
          return {
            ok: true,
            json: async () => ({ access_token: "token_abc", expires_in: 3600 }),
          } as any;
        }
        // Contacts endpoint response
        if (urlStr.includes("/Contacts/crm-contact-id-1")) {
          return {
            ok: true,
            json: async () => ({
              data: [{
                Client_Type: "Natural Person",
                Project_Interest: "Ocean Reef Phase 2",
                First_Name: "María",
                Last_Name: "González",
                Email: "maria.gonzalez@example.com",
                Mobile: "50769998888",
                Identificacion: "PE-123456",
              }],
            }),
          } as any;
        }
        return { ok: false, status: 404 } as any;
      });

      const result = await zoho.service.getContact("crm-contact-id-1");

      expect(result).toEqual({
        type: "NATURAL",
        nombreProyecto: "Ocean Reef Phase 2",
        firstName: "María",
        lastName: "González",
        email: "maria.gonzalez@example.com",
        celular: "50769998888",
        idNumber: "PE-123456",
        module: "Contacts",
      });

      expect(spyFetch).toHaveBeenCalled();
    });

    it("getContact - should fallback to Leads module when not found in Contacts", async () => {
      const spyFetch = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("/oauth/v2/token")) {
          return {
            ok: true,
            json: async () => ({ access_token: "token_abc", expires_in: 3600 }),
          } as any;
        }
        // Contacts fails
        if (urlStr.includes("/Contacts/crm-lead-id-2")) {
          return { ok: false, status: 404, text: async () => "Not Found" } as any;
        }
        // Leads succeeds
        if (urlStr.includes("/Leads/crm-lead-id-2")) {
          return {
            ok: true,
            json: async () => ({
              data: [{
                Tipo_Cliente: "Corporativo",
                Proyecto: "Alta Plaza",
                Company: "Mock Corp S.A.",
                RUC: "8-888-8888 DV 99",
                First_Name: "Jorge",
                Last_Name: "Ramírez",
                Email: "jorge.ramirez@example.com",
                Phone: "5073004000",
                Representante_Legal: "Jorge Ramírez",
                Cedula_Representante: "8-111-1111",
              }],
            }),
          } as any;
        }
        return { ok: false, status: 404 } as any;
      });

      const result = await zoho.service.getContact("crm-lead-id-2");

      expect(result.type).toBe("JURIDICA");
      expect(result.razonSocial).toBe("Mock Corp S.A.");
      expect(result.numeroDocumento).toBe("8-888-8888 DV 99");
      expect(result.module).toBe("Leads");
      expect(spyFetch).toHaveBeenCalled();
    });

    it("getContact - should throw final error when both Contacts and Leads modules fail", async () => {
      vi.spyOn(global, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("/oauth/v2/token")) {
          return {
            ok: true,
            json: async () => ({ access_token: "token_abc", expires_in: 3600 }),
          } as any;
        }
        return { ok: false, status: 404, text: async () => "Not Found" } as any;
      });

      await expect(zoho.service.getContact("unknown-id")).rejects.toThrow(
        "No se pudo encontrar ningún Expediente, Contacto o Lead con el ID de CRM"
      );
    });

    it("updateContact - should update record successfully in Contacts module", async () => {
      const spyFetch = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("/oauth/v2/token")) {
          return {
            ok: true,
            json: async () => ({ access_token: "token_abc", expires_in: 3600 }),
          } as any;
        }
        if (urlStr.includes("/Contacts/crm-contact-id-1")) {
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
        return { ok: false, status: 404 } as any;
      });

      const result = await zoho.service.updateContact("crm-contact-id-1", "NATURAL", {
        firstName: "María",
        lastName: "González",
      });

      expect(result.success).toBe(true);
      expect(result.crmId).toBe("crm-contact-id-1");
      expect(spyFetch).toHaveBeenCalled();
    });

    it("updateContact - should fallback and update in Leads module if Contacts PUT returns NOT_FOUND / INVALID_DATA", async () => {
      const spyFetch = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("/oauth/v2/token")) {
          return {
            ok: true,
            json: async () => ({ access_token: "token_abc", expires_in: 3600 }),
          } as any;
        }
        // Contacts PUT returns NOT_FOUND
        if (urlStr.includes("/Contacts/crm-lead-id-2")) {
          return {
            ok: true,
            json: async () => ({
              data: [{
                status: "error",
                code: "NOT_FOUND",
                message: "record not found",
              }],
            }),
          } as any;
        }
        // Leads PUT succeeds
        if (urlStr.includes("/Leads/crm-lead-id-2")) {
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
        return { ok: false, status: 404 } as any;
      });

      const result = await zoho.service.updateContact("crm-lead-id-2", "JURIDICA", {
        razonSocial: "Mock Corp S.A.",
      });

      expect(result.success).toBe(true);
      expect(result.crmId).toBe("crm-lead-id-2");
      expect(spyFetch).toHaveBeenCalled();
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

    it("getOrCreateFolderStructure - should idempotently return hierarchy", async () => {
      // Mock successive folder resolutions (all existing)
      vi.spyOn(global, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("/files/root_folder_12345/files")) {
          // Looking for 'DD' folder
          return {
            ok: true,
            json: async () => ({ data: [{ id: "dd_id", attributes: { name: "DD" } }] }),
          } as any;
        }
        if (urlStr.includes("/files/dd_id/files")) {
          // Looking for year folder
          return {
            ok: true,
            json: async () => ({ data: [{ id: "year_id", attributes: { name: "2026" } }] }),
          } as any;
        }
        if (urlStr.includes("/files/year_id/files")) {
          // Looking for month folder
          return {
            ok: true,
            json: async () => ({ data: [{ id: "month_id", attributes: { name: "08" } }] }),
          } as any;
        }
        if (urlStr.includes("/files/month_id/files")) {
          // Looking for client folder
          return {
            ok: true,
            json: async () => ({ data: [{ id: "client_id", attributes: { name: "Mendoza_Carlos_101" } }] }),
          } as any;
        }
        if (urlStr.includes("/files/client_id/files")) {
          // Looking for subfolder 'Cedula'
          return {
            ok: true,
            json: async () => ({ data: [{ id: "sub_cedula_id", attributes: { name: "Cedula" } }] }),
          } as any;
        }
        return { ok: false, status: 404 } as any;
      });

      const structure = await getOrCreateFolderStructure(
        "2026",
        "08",
        "Mendoza_Carlos_101",
        ["Cedula"],
        "token_123"
      );

      expect(structure.rootFolderId).toBe("root_folder_12345");
      expect(structure.ddFolderId).toBe("dd_id");
      expect(structure.yearFolderId).toBe("year_id");
      expect(structure.monthFolderId).toBe("month_id");
      expect(structure.clientFolderId).toBe("client_id");
      expect(structure.subfolders["Cedula"]).toBe("sub_cedula_id");
    });

    it("uploadFileToWorkDrive - should upload a file buffer via stream upload API", async () => {
      const spyFetch = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            id: "uploaded_file_id_555",
            type: "files",
          },
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
      expect(String(url)).toContain("upload.zoho.com/workdrive-api/v1/stream/upload");
      expect(requestInit?.method).toBe("POST");
      expect(requestInit?.headers).toBeDefined();
      expect((requestInit?.headers as any)["x-parent_id"]).toBe("parent_folder_id");
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

    it("deleteFileFromWorkDrive - should send DELETE request and successfully resolve on 204 No Content", async () => {
      const spyFetch = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 204,
      } as any);

      await expect(deleteFileFromWorkDrive("file_id_to_delete", "token_123")).resolves.not.toThrow();
      expect(spyFetch).toHaveBeenCalled();
      const [url, requestInit] = spyFetch.mock.calls[0];
      expect(String(url)).toContain("https://www.zohoapis.com/workdrive/api/v1/files/file_id_to_delete");
      expect(requestInit?.method).toBe("DELETE");
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
        } else if (urlStr.includes("/Contacts/crm-contact-id")) {
          return {
            ok: true,
            json: async () => ({
              data: [
                {
                  id: "crm-contact-id",
                  Email: "test@example.com",
                  First_Name: "Juan",
                  Last_Name: "Perez",
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
      expect(spyFetch).toHaveBeenCalledTimes(4);

      // Verify the POST arguments
      const noteCall = spyFetch.mock.calls.find(call => String(call[0]).includes("/Notes"));
      expect(noteCall).toBeDefined();
      const [noteUrl, noteInit] = noteCall!;
      expect(noteInit?.method).toBe("POST");
      const body = JSON.parse(noteInit?.body as string);
      expect(body.data[0].Note_Title).toBe("Formulario Completado");
      expect(body.data[0].$se_module).toBe("Contacts");
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
                Tipo_de_Persona: "Persona Jurídica",
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
      expect(result.contactoNombre).toBe("Expediente Test");
      expect(result.module).toBe("Debida_Diligencia");
      expect(spyFetch).toHaveBeenCalled();
    });

    it("updateContact - should update record successfully in Debida_Diligencia module", async () => {
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
  });
});
