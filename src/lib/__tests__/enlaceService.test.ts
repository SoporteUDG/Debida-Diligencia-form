import { vi, describe, it, expect, beforeEach } from "vitest";

const { prismaMock, zohoMock } = vi.hoisted(() => ({
  prismaMock: {
    draft: { upsert: vi.fn() },
  },
  zohoMock: {
    service: {
      getDDRecord: vi.fn(),
      getAccountContactRecord: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/tokenService", () => ({ generateToken: vi.fn(async () => "tok-uuid") }));
vi.mock("@/lib/zohoChangeService", () => ({ datosFormularioDesdeZoho: vi.fn(() => ({ desdeDD: "si" })) }));
vi.mock("@/lib/zohoService", () => ({
  zoho: zohoMock,
  contactRecordToFormData: vi.fn(() => ({ desdeContacto: "si" })),
}));

import { crearEnlaceConBorrador } from "../enlaceService";

const base = { contactId: "cc1", crmId: "dd1", isNatural: true, appUrl: "https://x", draftData: { nombreProyecto: "P" } };
const creado = () => prismaMock.draft.upsert.mock.calls[0][0].create;

beforeEach(() => {
  vi.clearAllMocks();
  zohoMock.service.getDDRecord.mockResolvedValue({ id: "dd1" });
  zohoMock.service.getAccountContactRecord.mockResolvedValue({ id: "zc1" });
});

describe("crearEnlaceConBorrador", () => {
  it("PRINCIPAL (por defecto): precarga del expediente y del Contact, no es adicional", async () => {
    const r = await crearEnlaceConBorrador({ ...base, contactCrmId: "zc1" });
    expect(r.clientUrl).toBe("https://x/persona-natural?token=tok-uuid");
    expect(creado()).toMatchObject({ role: "PRINCIPAL", isAditional: false, accountContactId: null });
    expect(creado().data).toMatchObject({ nombreProyecto: "P", desdeDD: "si", desdeContacto: "si" });
  });

  it("RELATED: solo se precarga desde su Contact (nunca desde el expediente) y queda como adicional", async () => {
    await crearEnlaceConBorrador({ ...base, role: "RELATED", contactCrmId: "zc2", accountContactId: "ac2" });
    expect(zohoMock.service.getDDRecord).not.toHaveBeenCalled();
    expect(zohoMock.service.getAccountContactRecord).toHaveBeenCalledWith("zc2");
    expect(creado()).toMatchObject({ role: "RELATED", isAditional: true, accountContactId: "ac2" });
    expect(creado().data).not.toHaveProperty("desdeDD");
    expect(creado().data).toMatchObject({ desdeContacto: "si" });
  });

  it("RELATED sin contacto (Representante Legal): sin precarga de Zoho", async () => {
    await crearEnlaceConBorrador({ ...base, role: "RELATED" });
    expect(zohoMock.service.getDDRecord).not.toHaveBeenCalled();
    expect(zohoMock.service.getAccountContactRecord).not.toHaveBeenCalled();
    expect(creado()).toMatchObject({ role: "RELATED", isAditional: true, accountContactId: null });
  });

  it("ADITIONAL (isAditional): sin precarga de Zoho", async () => {
    await crearEnlaceConBorrador({ ...base, isAditional: true, contactCrmId: "zc1", isNatural: false });
    expect(zohoMock.service.getDDRecord).not.toHaveBeenCalled();
    expect(zohoMock.service.getAccountContactRecord).not.toHaveBeenCalled();
    expect(creado()).toMatchObject({ role: "ADITIONAL", isAditional: true, type: "JURIDICA" });
  });
});
