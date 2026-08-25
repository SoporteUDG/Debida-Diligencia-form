import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logAuditEvent, computeDiff } from "@/lib/auditService";
import { sanitizeInput } from "@/lib/sanitizer";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, type, data, step } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Falta el token de identificación del borrador" },
        { status: 400 }
      );
    }

    if (!type || (type !== "natural" && type !== "juridica")) {
      return NextResponse.json(
        { success: false, error: "Tipo de cliente inválido o no especificado" },
        { status: 400 }
      );
    }

    const formType = type === "natural" ? "NATURAL" : "JURIDICA";

    // Fetch existing draft to compute differences
    const existing = await prisma.draft.findUnique({
      where: { token },
    });

    const sanitizedData = sanitizeInput(data || {});

    // Upsert the draft in the database
    const draft = await prisma.draft.upsert({
      where: { token },
      update: {
        data: sanitizedData,
        step: step || 1,
        updatedAt: new Date(),
      },
      create: {
        token,
        type: formType,
        data: sanitizedData,
        step: step || 1,
      },
    });

    // Compute differences and log audit event
    const diff = computeDiff(existing?.data || {}, data || {});
    const ipAddress = request.headers.get("x-forwarded-for") || (request as any).ip || "127.0.0.1";
    const userAgent = request.headers.get("user-agent") || "unknown";

    await logAuditEvent({
      action: "DRAFT_SAVE",
      entityName: "Draft",
      entityId: draft.id,
      ipAddress,
      userAgent,
      details: {
        step: step || 1,
        diff,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Borrador guardado exitosamente en base de datos",
      draftId: draft.id,
    });

  } catch (error: any) {
    console.error("[Draft API] Error al guardar borrador:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al procesar el guardado automático" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Falta el token de identificación del borrador" },
        { status: 400 }
      );
    }

    // Try to delete the draft if it exists
    let draftId: string | null = null;
    let draftType: string | null = null;
    try {
      const existing = await prisma.draft.findUnique({
        where: { token },
      });
      if (existing) {
        draftId = existing.id;
        draftType = existing.type;
        await prisma.draft.delete({
          where: { token },
        });
      }
    } catch (e: any) {
      // Record might not exist, ignore error or return success anyway
      console.log(`[Draft API] El borrador con token ${token} no existía o ya fue eliminado.`);
    }

    if (draftId) {
      const ipAddress = request.headers.get("x-forwarded-for") || (request as any).ip || "127.0.0.1";
      const userAgent = request.headers.get("user-agent") || "unknown";
      await logAuditEvent({
        action: "DRAFT_DELETE",
        entityName: "Draft",
        entityId: draftId,
        ipAddress,
        userAgent,
        details: {
          token,
          type: draftType,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Borrador eliminado exitosamente de la base de datos",
    });

  } catch (error: any) {
    console.error("[Draft API] Error al eliminar borrador:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al eliminar el borrador" },
      { status: 500 }
    );
  }
}
