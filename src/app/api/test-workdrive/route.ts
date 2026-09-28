import { NextRequest, NextResponse } from "next/server";
import { getOrCreateFolderStructure } from "@/lib/workdriveService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ddId = searchParams.get("ddId");
    const type = searchParams.get("type") || "natural";

    if (!ddId) {
      return NextResponse.json(
        { success: false, error: "Indique el ID del expediente de Debida Diligencia en Zoho CRM (?ddId=...)." },
        { status: 400 }
      );
    }

    const formType = type === "juridica" ? "JURIDICA" : "NATURAL";

    // Subcarpetas según las ranuras documentales de cada formulario
    const documentTypes =
      type === "juridica"
        ? [
            "copiaIdFile",
            "avisoOperacionesFile",
            "origenFondosFile",
            "pactoSocialFile",
            "certBancariaFile",
            "certRegistroFile",
            "certComprasFile",
          ]
        : ["idFile", "hasCertificacionBancaria", "hasEstadoCuenta", "origenFondosFile"];

    // Basic credentials validation check to return user-friendly tip
    const isConfigured =
      process.env.ZOHO_CLIENT_ID &&
      process.env.ZOHO_CLIENT_ID !== "placeholder_client_id" &&
      process.env.ZOHO_CLIENT_SECRET &&
      process.env.ZOHO_CLIENT_SECRET !== "placeholder_client_secret" &&
      process.env.ZOHO_REFRESH_TOKEN &&
      process.env.ZOHO_REFRESH_TOKEN !== "placeholder_refresh_token";

    if (!isConfigured) {
      return NextResponse.json(
        {
          success: false,
          error: "Las credenciales de Zoho WorkDrive no están completamente configuradas.",
          info: "Por favor reemplace los valores marcados como 'placeholder' en su archivo .env con credenciales reales de la consola de desarrolladores de Zoho.",
          currentConfig: {
            ZOHO_CLIENT_ID: process.env.ZOHO_CLIENT_ID,
            ZOHO_CLIENT_SECRET: process.env.ZOHO_CLIENT_SECRET ? "[DEFINIDO]" : "[VACIO]",
            ZOHO_REFRESH_TOKEN: process.env.ZOHO_REFRESH_TOKEN ? "[DEFINIDO]" : "[VACIO]",
          },
        },
        { status: 400 }
      );
    }

    console.log(
      `[Test API] Ejecutando sincronización de prueba para tipo "${type}" del expediente ${ddId}...`
    );

    const result = await getOrCreateFolderStructure(ddId, formType, documentTypes);

    return NextResponse.json({
      success: true,
      message: "Estructura de carpetas procesada correctamente.",
      params: {
        ddId,
        type,
        documentTypes,
      },
      folders: result,
    });
  } catch (error: any) {
    console.error("[Test API] Error en prueba de integración de Zoho WorkDrive:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error interno del servidor",
      },
      { status: 500 }
    );
  }
}
