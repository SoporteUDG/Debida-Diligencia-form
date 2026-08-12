import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

const getPrisma = (): PrismaClient => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is missing.");
  }

  // Set up pg driver adapter required by Prisma 7
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const options = { adapter };

  if (process.env.NODE_ENV === "production") {
    return new PrismaClient(options);
  }
  if (!globalThis.prismaGlobal) {
    globalThis.prismaGlobal = new PrismaClient(options);
  }
  return globalThis.prismaGlobal;
};

// Proxy to delay instantiation of PrismaClient until a property is accessed
const prisma = new Proxy({} as PrismaClient, {
  get(target, prop, receiver) {
    const client = getPrisma();
    return Reflect.get(client, prop, receiver);
  }
});

export default prisma;
