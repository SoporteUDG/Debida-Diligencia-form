import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/zohoAuthService", () => ({ getAccessToken: vi.fn(async () => "tok") }));
vi.mock("../zohoAuthService", () => ({ getAccessToken: vi.fn(async () => "tok") }));
vi.mock("../zohoService", () => ({
  zoho: {
    service: {
      getSocioDocumentsLink: vi.fn(async () => ({
        ddName: "Juan Perez",
        socioId: "s1",
        linkDocumentos: `https://workdrive.zoho.com/folder/${SOCIO}`,
      })),
    },
  },
}));

import {
  getOrCreateFolderStructure,
  localizarCarpetaExpediente,
  getOrCreateCarpetaEliminados,
} from "../workdriveService";

const SOCIO = "socio0000000000000000001";

/** WorkDrive en memoria: carpetas { id -> { name, parent } } detrás de fetch. */
let carpetas: Map<string, { name: string; parent: string }>;
let escrituras: Array<{ method: string; id?: string; body: any }>;
let n = 0;

const crear = (name: string, parent: string) => {
  const id = `f${String(++n).padStart(22, "0")}`;
  carpetas.set(id, { name, parent });
  return id;
};
const hijos = (parent: string) => [...carpetas.entries()].filter(([, c]) => c.parent === parent).map(([id, c]) => ({ id, ...c }));
const nombresEn = (parent: string) => hijos(parent).map((c) => c.name).sort();
const idDe = (name: string, parent: string) => hijos(parent).find((c) => c.name === name)?.id;

const respuesta = (body: any) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });

beforeEach(() => {
  carpetas = new Map();
  escrituras = [];
  n = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: any = {}) => {
    const u = new URL(url);
    const partes = u.pathname.split("/").filter(Boolean); // workdrive api v1 files ...
    const i = partes.indexOf("files");
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body) : null;
    if (method === "GET" && partes[i + 2] === "files") {
      return respuesta({ data: hijos(partes[i + 1]).map((c) => ({ id: c.id, attributes: { name: c.name } })) });
    }
    if (method === "POST") {
      escrituras.push({ method, body });
      return respuesta({ data: { id: crear(body.data.attributes.name, body.data.attributes.parent_id) } });
    }
    if (method === "PATCH") {
      const id = partes[i + 1];
      escrituras.push({ method, id, body });
      const c = carpetas.get(id)!;
      const a = body.data.attributes;
      carpetas.set(id, { name: a.name ?? c.name, parent: a.parent_id ?? c.parent });
      return respuesta({ data: { id } });
    }
    throw new Error(`fetch inesperado ${method} ${url}`);
  }));
});

afterEach(() => vi.unstubAllGlobals());

const TOKEN = "abcdefgh-1111-2222-3333-444444444444";

