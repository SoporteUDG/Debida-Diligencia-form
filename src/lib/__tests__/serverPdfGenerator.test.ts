import { describe, it, expect } from "vitest";
import { agruparDocumentos } from "../serverPdfGenerator";
import zlib from "zlib";
import { generateServerPDF } from "../serverPdfGenerator";

describe("agruparDocumentos", () => {
  it("lista TODOS los archivos de un campo multi-archivo", () => {
    const grupos = agruparDocumentos(
      [
        { name: "renta.pdf", fileType: "application/pdf", documentType: "origenFondosFile" },
        { name: "estados.pdf", fileType: "application/pdf", documentType: "origenFondosFile" },
        { name: "carta.pdf", fileType: "application/pdf", documentType: "origenFondosFile" },
      ],
      {}
    );

    expect(grupos).toHaveLength(1);
    expect(grupos[0].titulo).toBe("Origen de Fondos");
    expect(grupos[0].archivos).toEqual(["renta.pdf", "estados.pdf", "carta.pdf"]);
  });

  it("separa cada ranura documental en su propio grupo", () => {
    const grupos = agruparDocumentos(
      [
        { name: "a.pdf", fileType: "application/pdf", documentType: "origenFondosFile" },
        { name: "pacto.pdf", fileType: "application/pdf", documentType: "pactoSocialFile" },
        { name: "adenda.pdf", fileType: "application/pdf", documentType: "pactoSocialFile" },
      ],
      {}
    );

    const porTitulo = Object.fromEntries(grupos.map((g) => [g.titulo, g.archivos]));
    expect(porTitulo["Origen de Fondos"]).toEqual(["a.pdf"]);
    expect(porTitulo["Pacto Social y sus Adendas"]).toEqual(["pacto.pdf", "adenda.pdf"]);
  });

  it("recupera archivos del snapshot que no tienen fila Document", () => {
    const grupos = agruparDocumentos([], {
      origenFondosFile: ["solo_en_snapshot.pdf", "otro.pdf"],
      pactoSocialFile: "pacto_unico.pdf",
    });

    const porTitulo = Object.fromEntries(grupos.map((g) => [g.titulo, g.archivos]));
    expect(porTitulo["Origen de Fondos"]).toEqual(["solo_en_snapshot.pdf", "otro.pdf"]);
    expect(porTitulo["Pacto Social y sus Adendas"]).toEqual(["pacto_unico.pdf"]);
  });

  it("no duplica un archivo presente en Document y en el snapshot", () => {
    const grupos = agruparDocumentos(
      [{ name: "renta.pdf", fileType: "application/pdf", documentType: "origenFondosFile" }],
      { origenFondosFile: ["renta.pdf", "extra.pdf"] }
    );

    expect(grupos[0].archivos).toEqual(["renta.pdf", "extra.pdf"]);
  });

  it("descarta entradas vacías del snapshot", () => {
    const grupos = agruparDocumentos([], { origenFondosFile: ["", "  "], pactoSocialFile: "" });
    expect(grupos).toEqual([]);
  });

  it("agrupa bajo 'Otros Adjuntos' los documentos sin ranura", () => {
    const grupos = agruparDocumentos(
      [{ name: "suelto.pdf", fileType: "application/pdf", documentType: null }],
      {}
    );
    expect(grupos[0].titulo).toBe("Otros Adjuntos");
    expect(grupos[0].archivos).toEqual(["suelto.pdf"]);
  });

  it("ignora campos del snapshot que no son ranuras documentales", () => {
    const grupos = agruparDocumentos([], { razonSocial: "Empresa X", rlNombre: "Ana" });
    expect(grupos).toEqual([]);
  });
});

/**
 * Texto legible de un PDF de PDFKit: los flujos van comprimidos y el texto se
 * escribe en arreglos TJ como cadenas hexadecimales intercaladas con números
 * de kerning. Se inflan los flujos y se unen sólo las cadenas; si se dejara el
 * kerning, las etiquetas quedarían partidas a media palabra.
 */
function textoDelPdf(buf: Buffer): string {
  const bin = buf.toString("latin1");
  let crudo = "";
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bin)) !== null) {
    const ini = m.index + m[0].length;
    const fin = bin.indexOf("endstream", ini);
    if (fin === -1) continue;
    try {
      crudo += zlib.inflateSync(Buffer.from(bin.slice(ini, fin), "latin1")).toString("latin1");
    } catch {
      crudo += bin.slice(ini, fin);
    }
  }
  return crudo.replace(/\[([^\]]*)\]\s*TJ/g, (_full, cuerpo: string) =>
    (cuerpo.match(/<[0-9A-Fa-f]*>/g) || [])
      .map((h) => Buffer.from(h.slice(1, -1), "hex").toString("latin1"))
      .join("")
  );
}

const base = {
  firstName: "Carlos", lastName: "Mendoza", nationality: "Panamena", idNumber: "8-888-888",
  direccionResidencial: "Calle 50", ciudad: "Panama", provinciaEstado: "Chiriqui",
  paisResidencial: "Panama", formaContacto: "Referido", referidoPor: "Ana Ruiz",
  ingresosMensuales: "5000", esPep: "Si", pepNombre: "Juan PEP", pepCargo: "Diputado",
};
const hacer = (extra: Record<string, unknown>, id: string) =>
  generateServerPDF("NATURAL", { ...base, ...extra }, id, new Date("2026-09-22"), []);

