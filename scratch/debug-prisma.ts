import "./load-env";
import prisma from "../src/lib/prisma";

async function main() {
  console.log("DATABASE_URL:", process.env.DATABASE_URL ? "DEFINED" : "UNDEFINED");
  try {
    console.log("Running query using configured prisma client...");
    const count = await prisma.crmContact.count();
    console.log("Query success! Contact count:", count);
  } catch (e: any) {
    console.error("Initialization / Query Error details:");
    console.error("Name:", e.name);
    console.error("Message:", e.message);
    console.error("Code:", e.code);
    console.error("Stack:", e.stack);
  }
}
main();
