import { executeWithRetry } from "./zohoAuthService";
import crypto from "crypto";

/**
 * Normalizes values returned by Zoho CRM (e.g. converting null/undefined or string "null" to "").
 */
function cleanValue(val: any): string {
  if (val === null || val === undefined || String(val).trim().toLowerCase() === "null") {
    return "";
  }
  if (typeof val === "object") {
    if (val.name) return String(val.name).trim();
    if (val.value) return String(val.value).trim();
  }
  return String(val).trim();
}

/**
 * Searches for a value in a list of potential keys in a Zoho CRM record.
 * Useful since custom CRM fields can vary across environments.
 */
function findValue(record: any, keys: string[]): string {
  for (const key of keys) {
    if (key in record) {
      return cleanValue(record[key]);
    }
  }
  return "";
}

/** Módulos de Zoho CRM con los que trabaja el portal. */
export type CrmModule = "Accounts" | "Debida_Diligencia";

export interface MappedCrmData {
  type: "NATURAL" | "JURIDICA";
  nombreProyecto: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  celular?: string;
  idNumber?: string;
  estadoCivil?: string;
  
  razonSocial?: string;
  numeroDocumento?: string;
  contactoNombre?: string;
  contactoApellido?: string;
  contactoEmail?: string;
  contactoTelefono?: string;
  contactoId?: string;
  
  // Representative legal fields
  rlNombre?: string;
  rlNoIdentificacion?: string;
  rlTelefono?: string;
  rlNacionalidad?: string;
  rlFechaNacimiento?: string;
  rlDireccion?: string;
  rlPaisResidencia?: string;
  rlProfesionOcupacion?: string;
  rlActividadEconomica?: string;
  
  module?: CrmModule;
}

/**
 * Maps a raw Zoho CRM Account (Socio de Negocio) record to portal structures.
 */
export function mapAccountRecord(record: any): MappedCrmData {
  const rawType = findValue(record, [
    "Tipo_de_Persona",
    "Tipo_Cliente",
    "Tipo_de_Cliente",
    "Client_Type",
    "ClientType",
  ]).toLowerCase();

  const isJuridica =
    rawType.includes("jur") ||
    rawType.includes("corp") ||
    rawType.includes("empresa") ||
    rawType.includes("sociedad") ||
    !!findValue(record, ["Razon_Social", "Razón_Social", "Company", "Empresa"]);

  const type = isJuridica ? "JURIDICA" : "NATURAL";
  const nombreProyecto = findValue(record, ["Proyecto", "Project_Interest", "Project", "Nombre_Proyecto"]) || "General UDG";
  const email = findValue(record, ["Correo_electr_nico", "Email", "Correo_Electrónico", "Correo", "Email_corporativo"]);
  const phone = findValue(record, ["Celular", "Phone", "Tel_fono", "Teléfono", "Mobile", "Mobile_Phone"]);
  const idNumber = findValue(record, [
    "RUC",
    "N_mero_de_Identificaci_n_Fiscal_",
    "RUC_NIT",
    "Identificacion",
    "Cedula",
    "C_dula",
    "No_Identificacion",
  ]);
  const estadoCivil = findValue(record, ["Estado_Civil"]);
  const accountName = findValue(record, ["Account_Name", "Name", "Razon_Social", "Razón_Social"]);

  if (type === "NATURAL") {
    let firstName = findValue(record, ["First_Name", "Nombre", "Nombres", "FirstName"]);
    let lastName = findValue(record, ["Last_Name", "Apellido", "Apellidos", "LastName"]);

    if (!firstName && accountName) {
      const parts = accountName.split(/\s+/);
      if (parts.length > 1) {
        firstName = parts.slice(0, Math.ceil(parts.length / 2)).join(" ");
        lastName = parts.slice(Math.ceil(parts.length / 2)).join(" ");
      } else {
        firstName = accountName;
        lastName = "";
      }
    }

    return {
      type: "NATURAL",
      nombreProyecto,
      firstName: firstName || "Cliente",
      lastName: lastName || "",
      email,
      celular: phone,
      idNumber,
      estadoCivil,
      module: "Accounts",
    };
  } else {
    return {
      type: "JURIDICA",
      nombreProyecto,
      razonSocial: accountName || "Empresa Registrada",
      numeroDocumento: idNumber,
      email,
      celular: phone,
      contactoNombre: accountName,
      contactoEmail: email,
      contactoTelefono: phone,
      contactoId: idNumber,
      estadoCivil,
      module: "Accounts",
    };
  }
}

/**
 * Merges CRM pre-loaded values into the existing draft data.
 * Priority rule: Existing non-empty draft values are preserved (never overwritten).
 * Unfilled draft fields (empty, null, or undefined) are populated with Zoho CRM values.
 */
export function mergeCrmAndDraft(crmData: Partial<MappedCrmData>, draftData: any): any {
  const merged = { ...(draftData || {}) };

  for (const [key, value] of Object.entries(crmData)) {
    // Skip type (as type is read from draft/token metadata)
    if (key === "type") continue;

    const hasValueInDraft = 
      key in merged && 
      merged[key] !== null && 
      merged[key] !== undefined && 
      String(merged[key]).trim() !== "";

    if (!hasValueInDraft) {
      merged[key] = value;
    }
  }

  return merged;
}

