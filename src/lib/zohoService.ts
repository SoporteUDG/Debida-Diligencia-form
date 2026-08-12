import { executeWithRetry } from "./zohoAuthService";

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
  rlNombre?: string;
  rlNoIdentificacion?: string;
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
    const idNumber = findValue(record, ["Identificacion", "Cedula", "Cédula", "N_Identificacion", "RUC", "Ruc"]);

    return {
      type,
      nombreProyecto,
      firstName,
      lastName,
      email,
      celular: phone,
      idNumber,
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
    ]);

    // Split representative names or find representative fields
    const rlNombre = findValue(record, [
      "Representante_Legal",
      "rlNombre",
      "Nombre_Representante",
      "Legal_Representative",
    ]);

    const rlNoIdentificacion = findValue(record, [
      "Cedula_Representante",
      "rlNoIdentificacion",
      "ID_Representante",
    ]);

    // Use contact name as form contact person
    const contactFirstName = findValue(record, ["First_Name", "Nombre", "Nombres", "FirstName"]);
    const contactLastName = findValue(record, ["Last_Name", "Apellido", "Apellidos", "LastName"]);

    return {
      type,
      nombreProyecto,
      razonSocial,
      numeroDocumento: ruc,
      contactoNombre: contactFirstName || "Representante",
      contactoApellido: contactLastName || "Comercial",
      contactoEmail: email,
      contactoTelefono: phone,
      rlNombre,
      rlNoIdentificacion,
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
          };
        }
      }

      // Query Zoho CRM modules (try Contacts first, then fall back to Leads)
      return executeWithRetry(async (accessToken) => {
        const crmBaseUrl = process.env.ZOHO_CRM_BASE_URL || "https://www.zohoapis.com/crm/v2";

        // 1. Try Contacts Module
        console.log(`[Zoho Service] Buscando contacto ${crmId} en módulo Contacts...`);
        let response = await fetch(`${crmBaseUrl}/Contacts/${crmId}`, {
          method: "GET",
          headers: {
            Authorization: `Zoho-oauthtoken ${accessToken}`,
          },
        });

        if (response.ok) {
          const resJson = await response.json();
          if (resJson.data && resJson.data.length > 0) {
            console.log(`[Zoho Service] Contacto ${crmId} encontrado.`);
            return mapCrmRecord(resJson.data[0], "Contacts");
          }
        }

        // 2. Fallback to Leads Module
        console.log(`[Zoho Service] Contacto no encontrado en Contacts. Buscando en módulo Leads...`);
        response = await fetch(`${crmBaseUrl}/Leads/${crmId}`, {
          method: "GET",
          headers: {
            Authorization: `Zoho-oauthtoken ${accessToken}`,
          },
        });

        if (response.ok) {
          const resJson = await response.json();
          if (resJson.data && resJson.data.length > 0) {
            console.log(`[Zoho Service] Lead ${crmId} encontrado.`);
            return mapCrmRecord(resJson.data[0], "Leads");
          }
        }

        throw new Error(`No se pudo encontrar ningún Contacto o Lead con el ID de CRM: ${crmId}`);
      });
    },

    /**
     * Updates an existing Zoho Contact or Lead with the full mapped client form data.
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
        const tryUpdateInModule = async (module: "Contacts" | "Leads") => {
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
            // If the record was not found or invalid id, we returns notFound so we can try fallback module
            if (code === "INVALID_DATA" || code === "NOT_FOUND" || result.message?.toLowerCase().includes("record not found") || result.message?.toLowerCase().includes("invalid id")) {
              return { success: false, notFound: true, details: result };
            }
            throw new Error(`Zoho CRM Error [${code}]: ${result.message} - details: ${JSON.stringify(result.details)}`);
          }

          if (result.status !== "success" || result.code !== "SUCCESS") {
            throw new Error(`Zoho CRM Sincronización Parcial/Warning [${result.code}]: ${result.message} - details: ${JSON.stringify(result.details)}`);
          }

          return { success: true, notFound: false };
        };

        // 1. Try updating in Contacts
        let updateRes = await tryUpdateInModule("Contacts");
        if (updateRes.success) {
          console.log(`[Zoho Service] Registro ${crmId} actualizado exitosamente en módulo Contacts.`);
          return { success: true, crmId };
        }

        // 2. If not found, try updating in Leads
        if (updateRes.notFound) {
          console.log(`[Zoho Service] Registro no encontrado en Contacts. Intentando en Leads...`);
          updateRes = await tryUpdateInModule("Leads");
          if (updateRes.success) {
            console.log(`[Zoho Service] Registro ${crmId} actualizado exitosamente en módulo Leads.`);
            return { success: true, crmId };
          }
        }

        throw new Error(`No se pudo encontrar ni actualizar ningún Contacto o Lead con el ID de CRM: ${crmId}`);
      });
    },

    /**
     * Searches Contacts and Leads in Zoho CRM matching a text query.
     */
    searchContacts: async (
      query: string
    ): Promise<
      Array<{
        id: string;
        name: string;
        email: string;
        phone: string;
        module: "Contacts" | "Leads";
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
        clientSecret === "placeholder_client_secret" ||
        !refreshToken ||
        refreshToken === "placeholder_refresh_token";

      if (isPlaceholder) {
        console.log(`[Zoho Service] Búsqueda simulada activa para query: "${query}"`);
        const mockResults = [
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
          {
            id: "mock-contact-natural-maria",
            name: "María Alejandra González",
            email: "maria.gonzalez@example.com",
            phone: "50769998888",
            module: "Contacts" as const,
            type: "NATURAL" as const,
            projectInterest: "Costa del Este Residence",
          },
          {
            id: "mock-lead-juridica-bolivar",
            name: "Inversiones Bolívar S.A.",
            email: "contacto@inversionesbolivar.com",
            phone: "5073004000",
            module: "Leads" as const,
            type: "JURIDICA" as const,
            projectInterest: "Alta Plaza Business Tower",
          },
          {
            id: "mock-contact-pep",
            name: "Carlos Alberto Vicepresidente",
            email: "carlos.vice@gob.pa",
            phone: "50761234567",
            module: "Contacts" as const,
            type: "NATURAL" as const,
            projectInterest: "Ocean Reef Phase 2",
          }
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
          module: "Contacts" | "Leads";
          type: "NATURAL" | "JURIDICA";
          projectInterest?: string;
        }> = [];

        // 1. Search in Contacts
        try {
          console.log(`[Zoho Service] Buscando "${query}" en módulo Contacts...`);
          const res = await fetch(`${crmBaseUrl}/Contacts/search?word=${encodeURIComponent(query)}`, {
            method: "GET",
            headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
          });
          if (res.ok) {
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

        // 2. Search in Leads
        try {
          console.log(`[Zoho Service] Buscando "${query}" en módulo Leads...`);
          const res = await fetch(`${crmBaseUrl}/Leads/search?word=${encodeURIComponent(query)}`, {
            method: "GET",
            headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
          });
          if (res.ok) {
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
      module: "Contacts" | "Leads",
      formLink: string
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
        console.log(`[Zoho Service] Simulación: Enlace "${formLink}" actualizado en CRM para el registro ${crmId}.`);
        return { success: true };
      }

      return executeWithRetry(async (accessToken) => {
        const crmBaseUrl = process.env.ZOHO_CRM_BASE_URL || "https://www.zohoapis.com/crm/v2";
        const payload = {
          data: [
            {
              id: crmId,
              Client_Form_Link: formLink,
              Enlace_Formulario: formLink,
              Enlace_Debida_Diligencia: formLink,
            }
          ]
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
          console.log(`[Zoho Service] Enlace de formulario actualizado en Zoho CRM (${module}) para ID ${crmId}.`);
          return { success: true };
        }

        const errText = await response.text();
        console.error(`[Zoho Service Error] No se pudo actualizar el enlace en Zoho CRM (${module}):`, errText);
        return { success: false, error: errText };
      });
    },
  },
};

/**
 * Maps the complete portal form state structure into standard and potential custom Zoho CRM fields.
 */
export function mapFormToCrmPayload(clientType: "NATURAL" | "JURIDICA", formData: any): any {
  const payload: any = {
    "Due_Diligence_Status": "Completado",
    "Form_Submission_Date": new Date().toISOString().split("T")[0],
  };

  const project = formData.nombreProyecto || formData.projectName || "";
  if (project) {
    payload["Project_Interest"] = project;
    payload["Proyecto"] = project;
    payload["Proyecto_de_Interes"] = project;
  }

  if (clientType === "NATURAL") {
    if (formData.firstName) payload["First_Name"] = formData.firstName;
    if (formData.lastName) payload["Last_Name"] = formData.lastName;
    if (formData.email) payload["Email"] = formData.email;
    if (formData.celular) payload["Mobile"] = formData.celular;
    if (formData.telefono) payload["Phone"] = formData.telefono;
    
    if (formData.paisNacimiento) payload["Country_of_Birth"] = formData.paisNacimiento;
    if (formData.nationality) payload["Nationality"] = formData.nationality;
    if (formData.idNumber) payload["Identificacion"] = formData.idNumber;
    if (formData.tipoIdentificacion) payload["ID_Type"] = formData.tipoIdentificacion;
    if (formData.fechaNacimiento) payload["Date_of_Birth"] = formData.fechaNacimiento;

    if (formData.direccionResidencial) payload["Mailing_Street"] = formData.direccionResidencial;
    if (formData.ciudad) payload["Mailing_City"] = formData.ciudad;
    if (formData.provinciaEstado) payload["Mailing_State"] = formData.provinciaEstado;
    if (formData.paisResidencial) payload["Mailing_Country"] = formData.paisResidencial;

    if (formData.profession) payload["Profession"] = formData.profession;
    if (formData.employer) payload["Employer"] = formData.employer;
    if (formData.ingresosMensuales) payload["Monthly_Income"] = formData.ingresosMensuales;
    if (formData.medioPago) payload["Payment_Method"] = formData.medioPago;
    if (formData.fuenteFondosInmueble) payload["Source_of_Funds"] = formData.fuenteFondosInmueble;
    if (formData.esPep) payload["PEP_Status"] = formData.esPep;
  } else {
    if (formData.razonSocial) {
      payload["Company"] = formData.razonSocial;
      payload["Razon_Social"] = formData.razonSocial;
      payload["Account_Name"] = formData.razonSocial;
    }
    if (formData.numeroDocumento) {
      payload["RUC"] = formData.numeroDocumento;
      payload["Identificacion_Empresa"] = formData.numeroDocumento;
    }
    if (formData.fechaConstitucion) {
      payload["Constituent_Date"] = formData.fechaConstitucion;
      payload["Constitucion"] = formData.fechaConstitucion;
    }

    if (formData.empresaDireccion) payload["Billing_Street"] = formData.empresaDireccion;
    if (formData.empresaCiudad) payload["Billing_City"] = formData.empresaCiudad;
    if (formData.empresaProvincia) payload["Billing_State"] = formData.empresaProvincia;
    if (formData.empresaPais) payload["Billing_Country"] = formData.empresaPais;

    if (formData.empresaTelefono) payload["Phone"] = formData.empresaTelefono;
    if (formData.empresaEmail) payload["Email"] = formData.empresaEmail;

    if (formData.rlNombre) payload["Representante_Legal"] = formData.rlNombre;
    if (formData.rlNoIdentificacion) payload["Cedula_Representante"] = formData.rlNoIdentificacion;

    if (formData.contactoNombre) payload["First_Name"] = formData.contactoNombre;
    if (formData.contactoApellido) payload["Last_Name"] = formData.contactoApellido;
    if (formData.contactoEmail) payload["Email"] = formData.contactoEmail;
    if (formData.contactoTelefono) payload["Mobile"] = formData.contactoTelefono;
  }

  return payload;
}
