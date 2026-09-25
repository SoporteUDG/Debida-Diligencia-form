import { vi, describe, it, expect } from "vitest";
import { mergeCrmAndDraft, zoho, mapFormToCrmPayload } from "../zohoService";

describe("ZohoService Unit Tests", () => {
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
    it("should map natural form to the Debida_Diligencia fields of the guide", () => {
      const naturalForm = {
        nombreProyecto: "Proyecto Marina",
        formaContacto: "Otros",
        formaContactoDetalle: "Feria",
        firstName: "Lucas",
        lastName: "Silva",
        email: "lucas@gmail.com",
        celularCodigo: "+507",
        celular: "6111-2222",
        idNumber: "8-999-9999",
        fechaNacimiento: "1990-04-05",
        profession: "Otros",
        profesionOtros: "Piloto",
        esPropietario: "Accionista",
        usaFondos: "Sí",
        pctDedicacionPrincipal: "80",
        ingresosMensuales: "1,500.50",
        medioPago: "Efectivo, Cheque",
        fuenteFondosInmueble: "Otros",
        ifOtroNombre: "Herencia",
        montoServiciosAnuales: "Sí",
        cantidadServiciosAnuales: "3",
        adquiereNombreTercero: "No",
        nombreTercero: "dato viejo",
        esPep: "No",
        pepNombre: "dato viejo",
        idFile: "id.pdf",
        hasEstadoCuenta: [],
      };

      const payload = mapFormToCrmPayload("NATURAL", naturalForm);

      expect(payload["Estado"]).toBe("Completado");
      expect(payload["Proyecto"]).toBe("Proyecto Marina");
      expect(payload["Forma_de_contacto"]).toBe("Feria");
      expect(payload["Nombre_natural"]).toBe("Lucas Silva");
      expect(payload["Email_corporativo"]).toBe("lucas@gmail.com");
      expect(payload["Celular"]).toBe("+507 6111-2222");
      expect(payload["Numero_Identificacion"]).toBe("8-999-9999");
      expect(payload["Fecha_de_nacimiento"]).toBe("1990-04-05");
      expect(payload["Profesi_n"]).toBe("Piloto");
      expect(payload["Patrimonio_en_la_empresa"]).toBe(true);
      expect(payload["Fondos_provienen_de_la_Empresa"]).toBe(true);
      expect(payload["Porcentaje_Actividad_principal"]).toBe(80);
      expect(payload["Promedio_mensual"]).toBe(1500.5);
      expect(payload["Medios_de_Pago"]).toEqual(["Efectivo", "Cheque"]);
      expect(payload["Fuente_de_Fondos"]).toBe("Herencia");
      expect(payload["Mas_unidades_inmobiliarias"]).toBe(true);
      expect(payload["Cantidad_inmuebles"]).toBe(3);
      expect(payload["A_nombre_de_otro"]).toBe(false);
      expect(payload).not.toHaveProperty("Nombre_de_Otro");
      expect(payload["Es_PEP"]).toBe(false);
      expect(payload).not.toHaveProperty("PEP_nombre");
      expect(payload["Identificaci_n_Personal"]).toBe(true);
      expect(payload["Movimientos_Bancarios_6_Meses"]).toBe(false);
      // Campos que no se envían desde el formulario
      expect(payload).not.toHaveProperty("Name");
      expect(payload).not.toHaveProperty("Tipo_de_Persona");
      expect(payload).not.toHaveProperty("Email");
    });

    it("should map juridical form to the Debida_Diligencia fields of the guide", () => {
      const juridicaForm = {
        nombreProyecto: "Proyecto Pacific",
        razonSocial: "Desarrollo Global S.A.",
        numeroDocumento: "123456-9-2026",
        tipoCliente: "Persona Jurídica Nacional",
        estadoSociedad: "Operativa",
        ifContacto: "Sí",
        contactoNombre: "Ana",
        contactoApellido: "Pérez",
        contactoCargo: "Gerente",
        empresaTelefonoCodigo: "+507",
        empresaTelefono: "300-1000",
        gjcMembers: [
          { id: "a", nombre: "Luis", apellidos: "Gómez", cargo: "Presidente", nacionalidad: "Panamá", fechaNacimiento: "1980-01-02", nroId: "8-1-1", direccion: "Calle 1" },
          { id: "vacio", nombre: "", apellidos: "", cargo: "", nacionalidad: "", fechaNacimiento: "", nroId: "", direccion: "" },
        ],
        bfMembers: [{ id: "b", nombreCompleto: "Eva", porcentajeParticipacion: "50", fechaAdquisicion: "2021-03-04" }],
        fuenteFondosInmueble: "Terceros",
        terceroNombre: "Juan",
        terceroVinculo: "Socio",
        personDocuments: [{ personType: "RL", personId: "rl", documentType: "copiaIdFile", fileName: "rl.pdf" }],
        pactoSocialFile: [""],
        certBancariaFile: "banco.pdf",
      };

      const payload = mapFormToCrmPayload("JURIDICA", juridicaForm);

      expect(payload["Estado"]).toBe("Completado");
      expect(payload["Raz_n_social"]).toBe("Desarrollo Global S.A.");
      expect(payload["RUC_NIT"]).toBe("123456-9-2026");
      expect(payload["Tipo_de_Cliente"]).toBe("Persona Jurídica Nacional");
      expect(payload["Estado_sociedad"]).toBe("Operativa");
      expect(payload["Ocupa_cargo"]).toBe(true);
      expect(payload["Nombre_contacto"]).toBe("Ana Pérez");
      expect(payload["Cargo_de_contacto"]).toBe("Gerente");
      expect(payload["Tel_fono"]).toBe("+507 300-1000");
      expect(payload["Gobierno_Coporativo_Junta_Directiva"]).toEqual([
        { Nombre_y_apellido: "Luis Gómez", Cargo: "Presidente", Nacionalidad: "Panamá", Fecha_de_nacimiento: "1980-01-02", No_Identificaci_n: "8-1-1", Direcci_n: "Calle 1" },
      ]);
      expect(payload["Beneficiario_Finales"][0]).toMatchObject({ Nombre_completo: "Eva", Participaci_n: 50, Fecha_de_BF: "2021-03-04" });
      expect(payload["Tercero_Aportante_Nombre"]).toBe("Juan");
      expect(payload["Tercero_Aportante_Relaci_n"]).toBe("Socio");
      expect(payload["C_dula_de_Representante_Legal"]).toBe(true);
      expect(payload["Carta_de_Junta_Directiva"]).toBe(false);
      expect(payload["Pacto_Social"]).toBe(false);
      expect(payload["Certificado_Bancario"]).toBe(true);
      expect(payload).not.toHaveProperty("Name");
      expect(payload).not.toHaveProperty("Email");
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