describe("generateServerPDF · campos condicionales", () => {
  it("incluye los datos del tercero cuando el cliente los declaró", async () => {
    const t = textoDelPdf(await hacer({
      adquiereNombreTercero: "Sí", nombreTercero: "Pedro Tercero",
      fuenteFondosInmueble: "Aporte de Terceros",
      ifTerceroNombre: "Marta Aportante", ifTerceroNacionalidad: "Colombiana",
    }, "form-1"));
    expect(t).toContain("Nombre del Tercero");
    expect(t).toContain("Pedro Tercero");
    expect(t).toContain("Aportante Tercero");
    // El valor largo lo parte PDFKit en varias líneas: basta con el primer nombre.
    expect(t).toContain("Marta");
  }, 30000);

  it("omite el tercero cuando no corresponde, aunque quede valor residual", async () => {
    const t = textoDelPdf(await hacer({
      adquiereNombreTercero: "No", nombreTercero: "Residuo Viejo",
      fuenteFondosInmueble: "Ahorros propios",
    }, "form-2"));
    expect(t).toContain("Ingresos Mensuales");
    expect(t).not.toContain("Nombre del Tercero");
    expect(t).not.toContain("Residuo Viejo");
    expect(t).not.toContain("Aportante Tercero");
  }, 30000);

  it("muestra los detalles PEP con 'Si' sin tilde", async () => {
    expect(textoDelPdf(await hacer({}, "form-3"))).toContain("Detalles PEP");
  }, 30000);

  it("imprime la provincia desde provinciaEstado", async () => {
    expect(textoDelPdf(await hacer({}, "form-4"))).toContain("Chiriqui");
  }, 30000);

  it("no imprime el referido si el contacto no fue por referido", async () => {
    expect(textoDelPdf(await hacer({ formaContacto: "Broker" }, "form-5"))).not.toContain("Ana Ruiz");
  }, 30000);
});

describe("generateServerPDF · detalle de otra fuente de fondos", () => {
  const conOtros = { fuenteFondosInmueble: "Otros ingresos", ifOtroNombre: "Venta de finca familiar" };

  it("imprime el detalle junto a la categoría cuando la fuente es 'Otros'", async () => {
    const t = textoDelPdf(await hacer(conOtros, "form-6"));
    expect(t).toContain("Otra Fuente");
    expect(t).toContain("Venta de finca");
    // La categoría no se pierde: antes el detalle la reemplazaba.
    expect(t).toContain("Otros ingresos");
  }, 30000);

  it("omite el detalle si la fuente no es 'Otros', aunque quede valor residual", async () => {
    const t = textoDelPdf(await hacer(
      { fuenteFondosInmueble: "Ahorros propios", ifOtroNombre: "Residuo Viejo" },
      "form-7"
    ));
    expect(t).toContain("Ahorros propios");
    expect(t).not.toContain("Otra Fuente");
    expect(t).not.toContain("Residuo Viejo");
  }, 30000);

  it("no falla si el expediente no trae fuente de fondos", async () => {
    // fuenteFondosInmueble ausente: antes .includes() sin guarda reventaba.
    const buf = await hacer({ fuenteFondosInmueble: undefined }, "form-8");
    expect(buf.length).toBeGreaterThan(1000);
  }, 30000);
});

/**
 * Renglones del PDF con su altura: PDFKit escribe cada renglón en un bloque
 * BT ... ET que abre con "1 0 0 1 x y Tm". La y crece hacia arriba, así que un
 * renglón más abajo en la página tiene una y menor.
 */
function renglonesDelPdf(buf: Buffer): { y: number; texto: string }[] {
  const crudo = textoDelPdf(buf);
  const renglones: { y: number; texto: string }[] = [];
  const re = /BT\s+1 0 0 1 [\d.-]+ ([\d.-]+) Tm([\s\S]*?)ET/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(crudo)) !== null) renglones.push({ y: parseFloat(m[1]), texto: m[2] });
  return renglones;
}

/** y del renglón más bajo que contiene el texto (el último de un valor partido). */
function yMasBaja(renglones: { y: number; texto: string }[], texto: string): number {
  const ys = renglones.filter((r) => r.texto.includes(texto)).map((r) => r.y);
  expect(ys.length, `no se encontró "${texto}" en el PDF`).toBeGreaterThan(0);
  return Math.min(...ys);
}

describe("generateServerPDF · valores que ocupan varias líneas", () => {
  const ALTO_RENGLON = 8; // fuente de 8 pt

  it("una dirección larga empuja hacia abajo la fila siguiente", async () => {
    const r = renglonesDelPdf(await hacer({
      direccionResidencial: "Calle larga con muchas palabras para que el renglon se parta en dos lineas",
      ciudad: "Ciudad de Panama", paisResidencial: "Alemania", formaContacto: "Encuentra 24",
    }, "form-9"));
    // "Alemania" cae en el segundo renglón de la dirección; "Medio de Contacto"
    // debe quedar por debajo, no encima de él.
    expect(yMasBaja(r, "Medio de Contacto")).toBeLessThanOrEqual(yMasBaja(r, "Alemania") - ALTO_RENGLON);
  }, 30000);

  it("un valor largo en una fila de dos columnas empuja la fila siguiente", async () => {
    const r = renglonesDelPdf(await hacer({
      profession: "Ingeniera en mantenimiento de maquinaria industrial pesada ProfFin",
    }, "form-10"));
    expect(yMasBaja(r, "Patrono")).toBeLessThanOrEqual(yMasBaja(r, "ProfFin") - ALTO_RENGLON);
  }, 30000);

  it("los valores cortos conservan el alto de fila de siempre", async () => {
    const r = renglonesDelPdf(await hacer({ profession: "Analista", employer: "UDG" }, "form-11"));
    expect(yMasBaja(r, "Analista") - yMasBaja(r, "UDG")).toBeCloseTo(13, 1);
  }, 30000);
});
