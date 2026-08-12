import { 
  normalizeText, 
  normalizeExtension, 
  formatDateToYYYYMMDD, 
  generateNormalizedFilename 
} from "../src/lib/documentNamingService";

console.log("=== INICIANDO PRUEBAS UNITARIAS DE RENOMBRADO DOCUMENTAL ===\n");

// Test 1: Normalización de texto
console.log("Test 1: Normalización de texto...");
const text1 = "Copia de Cédula / Pasaporte - Dignatario";
const norm1 = normalizeText(text1);
console.log(`Original: "${text1}" -> Normalizado: "${norm1}"`);
if (norm1 !== "COPIA_DE_CEDULA_PASAPORTE_DIGNATARIO") {
  throw new Error("Fallo Test 1.1");
}

const text2 = "García-Núñez (María José) \u00d1and\u00fa";
const norm2 = normalizeText(text2);
console.log(`Original: "${text2}" -> Normalizado: "${norm2}"`);
if (norm2 !== "GARCIA_NUNEZ_MARIA_JOSE_NANDU") {
  throw new Error("Fallo Test 1.2");
}
console.log("✓ Test 1 Exitoso\n");

// Test 2: Extensiones
console.log("Test 2: Normalización de extensiones...");
const ext1 = ".PDF";
const normExt1 = normalizeExtension(ext1);
console.log(`Original: "${ext1}" -> Normalizado: "${normExt1}"`);
if (normExt1 !== "pdf") {
  throw new Error("Fallo Test 2.1");
}

const ext2 = "  .JPEG ";
const normExt2 = normalizeExtension(ext2);
console.log(`Original: "${ext2}" -> Normalizado: "${normExt2}"`);
if (normExt2 !== "jpeg") {
  throw new Error("Fallo Test 2.2");
}
console.log("✓ Test 2 Exitoso\n");

// Test 3: Formato de Fechas
console.log("Test 3: Formato de fechas...");
const date1 = new Date("2026-08-03T12:00:00Z");
const fmtDate1 = formatDateToYYYYMMDD(date1);
console.log(`Date: ${date1.toISOString()} -> Formato: "${fmtDate1}"`);
if (fmtDate1 !== "20260803") {
  throw new Error("Fallo Test 3.1");
}

const dateStr = "2025-12-31";
const fmtDate2 = formatDateToYYYYMMDD(dateStr);
console.log(`Date String: "${dateStr}" -> Formato: "${fmtDate2}"`);
if (fmtDate2 !== "20251231") {
  throw new Error("Fallo Test 3.2");
}

const invalidDate = "fecha-invalida";
const fmtDate3 = formatDateToYYYYMMDD(invalidDate);
console.log(`Invalid Date: "${invalidDate}" -> Formato (hoy): "${fmtDate3}"`);
if (!/^\d{8}$/.test(fmtDate3)) {
  throw new Error("Fallo Test 3.3");
}
console.log("✓ Test 3 Exitoso\n");

// Test 4: Prevención de Path Traversal
console.log("Test 4: Prevención de Path Traversal...");
const docTypeUnsafe = "../../../etc/passwd";
const normUnsafe = normalizeText(docTypeUnsafe);
console.log(`Peligroso: "${docTypeUnsafe}" -> Sanitizado: "${normUnsafe}"`);
if (normUnsafe.includes(".") || normUnsafe.includes("/")) {
  throw new Error("Fallo de seguridad en Test 4. Path traversal no prevenido.");
}
console.log("✓ Test 4 Exitoso\n");

// Test 5: Generación de nombres UDG y resolución de colisiones
console.log("Test 5: Generación de nombres UDG y resolución de duplicados...");
const inputs = {
  documentType: "Factura de Servicios Públicos",
  lastName: "Gómez-López",
  firstName: "José Manuel",
  date: "2026-08-03",
  extension: ".PDF",
};

const expectedBase = "FACTURA_DE_SERVICIOS_PUBLICOS_GOMEZ_LOPEZ_JOSE_MANUEL_20260803";

// Escenario A: Sin colisiones
const nameA = generateNormalizedFilename(inputs);
console.log(`Sin colisiones -> "${nameA}"`);
if (nameA !== `${expectedBase}.pdf`) {
  throw new Error("Fallo Escenario A");
}

// Escenario B: Con colisiones simples
const existingB = [`${expectedBase}.pdf`];
const nameB = generateNormalizedFilename({ ...inputs, existingNames: existingB });
console.log(`Con colisión única -> "${nameB}"`);
if (nameB !== `${expectedBase}_1.pdf`) {
  throw new Error("Fallo Escenario B");
}

// Escenario C: Con múltiples colisiones consecutivas
const existingC = [
  `${expectedBase}.pdf`,
  `${expectedBase}_1.pdf`,
  `${expectedBase}_2.PDF`, // Case-insensitive collision check test
  `${expectedBase}_3.pdf`,
];
const nameC = generateNormalizedFilename({ ...inputs, existingNames: existingC });
console.log(`Con colisiones múltiples -> "${nameC}"`);
if (nameC !== `${expectedBase}_4.pdf`) {
  throw new Error("Fallo Escenario C");
}

console.log("✓ Test 5 Exitoso\n");
console.log("=== ¡TODAS LAS PRUEBAS COMPLETADAS CON ÉXITO ROTUNDO! ===");
