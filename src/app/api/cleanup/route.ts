import { NextRequest, NextResponse } from "next/server";
import { cleanOrphans } from "@/lib/tempFileService";
import { logAuditEvent } from "@/lib/auditService";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const maxAgeMinutes = parseInt(searchParams.get("maxAgeMinutes") || "15", 10);
    
    if (isNaN(maxAgeMinutes) || maxAgeMinutes < 0) {
      return NextResponse.json({ error: "Parámetro maxAgeMinutes inválido" }, { status: 400 });
    }

    const maxAgeMs = maxAgeMinutes * 60 * 1000;
    const deletedFiles = await cleanOrphans(maxAgeMs);

    if (deletedFiles.length > 0) {
      const ipAddress = request.headers.get("x-forwarded-for") || (request as any).ip || "127.0.0.1";
      const userAgent = request.headers.get("user-agent") || "unknown";
      await logAuditEvent({
        action: "FILE_CLEANUP",
        entityName: "TempFile",
        ipAddress,
        userAgent,
        details: {
          reason: "Periodical cleanup of orphan temporary files",
          deletedCount: deletedFiles.length,
          files: deletedFiles,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Limpieza periódica ejecutada con éxito",
      maxAgeMinutes,
      deletedFilesCount: deletedFiles.length,
      deletedFiles,
    });
  } catch (error: any) {
    console.error("[Cleanup API] Error durante la limpieza:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || "Error interno al ejecutar la limpieza de residuos" 
      },
      { status: 500 }
    );
  }
}
