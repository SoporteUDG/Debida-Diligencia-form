import fs from "fs";
import path from "path";

const TEMP_DIR_NAME = "tmp/uploads";

/**
 * Retorna la ruta al directorio temporal aislado, creándolo si no existe y
 * aplicando permisos restrictivos (0700).
 */
export function getTempDir(): string {
  const tempPath = path.join(process.cwd(), TEMP_DIR_NAME);
  if (!fs.existsSync(tempPath)) {
    fs.mkdirSync(tempPath, { recursive: true });
    try {
      // Restringir acceso: lectura/escritura/ejecución solo para el propietario (0700)
      fs.chmodSync(tempPath, 0o700);
    } catch (e) {
      console.warn("No se pudieron configurar los permisos de la carpeta (chmod):", e);
    }
  }
  return tempPath;
}

/**
 * Guarda el buffer de un archivo en el directorio temporal con permisos restrictivos (0600).
 * Sanitiza el nombre para evitar vulnerabilidades de Path Traversal.
 */
export async function saveToTemp(fileBuffer: Buffer, fileName: string): Promise<string> {
  const tempDir = getTempDir();
  
  // Sanitizar el nombre del archivo para prevenir path traversal
  const sanitizedBase = path.basename(fileName).replace(/[^a-zA-Z0-9.-]/g, "_");
  const safeName = `${Date.now()}-${sanitizedBase}`;
  const filePath = path.join(tempDir, safeName);
  
  fs.writeFileSync(filePath, fileBuffer);
  try {
    // Restringir acceso al archivo: lectura/escritura solo para el propietario (0600)
    fs.chmodSync(filePath, 0o600);
  } catch (e) {
    console.warn("No se pudieron configurar los permisos del archivo (chmod):", e);
  }
  return filePath;
}

/**
 * Elimina un archivo temporal de forma segura.
 */
export async function cleanupFile(filePath: string): Promise<void> {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (e) {
    console.error(`Error al eliminar el archivo temporal en ${filePath}:`, e);
  }
}

/**
 * Wrapper de contexto seguro que garantiza que el archivo temporal guardado
 * se elimine al finalizar la ejecución, tanto si es exitosa como si falla.
 */
export async function withTempFile<T>(
  fileBuffer: Buffer,
  fileName: string,
  callback: (filePath: string) => Promise<T>
): Promise<T> {
  const filePath = await saveToTemp(fileBuffer, fileName);
  try {
    return await callback(filePath);
  } finally {
    await cleanupFile(filePath);
  }
}

/**
 * Escanea la carpeta temporal y elimina los archivos que superen la antigüedad límite (por defecto 15 minutos).
 * Retorna la lista de archivos que fueron eliminados.
 */
export async function cleanOrphans(maxAgeMs: number = 15 * 60 * 1000): Promise<string[]> {
  const tempDir = getTempDir();
  const deletedFiles: string[] = [];
  const now = Date.now();

  try {
    const files = fs.readdirSync(tempDir);
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile()) {
        const fileAge = now - stats.mtimeMs;
        if (fileAge > maxAgeMs) {
          fs.unlinkSync(filePath);
          deletedFiles.push(file);
        }
      }
    }
  } catch (e) {
    console.error("Error al limpiar archivos huérfanos:", e);
  }
  return deletedFiles;
}