export const zoho = {
  service: {
    /**
     * Queries Zoho CRM for a Debida_Diligencia record (or an Account / Socio de Negocio) by ID
     * and returns mapped portal details.
     * Includes automated retries and a mock fallback mode for development environment.
     *
     * @param crmId Zoho CRM record unique ID
     */
    getContact: async (crmId: string): Promise<MappedCrmData> => {
      const clientId = process.env.ZOHO_CLIENT_ID;
      const clientSecret = process.env.ZOHO_CLIENT_SECRET;
      const refreshToken = process.env.ZOHO_REFRESH_TOKEN;

      const isPlaceholder =
        !clientId ||
        clientId === "placeholder_client_id" ||
        !clientSecret ||
        clientSecret === "placeholder_client_secret" ||
        !refreshToken ||
        refreshToken === "placeholder_refresh_token";

      if (isPlaceholder || crmId.startsWith("mock-") || crmId === "simulated-crm-contact-id") {
        console.log(`[Zoho Service] Modo placeholder. Generando datos simulados para ID: ${crmId}`);
        const isCrmIdJur = crmId.toLowerCase().includes("jur") || crmId.startsWith("mock-jur");
        const module = "Debida_Diligencia" as const;
        
        if (isCrmIdJur) {
          return {
            type: "JURIDICA",
            nombreProyecto: "Proyecto Edificio Mock",
            razonSocial: "Inversiones Tecnológicas S.A.",
            numeroDocumento: "1554627-1-657482 DV 80",
            contactoNombre: "Ana",
            contactoApellido: "Martínez",
            contactoEmail: "contacto@inversionesmock.com",
            contactoTelefono: "50766112233",
            rlNombre: "Carlos Gómez",
            rlNoIdentificacion: "8-888-8888",
            module,
          };
        } else {
          return {
            type: "NATURAL",
            nombreProyecto: "Proyecto Terrazas Mock",
            firstName: "Juan",
            lastName: "Pérez",
            email: "juan.perez.mock@gmail.com",
            celular: "50766554433",
            idNumber: "8-777-7777",
            module,
          };
        }
      }

      // Query Zoho CRM modules (Debida_Diligencia first, then Accounts)
      return executeWithRetry(async (accessToken) => {
        const crmBaseUrl = process.env.ZOHO_CRM_BASE_URL || "https://www.zohoapis.com/crm/v2";

        // 1. Try Debida_Diligencia Module
        try {
          console.log(`[Zoho Service] Buscando registro ${crmId} en módulo Debida_Diligencia...`);
          const response = await fetch(`${crmBaseUrl}/Debida_Diligencia/${crmId}`, {
            method: "GET",
            headers: {
              Authorization: `Zoho-oauthtoken ${accessToken}`,
            },
          });

          if (response.ok && response.status !== 204) {
            const resJson = await response.json();
            if (resJson.data && resJson.data.length > 0) {
              const record = resJson.data[0];
              console.log(`[Zoho Service] Registro de Debida_Diligencia ${crmId} encontrado.`);
              
              const rawType = (record.Tipo_de_Persona || record.Tipo_de_Cliente || record.Tipo_Cliente || "").toString().toLowerCase();
              const isJur = rawType.includes("jur") || rawType.includes("empresa") || rawType.includes("sociedad") || !!record.Raz_n_social || !!record.Razon_Social;
              const type = isJur ? "JURIDICA" as const : "NATURAL" as const;
              
              const projectName = findValue(record, ["Proyecto", "Nombre_Proyecto", "Project", "Project_Interest"]) || "Altos del Parque";
              
              const email = findValue(record, [
                "Email",
                "Correo_Electr_nico",
                "Correo_Electrónico",
                "Correo_Electronico",
                "Correo_de_contacto",
                "Correo_contacto",
                "Email_Address",
                "Correo_Secundario",
                "Secondary_Email",
                "Correo_Alternativo",
                "Email_2",
                "Correo",
              ]);

              const phone = findValue(record, ["Tel_fono", "Telefono", "Teléfono", "Celular", "Mobile", "Phone"]);
              const idNumber = findValue(record, ["RUC_NIT", "Identificacion", "Cedula", "Cédula", "C_dula", "ID_Number", "N_Identificacion", "C_I_P_Pasaporte"]);

              let firstName = findValue(record, ["First_Name", "Nombre", "Nombres", "FirstName"]);
              let lastName = findValue(record, ["Last_Name", "Apellido", "Apellidos", "LastName"]);

              if (!firstName && record.Name) {
                const cleanName = String(record.Name).split("-")[0].trim();
                const parts = cleanName.split(/\s+/);
                if (parts.length > 1) {
                  firstName = parts.slice(0, Math.ceil(parts.length / 2)).join(" ");
                  lastName = parts.slice(Math.ceil(parts.length / 2)).join(" ");
                } else {
                  firstName = cleanName;
                  lastName = "";
                }
              }

              return {
                type,
                nombreProyecto: projectName,
                firstName: firstName || "Cliente",
                lastName: lastName || "",
                email,
                celular: phone,
                idNumber,
                razonSocial: record.Raz_n_social || record.Razon_Social || "",
                numeroDocumento: idNumber,
                contactoNombre: record.Name || (firstName && lastName ? `${firstName} ${lastName}`.trim() : (firstName || "Expediente")),
                contactoApellido: lastName || "",
                contactoEmail: email,
                contactoTelefono: phone,
                module: "Debida_Diligencia",
              };
            }
          }
        } catch (e) {
          console.log(`[Zoho Service] Error buscando en módulo Debida_Diligencia, intentando Accounts...`, e);
        }

        // 2. Try Accounts Module (Socios de Negocio)
        try {
          console.log(`[Zoho Service] Buscando registro ${crmId} en módulo Accounts (Socios de Negocio)...`);
          const accResponse = await fetch(`${crmBaseUrl}/Accounts/${crmId}`, {
            method: "GET",
            headers: {
              Authorization: `Zoho-oauthtoken ${accessToken}`,
            },
          });

          if (accResponse.ok && accResponse.status !== 204) {
            const accJson = await accResponse.json();
            if (accJson.data && accJson.data.length > 0) {
              console.log(`[Zoho Service] Socio de Negocio ${crmId} encontrado.`);
              return mapAccountRecord(accJson.data[0]);
            }
          }
        } catch (accErr) {
          console.log(`[Zoho Service] Error buscando en módulo Accounts:`, accErr);
        }

        throw new Error(`No se pudo encontrar ningún Expediente de Debida Diligencia o Socio de Negocio con el ID de CRM: ${crmId}`);
      });
    },

    /**
     * Updates an existing Zoho record in Debida_Diligencia with form data.
     * Integrates with oauth automatic retries and development simulation fallback.
     */
    updateContact: async (
      crmId: string,
      clientType: "NATURAL" | "JURIDICA",
      formData: any
    ): Promise<{ success: boolean; crmId: string; mocked?: boolean }> => {
      const clientId = process.env.ZOHO_CLIENT_ID;
      const clientSecret = process.env.ZOHO_CLIENT_SECRET;
      const refreshToken = process.env.ZOHO_REFRESH_TOKEN;

      const isPlaceholder =
        !clientId ||
        clientId === "placeholder_client_id" ||
        !clientSecret ||
        clientSecret === "placeholder_client_secret" ||
        !refreshToken ||
        refreshToken === "placeholder_refresh_token";

      if (isPlaceholder || crmId.startsWith("mock-") || crmId === "simulated-crm-contact-id") {
        console.log(`[Zoho Service] Modo placeholder activo. Simulando actualización exitosa de CRM para ID: ${crmId}`);
        return { success: true, crmId, mocked: true };
      }

      const payload = mapFormToCrmPayload(clientType, formData);

      return executeWithRetry(async (accessToken) => {
        const crmBaseUrl = process.env.ZOHO_CRM_BASE_URL || "https://www.zohoapis.com/crm/v2";

        // Helper function to update record in a specific module
        const tryUpdateInModule = async (module: string) => {
          console.log(`[Zoho Service] Intentando actualizar registro ${crmId} en módulo ${module}...`);
          const response = await fetch(`${crmBaseUrl}/${module}/${crmId}`, {
            method: "PUT",
            headers: {
              Authorization: `Zoho-oauthtoken ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              data: [payload],
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Zoho CRM API returned HTTP ${response.status}: ${errorText}`);
          }

          const resJson = await response.json();
          if (!resJson.data || resJson.data.length === 0) {
            throw new Error(`Zoho CRM response was empty or invalid: ${JSON.stringify(resJson)}`);
          }

          const result = resJson.data[0];
          
          if (result.status === "error") {
            const code = result.code;
            if (code === "INVALID_DATA" || code === "NOT_FOUND" || result.message?.toLowerCase().includes("record not found") || result.message?.toLowerCase().includes("invalid id")) {
              return { success: false, notFound: true, details: result };
            }
            throw new Error(`Zoho CRM Error [${code}]: ${result.message} - details: ${JSON.stringify(result.details)}`);
          }

          if (result.status !== "success" || result.code !== "SUCCESS") {
            throw new Error(`Zoho CRM Sincronización Parcial [${result.code}]: ${result.message}`);
          }

          return { success: true, notFound: false };
        };

        const updateRes = await tryUpdateInModule("Debida_Diligencia");
        if (!updateRes.success) {
          throw new Error(`No se encontró el registro ${crmId} en el módulo Debida_Diligencia de Zoho CRM.`);
        }

        console.log(`[Zoho Service] Registro ${crmId} actualizado exitosamente en módulo Debida_Diligencia.`);
        return { success: true, crmId };
      });
    },

    searchContacts: async (
      query: string
    ): Promise<
      Array<{
        id: string;
        name: string;
        email: string;
        phone: string;
        module: CrmModule;
        type: "NATURAL" | "JURIDICA";
        projectInterest?: string;
      }>
    > => {
      const clientId = process.env.ZOHO_CLIENT_ID;
      const clientSecret = process.env.ZOHO_CLIENT_SECRET;
      const refreshToken = process.env.ZOHO_REFRESH_TOKEN;

      const isPlaceholder =
        !clientId ||
        clientId === "placeholder_client_id" ||
        !clientSecret ||
        clientSecret === "placeholder_secret" ||
        !refreshToken ||
        refreshToken === "placeholder_refresh_token";

      if (isPlaceholder) {
        console.log(`[Zoho Service] Búsqueda simulada activa para query: "${query}"`);
        const mockResults = [
          {
            id: "mock-account-natural",
            name: "Juan Pérez (Socio de Negocio)",
            email: "juan.perez.mock@gmail.com",
            phone: "50766554433",
            module: "Accounts" as const,
            type: "NATURAL" as const,
            projectInterest: "Proyecto Terrazas Mock",
          },
          {
            id: "mock-account-juridica",
            name: "Inversiones Tecnológicas S.A. (Socio de Negocio)",
            email: "contacto@inversionesmock.com",
            phone: "50766112233",
            module: "Accounts" as const,
            type: "JURIDICA" as const,
            projectInterest: "Proyecto Edificio Mock",
          },
          {
            id: "mock-debida-natural",
            name: "Expediente: Juan Pérez (Debida Diligencia)",
            email: "juan.perez.mock@gmail.com",
            phone: "50766554433",
            module: "Debida_Diligencia" as const,
            type: "NATURAL" as const,
            projectInterest: "Proyecto Terrazas Mock",
          },
          {
            id: "mock-debida-juridica",
            name: "Expediente: Inversiones Tecnológicas S.A. (Debida Diligencia)",
            email: "contacto@inversionesmock.com",
            phone: "50766112233",
            module: "Debida_Diligencia" as const,
            type: "JURIDICA" as const,
            projectInterest: "Proyecto Edificio Mock",
          },
        ];
        return mockResults.filter(
          r => r.name.toLowerCase().includes(query.toLowerCase()) || r.email.toLowerCase().includes(query.toLowerCase())
        );
      }

      return executeWithRetry(async (accessToken) => {
        const crmBaseUrl = process.env.ZOHO_CRM_BASE_URL || "https://www.zohoapis.com/crm/v2";
        const results: Array<{
          id: string;
          name: string;
          email: string;
          phone: string;
          module: CrmModule;
          type: "NATURAL" | "JURIDICA";
          projectInterest?: string;
        }> = [];

        // 1. Search in Debida_Diligencia
        try {
          console.log(`[Zoho Service] Buscando "${query}" en módulo Debida_Diligencia...`);
          const res = await fetch(`${crmBaseUrl}/Debida_Diligencia/search?word=${encodeURIComponent(query)}`, {
            method: "GET",
            headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
          });
          if (res.ok && res.status !== 204) {
            const data = await res.json();
            if (data.data) {
              for (const record of data.data) {
                const isJur = record.Tipo_de_Persona === "Persona Jurídica" || record.Tipo_de_Persona === "JURIDICA";
                const type = isJur ? "JURIDICA" as const : "NATURAL" as const;
                const projectName = record.Proyecto?.name || record.Proyecto || "";
                results.push({
                  id: record.id,
                  name: record.Name || "Expediente sin nombre",
                  email: record.Email || record.Correo_de_contacto || "",
                  phone: record.Tel_fono || "",
                  module: "Debida_Diligencia",
                  type,
                  projectInterest: projectName || undefined,
                });
              }
            }
          }
        } catch (err) {
          console.error("[Zoho Service Search Contacts] Error searching Debida_Diligencia:", err);
        }

        // 2. Search in Accounts (Socios de Negocio)
        try {
          console.log(`[Zoho Service] Buscando "${query}" en módulo Accounts (Socios de Negocio)...`);
          const res = await fetch(`${crmBaseUrl}/Accounts/search?word=${encodeURIComponent(query)}`, {
            method: "GET",
            headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
          });
          if (res.ok && res.status !== 204) {
            const data = await res.json();
            if (data.data) {
              for (const record of data.data) {
                const mapped = mapAccountRecord(record);
                const name = record.Account_Name || record.Name || (mapped.firstName ? `${mapped.firstName} ${mapped.lastName}`.trim() : "Socio de Negocio");
                results.push({
                  id: record.id,
                  name,
                  email: mapped.email || "",
                  phone: mapped.celular || "",
                  module: "Accounts",
                  type: mapped.type,
                  projectInterest: mapped.nombreProyecto || undefined,
                });
              }
            }
          }
        } catch (err) {
          console.error("[Zoho Service Search Contacts] Error searching Accounts:", err);
        }

        return results;
      });
    },

    /**
     * Creates a new record in the Zoho CRM Debida_Diligencia module.
     * Used when initializing a due diligence process from an Account (Socio de Negocio).
     */
    createDebidaDiligenciaRecord: async (params: {
      accountCrmId?: string;
      clientType: "NATURAL" | "JURIDICA";
      name: string;
      projectName?: string;
      formLink?: string;
      expiresAt?: Date;
      email?: string;
      phone?: string;
      idNumber?: string;
      estadoCivil?: string;
      razonSocial?: string;
      advisorName?: string;
    }): Promise<{ success: boolean; debidaId: string; mocked?: boolean }> => {
      const clientId = process.env.ZOHO_CLIENT_ID;
      const clientSecret = process.env.ZOHO_CLIENT_SECRET;
      const refreshToken = process.env.ZOHO_REFRESH_TOKEN;

      const isPlaceholder =
        !clientId ||
        clientId === "placeholder_client_id" ||
        !clientSecret ||
        clientSecret === "placeholder_client_secret" ||
        clientSecret === "placeholder_secret" ||
        !refreshToken ||
        refreshToken === "placeholder_refresh_token";

      if (isPlaceholder || (params.accountCrmId && (params.accountCrmId.startsWith("mock-") || params.accountCrmId === "simulated-crm-contact-id"))) {
        const mockDebidaId = "mock-debida-" + Date.now();
        console.log(`[Zoho Service] Simulación: Creando registro en Debida_Diligencia con ID ${mockDebidaId} para socio ${params.accountCrmId}`);
        return { success: true, debidaId: mockDebidaId, mocked: true };
      }

      return executeWithRetry(async (accessToken) => {
        const crmBaseUrl = process.env.ZOHO_CRM_BASE_URL || "https://www.zohoapis.com/crm/v2";

        let isoDate: string | undefined;
        if (params.expiresAt) {
          const pad = (num: number) => String(num).padStart(2, "0");
          const year = params.expiresAt.getUTCFullYear();
          const month = pad(params.expiresAt.getUTCMonth() + 1);
          const day = pad(params.expiresAt.getUTCDate());
          const hours = pad(params.expiresAt.getUTCHours());
          const minutes = pad(params.expiresAt.getUTCMinutes());
          const seconds = pad(params.expiresAt.getUTCSeconds());
          isoDate = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+00:00`;
        }

        const recordPayload: any = {
          Tipo_de_Persona: params.clientType === "NATURAL" ? "Persona Natural" : "Persona Jurídica",
          Estado_del_enlace: "Activo",
          Estado: "En Proceso",
        };

        if (params.formLink) {
          recordPayload.Enlace_de_Formulario = params.formLink;
          recordPayload.Enlace_Formulario = params.formLink;
          recordPayload.Enlace_Debida_Diligencia = params.formLink;
          recordPayload.Client_Form_Link = params.formLink;
        }

        if (isoDate) {
          recordPayload.Vigencia_del_enlace = isoDate;
        }

        if (params.email) {
          recordPayload.Email = params.email;
          recordPayload.Correo_Electr_nico = params.email;
          recordPayload.Correo_de_contacto = params.email;
        }

        if (params.phone) {
          recordPayload.Tel_fono = params.phone;
          recordPayload.Celular = params.phone;
        }

        if (params.idNumber) {
          recordPayload.RUC_NIT = params.idNumber;
          recordPayload.Identificacion = params.idNumber;
        }

        if (params.estadoCivil) {
          recordPayload.Estado_Civil = params.estadoCivil;
        }

        if (params.projectName) {
          recordPayload.Proyecto = params.projectName;
        }

        if (params.razonSocial) {
          recordPayload.Raz_n_social = params.razonSocial;
          recordPayload.Razon_Social = params.razonSocial;
        }

        if (params.advisorName) {
          recordPayload.Asesor = params.advisorName;
        }

        console.log(`[Zoho Service] Creando registro en Debida_Diligencia...`);
        const response = await fetch(`${crmBaseUrl}/Debida_Diligencia`, {
          method: "POST",
          headers: {
            Authorization: `Zoho-oauthtoken ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ data: [recordPayload] }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Zoho CRM API Debida_Diligencia POST returned HTTP ${response.status}: ${errorText}`);
        }

        const resJson = await response.json();
        if (!resJson.data || resJson.data.length === 0) {
          throw new Error(`Zoho CRM Debida_Diligencia creation returned empty response: ${JSON.stringify(resJson)}`);
        }

        const result = resJson.data[0];
        if (result.status === "error" || (result.code !== "SUCCESS" && result.status !== "success")) {
          throw new Error(`Zoho CRM Error creando Debida_Diligencia [${result.code}]: ${result.message}`);
        }

        const createdId = result.details?.id;
        console.log(`[Zoho Service] Registro creado exitosamente en Debida_Diligencia con ID: ${createdId}`);
        return { success: true, debidaId: createdId };
      });
    },

    /**
     * Updates the custom client form link field in Zoho CRM.
     */
    updateClientFormLink: async (
      crmId: string,
      module: CrmModule,
      formLink?: string,
      expiresAt?: Date,
      linkStatus?: string
    ): Promise<{ success: boolean; error?: string }> => {
      const clientId = process.env.ZOHO_CLIENT_ID;
      const clientSecret = process.env.ZOHO_CLIENT_SECRET;
      const refreshToken = process.env.ZOHO_REFRESH_TOKEN;

      const isPlaceholder =
        !clientId ||
        clientId === "placeholder_client_id" ||
        !clientSecret ||
        clientSecret === "placeholder_client_secret" ||
        !refreshToken ||
        refreshToken === "placeholder_refresh_token";

      if (isPlaceholder || crmId.startsWith("mock-") || crmId === "simulated-crm-contact-id") {
        console.log(`[Zoho Service] Simulación: Enlace "${formLink}" (Vigencia: ${expiresAt?.toISOString()}, Estado: ${linkStatus}) actualizado en CRM para el registro ${crmId}.`);
        return { success: true };
      }

      return executeWithRetry(async (accessToken) => {
        const crmBaseUrl = process.env.ZOHO_CRM_BASE_URL || "https://www.zohoapis.com/crm/v2";
        
        const recordUpdate: any = {
          id: crmId
        };

        if (formLink !== undefined) {
          recordUpdate.Client_Form_Link = formLink;
          recordUpdate.Enlace_Formulario = formLink;
          recordUpdate.Enlace_Debida_Diligencia = formLink;
          recordUpdate.Enlace_de_Formulario = formLink;
        }

        if (expiresAt !== undefined) {
          const pad = (num: number) => String(num).padStart(2, "0");
          const year = expiresAt.getUTCFullYear();
          const month = pad(expiresAt.getUTCMonth() + 1);
          const day = pad(expiresAt.getUTCDate());
          const hours = pad(expiresAt.getUTCHours());
          const minutes = pad(expiresAt.getUTCMinutes());
          const seconds = pad(expiresAt.getUTCSeconds());
          recordUpdate.Vigencia_del_enlace = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+00:00`;
        }

        if (linkStatus !== undefined) {
          recordUpdate.Estado_del_enlace = linkStatus;
        }

        const payload = {
          data: [recordUpdate]
        };

        const response = await fetch(`${crmBaseUrl}/${module}/${crmId}`, {
          method: "PUT",
          headers: {
            Authorization: `Zoho-oauthtoken ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const resJson = await response.json();
          console.log(`[Zoho Service] Enlace actualizado. Respuesta de Zoho:`, JSON.stringify(resJson));
          return { success: true };
        }

        const errText = await response.text();
        console.error(`[Zoho Service Error] No se pudo actualizar el enlace en Zoho CRM (${module}):`, errText);
        return { success: false, error: errText };
      });
    },

    /**
     * Creates an activity note in Zoho CRM associated with a Debida_Diligencia or Account record.
     */
    createNote: async (
      crmId: string,
      title: string,
      content: string
    ): Promise<{ success: boolean; noteId?: string }> => {
      const clientId = process.env.ZOHO_CLIENT_ID;
      const clientSecret = process.env.ZOHO_CLIENT_SECRET;
      const refreshToken = process.env.ZOHO_REFRESH_TOKEN;

      const isPlaceholder =
        !clientId ||
        clientId === "placeholder_client_id" ||
        !clientSecret ||
        clientSecret === "placeholder_client_secret" ||
        !refreshToken ||
        refreshToken === "placeholder_refresh_token";

      if (isPlaceholder || crmId.startsWith("mock-") || crmId === "simulated-crm-contact-id") {
        console.log(`[Zoho Service] Modo placeholder. Simulando creación de nota para ID ${crmId}: "${title}"`);
        return { success: true, noteId: "mock-note-id-" + crypto.randomUUID() };
      }

      return executeWithRetry(async (accessToken) => {
        const crmBaseUrl = process.env.ZOHO_CRM_BASE_URL || "https://www.zohoapis.com/crm/v2";

        // Determine if it is under Accounts or Debida_Diligencia
        let resolvedModule: CrmModule = "Debida_Diligencia";
        try {
          const contactInfo = await zoho.service.getContact(crmId);
          resolvedModule = contactInfo.module || "Debida_Diligencia";
        } catch (e) {
          console.warn(`[Zoho Note] No se pudo determinar el módulo para ID ${crmId}, asumiendo Debida_Diligencia:`, e);
        }

        console.log(`[Zoho Service] Creando nota de actividad para ${crmId} (${resolvedModule}): ${title}`);

        const response = await fetch(`${crmBaseUrl}/Notes`, {
          method: "POST",
          headers: {
            Authorization: `Zoho-oauthtoken ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            data: [
              {
                Note_Title: title,
                Note_Content: content,
                Parent_Id: crmId,
                $se_module: resolvedModule,
              },
            ],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Zoho CRM Notes API returned HTTP ${response.status}: ${errorText}`);
        }

        const resJson = await response.json();
        if (!resJson.data || resJson.data.length === 0) {
          throw new Error(`Zoho CRM Notes response was empty or invalid: ${JSON.stringify(resJson)}`);
        }

        const result = resJson.data[0];
        if (result.status === "error") {
          throw new Error(`Zoho CRM Notes Error [${result.code}]: ${result.message}`);
        }

        return { success: true, noteId: result.details?.id };
      });
    },

    /**
     * Uploads a file buffer directly as an Attachment to a record in Zoho CRM
     * (Debida_Diligencia or Accounts).
     */
    uploadAttachment: async (
      crmId: string,
      fileName: string,
      fileBuffer: Buffer,
      moduleOverride?: CrmModule
    ): Promise<{ success: boolean; attachmentId?: string; mocked?: boolean }> => {
      const clientId = process.env.ZOHO_CLIENT_ID;
      const clientSecret = process.env.ZOHO_CLIENT_SECRET;
      const refreshToken = process.env.ZOHO_REFRESH_TOKEN;

      const isPlaceholder =
        !clientId ||
        clientId === "placeholder_client_id" ||
        !clientSecret ||
        clientSecret === "placeholder_client_secret" ||
        !refreshToken ||
        refreshToken === "placeholder_refresh_token";

      if (isPlaceholder || crmId.startsWith("mock-") || crmId === "simulated-crm-contact-id") {
        console.log(`[Zoho Service] Modo placeholder. Simulando subida de archivo adjunto "${fileName}" para ID ${crmId}`);
        return { success: true, attachmentId: "mock-attachment-id-" + crypto.randomUUID(), mocked: true };
      }

      return executeWithRetry(async (accessToken) => {
        const crmBaseUrl = process.env.ZOHO_CRM_BASE_URL || "https://www.zohoapis.com/crm/v2";

        let resolvedModule: CrmModule = moduleOverride || "Debida_Diligencia";
        if (!moduleOverride) {
          try {
            const contactInfo = await zoho.service.getContact(crmId);
            resolvedModule = contactInfo.module || "Debida_Diligencia";
          } catch (e) {
            console.warn(`[Zoho Attachment] No se pudo determinar el módulo para ID ${crmId}, asumiendo Debida_Diligencia:`, e);
          }
        }

        console.log(`[Zoho Service] Subiendo archivo adjunto "${fileName}" a ${resolvedModule} (ID: ${crmId})...`);

        const formData = new FormData();
        const blob = new Blob([new Uint8Array(fileBuffer)], { type: "application/pdf" });
        formData.append("file", blob, fileName);

        const response = await fetch(`${crmBaseUrl}/${resolvedModule}/${crmId}/Attachments`, {
          method: "POST",
          headers: {
            Authorization: `Zoho-oauthtoken ${accessToken}`,
          },
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Zoho CRM Attachments API returned HTTP ${response.status}: ${errorText}`);
        }

        const resJson = await response.json();
        if (!resJson.data || resJson.data.length === 0) {
          throw new Error(`Zoho CRM Attachments response was empty or invalid: ${JSON.stringify(resJson)}`);
        }

        const result = resJson.data[0];
        if (result.status === "error") {
          throw new Error(`Zoho CRM Attachments Error [${result.code}]: ${result.message}`);
        }

        console.log(`[Zoho Service] Archivo adjunto subido exitosamente a Zoho CRM. ID de adjunto: ${result.details?.id || "N/A"}`);
        return { success: true, attachmentId: result.details?.id };
      });
    },
  },
};

// ==========================================
// Helpers para el mapeo formulario -> Zoho CRM
// ==========================================

/** Texto recortado, o undefined si está vacío (el campo no se envía). */
function text(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}

/** "Sí" / "Si" / true -> true. Cualquier otro valor -> false. */
function isYes(v: unknown): boolean {
  return v === true || /^s[ií]$/i.test(String(v ?? "").trim());
}

/** Opciones "Otros" / "Otro" / "OTROS" que se reemplazan por su campo de detalle. */
function isOtros(v: unknown): boolean {
  return /^otros?$/i.test(String(v ?? "").trim());
}

/** Código de país + número, como en el formulario: "+507 6000-0000". */
function phone(code: unknown, num: unknown): string | undefined {
  const n = text(num);
  if (!n) return undefined;
  const c = text(code);
  return c ? `${c} ${n}` : n;
}

/** Campos Money / Decimal / Porcentaje: "$1,500.50" -> 1500.5 */
function toNumber(v: unknown): number | undefined {
  const s = text(v)?.replace(/[$%\s,]/g, "");
  return s && /^\d+(\.\d+)?$/.test(s) ? parseFloat(s) : undefined;
}

/** Zoho espera fechas yyyy-MM-dd. */
function toDate(v: unknown): string | undefined {
  const s = text(v);
  return s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : undefined;
}

/** Picklist múltiple: el formulario guarda "Efectivo, Cheque". */
function toList(v: unknown): string[] | undefined {
  const items = (Array.isArray(v) ? v : String(v ?? "").split(","))
    .map((x) => String(x).trim())
    .filter(Boolean);
  return items.length ? items : undefined;
}

function hasFile(v: unknown): boolean {
  return Array.isArray(v) ? v.some((x) => !!text(x)) : !!text(v);
}

function hasPersonDoc(docs: unknown, personType: "GJC" | "BF" | "RL"): boolean {
  return Array.isArray(docs) && docs.some((d: any) => d?.personType === personType && !!text(d?.fileName));
}

function rowHasContent(row: Record<string, any>): boolean {
  return Object.entries(row).some(([k, v]) => k !== "id" && !!text(v));
}

/** Copia al payload solo los campos con valor. */
function assign(payload: Record<string, unknown>, fields: Record<string, unknown>) {
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) payload[key] = value;
  }
}

