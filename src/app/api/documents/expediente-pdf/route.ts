import { NextRequest, NextResponse } from "next/server";
import { generateServerPDF } from "@/lib/serverPdfGenerator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Json = Record<string, unknown>;

/** La firma viaja como imagen base64; 5 MB cubre de sobra el expediente. */
const MAX_BODY_BYTES = 5 * 1024 * 1024;

/**
 * Genera el PDF del expediente (sin anexos) con el mismo diseño que el
 * consolidado de WorkDrive. Lo usa lib/pdfGenerator desde el navegador.
 *
 * No lee nada de la base de datos: sólo da formato a los datos que recibe, que
 * quien llama ya tiene (el formulario enviado, la vista de consulta pública o
 * el panel). Por eso no exige más autorización que esas mismas pantallas. Los
 * anexos se siguen descargando por /api/documents/download, que sí la exige.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Solicitud demasiado grande" }, { status: 413 });
  }

  let body: Json;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const type = String(body?.type || "").toLowerCase();
  if (type !== "natural" && type !== "juridica") {
    return NextResponse.json({ error: "Tipo de formulario inválido" }, { status: 400 });
  }
  if (!body.data || typeof body.data !== "object") {
    return NextResponse.json({ error: "Faltan los datos del formulario" }, { status: 400 });
  }

  const id = String(body.id || "BORRADOR").slice(0, 64);
  const fecha = typeof body.date === "string" && body.date.trim() ? body.date.trim().slice(0, 64) : new Date();
  const version = typeof body.version === "number" && Number.isInteger(body.version) && body.version > 0 ? body.version : undefined;
  const documents = Array.isArray(body.documents)
    ? body.documents
        .filter((d: unknown): d is Json => !!d && typeof (d as Json).name === "string")
        .map((d: Json) => ({
          name: d.name as string,
          fileType: typeof d.fileType === "string" ? d.fileType : undefined,
          documentType: typeof d.documentType === "string" ? d.documentType : null,
          personType: typeof d.personType === "string" ? d.personType : null,
          personId: typeof d.personId === "string" ? d.personId : null,
          status: typeof d.status === "string" ? d.status : null,
        }))
    : [];

  try {
    const pdf = await generateServerPDF(
      type === "natural" ? "NATURAL" : "JURIDICA",
      body.data,
      id,
      fecha,
      documents,
      version
    );
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Expediente_UDG_${type === "natural" ? "Natural" : "Juridica"}_${id.replace(/[^\w-]/g, "_")}.pdf"`,
      },
    });
  } catch (error) {
    console.error("[Expediente PDF] Error al generar el PDF:", error);
    return NextResponse.json({ error: "No se pudo generar el PDF" }, { status: 500 });
  }
}
