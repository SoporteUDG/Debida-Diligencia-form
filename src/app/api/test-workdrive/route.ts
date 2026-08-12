import { NextRequest, NextResponse } from "next/server";
import { getOrCreateFolderStructure } from "@/lib/workdriveService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year") || "2026";
    const month = searchParams.get("month") || "07";
    const nameId = searchParams.get("apellidoNombreId") || "Perez_Juan_12345678";
    const type = searchParams.get("type") || "natural";

    // Define subfolders based on document types
    const documentTypes =
      type === "juridica"
        ? [
            "Copia ID Dignatarios",
            "Aviso de Operaciones",
            "Origen de Fondos",
            "Factura Servicios Públicos",
            "Pacto Social",
            "Certificación Bancaria",
            "Certificado Registro Público",
          ]
        : ["Copia ID", "Prueba de Domicilio", "Origen de Fondos", "Otros Adjuntos"];

    // Basic credentials validation check to return user-friendly tip
    const isConfigured =
      process.env.ZOHO_CLIENT_ID &&
      process.env.ZOHO_CLIENT_ID !== "placeholder_client_id" &&
      process.env.ZOHO_CLIENT_SECRET &&
      process.env.ZOHO_CLIENT_SECRET !== "placeholder_client_secret" &&
      process.env.ZOHO_REFRESH_TOKEN &&
      process.env.ZOHO_REFRESH_TOKEN !== "placeholder_refresh_token" &&
      process.env.ZOHO_WORKDRIVE_ROOT_FOLDER_ID &&
      process.env.ZOHO_WORKDRIVE_ROOT_FOLDER_ID !== "placeholder_root_folder_id";

    if (!isConfigured) {
      return NextResponse.json(
        {
          success: false,
          error: "Las credenciales de Zoho WorkDrive no están completamente configuradas.",
          info: "Por favor reemplace los valores marcados como 'placeholder' en su archivo .env con credenciales reales de la consola de desarrolladores de Zoho y el ID de carpeta de WorkDrive.",
          currentConfig: {
            ZOHO_CLIENT_ID: process.env.ZOHO_CLIENT_ID,
            ZOHO_CLIENT_SECRET: process.env.ZOHO_CLIENT_SECRET ? "[DEFINIDO]" : "[VACIO]",
            ZOHO_REFRESH_TOKEN: process.env.ZOHO_REFRESH_TOKEN ? "[DEFINIDO]" : "[VACIO]",
            ZOHO_WORKDRIVE_ROOT_FOLDER_ID: process.env.ZOHO_WORKDRIVE_ROOT_FOLDER_ID,
          },
        },
        { status: 400 }
      );
    }

    console.log(
      `[Test API] Ejecutando sincronización de prueba para tipo "${type}" en /DD/${year}/${month}/${nameId}...`
    );

    const result = await getOrCreateFolderStructure(year, month, nameId, documentTypes);

    return NextResponse.json({
      success: true,
      message: "Estructura de carpetas procesada correctamente.",
      params: {
        year,
        month,
        apellidoNombreId: nameId,
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
