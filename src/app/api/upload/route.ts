import { NextRequest, NextResponse } from "next/server";
import { withTempFile } from "@/lib/tempFileService";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const MIME_EXT_MAP: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/tiff": ["tiff", "tif"],
  "image/heic": ["heic", "heif"],
};

function detectMimeType(buffer: Buffer): { mime: string; ext: string } | null {
  if (buffer.length < 4) return null;

  const hex4 = buffer.toString("hex", 0, 4).toLowerCase();
  const hex12 = buffer.length >= 12 ? buffer.toString("hex", 0, 12).toLowerCase() : "";

  // 1. PDF: 25 50 44 46 (%PDF)
  if (hex4 === "25504446") {
    return { mime: "application/pdf", ext: "pdf" };
  }

  // 2. PNG: 89 50 4E 47
  if (hex4 === "89504e47") {
    return { mime: "image/png", ext: "png" };
  }

  // 3. JPEG: FF D8 FF
  if (hex4.startsWith("ffd8ff")) {
    return { mime: "image/jpeg", ext: "jpg" };
  }

  // 4. TIFF: 49 49 2A 00 or 4D 4D 00 2A
  if (hex4 === "49492a00" || hex4 === "4d4d002a") {
    return { mime: "image/tiff", ext: "tiff" };
  }

  // 5. HEIC: check ftypheic, ftypmif1, etc.
  if (hex12.length >= 24) {
    const ftyp = hex12.substring(8, 16); // bytes 4-7
    const brand = hex12.substring(16, 24); // bytes 8-11
    if (ftyp === "66747970") {
      const brandStr = Buffer.from(brand, "hex").toString("ascii").toLowerCase();
      if (["heic", "heix", "mif1", "msf1", "hevc"].includes(brandStr)) {
        return { mime: "image/heic", ext: "heic" };
      }
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    
    if (!file) {
      return NextResponse.json({ success: false, error: "No se proporcionó ningún archivo" }, { status: 400 });
    }

    // 1. Size Validation
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { 
          success: false, 
          error: `El archivo supera el tamaño máximo permitido de 10 MB (Tamaño subido: ${(file.size / (1024 * 1024)).toFixed(2)} MB)` 
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = file.name;

    // 2. MIME/Magic bytes verification
    const detected = detectMimeType(buffer);
    if (!detected) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Tipo de archivo no permitido. Solo se admiten archivos PDF, PNG, JPG, JPEG, TIFF y HEIC." 
        },
        { status: 400 }
      );
    }

    // 3. Extension check consistency
    const ext = path.extname(fileName).toLowerCase().replace(".", "");
    const allowedExtensions = MIME_EXT_MAP[detected.mime];

    if (!allowedExtensions || !allowedExtensions.includes(ext)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Discrepancia de extensión de archivo: La extensión (.${ext}) no coincide con el tipo de contenido real detectado (${detected.mime}).` 
        },
        { status: 400 }
      );
    }

    // Usar con conector temporal con garantía de eliminación
    const result = await withTempFile(buffer, fileName, async (filePath) => {
      const existsDuringProcessing = fs.existsSync(filePath);
      
      console.log(`[Upload API] Procesando archivo en ubicación temporal: ${filePath}`);
      
      if (fileName.includes("trigger-error")) {
        throw new Error("Error simulado en procesamiento del archivo para validar limpieza");
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      return {
        success: true,
        message: "Archivo procesado y verificado correctamente",
        fileName,
        mimeType: detected.mime,
        tempPath: filePath,
        existsDuringProcessing,
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[Upload API] Error durante el procesamiento de subida:", error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || "Error interno del servidor",
        info: "El archivo temporal ha sido eliminado de forma segura."
      },
      { status: 500 }
    );
  }
}
