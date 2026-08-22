import fs from "fs";
import path from "path";

// Load .env file manually
try {
  const envPath = path.resolve(__dirname, "../.env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    const lines = envContent.split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || "";
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value;
      }
    }
  }
} catch (e) {
  console.error("Error loading env:", e);
}

import prisma from "../src/lib/prisma";
import crypto from "crypto";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  console.log("🧹 Iniciando limpieza de la base de datos...");
  // Order of deletion to avoid foreign key violations
  await prisma.auditLog.deleteMany({});
  await prisma.crmSync.deleteMany({});
  await prisma.workDriveSync.deleteMany({});
  await prisma.sapSync.deleteMany({});
  await prisma.signature.deleteMany({});
  await prisma.gjcMember.deleteMany({});
  await prisma.bfMember.deleteMany({});
  await prisma.legalRepresentative.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.form.deleteMany({});
  await prisma.draft.deleteMany({});
  await prisma.token.deleteMany({});
  await prisma.crmContact.deleteMany({});
  await prisma.adminUser.deleteMany({});
  console.log("✨ Limpieza completada.");

  console.log("🌱 Creando usuarios administradores...");
  const superadmin = await prisma.adminUser.create({
    data: {
      email: "admin@udg.com",
      name: "Oficial de Cumplimiento UDG",
      passwordHash: hashPassword("admin123"),
      role: "SUPERADMIN",
    },
  });

  const admin = await prisma.adminUser.create({
    data: {
      email: "oficial1@udg.com",
      name: "Ana Ramírez",
      passwordHash: hashPassword("oficial2026"),
      role: "ADMIN",
    },
  });

  console.log("🌱 Creando contactos de prueba (Leads y Contacts)...");
  const contactNatural = await prisma.crmContact.create({
    data: {
      crmId: "crm-contact-natural-101",
      firstName: "Carlos",
      lastName: "Mendoza",
      email: "carlos.mendoza@client.com",
      phone: "+507 6001-1234",
    },
  });

  const contactJuridica = await prisma.crmContact.create({
    data: {
      crmId: "crm-contact-juridica-202",
      firstName: "Roberto",
      lastName: "Varela",
      email: "roberto.varela@corporation.com",
      phone: "+507 399-4455",
    },
  });

  console.log("🌱 Creando tokens de acceso...");
  // 1. Token natural vigente
  const tokenNaturalVigente = await prisma.token.create({
    data: {
      token: "token-natural-vigente-1111",
      type: "ACCESS",
      crmContactId: contactNatural.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days in future
      used: false,
    },
  });

  // 2. Token natural expirado
  await prisma.token.create({
    data: {
      token: "token-natural-expirado-2222",
      type: "ACCESS",
      crmContactId: contactNatural.id,
      expiresAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5), // 5 days in past
      used: false,
    },
  });

  // 3. Token juridica vigente
  const tokenJuridicaVigente = await prisma.token.create({
    data: {
      token: "token-juridica-vigente-3333",
      type: "ACCESS",
      crmContactId: contactJuridica.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      used: false,
    },
  });

  console.log("🌱 Creando borradores de formularios (Drafts)...");
  // Draft natural en progreso parcial (paso 2)
  await prisma.draft.create({
    data: {
      token: "token-natural-vigente-1111",
      type: "NATURAL",
      crmContactId: contactNatural.id,
      step: 2,
      data: {
        projectName: "Ocean Reef Villa 14",
        firstName: "Carlos",
        lastName: "Mendoza",
        email: "carlos.mendoza@client.com",
        celular: "+507 6001-1234",
        paisResidencia: "Panamá",
        nacionalidad: "Panameña",
        idType: "CEDULA",
        idNumber: "8-888-8888",
      },
    },
  });

  // Draft juridica completo (listo para firmar)
  const draftJuridica = await prisma.draft.create({
    data: {
      token: "token-juridica-vigente-3333",
      type: "JURIDICA",
      crmContactId: contactJuridica.id,
      step: 4,
      data: {
        projectName: "Costa del Este Corporate Center",
        razonSocial: "Inversiones Varela S.A.",
        numeroDocumento: "1554628-1-657482 DV 23",
        email: "roberto.varela@corporation.com",
        celular: "+507 399-4455",
        actividadPrincipal: "Desarrollo Inmobiliario y Logístico",
        paisConstitucion: "Panamá",
      },
    },
  });

  console.log("🌱 Creando formularios enviados (Forms)...");
  // 1. Formulario Persona Natural - STATUS: SUBMITTED (Pendiente de revision)
  const formNatural = await prisma.form.create({
    data: {
      type: "NATURAL",
      status: "SUBMITTED",
      clientName: "Carlos Mendoza",
      projectName: "Ocean Reef Villa 14",
      crmContactId: contactNatural.id,
      data: {
        firstName: "Carlos",
        lastName: "Mendoza",
        email: "carlos.mendoza@client.com",
        celular: "+507 6001-1234",
        idNumber: "8-888-8888",
        projectName: "Ocean Reef Villa 14",
        paisResidencia: "Panamá",
        nacionalidad: "Panameña",
        profesion: "Ingeniero Civil",
        ingresosMensuales: "De $5,000 a $10,000",
        origenFondos: "Salario y dividendos comerciales",
      },
    },
  });

  // Firma del formulario natural
  await prisma.signature.create({
    data: {
      formId: formNatural.id,
      signerName: "Carlos Mendoza",
      signatureDate: new Date(),
      firmaImage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH5QgWBRUa2zU", // Mock small png
      ipAddress: "192.168.1.100",
    },
  });

  // Documentos asociados al formulario natural
  await prisma.document.createMany({
    data: [
      {
        formId: formNatural.id,
        name: "Cedula_Carlos_Mendoza.pdf",
        fileType: "application/pdf",
        url: "https://www.zohoapis.com/workdrive/api/v1/files/mock-cedula-id",
        status: "APPROVED",
      },
      {
        formId: formNatural.id,
        name: "Recibo_Publico_Mendoza.png",
        fileType: "image/png",
        url: "https://www.zohoapis.com/workdrive/api/v1/files/mock-recibo-id",
        status: "PENDING",
      },
    ],
  });

  // 2. Formulario Persona Jurídica - STATUS: APPROVED (Aprobado por oficial de cumplimiento)
  const formJuridica = await prisma.form.create({
    data: {
      type: "JURIDICA",
      status: "APPROVED",
      clientName: "Inversiones Varela S.A.",
      projectName: "Costa del Este Corporate Center",
      crmContactId: contactJuridica.id,
      conclusionesVerificacion: "Perfil financiero consistente. Sin alertas en listas de prevención.",
      data: {
        razonSocial: "Inversiones Varela S.A.",
        numeroDocumento: "1554628-1-657482 DV 23",
        email: "roberto.varela@corporation.com",
        celular: "+507 399-4455",
        projectName: "Costa del Este Corporate Center",
        actividadPrincipal: "Desarrollo Inmobiliario y Logístico",
        paisConstitucion: "Panamá",
      },
    },
  });

  // Representante legal
  await prisma.legalRepresentative.create({
    data: {
      formId: formJuridica.id,
      nombre: "Roberto Varela",
      nacionalidad: "Panameña",
      noIdentificacion: "8-777-7777",
      profesionOcupacion: "Director Ejecutivo",
      telefono: "+507 6666-9999",
      direccion: "Punta Pacifica, PH Loft, Apto 12B",
    },
  });

  // Junta Directiva
  await prisma.gjcMember.createMany({
    data: [
      {
        formId: formJuridica.id,
        cargo: "Presidente",
        nombre: "Roberto",
        apellidos: "Varela",
        nacionalidad: "Panameña",
        nroId: "8-777-7777",
      },
      {
        formId: formJuridica.id,
        cargo: "Secretaria",
        nombre: "María",
        apellidos: "Varela",
        nacionalidad: "Panameña",
        nroId: "8-444-4444",
      },
    ],
  });

  // Beneficiarios Finales
  await prisma.bfMember.create({
    data: {
      formId: formJuridica.id,
      nombreCompleto: "Roberto Varela",
      noIdentificacion: "8-777-7777",
      nacionalidad: "Panameña",
      porcentajeParticipacion: "100%",
      paisNacimiento: "Panamá",
    },
  });

  // Sincronizaciones simuladas para el formulario aprobado
  await prisma.crmSync.create({
    data: {
      formId: formJuridica.id,
      status: "SUCCESS",
      crmId: "crm-contact-juridica-202",
    },
  });

  await prisma.workDriveSync.create({
    data: {
      formId: formJuridica.id,
      status: "SUCCESS",
      folderUrl: "https://workdrive.zoho.com/folder/mock-folder-varela-id",
    },
  });

  await prisma.sapSync.create({
    data: {
      formId: formJuridica.id,
      status: "PENDING",
    },
  });

  console.log("🌱 Creando registros de auditoría...");
  await prisma.auditLog.createMany({
    data: [
      {
        action: "USER_LOGIN",
        entityName: "AdminUser",
        entityId: superadmin.id,
        userId: superadmin.id,
        ipAddress: "127.0.0.1",
        userAgent: "Chrome",
        details: "Inicio de sesión de Oficial de Cumplimiento",
      },
      {
        action: "LINK_GENERATE",
        entityName: "Draft",
        entityId: draftJuridica.id,
        userId: admin.id,
        ipAddress: "127.0.0.1",
        details: "Enlace generado para Inversiones Varela S.A.",
      },
    ],
  });

  console.log("🏁 ¡Seeding de desarrollo completado exitosamente!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
