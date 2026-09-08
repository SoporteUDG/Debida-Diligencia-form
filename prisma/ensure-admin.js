const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

async function ensureAdmin() {
  const prisma = new PrismaClient();
  try {
    const count = await prisma.adminUser.count();
    if (count === 0) {
      const email = process.env.ADMIN_INITIAL_EMAIL || "admin@udg.com";
      const password = process.env.ADMIN_INITIAL_PASSWORD || "admin123";
      const name = process.env.ADMIN_INITIAL_NAME || "Oficial de Cumplimiento UDG";

      await prisma.adminUser.create({
        data: {
          email,
          name,
          passwordHash: hashPassword(password),
          role: "SUPERADMIN",
        },
      });
      console.log(`[Init DB] Usuario administrador inicial creado exitosamente: ${email}`);
    } else {
      console.log("[Init DB] Administrador(es) ya existentes en la base de datos.");
    }
  } catch (err) {
    console.error("[Init DB] Error asegurando usuario admin:", err);
  } finally {
    await prisma.$disconnect();
  }
}

ensureAdmin();
