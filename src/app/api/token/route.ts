import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  generateToken,
  verifyToken,
  reactivateToken,
  revokeToken,
} from "@/lib/tokenService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const log: string[] = [];
  let testContactId: string | null = null;
  let testTokenUuid: string | null = null;

  try {
    log.push("Iniciando suite de integración para TokenService...");

    // 1. Setup: Ensure a test contact exists
    const testEmail = "test-token-lifecycle@udg.com";
    log.push(`Buscando o creando contacto de pruebas con email: ${testEmail}`);
    let contact = await prisma.crmContact.findUnique({
      where: { email: testEmail },
    });

    if (!contact) {
      contact = await prisma.crmContact.create({
        data: {
          crmId: "CRM-TEST-TOKEN",
          firstName: "Token",
          lastName: "Test User",
          email: testEmail,
          phone: "+5071234567",
        },
      });
      log.push(`Contacto de pruebas creado con ID: ${contact.id}`);
    } else {
      log.push(`Contacto de pruebas existente encontrado con ID: ${contact.id}`);
    }
    testContactId = contact.id;

    // 2. Generate a token (30 days validity)
    log.push("Generando token firmado criptográficamente (duración: 30 días)...");
    const signedToken = await generateToken(contact.id, "ACCESS", 30);
    log.push(`Token generado con éxito: "${signedToken}"`);

    const uuid = signedToken.includes(".") ? signedToken.split(".")[0] : signedToken;
    testTokenUuid = uuid;

    // 3. Verify valid token
    log.push("Paso 1: Verificando token intacto recién generado...");
    const verify1 = await verifyToken(signedToken);
    log.push(`Resultado: ${JSON.stringify(verify1)}`);
    if (!verify1.success) throw new Error("Fallo al verificar el token original válido.");

    // 4. Verify altered token (tampering check)
    log.push("Paso 2: Alterando firma del token para verificar control de integridad...");
    const alteredSignatureToken = `${signedToken}x`;
    const verify2 = await verifyToken(alteredSignatureToken);
    log.push(`Resultado (esperado fallo): ${JSON.stringify(verify2)}`);
    if (verify2.success) throw new Error("Seguridad fallida: Se aceptó un token con firma alterada.");

    // 5. Verify expired token
    log.push("Paso 3: Forzando expiración en base de datos (fecha de expiración en el pasado)...");
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5); // 5 days in the past
    await prisma.token.update({
      where: { token: uuid },
      data: { expiresAt: pastDate },
    });
    const verify3 = await verifyToken(signedToken);
    log.push(`Resultado (esperado fallo por expiración): ${JSON.stringify(verify3)}`);
    if (verify3.success) throw new Error("Seguridad fallida: Se aceptó un token expirado.");

    // 6. Reactivate token
    log.push("Paso 4: Invocando reactivación (extender validez por 15 días más)...");
    const reactivation = await reactivateToken(uuid, 15);
    log.push(`Resultado de reactivación: ${JSON.stringify(reactivation)}`);
    if (!reactivation.success) throw new Error("Fallo al reactivar el token.");

    log.push("Verificando el token reactivado...");
    const verify4 = await verifyToken(signedToken);
    log.push(`Resultado (esperada aprobación): ${JSON.stringify(verify4)}`);
    if (!verify4.success) throw new Error("Fallo al verificar el token después de reactivarlo.");

    // 7. Revoke token
    log.push("Paso 5: Invocando revocación del token (marcar como utilizado/bloqueado)...");
    const revocation = await revokeToken(uuid);
    log.push(`Resultado de revocación: ${JSON.stringify(revocation)}`);
    if (!revocation.success) throw new Error("Fallo al revocar el token.");

    log.push("Verificando token revocado...");
    const verify5 = await verifyToken(signedToken);
    log.push(`Resultado (esperado fallo por revocación): ${JSON.stringify(verify5)}`);
    if (verify5.success) throw new Error("Seguridad fallida: Se aceptó un token marcado como usado/revocado.");

    log.push("Suite de integración completada con éxito rotundo!");

    return NextResponse.json({
      success: true,
      message: "Todas las pruebas criptográficas y lógicas de tokens pasaron con éxito",
      logs: log,
    });

  } catch (error: any) {
    log.push(`FATAL ERROR: ${error.message || error}`);
    console.error("[Token Integration Test] Error en suite de pruebas:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error en la ejecución de pruebas de integración",
        logs: log,
      },
      { status: 500 }
    );
  } finally {
    // 8. Cleanup: Delete test token & contact to keep DB clean
    log.push("Limpiando registros de pruebas creados en base de datos...");
    if (testContactId) {
      try {
        await prisma.crmContact.delete({
          where: { id: testContactId },
        });
        log.push("Registros de contacto y tokens de prueba eliminados correctamente.");
      } catch (cleanupError) {
        console.error("[Token Integration Test] Error en limpieza de DB:", cleanupError);
      }
    }
  }
}
