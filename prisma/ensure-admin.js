const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Load .env if present and DATABASE_URL is not set
if (!process.env.DATABASE_URL) {
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
  } catch (_) {}
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

async function ensureAdmin() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("[Init DB] No se encontró DATABASE_URL en las variables de entorno.");
    return;
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

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
    try {
      await prisma.$disconnect();
      await pool.end();
    } catch (_) {}
  }
}

ensureAdmin();
