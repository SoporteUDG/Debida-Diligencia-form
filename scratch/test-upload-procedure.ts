import "./load-env";
import prisma from "../src/lib/prisma";
import { appRouter } from "../src/server/routers/_app";
import { generateToken } from "../src/lib/tokenService";

async function testUpload() {
  console.log("--- INICIANDO PRUEBA DE PROCEDIMIENTO tRPC UPLOAD ---");
  console.log("DATABASE_URL cargado:", process.env.DATABASE_URL ? "SÍ" : "NO");

  // 1. Retrieve or create a test CrmContact in the database
  let contact = await prisma.crmContact.findFirst();
  if (!contact) {
    console.log("No se encontró ningún CrmContact en la BD. Creando uno de prueba...");
    contact = await prisma.crmContact.create({
      data: {
        crmId: "crm_test_12345",
        firstName: "Prueba",
        lastName: "Usuario",
        email: "test.user.workdrive@example.com",
      },
    });
  }
  console.log(`Utilizando contacto: ${contact.firstName} ${contact.lastName} (CRM ID: ${contact.crmId})`);

  // Generate a valid client token to pass TRPC tokenProcedure authorization
  console.log("Generando token de acceso temporal...");
  const signedToken = await generateToken(contact.id, "ACCESS", 1);

  // 2. Build mock Request and Context
  const mockReq = {
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === "user-agent") return "Mozilla/5.0 TestAgent";
        if (name.toLowerCase() === "x-forwarded-for") return "127.0.0.1";
        if (name.toLowerCase() === "authorization" || name.toLowerCase() === "x-client-token") {
          return `Bearer ${signedToken}`;
        }
        return null;
      },
    },
  } as any;

  const caller = appRouter.createCaller({
    req: mockReq,
    prisma,
    ip: "127.0.0.1",
    userAgent: "Mozilla/5.0 TestAgent",
  } as any);

  // Tiny valid PDF sample base64 string
  // Magic bytes: 25 50 44 46 (%PDF)
  const samplePdfBase64 = Buffer.from(
    "%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF"
  ).toString("base64");

  // TEST 1: Check validation for extension spoofing / mismatch
  // Passing PDF content but naming it test.jpg
  try {
    console.log("\n[TEST 1] Probando detección de spoofing de archivos (Contenido PDF con extensión .jpg)...");
    await caller.documents.uploadDocument({
      fileName: "test_archivo.jpg",
      fileType: "image/jpeg",
      fileData: samplePdfBase64,
      documentType: "Copia ID",
    });
    console.error("ERROR: ¡La validación de consistencia de extensión debió haber fallado!");
  } catch (error: any) {
    console.log("ÉXITO: Se capturó el error esperado por discrepancia de extensión:");
    console.log(" > Mensaje:", error.message);
    if (error.message.includes("[FILE_VALIDATION]")) {
      console.log(" > OK: Error reportado correctamente en la etapa [FILE_VALIDATION].");
    } else {
      console.warn(" > ADVERTENCIA: La etapa de error reportada no fue FILE_VALIDATION. Detalles:", error);
    }
  }

  // TEST 2: Orchestration run (will fail at credentials but test stages)
  try {
    console.log("\n[TEST 2] Probando flujo completo orquestado...");
    const response = await caller.documents.uploadDocument({
      fileName: "identificacion_oficial.pdf",
      fileType: "application/pdf",
      fileData: samplePdfBase64,
      documentType: "Copia ID",
    });
    console.log("ÉXITO: Carga completada satisfactoriamente (credenciales reales válidas):", response);
  } catch (error: any) {
    console.log("CAPTURA DE ETAPA: Flujo interrumpido debido al estado de la configuración (esperado con placeholders):");
    console.log(" > Mensaje:", error.message);
    
    const isZohoStage = error.message.includes("[FOLDER_CREATION]") || error.message.includes("[ZOHO_UPLOAD]");
    const isConfigError = error.message.includes("Configuración de Zoho incompleta");
    
    if (isZohoStage || isConfigError) {
      console.log(" > OK: La trazabilidad de etapas orquestó el flujo correctamente y falló en la fase esperada.");
    } else {
      console.warn(" > ADVERTENCIA: Etapa de fallo inesperada. Detalles del error:", error);
    }
  }

  console.log("\n--- PRUEBA FINALIZADA ---");
}

testUpload()
  .catch((e) => console.error("Error catastrófico en la ejecución del test:", e))
  .finally(() => prisma.$disconnect());
