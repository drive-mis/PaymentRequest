import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";

// Runs before `next dev` and `next start` (see the predev/prestart scripts in
// package.json). The database file is gitignored, so on a fresh clone it does
// not exist at all — without this the app would boot and then throw
// "table main.CarLoanRequest does not exist" on the first query.
//
// `prisma db push` (run just before this) creates/syncs the schema; this then
// seeds sample data only when the table is empty. It never touches a database
// that already has records.
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
