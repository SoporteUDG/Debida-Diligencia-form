import { executeWithRetry } from "./zohoAuthService";
import crypto from "crypto";

/**
 * Normalizes values returned by Zoho CRM (e.g. converting null/undefined or string "null" to "").
 */
function cleanValue(val: any): string {
  if (val === null || val === undefined || String(val).trim().toLowerCase() === "null") {
    return "";
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

export interface MappedCrmData {
  type: "NATURAL" | "JURIDICA";
  nombreProyecto: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  celular?: string;
  idNumber?: string;
  
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
  
  module?: "Contacts" | "Leads" | "Debida_Diligencia";
}

/**
 * Maps a raw Zoho CRM Contact or Lead record to the portal's form structures.
 */
export function mapCrmRecord(record: any, moduleType: "Contacts" | "Leads"): MappedCrmData {
  // 1. Determine client type (Natural or Jurídica)
  const rawType = findValue(record, [
    "Client_Type",
    "Tipo_Cliente",
    "Tipo_de_Cliente",
    "ClientType",
    "Tipo_de_Persona",
  ]).toLowerCase();

  // Default to NATURAL unless it matches JURIDICA indicators
  const isJuridica = 
    rawType.includes("jurid") || 
    rawType.includes("corp") || 
    rawType.includes("empresa") ||
    rawType.includes("sociedad") ||
    !!findValue(record, ["Razon_Social", "Razón_Social", "Company", "Empresa"]);

  const type = isJuridica ? "JURIDICA" : "NATURAL";

  // 2. Map project name
  const nombreProyecto = findValue(record, [
    "Project_Interest",
    "Proyecto_de_Interes",
    "Project",
    "Proyecto",
    "Nombre_Proyecto",
  ]) || "General UDG";

  // Common fields
  const email = findValue(record, ["Email", "Correo_Electrónico", "Correo", "Email_Address"]);
  const phone = findValue(record, ["Mobile", "Phone", "Teléfono", "Celular", "Mobile_Phone"]);

  if (type === "NATURAL") {
    const firstName = findValue(record, ["First_Name", "Nombre", "Nombres", "FirstName"]);
    const lastName = findValue(record, ["Last_Name", "Apellido", "Apellidos", "LastName"]);
    const idNumber = findValue(record, ["Identificacion", "Cedula", "Cédula", "N_Identificacion", "RUC", "Ruc", "C_dula", "C_dula_de_Identidad_Personal", "C_dula_o_Pasaporte", "C_I_P_Pasaporte", "RUC_NIT"]);

    return {
      type,
      nombreProyecto,
      firstName,
      lastName,
      email,
      celular: phone,
      idNumber,
      module: moduleType,
    };
  } else {
    // JURIDICA mapping
    const razonSocial = findValue(record, [
      "Razon_Social",
      "Razón_Social",
      "Company",
      "Account_Name",
      "Empresa",
    ]) || findValue(record, ["Company"]);

    const ruc = findValue(record, [
      "RUC",
      "Ruc",
      "Identificacion",
      "Cedula",
      "Cédula",
      "RUC_Razon_Social",
      "Número_de_RUC",
      "C_dula",
      "C_dula_de_Identidad_Personal",
      "C_dula_o_Pasaporte",
      "C_I_P_Pasaporte",
      "RUC_NIT",
    ]);

    // Split representative names or find representative fields
    const rlNombre = findValue(record, [
      "Representante_Legal",
      "rlNombre",
      "Nombre_Representante",
      "Legal_Representative",
      "Nombre_y_Apellido",
    ]);

    const rlNoIdentificacion = findValue(record, [
      "Cedula_Representante",
      "rlNoIdentificacion",
      "ID_Representante",
      "RL_No_Identificaci_n",
    ]);

    const rlTelefono = findValue(record, ["RL_Tel_fono", "rlTelefono"]);
    const rlNacionalidad = findValue(record, ["RL_Nacionalidad", "rlNacionalidad"]);
    const rlFechaNacimiento = findValue(record, ["aaa", "rlFechaNacimiento"]);
    const rlDireccion = findValue(record, ["RL_Direcci_n", "rlDireccion"]);
    const rlPaisResidencia = findValue(record, ["RL_Pa_s_de_Residencia", "rlPaisResidencia"]);
    const rlProfesionOcupacion = findValue(record, ["RL_Profesi_n_Ocupaci_n", "rlProfesionOcupacion"]);
    const rlActividadEconomica = findValue(record, ["RL_Actividad_Econ_mica", "rlActividadEconomica"]);

    // Use contact name and ID as form contact person
    const contactFirstName = findValue(record, ["First_Name", "Nombre", "Nombres", "FirstName"]);
    const contactLastName = findValue(record, ["Last_Name", "Apellido", "Apellidos", "LastName"]);
    const contactoId = findValue(record, [
      "Identificacion",
      "Cedula",
      "Cédula",
      "N_Identificacion",
      "C_dula",
      "C_dula_de_Identidad_Personal",
      "C_dula_o_Pasaporte",
      "C_I_P_Pasaporte",
    ]);

    return {
      type,
      nombreProyecto,
      razonSocial,
      numeroDocumento: ruc,
      contactoNombre: contactFirstName || "Representante",
      contactoApellido: contactLastName || "Comercial",
      contactoEmail: email,
      contactoTelefono: phone,
      contactoId: contactoId,
      rlNombre,
      rlNoIdentificacion,
      rlTelefono,
      rlNacionalidad,
      rlFechaNacimiento,
      rlDireccion,
      rlPaisResidencia,
      rlProfesionOcupacion,
      rlActividadEconomica,
      module: moduleType,
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
     * Queries Zoho CRM for a Contact or Lead by ID and returns mapped portal details.
     * Includes automated retries and a mock fallback mode for development environment.
     *
     * @param crmId Zoho CRM Contact or Lead unique ID
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
        const module = crmId.includes("debida") ? "Debida_Diligencia" as const : "Contacts" as const;
        
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

      // Query Zoho CRM modules (try Debida_Diligencia first, then Contacts/Leads)
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
              
              const isJur = record.Tipo_de_Persona === "Persona Jurídica" || record.Tipo_de_Persona === "JURIDICA";
              const type = isJur ? "JURIDICA" as const : "NATURAL" as const;
              const projectName = record.Proyecto?.name || record.Proyecto || "";
              
              return {
                type,
                nombreProyecto: projectName,
                razonSocial: record.Raz_n_social || "",
                numeroDocumento: record.RUC_NIT || "",
                contactoNombre: record.Name || "Expediente",
                contactoApellido: "",
                contactoEmail: record.Email || record.Correo_de_contacto || "",
                contactoTelefono: record.Tel_fono || "",
                module: "Debida_Diligencia",
              };
            }
          }
        } catch (e) {
          console.log(`[Zoho Service] Error buscando en módulo Debida_Diligencia, intentando estándar...`, e);
        }

        // 2. Try Contacts Module
        console.log(`[Zoho Service] Buscando contacto ${crmId} en módulo Contacts...`);
        let response = await fetch(`${crmBaseUrl}/Contacts/${crmId}`, {
          method: "GET",
          headers: {
            Authorization: `Zoho-oauthtoken ${accessToken}`,
          },
        });

        if (response.ok && response.status !== 204) {
          const resJson = await response.json();
          if (resJson.data && resJson.data.length > 0) {
            console.log(`[Zoho Service] Contacto ${crmId} encontrado.`);
            return mapCrmRecord(resJson.data[0], "Contacts");
          }
        }

        // 3. Fallback to Leads Module
        console.log(`[Zoho Service] Contacto no encontrado en Contacts. Buscando en módulo Leads...`);
        response = await fetch(`${crmBaseUrl}/Leads/${crmId}`, {
          method: "GET",
          headers: {
            Authorization: `Zoho-oauthtoken ${accessToken}`,
          },
        });

        if (response.ok && response.status !== 204) {
          const resJson = await response.json();
          if (resJson.data && resJson.data.length > 0) {
            console.log(`[Zoho Service] Lead ${crmId} encontrado.`);
            return mapCrmRecord(resJson.data[0], "Leads");
          }
        }

        throw new Error(`No se pudo encontrar ningún Expediente, Contacto o Lead con el ID de CRM: ${crmId}`);
      });
    },

    /**
     * Updates an existing Zoho record in Debida_Diligencia (or fallback to Contacts/Leads) with form data.
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

        // 1. Try updating in Debida_Diligencia
        try {
          const updateRes = await tryUpdateInModule("Debida_Diligencia");
          if (updateRes.success) {
            console.log(`[Zoho Service] Registro ${crmId} actualizado exitosamente en módulo Debida_Diligencia.`);
            return { success: true, crmId };
          }
        } catch (e) {
          console.log(`[Zoho Service] Falló actualización en módulo Debida_Diligencia, intentando estándar...`, e);
        }

        // 2. Try updating in Contacts
        let updateRes = await tryUpdateInModule("Contacts");
        if (updateRes.success) {
          console.log(`[Zoho Service] Registro ${crmId} actualizado exitosamente en módulo Contacts.`);
          return { success: true, crmId };
        }

        // 3. Try updating in Leads
        if (updateRes.notFound) {
          console.log(`[Zoho Service] Registro no encontrado en Contacts. Intentando en Leads...`);
          updateRes = await tryUpdateInModule("Leads");
          if (updateRes.success) {
            console.log(`[Zoho Service] Registro ${crmId} actualizado exitosamente en módulo Leads.`);
            return { success: true, crmId };
          }
        }

        throw new Error(`No se pudo encontrar ni actualizar ningún registro con el ID de CRM: ${crmId}`);
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
        module: "Contacts" | "Leads" | "Debida_Diligencia";
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
          {
            id: "mock-contact-natural",
            name: "Juan Pérez",
            email: "juan.perez.mock@gmail.com",
            phone: "50766554433",
            module: "Contacts" as const,
            type: "NATURAL" as const,
            projectInterest: "Proyecto Terrazas Mock",
          },
          {
            id: "mock-lead-juridica",
            name: "Inversiones Tecnológicas S.A. (Ana Martínez)",
            email: "contacto@inversionesmock.com",
            phone: "50766112233",
            module: "Leads" as const,
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
          module: "Contacts" | "Leads" | "Debida_Diligencia";
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

        // 2. Search in Contacts
        try {
          console.log(`[Zoho Service] Buscando "${query}" en módulo Contacts...`);
          const res = await fetch(`${crmBaseUrl}/Contacts/search?word=${encodeURIComponent(query)}`, {
            method: "GET",
            headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
          });
          if (res.ok && res.status !== 204) {
            const data = await res.json();
            if (data.data) {
              for (const record of data.data) {
                const mapped = mapCrmRecord(record, "Contacts");
                const firstName = record.First_Name || "";
                const lastName = record.Last_Name || "";
                results.push({
                  id: record.id,
                  name: `${firstName} ${lastName}`.trim() || record.Full_Name || "Contacto sin nombre",
                  email: record.Email || "",
                  phone: record.Mobile || record.Phone || "",
                  module: "Contacts",
                  type: mapped.type,
                  projectInterest: mapped.nombreProyecto || undefined,
                });
              }
            }
          }
        } catch (err) {
          console.error("[Zoho Service Search Contacts] Error searching Contacts:", err);
        }

        // 3. Search in Leads
        try {
          console.log(`[Zoho Service] Buscando "${query}" en módulo Leads...`);
          const res = await fetch(`${crmBaseUrl}/Leads/search?word=${encodeURIComponent(query)}`, {
            method: "GET",
            headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
          });
          if (res.ok && res.status !== 204) {
            const data = await res.json();
            if (data.data) {
              for (const record of data.data) {
                const mapped = mapCrmRecord(record, "Leads");
                const name = record.Company || `${record.First_Name || ""} ${record.Last_Name || ""}`.trim() || record.Full_Name || "Lead sin nombre";
                results.push({
                  id: record.id,
                  name,
                  email: record.Email || "",
                  phone: record.Mobile || record.Phone || "",
                  module: "Leads",
                  type: mapped.type,
                  projectInterest: mapped.nombreProyecto || undefined,
                });
              }
            }
          }
        } catch (err) {
          console.error("[Zoho Service Search Contacts] Error searching Leads:", err);
        }

        return results;
      });
    },

    /**
     * Updates the custom client form link field in Zoho CRM.
     */
    updateClientFormLink: async (
      crmId: string,
      module: "Contacts" | "Leads" | "Debida_Diligencia",
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
     * Creates an activity note in Zoho CRM associated with a Contact, Lead or Debida_Diligencia.
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

        // Determine if it is under Contacts, Leads or Debida_Diligencia
        let resolvedModule: "Contacts" | "Leads" | "Debida_Diligencia" = "Contacts";
        try {
          const contactInfo = await zoho.service.getContact(crmId);
          resolvedModule = contactInfo.module || "Contacts";
        } catch (e) {
          console.warn(`[Zoho Note] No se pudo determinar el módulo para ID ${crmId}, asumiendo Contacts:`, e);
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
  },
};