describe("Estructura de carpetas en WorkDrive", () => {
  it("expediente nuevo: /DD/Principal-{TIPO}-{DD}", async () => {
    const r = await getOrCreateFolderStructure("dd1", "NATURAL", [], "tok");
    const dd = idDe("DD", SOCIO)!;
    expect(nombresEn(dd)).toEqual(["Principal-NATURAL-Juan Perez"]);
    expect(r.clientFolderId).toBe(idDe("Principal-NATURAL-Juan Perez", dd));
  });

  it.each([
    ["Relacionado", "Relacionado-NATURAL-Luis Mora (abcdefgh)"],
    ["Representante Legal", "Representante Legal-NATURAL-Luis Mora (abcdefgh)"],
    ["Adicional", "Adicional-NATURAL-Luis Mora (abcdefgh)"],
  ] as const)("enlace %s: su carpeta va AL LADO de la principal, con su rol en el nombre", async (rol, nombre) => {
    const r = await getOrCreateFolderStructure("dd1", "JURIDICA", [], "tok", { token: TOKEN, nombre: "Luis Mora", tipo: "NATURAL", rol });
    const dd = idDe("DD", SOCIO)!;
    expect(nombresEn(dd)).toEqual([nombre, "Principal-JURIDICA-Juan Perez"].sort());
    expect(r.clientFolderId).toBe(idDe(nombre, dd));
    expect(r.expedienteFolderId).toBe(idDe("Principal-JURIDICA-Juan Perez", dd));
    // Nada dentro de la principal
    expect(nombresEn(r.expedienteFolderId)).toEqual([]);
  });

  it("estructura anterior: renombra la principal y saca a /DD la carpeta del enlace que vivía dentro", async () => {
    const dd = crear("DD", SOCIO);
    const principal = crear("NATURAL-Juan Perez", dd);
    const anidada = crear("NATURAL-Luis Mora-Juan Perez (abcdefgh)", principal);
    crear("Cédula", anidada);

    const r = await getOrCreateFolderStructure("dd1", "NATURAL", [], "tok", { token: TOKEN, nombre: "Luis Mora", tipo: "NATURAL", rol: "Relacionado" });

    // Mismas carpetas (mismos IDs, con su contenido), nueva ubicación y nombre
    expect(r.expedienteFolderId).toBe(principal);
    expect(r.clientFolderId).toBe(anidada);
    expect(nombresEn(dd)).toEqual(["Principal-NATURAL-Juan Perez", "Relacionado-NATURAL-Luis Mora (abcdefgh)"]);
    expect(nombresEn(principal)).toEqual([]);
    expect(nombresEn(anidada)).toEqual(["Cédula"]);
    // No se creó ninguna carpeta nueva
    expect(escrituras.filter((e) => e.method === "POST")).toHaveLength(0);
  });

  it("localizarCarpetaExpediente solo lee: encuentra la estructura anterior sin mover ni renombrar", async () => {
    const dd = crear("DD", SOCIO);
    const principal = crear("NATURAL-Juan Perez", dd);
    const anidada = crear("NATURAL-Luis Mora-Juan Perez (abcdefgh)", principal);

    const sinToken = await localizarCarpetaExpediente("dd1", "NATURAL", "tok");
    expect(sinToken).toMatchObject({ ddFolderId: dd, clientFolderId: principal, expedienteFolderId: principal, parentFolderId: dd });

    const conToken = await localizarCarpetaExpediente("dd1", "NATURAL", "tok", TOKEN);
    expect(conToken).toMatchObject({ clientFolderId: anidada, expedienteFolderId: principal, parentFolderId: principal });
    expect(escrituras).toHaveLength(0);
  });

  it("localizarCarpetaExpediente encuentra el enlace en /DD (estructura nueva)", async () => {
    const dd = crear("DD", SOCIO);
    const principal = crear("Principal-NATURAL-Juan Perez", dd);
    const enlace = crear("Relacionado-NATURAL-Luis Mora (abcdefgh)", dd);
    const r = await localizarCarpetaExpediente("dd1", "NATURAL", "tok", TOKEN);
    expect(r).toMatchObject({ clientFolderId: enlace, expedienteFolderId: principal, parentFolderId: dd });
  });

  it("Eliminados: se crea si no existe", async () => {
    const dd = crear("DD", SOCIO);
    const id = await getOrCreateCarpetaEliminados(dd, "tok");
    expect(nombresEn(dd)).toEqual(["Eliminados"]);
    expect(id).toBe(idDe("Eliminados", dd));
  });

  it("Eliminados: una _Retirados existente se renombra (conserva su contenido)", async () => {
    const dd = crear("DD", SOCIO);
    const retirados = crear("_Retirados", dd);
    crear("NATURAL-Viejo", retirados);
    const id = await getOrCreateCarpetaEliminados(dd, "tok");
    expect(id).toBe(retirados);
    expect(nombresEn(dd)).toEqual(["Eliminados"]);
    expect(nombresEn(retirados)).toEqual(["NATURAL-Viejo"]);
  });
});
