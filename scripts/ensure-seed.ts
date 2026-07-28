import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";

// Runs before every `next dev` (see package.json "predev"). Schema sync
// (`prisma db push`) already ran by the time this executes; this only seeds
// sample data on a totally empty database (first run / fresh clone) so the
// app is never blank or broken out of the box. It never touches an existing,
// non-empty database.
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.carLoanRequest.count();
  if (count > 0) {
    console.log(`Database already has ${count} CarLoanRequest record(s) — skipping seed.`);
    return;
  }
  console.log("Database is empty — running seed script...");
  execSync("tsx prisma/seed.ts", { stdio: "inherit" });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
