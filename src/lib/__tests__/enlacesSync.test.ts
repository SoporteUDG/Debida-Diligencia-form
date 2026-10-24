import { vi, describe, it, expect, beforeEach } from "vitest";

const { prismaMock, zohoMock } = vi.hoisted(() => ({
  prismaMock: {
    form: { findUnique: vi.fn() },
    crmSync: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
  zohoMock: {
    service: {
      updateContact: vi.fn(),
      updateAccountContact: vi.fn(),
      updateDDFields: vi.fn(),
      createNote: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("../auditService", () => ({ logAuditEvent: vi.fn() }));
vi.mock("@/lib/auditService", () => ({ logAuditEvent: vi.fn() }));
// Mapeos reales; solo las llamadas a Zoho son simuladas
vi.mock("../zohoService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../zohoService")>()),
  zoho: zohoMock,
}));

import { syncFormToCrm } from "../crmSyncService";
import { mapFormToCrmPayload, mapFormToContactPayload, mapRepresentanteToDDPayload } from "../zohoService";

/** Formulario natural lleno (todas las secciones con valor). */
const natural = {
  firstName: "Luis", lastName: "Mora", paisNacimiento: "Panamá", nationality: "Panameña", otraNacionalidad: "Española",
  tipoIdentificacion: "Cédula", idNumber: "8-123-456", fechaVencimientoId: "2030-01-01", fechaNacimiento: "1990-05-05",
  estadoCivil: "Soltero", estatusMigratorio: "Residente", paisResidenciaFiscal: "Panamá",
  direccionResidencial: "Calle 50", ciudad: "Panamá", provinciaEstado: "Panamá", paisResidencial: "Panamá",
  telefonoCodigo: "+507", telefono: "2223333", celularCodigo: "+507", celular: "66667777", email: "l@x.com",
  profession: "Ingeniero", paisActividadLaboral: "Panamá", employer: "ACME", actividadLaboral: "Construcción",
  direccionLaboral: "Calle 1", cargoDesempena: "Gerente", esPropietario: "Accionista", usaFondos: "si",
  actEconPrincipal: "Comercio", pctDedicacionPrincipal: "80", jurisdiccionPrincipal: "Panamá",
  ingresosMensuales: "5000", medioPago: ["Transferencia"], fuenteFondosInmueble: "Ahorros",
  esPep: "si", pepNombre: "X", pepCargo: "Y", pepInstitucion: "Z", pepRelacion: "Propio",
  nombreProyecto: "Torre", formaContacto: "Web",
};

describe("Campos que escribe cada formulario", () => {
  it("Representante Legal: solo sus campos exclusivos, ninguno compartido con Persona Natural", () => {
    const rl = mapRepresentanteToDDPayload(natural);
    expect(rl).toEqual({ Direccion_Representante: "Calle 50", Telefono_Representante: "+507 2223333" });
    const camposNatural = new Set(Object.keys(mapFormToCrmPayload("NATURAL", natural)));
    for (const campo of Object.keys(rl)) expect(camposNatural.has(campo)).toBe(false);
    // Nada de estado / enlace / fecha de ingreso
    expect(rl).not.toHaveProperty("Estado_del_enlace");
    expect(rl).not.toHaveProperty("Fecha_de_Ingreso");
  });

  it("Representante Legal sin teléfono fijo usa el celular; sin datos no escribe nada", () => {
    expect(mapRepresentanteToDDPayload({ celularCodigo: "+507", celular: "66667777" })).toEqual({ Telefono_Representante: "+507 66667777" });
    expect(mapRepresentanteToDDPayload({})).toEqual({});
  });

  it("Contact natural: exactamente los campos 'Zoho Contactos' de la guía", () => {
    expect(Object.keys(mapFormToContactPayload("NATURAL", natural)).sort()).toEqual(
      ["First_Name", "Last_Name", "Pais_de_Nacimiento_2", "Nacionalidad_2", "Otra_Nacionalidad", "C_I_P_Pasaporte", "Fecha_de_Expiraci_n_CIP", "Fecha_Nacimiento", "Celular", "Mobile", "Phone"].sort()
    );
  });
});

describe("syncFormToCrm según el rol del enlace", () => {
  const form = (extra: any) => ({
    id: "f1",
    type: "NATURAL",
    data: natural,
    projectName: "Torre",
    isAditional: false,
    role: "PRINCIPAL",
    accountContactId: null,
    accountContact: null,
    documents: [],
    crmContact: { id: "cc1", crmId: "dd1", accountContact: { crmId: "zc-std" } },
    ...extra,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(process.env, { ZOHO_CLIENT_ID: "id", ZOHO_CLIENT_SECRET: "secret", ZOHO_REFRESH_TOKEN: "refresh" });
    prismaMock.crmSync.findUnique.mockResolvedValue(null);
    prismaMock.crmSync.create.mockResolvedValue({ status: "PENDING" });
    zohoMock.service.updateContact.mockResolvedValue({ success: true });
    zohoMock.service.updateAccountContact.mockResolvedValue({ success: true });
    zohoMock.service.updateDDFields.mockResolvedValue({ success: true });
  });

  it("PRINCIPAL natural: escribe el expediente y el Contact estándar", async () => {
    prismaMock.form.findUnique.mockResolvedValue(form({}));
    await syncFormToCrm("f1");
    expect(zohoMock.service.updateContact).toHaveBeenCalledWith("dd1", "NATURAL", natural, expect.objectContaining({ contactCrmId: "zc-std" }));
    expect(zohoMock.service.updateAccountContact).not.toHaveBeenCalled();
    expect(zohoMock.service.updateDDFields).not.toHaveBeenCalled();
  });

  it("RELATED con contacto: solo su Contact, nunca el expediente", async () => {
    prismaMock.form.findUnique.mockResolvedValue(
      form({ isAditional: true, role: "RELATED", accountContactId: "ac2", accountContact: { crmId: "zc2", firstName: "Luis", lastName: "Mora" } })
    );
    const r = await syncFormToCrm("f1");
    expect(r.success).toBe(true);
    expect(zohoMock.service.updateAccountContact).toHaveBeenCalledWith("zc2", "NATURAL", natural);
    expect(zohoMock.service.updateContact).not.toHaveBeenCalled();
    expect(zohoMock.service.updateDDFields).not.toHaveBeenCalled();
    expect(prismaMock.crmSync.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "SUCCESS", crmId: "zc2" }) }));
    // La nota (solo texto) queda en el expediente
    expect(zohoMock.service.createNote.mock.calls[0][0]).toBe("dd1");
  });

  it("RELATED sin contacto (Representante Legal): solo sus campos exclusivos del expediente jurídico, ningún Contact", async () => {
    prismaMock.form.findUnique.mockResolvedValue(
      form({ isAditional: true, role: "RELATED", crmContact: { id: "cc1", crmId: "jur1", accountContact: null } })
    );
    await syncFormToCrm("f1");
    expect(zohoMock.service.updateDDFields).toHaveBeenCalledWith("jur1", { Direccion_Representante: "Calle 50", Telefono_Representante: "+507 2223333" });
    expect(zohoMock.service.updateContact).not.toHaveBeenCalled();
    expect(zohoMock.service.updateAccountContact).not.toHaveBeenCalled();
  });

  it("PRINCIPAL jurídica sin contacto vinculado: no envía nada a un Contact", async () => {
    prismaMock.form.findUnique.mockResolvedValue(
      form({ type: "JURIDICA", data: { razonSocial: "ACME" }, crmContact: { id: "cc1", crmId: "jur1", accountContact: null } })
    );
    await syncFormToCrm("f1");
    expect(zohoMock.service.updateContact).toHaveBeenCalledWith("jur1", "JURIDICA", { razonSocial: "ACME" }, expect.objectContaining({ contactCrmId: undefined }));
    expect(zohoMock.service.updateAccountContact).not.toHaveBeenCalled();
  });

  it("ADITIONAL: no se sincroniza con Zoho", async () => {
    prismaMock.form.findUnique.mockResolvedValue(form({ isAditional: true, role: "ADITIONAL" }));
    const r = await syncFormToCrm("f1");
    expect(r).toMatchObject({ success: true, skipped: true });
    expect(zohoMock.service.updateContact).not.toHaveBeenCalled();
    expect(zohoMock.service.updateAccountContact).not.toHaveBeenCalled();
    expect(zohoMock.service.updateDDFields).not.toHaveBeenCalled();
  });
});
