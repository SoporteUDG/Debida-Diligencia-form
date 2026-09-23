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

// Mismo formato que generateToken (src/lib/tokenService.ts): 14 caracteres hex.
function newTokenValue(): string {
  return crypto.randomBytes(7).toString("hex");
}

const TOKEN_LIFETIME_DAYS = 30;

// Los crmId con prefijo "mock-" los resuelve zohoService en modo simulado,
// así que ningún borrador de prueba toca registros reales de Zoho CRM.
const DRAFT_SEEDS = [
  {
    type: "NATURAL" as const,
    crmId: "mock-nat-carlos-mendoza",
    firstName: "Carlos",
    lastName: "Mendoza",
    email: "carlos.mendoza@client.com",
    phone: "+507 6001-1234",
    projectName: "Ocean Reef Villa 14",
  },
  {
    type: "NATURAL" as const,
    crmId: "mock-nat-lucia-herrera",
    firstName: "Lucía",
    lastName: "Herrera",
    email: "lucia.herrera@client.com",
    phone: "+507 6002-5678",
    projectName: "Altos del Parque",
  },
  {
    type: "JURIDICA" as const,
    crmId: "mock-jur-inversiones-varela",
    // generar-enlace guarda la razón social en firstName para personas jurídicas
    firstName: "Inversiones Varela S.A.",
    lastName: "",
    email: "roberto.varela@corporation.com",
    phone: "+507 399-4455",
    projectName: "Costa del Este Corporate Center",
  },
];

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
  await prisma.formVersion.deleteMany({});
  await prisma.formEditAuthorization.deleteMany({});
  await prisma.form.deleteMany({});
  await prisma.draft.deleteMany({});
  await prisma.token.deleteMany({});
  await prisma.crmContact.deleteMany({});
  await prisma.adminUser.deleteMany({});
  console.log("✨ Limpieza completada.");

  console.log("🌱 Creando usuarios administradores...");
  await prisma.adminUser.create({
    data: {
      email: "admin@udg.com",
      name: "Oficial de Cumplimiento UDG",
      passwordHash: hashPassword("admin123"),
      role: "SUPERADMIN",
    },
  });

  await prisma.adminUser.create({
    data: {
      email: "oficial1@udg.com",
      name: "Ana Ramírez",
      passwordHash: hashPassword("oficial2026"),
      role: "ADMIN",
    },
  });

  console.log("🌱 Creando contactos, tokens y borradores...");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const links: string[] = [];

  for (const seed of DRAFT_SEEDS) {
    const isNatural = seed.type === "NATURAL";

    const contact = await prisma.crmContact.create({
      data: {
        crmId: seed.crmId,
        firstName: seed.firstName,
        lastName: seed.lastName,
        email: seed.email,
        phone: seed.phone,
      },
    });

    const tokenValue = newTokenValue();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TOKEN_LIFETIME_DAYS);

    await prisma.token.create({
      data: {
        token: tokenValue,
        type: "ACCESS",
        crmContactId: contact.id,
        expiresAt,
        used: false,
      },
    });

    // Misma forma de datos que crea /api/generar-enlace al emitir un enlace nuevo
    await prisma.draft.create({
      data: {
        token: tokenValue,
        type: seed.type,
        crmContactId: contact.id,
        step: 1,
        data: {
          crmContactId: seed.crmId,
          nombreProyecto: seed.projectName,
          ...(isNatural
            ? { firstName: seed.firstName, lastName: seed.lastName, email: seed.email }
            : { razonSocial: seed.firstName, contactoEmail: seed.email }),
        },
      },
    });

    const formPath = isNatural ? "persona-natural" : "persona-juridica";
    links.push(`   ${seed.type.padEnd(8)} ${seed.firstName} ${seed.lastName}`.trimEnd());
    links.push(`            ${appUrl}/${formPath}?token=${tokenValue}`);
  }

  console.log("🔗 Enlaces de acceso (vigentes por " + TOKEN_LIFETIME_DAYS + " días):");
  for (const line of links) console.log(line);

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