/**
 * Maps the complete portal form state into the Debida_Diligencia fields listed in
 * zoho_fields_guide.md. API names follow the real Zoho module (e.g. Tipo_de_Cliente,
 * Promedio_mensual, Aviso_de_Operaciones), which in a few rows differs from the guide.
 */
export function mapFormToCrmPayload(clientType: "NATURAL" | "JURIDICA", formData: any): any {
  const d = formData || {};
  const payload: Record<string, unknown> = {
    "Estado": "Completado",
    "Fecha_de_Ingreso": new Date().toISOString().split("T")[0],
    "Estado_del_enlace": "Expirado / Revocado",
  };

  // 1. Datos de cabecera
  assign(payload, {
    "Proyecto": text(d.nombreProyecto || d.projectName),
    "Forma_de_contacto": isOtros(d.formaContacto) ? text(d.formaContactoDetalle) : text(d.formaContacto),
    "Referido_por": d.formaContacto === "Referido" ? text(d.referidoPor) : undefined,
  });

  const esPep = isYes(d.esPep);
  const pep = {
    "Es_PEP": esPep,
    "PEP_nombre": esPep ? text(d.pepNombre) : undefined,
    "PEP_cargo": esPep ? text(d.pepCargo) : undefined,
    "PEP_instituci_n": esPep ? text(d.pepInstitucion) : undefined,
    "PEP_relaci_n": esPep ? text(d.pepRelacion) : undefined,
  };
  const conTercero = String(d.fuenteFondosInmueble ?? "").includes("Terceros");

  if (clientType === "JURIDICA") {
    const ocupaCargo = isYes(d.ifContacto);
    const masUnidades = isYes(d.adquiereMasUnidades);

    assign(payload, {
      // Datos de identificación jurídica
      "Raz_n_social": text(d.razonSocial),
      "Tipo_de_sociedad": text(d.tipoSociedad),
      "Tipo_de_Cliente": text(d.tipoCliente),
      "Estado_sociedad": text(d.estadoSociedad),
      "Tipo_de_identificacion": text(d.tipoDocumentoIdentidad),
      "Actividad_Principal": text(d.actividadPrincipal),
      "RUC_NIT": text(d.numeroDocumento),
      "Fecha_vencimiento_ID": toDate(d.fechaVencimientoId),
      "ID_tributaria": text(d.numeroIdTributaria),
      "Pa_s_donde_tributa": text(d.paisTributacion),
      "Pa_s_donde_opera": text(d.paisOpera),
      "Fecha_de_constituci_n": toDate(d.fechaConstitucion),
      "Pais_de_inscripci_n": text(d.paisInscripcion),

      // Persona de contacto
      "Nombre_contacto": text(`${d.contactoNombre || ""} ${d.contactoApellido || ""}`),
      "Identificaci_n_Contacto": text(d.contactoId),
      "Telefono_contacto": text(d.contactoTelefono),
      "Correo_de_contacto": text(d.contactoEmail),
      "Ocupa_cargo": ocupaCargo,
      "Cargo_de_contacto": ocupaCargo ? text(d.contactoCargo) : undefined,

      // Datos generales de la empresa
      "Direccion_Calle": text(d.empresaDireccion),
      "Ciudad": text(d.empresaCiudad),
      "Provincia": text(d.empresaProvincia),
      "Pa_s": text(d.empresaPais),
      "Tel_fono": phone(d.empresaTelefonoCodigo, d.empresaTelefono),
      "Celular": phone(d.empresaCelularCodigo, d.empresaCelular),
      "Email_corporativo": text(d.empresaEmail),

      // Representante legal o apoderado
      "Nombre_natural": text(d.rlNombre),
      "Estado_Civil": text(d.rlEstadoCivil),
      "Nacionalidad": text(d.rlNacionalidad),
      "Numero_Identificacion": text(d.rlNoIdentificacion),
      "Fecha_de_nacimiento": toDate(d.rlFechaNacimiento),
      "Profesi_n": text(d.rlProfesionOcupacion),
      "Actividad_Persona": text(d.rlActividadEconomica),
      "Pais_de_residencia_fiscal": text(d.rlPaisResidencia),
      "Direccion_Representante": text(d.rlDireccion),
      "Telefono_Representante": text(d.rlTelefono),
      "Declaraci_n_del_origen_il_cito_firmada": isYes(d.rlObjetoInvestigacion),

      // Perfil financiero
      "Promedio_mensual": toNumber(d.ingresosMensuales),
      "Medios_de_Pago": toList(d.medioPago),
      "Fuente_de_Fondos": text(d.fuenteFondosInmueble),
      "Mas_unidades_inmobiliarias": masUnidades,
      "Cantidad_inmuebles": masUnidades ? toNumber(d.cantidadUnidadesInmobiliarias) : undefined,

      // Tercero aportante (solo si los fondos provienen de terceros)
      "Tercero_Aportante_Nombre": conTercero ? text(d.terceroNombre) : undefined,
      "Tercero_Aportante_Nacionalidad": conTercero ? text(d.terceroNacionalidad) : undefined,
      "Tercero_Aportante_Relaci_n": conTercero ? text(d.terceroVinculo) : undefined,
      "Tercero_Aportante_Fuente_de_Fondos": conTercero ? text(d.terceroFuenteFondos) : undefined,

      ...pep,

      // Documentos recibidos
      "C_dula_de_Representante_Legal": hasPersonDoc(d.personDocuments, "RL"),
      "Carta_de_Junta_Directiva": hasPersonDoc(d.personDocuments, "GJC"),
      "Declaraci_n_Jurada_de_Beneficiario_Final": hasPersonDoc(d.personDocuments, "BF"),
      "Aviso_de_Operaciones": hasFile(d.avisoOperacionesFile),
      "Estados_Financieros": hasFile(d.origenFondosFile),
      "Pacto_Social": hasFile(d.pactoSocialFile),
      "Certificado_de_Registro_P_blico": hasFile(d.certRegistroFile),
      "Certificado_Bancario": hasFile(d.certBancariaFile),
      "Carta_de_compra_de_beneficiarios": hasFile(d.certComprasFile),
    });

    // Subformulario: Gobierno Corporativo / Junta Directiva
    payload["Gobierno_Coporativo_Junta_Directiva"] = (d.gjcMembers || []).filter(rowHasContent).map((m: any) => ({
      "Nombre_y_apellido": `${m.nombre || ""} ${m.apellidos || ""}`.trim(),
      "Cargo": m.cargo || "",
      "Nacionalidad": m.nacionalidad || "",
      "Fecha_de_nacimiento": toDate(m.fechaNacimiento) ?? null,
      "No_Identificaci_n": m.nroId || "",
      "Direcci_n": m.direccion || "",
    }));

    // Subformulario: Beneficiarios Finales
    payload["Beneficiario_Finales"] = (d.bfMembers || []).filter(rowHasContent).map((m: any) => ({
      "Nombre_completo": m.nombreCompleto || "",
      "No_Identificaci_n": m.noIdentificacion || "",
      "Nacionalidad": m.nacionalidad || "",
      "Participaci_n": toNumber(m.porcentajeParticipacion) ?? null,
      "Pais_nac_Residencia": m.paisNacimiento || "",
      "Fecha_de_BF": toDate(m.fechaAdquisicion) ?? null,
      "Direcci_n": m.direccion || "",
    }));
  } else {
    const patrimonio = !!text(d.esPropietario) && d.esPropietario !== "No";
    const masUnidades = isYes(d.montoServiciosAnuales);
    const aNombreDeOtro = isYes(d.adquiereNombreTercero);

    // "Otros" como fuente de fondos se reemplaza por el detalle escrito por el cliente
    let fuenteFondos = text(d.fuenteFondosInmueble);
    const otroDetalle = text(d.ifOtroNombre);
    if (fuenteFondos && otroDetalle && fuenteFondos.includes("Otros")) {
      fuenteFondos = isOtros(fuenteFondos) ? otroDetalle : `${fuenteFondos} - ${otroDetalle}`;
    }

    assign(payload, {
      // Datos de identificación
      "Nombre_natural": text(`${d.firstName || ""} ${d.lastName || ""}`),
      "Pais_de_nacimiento": text(d.paisNacimiento),
      "Pais_de_residencia_fiscal": text(d.paisResidenciaFiscal),
      "ID_tributaria": text(d.idTributaria),
      "Nacionalidad": text(d.nationality),
      "Tipo_de_identificacion": text(d.tipoIdentificacion),
      "Otra_nacionalidad": text(d.otraNacionalidad),
      "Estado_Civil": text(d.estadoCivil),
      "Numero_Identificacion": text(d.idNumber),
      "Fecha_vencimiento_ID": toDate(d.fechaVencimientoId),
      "Fecha_de_nacimiento": toDate(d.fechaNacimiento),
      "Estado_migratorio": text(d.estatusMigratorio),

      // Jurisdicción / ubicación geográfica
      "Direccion_Calle": text(d.direccionResidencial),
      "Ciudad": text(d.ciudad),
      "Provincia": text(d.provinciaEstado),
      "Pa_s": text(d.paisResidencial),
      "Tel_fono": phone(d.telefonoCodigo, d.telefono),
      "Celular": phone(d.celularCodigo, d.celular),
      "Email_corporativo": text(d.email),

      // Datos laborales
      "Profesi_n": isOtros(d.profession) ? text(d.profesionOtros) : text(d.profession),
      "Pa_s_de_Empresa": text(d.paisActividadLaboral),
      "Empresa_donde_labora": text(d.employer),
      "Actividad_Empresa": isOtros(d.actividadLaboral) ? text(d.actividadLaboralOtros) : text(d.actividadLaboral),
      "Direcci_n_laboral": text(d.direccionLaboral),
      "Cargo_en_la_Empresa": text(d.cargoDesempena),
      "Patrimonio_en_la_empresa": patrimonio,
      "Fondos_provienen_de_la_Empresa": patrimonio && isYes(d.usaFondos),

      // Actividades económicas o profesionales
      "Actividad_Persona": isOtros(d.actEconPrincipal) ? text(d.otroActEcon) : text(d.actEconPrincipal),
      "Porcentaje_Actividad_principal": toNumber(d.pctDedicacionPrincipal),
      "Jurisdicci_n_de_Operaci_n_Principal": text(d.jurisdiccionPrincipal),
      "Otras_Actividades": text(d.actEconSecundaria),
      "Porcentaje_Otra_Actividad": toNumber(d.pctDedicacionSecundaria),
      "Jurisdicci_n_de_Otra_operaci_n": text(d.jurisdiccionSecundaria),

      // Perfil financiero
      "Promedio_mensual": toNumber(d.ingresosMensuales),
      "Medios_de_Pago": toList(d.medioPago),
      "Fuente_de_Fondos": fuenteFondos,
      "Mas_unidades_inmobiliarias": masUnidades,
      "Cantidad_inmuebles": masUnidades ? toNumber(d.cantidadServiciosAnuales) : undefined,

      // Tercero aportante (solo si los fondos provienen de terceros)
      "Tercero_Aportante_Nombre": conTercero ? text(d.ifTerceroNombre) : undefined,
      "Tercero_Aportante_Nacionalidad": conTercero ? text(d.ifTerceroNacionalidad) : undefined,
      "Tercero_Aportante_Relaci_n": conTercero ? text(d.ifTerceroRelacion) : undefined,
      "Tercero_Aportante_Fuente_de_Fondos": conTercero ? text(d.ifTerceroFuenteDeIngresos) : undefined,

      // Identificación del beneficiario del inmueble
      "A_nombre_de_otro": aNombreDeOtro,
      "Nombre_de_Otro": aNombreDeOtro ? text(d.nombreTercero) : undefined,
      "Prop_sito_del_inmueble": text(d.destinoInmueble),

      ...pep,

      // Documentos recibidos
      "Carta_de_Certificaci_n_Bancaria": hasFile(d.hasCertificacionBancaria),
      "Certificaci_n_de_Ingresos": hasFile(d.origenFondosFile),
      "Movimientos_Bancarios_6_Meses": hasFile(d.hasEstadoCuenta),
      "Identificaci_n_Personal": hasFile(d.idFile),
    });
  }

  return payload;
}
