import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/zohoAuthService";
import { verifyToken } from "@/lib/tokenService";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const textResponse = (message: string, status: number) =>
  new NextResponse(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

/**
 * Muestra en línea un documento del borrador para el overlay de los formularios.
 * El token va en la URL porque un iframe no puede enviar cabeceras; solo da
 * acceso a los documentos de su propio borrador.
 */
export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name");
  const token = request.nextUrl.searchParams.get("token");

  if (!name || !token) {
    return textResponse("Solicitud inválida", 400);
  }

  const verification = await verifyToken(token);
  if (!verification.success || !verification.uuid) {
    return textResponse("No autorizado", 401);
  }

  const draft = await prisma.draft.findUnique({
    where: { token: verification.uuid },
    select: { id: true },
  });
  const document = draft
    ? await prisma.document.findFirst({
        where: { draftId: draft.id, name, deletedAt: null },
        orderBy: { createdAt: "desc" },
      })
    : null;

  // PENDING_SYNC: la subida a WorkDrive falló y solo existe el registro
  if (!document || !document.zohoFileId || document.zohoFileId === "PENDING_SYNC") {
    return textResponse("El documento no está disponible para visualizar", 404);
  }

  try {
    const accessToken = await getAccessToken();
    const response = await fetch(`https://www.zohoapis.com/workdrive/api/v1/download/${encodeURIComponent(document.zohoFileId)}`, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });

    if (!response.ok) {
      console.error("[Document Preview] Zoho response:", response.status, await response.text());
      return textResponse("No se pudo cargar el documento", 502);
    }

    const fileName = encodeURIComponent(document.originalName || document.name);
    return new NextResponse(await response.arrayBuffer(), {
      headers: {
        "Content-Type": document.fileType,
        "Content-Disposition": `inline; filename*=UTF-8''${fileName}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[Document Preview] Error:", error);
    return textResponse("No se pudo cargar el documento", 502);
  }
}
