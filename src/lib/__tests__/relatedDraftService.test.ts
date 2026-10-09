import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ default: {} }));

import { calcularAutocompletado } from "../relatedDraftService";

describe("calcularAutocompletado", () => {
  const natural = {
    nombreProyecto: "Altos del Parque",
    formaContacto: "Referido",
    referidoPor: "Ana",
    firstName: "Carlos",
    lastName: "Gómez",
    idNumber: "8-888-8888",
    estadoCivil: "Casado",
    nationality: "Panamá",
    fechaNacimiento: "1980-05-01",
    profession: "Otros",
    profesionOtros: "Piloto",
    actEconPrincipal: "Asalariado",
    paisResidenciaFiscal: "Panamá",
    // Campo eliminado de la natural: un borrador antiguo puede traerlo, no se copia
    idTributaria: "123",
    direccionResidencial: "Calle 50",
    telefonoCodigo: "+1",
    telefono: "5551234",
    celularCodigo: "+507",
    celular: "66112233",
    email: "carlos@mail.com",
    ingresosMensuales: "5000",
    medioPago: "Efectivo, Cheque",
    fuenteFondosInmueble: "Propios, Otros",
    montoServiciosAnuales: "Sí",
    cantidadServiciosAnuales: "2",
    esPep: "Sí",
    pepNombre: "Carlos Gómez",
    pepRelacion: "Otro",
  };

  it("Natural -> Jurídica: maps the natural person onto the RL and translates values", () => {
    const cambios = calcularAutocompletado("NATURAL", natural, {
      empresaTelefonoCodigo: "+507",
      empresaTelefono: "",
    });

    expect(cambios.rlNombre).toBe("Carlos Gómez");
    expect(cambios.rlNoIdentificacion).toBe("8-888-8888");
    expect(cambios.rlProfesionOcupacion).toBe("Piloto");
    expect(cambios.rlActividadEconomica).toBe("Asalariado");
    // La ID tributaria es solo de la jurídica: no sale de la natural
    expect(cambios.numeroIdTributaria).toBeUndefined();
    expect(cambios.empresaTelefonoCodigo).toBe("+1");
    expect(cambios.empresaTelefono).toBe("5551234");
    expect(cambios.fuenteFondosInmueble).toBe("Recursos propios");
    expect(cambios.adquiereMasUnidades).toBe("Sí");
    expect(cambios.cantidadUnidadesInmobiliarias).toBe("2");
    expect(cambios.pepRelacion).toBe("Otros");
    expect(cambios.formaContacto).toBe("Referido");
    expect(cambios.referidoPor).toBe("Ana");
  });

  it("never overwrites fields the related client already filled", () => {
    const cambios = calcularAutocompletado("NATURAL", natural, {
      rlNombre: "Otro Nombre",
      empresaTelefono: "2223344",
      esPep: "No",
      nombreProyecto: "Otro Proyecto",
    });

    expect(cambios.rlNombre).toBeUndefined();
    expect(cambios.empresaTelefono).toBeUndefined();
    expect(cambios.empresaTelefonoCodigo).toBeUndefined();
    expect(cambios.esPep).toBeUndefined();
    expect(cambios.pepNombre).toBeUndefined();
    expect(cambios.nombreProyecto).toBeUndefined();
  });

  it("Jurídica -> Natural: splits the RL name and uses 'Otros' for values outside the list", () => {
    const cambios = calcularAutocompletado(
      "JURIDICA",
      {
        rlNombre: "María José Pérez Ruiz",
        numeroIdTributaria: "155-1-2026",
        rlProfesionOcupacion: "Abogado",
        rlActividadEconomica: "Comercio al por mayor",
        fuenteFondosInmueble: "Ambos",
        adquiereMasUnidades: "Si",
        formaContacto: "Redes Sociales",
        pepRelacion: "Representante Legal",
        esPep: "Sí",
      },
      { celularCodigo: "+507" }
    );

    expect(cambios.firstName).toBe("María José");
    expect(cambios.lastName).toBe("Pérez Ruiz");
    expect(cambios.profession).toBe("Abogado");
    expect(cambios.profesionOtros).toBeUndefined();
    expect(cambios.actEconPrincipal).toBe("Otros");
    expect(cambios.otroActEcon).toBe("Comercio al por mayor");
    expect(cambios.fuenteFondosInmueble).toBe("Propios, Financiamiento");
    expect(cambios.montoServiciosAnuales).toBe("Sí");
    // Sin equivalente en el formulario Natural
    expect(cambios.formaContacto).toBeUndefined();
    expect(cambios.pepRelacion).toBeUndefined();
    expect(cambios.esPep).toBe("Sí");
    // La natural no tiene ID tributaria: su documento es idNumber (del RL)
    expect(cambios).not.toHaveProperty("idTributaria");
  });
});
