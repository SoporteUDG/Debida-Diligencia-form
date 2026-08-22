import { vi, describe, it, expect } from "vitest";
import { mapCrmRecord, mergeCrmAndDraft, zoho, mapFormToCrmPayload } from "../zohoService";

describe("ZohoService Unit Tests", () => {
  describe("mapCrmRecord", () => {
    it("should map raw Zoho CRM Contact fields to NATURAL client model", () => {
      const mockContact = {
        Client_Type: "Natural Person",
        Project_Interest: "Ocean Reef Phase 2",
        First_Name: "María",
        Last_Name: "González",
        Email: "maria.gonzalez@example.com",
        Mobile: "50769998888",
        Identificacion: "PE-123456",
      };

      const mapped = mapCrmRecord(mockContact, "Contacts");

      expect(mapped).toEqual({
        type: "NATURAL",
        nombreProyecto: "Ocean Reef Phase 2",
        firstName: "María",
        lastName: "González",
        email: "maria.gonzalez@example.com",
        celular: "50769998888",
        idNumber: "PE-123456",
        module: "Contacts",
      });
    });

    it("should map raw Zoho CRM Lead fields to JURIDICA client model when company fields are detected", () => {
      const mockLead = {
        Tipo_Cliente: "Corporativo",
        Proyecto: "Alta Plaza Business Tower",
        Company: "Mock Corp S.A.",
        RUC: "8-888-8888 DV 99",
        First_Name: "Jorge",
        Last_Name: "Ramírez",
        Email: "jorge.ramirez@example.com",
        Phone: "5073004000",
        Representante_Legal: "Jorge Ramírez",
        Cedula_Representante: "8-111-1111",
      };

      const mapped = mapCrmRecord(mockLead, "Leads");

      expect(mapped).toEqual({
        type: "JURIDICA",
        nombreProyecto: "Alta Plaza Business Tower",
        razonSocial: "Mock Corp S.A.",
        numeroDocumento: "8-888-8888 DV 99",
        contactoNombre: "Jorge",
        contactoApellido: "Ramírez",
        contactoEmail: "jorge.ramirez@example.com",
        contactoTelefono: "5073004000",
        rlNombre: "Jorge Ramírez",
        rlNoIdentificacion: "8-111-1111",
        module: "Leads",
      });
    });
  });

  describe("mergeCrmAndDraft", () => {
    it("should populate empty draft fields with CRM data", () => {
      const crmData = {
        type: "NATURAL" as const,
        nombreProyecto: "Proyecto Coral",
        firstName: "José",
        lastName: "Herrera",
        email: "jose@crm.com",
        celular: "66112233",
      };

      const draftData = {
        firstName: "", // Empty string
        lastName: "Herrera Editado", // Already filled
        email: undefined, // Undefined
        // celular is missing
      };

      const merged = mergeCrmAndDraft(crmData, draftData);

      expect(merged).toEqual({
        nombreProyecto: "Proyecto Coral",
        firstName: "José", // Preloaded because it was empty string
        lastName: "Herrera Editado", // Preserved client edits
        email: "jose@crm.com", // Preloaded because it was undefined
        celular: "66112233", // Preloaded because it was missing
      });
    });

    it("should not overwrite non-empty draft values with CRM data", () => {
      const crmData = {
        nombreProyecto: "Proyecto Coral",
        firstName: "José",
      };

      const draftData = {
        nombreProyecto: "Proyecto Editado por Cliente",
        firstName: "José Modificado",
      };

      const merged = mergeCrmAndDraft(crmData, draftData);

      expect(merged.nombreProyecto).toBe("Proyecto Editado por Cliente");
      expect(merged.firstName).toBe("José Modificado");
    });
  });

  describe("zoho.service.getContact", () => {
    it("should return simulated data in placeholder/development mode", async () => {
      const result = await zoho.service.getContact("mock-natural-id");
      expect(result.type).toBe("NATURAL");
      expect(result.firstName).toBe("Juan");
      expect(result.email).toBe("juan.perez.mock@gmail.com");

      const resultJur = await zoho.service.getContact("mock-juridica-id");
      expect(resultJur.type).toBe("JURIDICA");
      expect(resultJur.razonSocial).toBe("Inversiones Tecnológicas S.A.");
    });
  });

  describe("mapFormToCrmPayload", () => {
    it("should map natural form to CRM payload correctly", () => {
      const naturalForm = {
        nombreProyecto: "Proyecto Marina",
        firstName: "Lucas",
        lastName: "Silva",
        email: "lucas@gmail.com",
        celular: "50761112222",
        idNumber: "8-999-9999",
        profession: "Ingeniero",
      };

      const payload = mapFormToCrmPayload("NATURAL", naturalForm);
      
      expect(payload["Estado"]).toBe("Completado");
      expect(payload["Proyecto"]).toBe("Proyecto Marina");
      expect(payload["Name"]).toBe("Lucas Silva");
      expect(payload["Email"]).toBe("lucas@gmail.com");
      expect(payload["Tel_fono"]).toBe("50761112222");
      expect(payload["RUC_NIT"]).toBe("8-999-9999");
      expect(payload["Actividad_Principal"]).toBe("Ingeniero");
    });

    it("should map juridical form to CRM payload correctly", () => {
      const juridicaForm = {
        nombreProyecto: "Proyecto Pacific",
        razonSocial: "Desarrollo Global S.A.",
        numeroDocumento: "123456-9-2026",
      };

      const payload = mapFormToCrmPayload("JURIDICA", juridicaForm);

      expect(payload["Estado"]).toBe("Completado");
      expect(payload["Name"]).toBe("Desarrollo Global S.A.");
      expect(payload["Raz_n_social"]).toBe("Desarrollo Global S.A.");
      expect(payload["RUC_NIT"]).toBe("123456-9-2026");
    });
  });

  describe("zoho.service.updateContact", () => {
    it("should return success in placeholder mode", async () => {
      const result = await zoho.service.updateContact("mock-contact-123", "NATURAL", {});
      expect(result.success).toBe(true);
      expect(result.mocked).toBe(true);
    });
  });
});