/**
 * Maps the complete portal form state structure into standard and potential custom Zoho CRM fields.
 */
export function mapFormToCrmPayload(clientType: "NATURAL" | "JURIDICA", formData: any): any {
  const payload: any = {
    "Estado": "Completado",
    "Fecha_de_Ingreso": new Date().toISOString().split("T")[0],
    "Tipo_de_Persona": clientType === "NATURAL" ? "Persona Natural" : "Persona Jurídica",
    "Estado_del_enlace": "Expirado / Revocado",
  };

  // Mapear Proyecto si está definido
  const project = formData.nombreProyecto || formData.projectName || "";
  if (project) {
    payload["Proyecto"] = project;
  }

  if (clientType === "NATURAL") {
    const fullName = `${formData.firstName || ""} ${formData.lastName || ""}`.trim();
    payload["Name"] = fullName || "Expediente Natural";
    
    if (formData.idNumber) payload["RUC_NIT"] = formData.idNumber;
    if (formData.email) payload["Email"] = formData.email;
    if (formData.celular || formData.telefono) payload["Tel_fono"] = formData.celular || formData.telefono;
    if (formData.profession) payload["Actividad_Principal"] = formData.profession;
    if (formData.paisResidencial) payload["Pa_s"] = formData.paisResidencial;
    if (formData.provinciaEstado) payload["Provincia"] = formData.provinciaEstado;
    if (formData.ciudad) payload["Ciudad"] = formData.ciudad;
    if (formData.direccionResidencial) payload["Direccion_Calle"] = formData.direccionResidencial;
    
    if (formData.fuenteFondosInmueble || formData.origenFondos) {
      payload["Origen_de_Fondos"] = formData.fuenteFondosInmueble || formData.origenFondos;
    }
    if (formData.medioPago) payload["Medio_de_Pago"] = formData.medioPago;
    if (formData.propositoInmueble) payload["Prop_sito_del_inmueble"] = formData.propositoInmueble;
    if (formData.ingresosMensuales) payload["Monto_anual_estimado"] = formData.ingresosMensuales;
    payload["A_nombre_de_otro"] = !!formData.terceroNombre;
  } else {
    payload["Name"] = formData.razonSocial || "Expediente Jurídico";
    if (formData.razonSocial) payload["Raz_n_social"] = formData.razonSocial;
    if (formData.numeroDocumento) payload["RUC_NIT"] = formData.numeroDocumento;
    if (formData.fechaConstitucion) payload["Fecha_de_constituci_n"] = formData.fechaConstitucion;
    
    if (formData.empresaDireccion) payload["Direccion_Calle"] = formData.empresaDireccion;
    if (formData.empresaCiudad) payload["Ciudad"] = formData.empresaCiudad;
    if (formData.empresaProvincia) payload["Provincia"] = formData.empresaProvincia;
    if (formData.empresaPais) payload["Pa_s"] = formData.empresaPais;
    
    if (formData.empresaTelefono) payload["Tel_fono"] = formData.empresaTelefono;
    if (formData.empresaEmail) {
      payload["Email"] = formData.empresaEmail;
      payload["Email_corporativo"] = formData.empresaEmail;
    }
    
    if (formData.empresaActividad || formData.actividadPrincipal) {
      payload["Actividad_Principal"] = formData.empresaActividad || formData.actividadPrincipal;
    }
    if (formData.medioPago) payload["Medio_de_Pago"] = formData.medioPago;
    if (formData.origenFondos) payload["Origen_de_Fondos"] = formData.origenFondos;
    if (formData.propositoInmueble) payload["Prop_sito_del_inmueble"] = formData.propositoInmueble;
    if (formData.ingresosMensuales || formData.montoAnualEstimado) {
      payload["Monto_anual_estimado"] = formData.ingresosMensuales || formData.montoAnualEstimado;
    }

    // Subformulario: Beneficiarios Finales
    const bfMembers = formData.bfMembers || [];
    payload["Beneficiario_Finales"] = bfMembers.map((m: any) => ({
      "Nombre_completo": m.name || m.nombreCompleto || "",
      "No_Identificaci_n": m.idNumber || m.noIdentificacion || "",
      "Nacionalidad": m.nationality || m.nacionalidad || "",
      "Participaci_n": parseFloat(String(m.percentage || m.porcentajeParticipacion || 0)),
      "Pais_nac_Residencia": m.country || m.paisNacimiento || "",
    }));

    // Subformulario: Gobierno Corporativo / Junta Directiva
    const gjcMembers = formData.gjcMembers || [];
    payload["Gobierno_Coporativo_Junta_Directiva"] = gjcMembers.map((m: any) => ({
      "Nombre_y_apellido": `${m.nombre || ""} ${m.apellidos || ""}`.trim(),
      "Cargo": m.cargo || "",
      "Nacionalidad": m.nacionalidad || "",
      "Fecha_de_nacimiento": m.fechaNacimiento || null,
      "No_Identificaci_n": m.nroId || "",
    }));
  }

  return payload;
}
