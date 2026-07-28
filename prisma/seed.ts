import { PrismaClient } from "@prisma/client";
import { MOCK_CUSTOMERS, MOCK_VEHICLES } from "../src/lib/mockSource";
import { BRANCHES, PROGRAMS, BANKS } from "../src/lib/choices";
import { computeDuplicateCheckKey, deriveSubStatuses } from "../src/lib/rules";
import type { StatusHistoryEntry, AuditEntry } from "../src/lib/types";

const prisma = new PrismaClient();

const SALES = ["Mona Aziz", "Karim Adel"];
const OPS = ["Yara Hassan", "Tarek Fathy"];
const FINANCE = ["Nadia Salem", "Omar Ibrahim"];
const SALES_MANAGERS = ["Hossam Younes", "Dina Farag"];

let clock = Date.now() - 26 * 24 * 3600 * 1000; // start ~26 days ago

function tick(hours: number): string {
  clock += hours * 3600 * 1000;
  return new Date(clock).toISOString();
}

function history(entries: Omit<StatusHistoryEntry, "changedAt">[], gapsHours: number[]): StatusHistoryEntry[] {
  return entries.map((e, i) => ({ ...e, changedAt: tick(gapsHours[i] ?? 6) }));
}

function audit(fromHistory: StatusHistoryEntry[]): AuditEntry[] {
  return fromHistory.map((h) => ({
    action: "STATUS_CHANGE",
    field: "STATUS",
    oldValue: null,
    newValue: h.status,
    user: h.changedBy,
    role: h.changedByRole,
    timestamp: h.changedAt,
  }));
}

interface Seed {
  idx: number;
  customer: (typeof MOCK_CUSTOMERS)[number];
  vehicle: (typeof MOCK_VEHICLES)[number];
  branch: string;
  program: (typeof PROGRAMS)[number];
  salesAgent: string;
  status: string;
  loan?: { price: number; down: number; loan: number; rate: number; tenor: number; fees: number; bank: string; branch: string };
  history: StatusHistoryEntry[];
  contractReadyStatus?: string;
  operationNotes?: string;
  deviation?: string;
  cheque?: { number: string; location: string };
  ackFile?: string;
  isDuplicate?: boolean;
  duplicateOf?: string;
}

function appId(n: number) {
  return `APP-${String(n).padStart(6, "0")}`;
}

async function main() {
  console.log("Seeding CarLoanRequest…");
  await prisma.carLoanRequest.deleteMany();

  const seeds: Seed[] = [];
  let n = 1;

  // 1. Plain Draft (Sales)
  {
    clock = Date.now() - 2 * 24 * 3600 * 1000;
    const h = history(
      [{ stage: "Sales", status: "Draft", decision: "Created", reason: null, changedBy: "Mona Aziz", changedByRole: "Sales" }],
      [0]
    );
    seeds.push({
      idx: n++,
      customer: MOCK_CUSTOMERS[0],
      vehicle: MOCK_VEHICLES[0],
      branch: BRANCHES[0],
      program: PROGRAMS[0],
      salesAgent: "Mona Aziz",
      status: "Draft",
      history: h,
      contractReadyStatus: "Not Ready",
    });
  }

  // 2. Draft created by Operations
  {
    clock = Date.now() - 1 * 24 * 3600 * 1000;
    const h = history(
      [{ stage: "Operations", status: "Draft", decision: "Created", reason: null, changedBy: "Yara Hassan", changedByRole: "Operations" }],
      [0]
    );
    seeds.push({
      idx: n++,
      customer: MOCK_CUSTOMERS[1],
      vehicle: MOCK_VEHICLES[1],
      branch: BRANCHES[1],
      program: PROGRAMS[0],
      salesAgent: "Yara Hassan",
      status: "Draft",
      history: h,
      contractReadyStatus: "Ready for Review",
    });
  }

  // 3. Submitted for Operations Review
  {
    clock = Date.now() - 6 * 24 * 3600 * 1000;
    const h = history(
      [
        { stage: "Sales", status: "Draft", decision: "Created", reason: null, changedBy: "Karim Adel", changedByRole: "Sales" },
        { stage: "Sales", status: "Submitted for Operations Review", decision: null, reason: null, changedBy: "Karim Adel", changedByRole: "Sales" },
      ],
      [0, 4]
    );
    seeds.push({
      idx: n++,
      customer: MOCK_CUSTOMERS[2],
      vehicle: MOCK_VEHICLES[2],
      branch: BRANCHES[2],
      program: PROGRAMS[1],
      salesAgent: "Karim Adel",
      status: "Submitted for Operations Review",
      history: h,
      contractReadyStatus: "Sent for Review",
    });
  }

  // 4. Under Operations Review
  {
    clock = Date.now() - 5 * 24 * 3600 * 1000;
    const h = history(
      [
        { stage: "Sales", status: "Draft", decision: "Created", reason: null, changedBy: "Mona Aziz", changedByRole: "Sales" },
        { stage: "Sales", status: "Submitted for Operations Review", decision: null, reason: null, changedBy: "Mona Aziz", changedByRole: "Sales" },
        { stage: "Operations", status: "Under Operations Review", decision: null, reason: null, changedBy: "Tarek Fathy", changedByRole: "Operations" },
      ],
      [0, 3, 10]
    );
    seeds.push({
      idx: n++,
      customer: MOCK_CUSTOMERS[3],
      vehicle: MOCK_VEHICLES[3],
      branch: BRANCHES[0],
      program: PROGRAMS[2],
      salesAgent: "Mona Aziz",
      status: "Under Operations Review",
      history: h,
      contractReadyStatus: "Sent for Review",
      operationNotes: "Documents look complete, verifying pricing before proceeding.",
    });
  }

  // 5. Returned by Operations (currently sitting, needs Sales fix)
  {
    clock = Date.now() - 4 * 24 * 3600 * 1000;
    const h = history(
      [
        { stage: "Sales", status: "Draft", decision: "Created", reason: null, changedBy: "Karim Adel", changedByRole: "Sales" },
        { stage: "Sales", status: "Submitted for Operations Review", decision: null, reason: null, changedBy: "Karim Adel", changedByRole: "Sales" },
        { stage: "Operations", status: "Under Operations Review", decision: null, reason: null, changedBy: "Yara Hassan", changedByRole: "Operations" },
        {
          stage: "Operations",
          status: "Returned by Operations",
          decision: "Returned",
          reason: "Missing beneficiary ID documents — please re-upload a clear scan.",
          changedBy: "Yara Hassan",
          changedByRole: "Operations",
        },
      ],
      [0, 2, 8, 5]
    );
    seeds.push({
      idx: n++,
      customer: MOCK_CUSTOMERS[4],
      vehicle: MOCK_VEHICLES[4],
      branch: BRANCHES[3],
      program: PROGRAMS[0],
      salesAgent: "Karim Adel",
      status: "Returned by Operations",
      history: h,
      contractReadyStatus: "Sent for Review",
      deviation: "Beneficiary documents illegible",
    });
  }

  // 6. Returned by Operations then fixed & resubmitted (now Submitted again)
  {
    clock = Date.now() - 9 * 24 * 3600 * 1000;
    const h = history(
      [
        { stage: "Sales", status: "Draft", decision: "Created", reason: null, changedBy: "Mona Aziz", changedByRole: "Sales" },
        { stage: "Sales", status: "Submitted for Operations Review", decision: null, reason: null, changedBy: "Mona Aziz", changedByRole: "Sales" },
        { stage: "Operations", status: "Under Operations Review", decision: null, reason: null, changedBy: "Tarek Fathy", changedByRole: "Operations" },
        {
          stage: "Operations",
          status: "Returned by Operations",
          decision: "Returned",
          reason: "Down payment on the pricing sheet doesn't match the contract — please correct and resend.",
          changedBy: "Tarek Fathy",
          changedByRole: "Operations",
        },
        { stage: "Sales", status: "Submitted for Operations Review", decision: null, reason: null, changedBy: "Mona Aziz", changedByRole: "Sales" },
      ],
      [0, 3, 6, 4, 18]
    );
    seeds.push({
      idx: n++,
      customer: MOCK_CUSTOMERS[5],
      vehicle: MOCK_VEHICLES[5],
      branch: BRANCHES[1],
      program: PROGRAMS[1],
      salesAgent: "Mona Aziz",
      status: "Submitted for Operations Review",
      history: h,
      contractReadyStatus: "Sent for Review",
    });
  }

  // 7. Rejected by Operations
  {
    clock = Date.now() - 10 * 24 * 3600 * 1000;
    const h = history(
      [
        { stage: "Sales", status: "Draft", decision: "Created", reason: null, changedBy: "Karim Adel", changedByRole: "Sales" },
        { stage: "Sales", status: "Submitted for Operations Review", decision: null, reason: null, changedBy: "Karim Adel", changedByRole: "Sales" },
        { stage: "Operations", status: "Under Operations Review", decision: null, reason: null, changedBy: "Yara Hassan", changedByRole: "Operations" },
        {
          stage: "Operations",
          status: "Rejected by Operations",
          decision: "Rejected",
          reason: "Customer failed internal credit policy checks.",
          changedBy: "Yara Hassan",
          changedByRole: "Operations",
        },
      ],
      [0, 2, 6, 4]
    );
    seeds.push({
      idx: n++,
      customer: MOCK_CUSTOMERS[6],
      vehicle: MOCK_VEHICLES[6],
      branch: BRANCHES[4],
      program: PROGRAMS[0],
      salesAgent: "Karim Adel",
      status: "Rejected by Operations",
      history: h,
    });
  }

  // 8. Payment Request Submitted (awaiting Finance to start review)
  {
    clock = Date.now() - 7 * 24 * 3600 * 1000;
    const h = history(
      [
        { stage: "Sales", status: "Draft", decision: "Created", reason: null, changedBy: "Mona Aziz", changedByRole: "Sales" },
        { stage: "Sales", status: "Submitted for Operations Review", decision: null, reason: null, changedBy: "Mona Aziz", changedByRole: "Sales" },
        { stage: "Operations", status: "Under Operations Review", decision: null, reason: null, changedBy: "Tarek Fathy", changedByRole: "Operations" },
        { stage: "Operations", status: "Payment Request Submitted", decision: "Approved", reason: null, changedBy: "Tarek Fathy", changedByRole: "Operations" },
      ],
      [0, 3, 8, 6]
    );
    seeds.push({
      idx: n++,
      customer: MOCK_CUSTOMERS[7],
      vehicle: MOCK_VEHICLES[7],
      branch: BRANCHES[0],
      program: PROGRAMS[2],
      salesAgent: "Tarek Fathy",
      status: "Payment Request Submitted",
      history: h,
      contractReadyStatus: "Sent for Review",
      loan: { price: 2_450_000, down: 490_000, loan: 1_960_000, rate: 22.5, tenor: 48, fees: 15_000, bank: BANKS[0].BANK_NAME, branch: BANKS[0].branches[0] },
    });
  }

  // 9. Under Finance Review
  {
    clock = Date.now() - 6 * 24 * 3600 * 1000;
    const h = history(
      [
        { stage: "Sales", status: "Draft", decision: "Created", reason: null, changedBy: "Karim Adel", changedByRole: "Sales" },
        { stage: "Sales", status: "Submitted for Operations Review", decision: null, reason: null, changedBy: "Karim Adel", changedByRole: "Sales" },
        { stage: "Operations", status: "Under Operations Review", decision: null, reason: null, changedBy: "Yara Hassan", changedByRole: "Operations" },
        { stage: "Operations", status: "Payment Request Submitted", decision: "Approved", reason: null, changedBy: "Yara Hassan", changedByRole: "Operations" },
        { stage: "Finance", status: "Under Finance Review", decision: null, reason: null, changedBy: "Nadia Salem", changedByRole: "Finance" },
      ],
      [0, 2, 6, 5, 9]
    );
    seeds.push({
      idx: n++,
      customer: MOCK_CUSTOMERS[8],
      vehicle: MOCK_VEHICLES[8],
      branch: BRANCHES[5],
      program: PROGRAMS[3],
      salesAgent: "Yara Hassan",
      status: "Under Finance Review",
      history: h,
      loan: { price: 1_850_000, down: 370_000, loan: 1_480_000, rate: 21, tenor: 36, fees: 12_000, bank: BANKS[1].BANK_NAME, branch: BANKS[1].branches[0] },
    });
  }

  // 10. Returned by Finance (currently sitting)
  {
    clock = Date.now() - 8 * 24 * 3600 * 1000;
    const h = history(
      [
        { stage: "Sales", status: "Draft", decision: "Created", reason: null, changedBy: "Mona Aziz", changedByRole: "Sales" },
        { stage: "Sales", status: "Submitted for Operations Review", decision: null, reason: null, changedBy: "Mona Aziz", changedByRole: "Sales" },
        { stage: "Operations", status: "Under Operations Review", decision: null, reason: null, changedBy: "Tarek Fathy", changedByRole: "Operations" },
        { stage: "Operations", status: "Payment Request Submitted", decision: "Approved", reason: null, changedBy: "Tarek Fathy", changedByRole: "Operations" },
        { stage: "Finance", status: "Under Finance Review", decision: null, reason: null, changedBy: "Omar Ibrahim", changedByRole: "Finance" },
        {
          stage: "Finance",
          status: "Returned by Finance",
          decision: "Returned",
          reason: "Down payment percentage is below the 20% policy floor for this program — please revise.",
          changedBy: "Omar Ibrahim",
          changedByRole: "Finance",
        },
      ],
      [0, 3, 5, 4, 7, 6]
    );
    seeds.push({
      idx: n++,
      customer: MOCK_CUSTOMERS[9],
      vehicle: MOCK_VEHICLES[9],
      branch: BRANCHES[2],
      program: PROGRAMS[0],
      salesAgent: "Tarek Fathy",
      status: "Returned by Finance",
      history: h,
      loan: { price: 1_600_000, down: 160_000, loan: 1_440_000, rate: 23, tenor: 60, fees: 10_000, bank: BANKS[2].BANK_NAME, branch: BANKS[2].branches[0] },
    });
  }

  // 11. Returned by Finance then fixed & resubmitted (now Payment Request Submitted again)
  {
    clock = Date.now() - 12 * 24 * 3600 * 1000;
    const h = history(
      [
        { stage: "Sales", status: "Draft", decision: "Created", reason: null, changedBy: "Karim Adel", changedByRole: "Sales" },
        { stage: "Sales", status: "Submitted for Operations Review", decision: null, reason: null, changedBy: "Karim Adel", changedByRole: "Sales" },
        { stage: "Operations", status: "Under Operations Review", decision: null, reason: null, changedBy: "Yara Hassan", changedByRole: "Operations" },
        { stage: "Operations", status: "Payment Request Submitted", decision: "Approved", reason: null, changedBy: "Yara Hassan", changedByRole: "Operations" },
        { stage: "Finance", status: "Under Finance Review", decision: null, reason: null, changedBy: "Nadia Salem", changedByRole: "Finance" },
        {
          stage: "Finance",
          status: "Returned by Finance",
          decision: "Returned",
          reason: "Bank branch code on file doesn't match the customer's provided bank letter.",
          changedBy: "Nadia Salem",
          changedByRole: "Finance",
        },
        { stage: "Operations", status: "Payment Request Submitted", decision: "Approved", reason: null, changedBy: "Yara Hassan", changedByRole: "Operations" },
      ],
      [0, 2, 5, 4, 6, 5, 8]
    );
    seeds.push({
      idx: n++,
      customer: MOCK_CUSTOMERS[0],
      vehicle: MOCK_VEHICLES[9],
      branch: BRANCHES[0],
      program: PROGRAMS[1],
      salesAgent: "Karim Adel",
      status: "Payment Request Submitted",
      history: h,
      loan: { price: 2_100_000, down: 420_000, loan: 1_680_000, rate: 22, tenor: 48, fees: 14_000, bank: BANKS[3].BANK_NAME, branch: BANKS[3].branches[0] },
    });
  }

  // 12. Rejected by Finance
  {
    clock = Date.now() - 13 * 24 * 3600 * 1000;
    const h = history(
      [
        { stage: "Sales", status: "Draft", decision: "Created", reason: null, changedBy: "Mona Aziz", changedByRole: "Sales" },
        { stage: "Sales", status: "Submitted for Operations Review", decision: null, reason: null, changedBy: "Mona Aziz", changedByRole: "Sales" },
        { stage: "Operations", status: "Under Operations Review", decision: null, reason: null, changedBy: "Tarek Fathy", changedByRole: "Operations" },
        { stage: "Operations", status: "Payment Request Submitted", decision: "Approved", reason: null, changedBy: "Tarek Fathy", changedByRole: "Operations" },
        { stage: "Finance", status: "Under Finance Review", decision: null, reason: null, changedBy: "Omar Ibrahim", changedByRole: "Finance" },
        {
          stage: "Finance",
          status: "Rejected by Finance",
          decision: "Rejected",
          reason: "Treasury flagged insufficient collateral coverage for this loan amount.",
          changedBy: "Omar Ibrahim",
          changedByRole: "Finance",
        },
      ],
      [0, 2, 6, 5, 7, 4]
    );
    seeds.push({
      idx: n++,
      customer: MOCK_CUSTOMERS[1],
      vehicle: MOCK_VEHICLES[8],
      branch: BRANCHES[3],
      program: PROGRAMS[2],
      salesAgent: "Mona Aziz",
      status: "Rejected by Finance",
      history: h,
      loan: { price: 3_200_000, down: 320_000, loan: 2_880_000, rate: 24, tenor: 60, fees: 20_000, bank: BANKS[0].BANK_NAME, branch: BANKS[0].branches[1] },
    });
  }

  // 13. Approved by Finance (ready for cheque issuance)
  {
    clock = Date.now() - 5 * 24 * 3600 * 1000;
    const h = history(
      [
        { stage: "Sales", status: "Draft", decision: "Created", reason: null, changedBy: "Karim Adel", changedByRole: "Sales" },
        { stage: "Sales", status: "Submitted for Operations Review", decision: null, reason: null, changedBy: "Karim Adel", changedByRole: "Sales" },
        { stage: "Operations", status: "Under Operations Review", decision: null, reason: null, changedBy: "Yara Hassan", changedByRole: "Operations" },
        { stage: "Operations", status: "Payment Request Submitted", decision: "Approved", reason: null, changedBy: "Yara Hassan", changedByRole: "Operations" },
        { stage: "Finance", status: "Under Finance Review", decision: null, reason: null, changedBy: "Nadia Salem", changedByRole: "Finance" },
        { stage: "Finance", status: "Approved by Finance", decision: "Approved", reason: null, changedBy: "Nadia Salem", changedByRole: "Finance" },
      ],
      [0, 2, 5, 4, 6, 5]
    );
    seeds.push({
      idx: n++,
      customer: MOCK_CUSTOMERS[2],
      vehicle: MOCK_VEHICLES[7],
      branch: BRANCHES[1],
      program: PROGRAMS[0],
      salesAgent: "Karim Adel",
      status: "Approved by Finance",
      history: h,
      loan: { price: 1_750_000, down: 350_000, loan: 1_400_000, rate: 21.5, tenor: 42, fees: 11_000, bank: BANKS[1].BANK_NAME, branch: BANKS[1].branches[1] },
    });
  }

  // 14. Cheque Issued (awaiting Operations pickup)
  {
    clock = Date.now() - 11 * 24 * 3600 * 1000;
    const h = history(
      [
        { stage: "Sales", status: "Draft", decision: "Created", reason: null, changedBy: "Mona Aziz", changedByRole: "Sales" },
        { stage: "Sales", status: "Submitted for Operations Review", decision: null, reason: null, changedBy: "Mona Aziz", changedByRole: "Sales" },
        { stage: "Operations", status: "Under Operations Review", decision: null, reason: null, changedBy: "Tarek Fathy", changedByRole: "Operations" },
        { stage: "Operations", status: "Payment Request Submitted", decision: "Approved", reason: null, changedBy: "Tarek Fathy", changedByRole: "Operations" },
        { stage: "Finance", status: "Under Finance Review", decision: null, reason: null, changedBy: "Omar Ibrahim", changedByRole: "Finance" },
        { stage: "Finance", status: "Approved by Finance", decision: "Approved", reason: null, changedBy: "Omar Ibrahim", changedByRole: "Finance" },
        { stage: "Finance", status: "Cheque Issued", decision: null, reason: null, changedBy: "Omar Ibrahim", changedByRole: "Finance" },
      ],
      [0, 2, 5, 4, 6, 5, 8]
    );
    seeds.push({
      idx: n++,
      customer: MOCK_CUSTOMERS[3],
      vehicle: MOCK_VEHICLES[6],
      branch: BRANCHES[4],
      program: PROGRAMS[1],
      salesAgent: "Mona Aziz",
      status: "Cheque Issued",
      history: h,
      loan: { price: 1_950_000, down: 390_000, loan: 1_560_000, rate: 22, tenor: 48, fees: 13_000, bank: BANKS[2].BANK_NAME, branch: BANKS[2].branches[1] },
      cheque: { number: "CHQ-0098213", location: "Treasury Safe — HQ" },
    });
  }

  // 15. Cheque Delivered to Operations (awaiting customer delivery)
  {
    clock = Date.now() - 14 * 24 * 3600 * 1000;
    const h = history(
      [
        { stage: "Sales", status: "Draft", decision: "Created", reason: null, changedBy: "Karim Adel", changedByRole: "Sales" },
        { stage: "Sales", status: "Submitted for Operations Review", decision: null, reason: null, changedBy: "Karim Adel", changedByRole: "Sales" },
        { stage: "Operations", status: "Under Operations Review", decision: null, reason: null, changedBy: "Yara Hassan", changedByRole: "Operations" },
        { stage: "Operations", status: "Payment Request Submitted", decision: "Approved", reason: null, changedBy: "Yara Hassan", changedByRole: "Operations" },
        { stage: "Finance", status: "Under Finance Review", decision: null, reason: null, changedBy: "Nadia Salem", changedByRole: "Finance" },
        { stage: "Finance", status: "Approved by Finance", decision: "Approved", reason: null, changedBy: "Nadia Salem", changedByRole: "Finance" },
        { stage: "Finance", status: "Cheque Issued", decision: null, reason: null, changedBy: "Nadia Salem", changedByRole: "Finance" },
        {
          stage: "Operations",
          status: "Cheque Delivered to Operations",
          decision: null,
          reason: null,
          changedBy: "Tarek Fathy",
          changedByRole: "Operations",
        },
      ],
      [0, 2, 5, 4, 6, 5, 4, 6]
    );
    seeds.push({
      idx: n++,
      customer: MOCK_CUSTOMERS[4],
      vehicle: MOCK_VEHICLES[5],
      branch: BRANCHES[0],
      program: PROGRAMS[2],
      salesAgent: "Karim Adel",
      status: "Cheque Delivered to Operations",
      history: h,
      loan: { price: 2_650_000, down: 530_000, loan: 2_120_000, rate: 23, tenor: 54, fees: 18_000, bank: BANKS[3].BANK_NAME, branch: BANKS[3].branches[1] },
      cheque: { number: "CHQ-0098214", location: "In transit to Nasr City branch" },
    });
  }

  // 16 & 17. Delivered to Customer (fully completed)
  for (let k = 0; k < 2; k++) {
    clock = Date.now() - (18 + k * 2) * 24 * 3600 * 1000;
    const salesAgent = SALES[k % 2];
    const opsRev = OPS[k % 2];
    const finRev = FINANCE[k % 2];
    const h = history(
      [
        { stage: "Sales", status: "Draft", decision: "Created", reason: null, changedBy: salesAgent, changedByRole: "Sales" },
        { stage: "Sales", status: "Submitted for Operations Review", decision: null, reason: null, changedBy: salesAgent, changedByRole: "Sales" },
        { stage: "Operations", status: "Under Operations Review", decision: null, reason: null, changedBy: opsRev, changedByRole: "Operations" },
        { stage: "Operations", status: "Payment Request Submitted", decision: "Approved", reason: null, changedBy: opsRev, changedByRole: "Operations" },
        { stage: "Finance", status: "Under Finance Review", decision: null, reason: null, changedBy: finRev, changedByRole: "Finance" },
        { stage: "Finance", status: "Approved by Finance", decision: "Approved", reason: null, changedBy: finRev, changedByRole: "Finance" },
        { stage: "Finance", status: "Cheque Issued", decision: null, reason: null, changedBy: finRev, changedByRole: "Finance" },
        { stage: "Operations", status: "Cheque Delivered to Operations", decision: null, reason: null, changedBy: opsRev, changedByRole: "Operations" },
        { stage: "Operations", status: "Delivered to Customer", decision: null, reason: null, changedBy: opsRev, changedByRole: "Operations" },
      ],
      [0, 2, 5, 4, 6, 5, 4, 5, 7]
    );
    seeds.push({
      idx: n++,
      customer: MOCK_CUSTOMERS[6 + k],
      vehicle: MOCK_VEHICLES[3 + k],
      branch: BRANCHES[k % BRANCHES.length],
      program: PROGRAMS[k % PROGRAMS.length],
      salesAgent,
      status: "Delivered to Customer",
      history: h,
      loan: {
        price: 1_800_000 + k * 200_000,
        down: 360_000 + k * 40_000,
        loan: 1_440_000 + k * 160_000,
        rate: 21 + k,
        tenor: 36 + k * 6,
        fees: 12_000 + k * 1_000,
        bank: BANKS[k % BANKS.length].BANK_NAME,
        branch: BANKS[k % BANKS.length].branches[0],
      },
      cheque: { number: `CHQ-009821${5 + k}`, location: "Delivered" },
      ackFile: "/uploads/seed-acknowledgement-sample.txt",
    });
  }

  // 18. Cancelled
  {
    clock = Date.now() - 3 * 24 * 3600 * 1000;
    const h = history(
      [
        { stage: "Sales", status: "Draft", decision: "Created", reason: null, changedBy: "Mona Aziz", changedByRole: "Sales" },
        {
          stage: "System",
          status: "Cancelled",
          decision: "Cancelled",
          reason: "Customer withdrew the application after finding alternative financing.",
          changedBy: "Mona Aziz",
          changedByRole: "Sales",
        },
      ],
      [0, 5]
    );
    seeds.push({
      idx: n++,
      customer: MOCK_CUSTOMERS[5],
      vehicle: MOCK_VEHICLES[4],
      branch: BRANCHES[2],
      program: PROGRAMS[0],
      salesAgent: "Mona Aziz",
      status: "Cancelled",
      history: h,
    });
  }

  // 19 & 20. Duplicate-flagged pair — same customer + same vehicle, different loan amount
  const dupCustomer = MOCK_CUSTOMERS[7];
  const dupVehicle = MOCK_VEHICLES[2];
  let dupFirstAppId = "";
  {
    clock = Date.now() - 16 * 24 * 3600 * 1000;
    const h = history(
      [
        { stage: "Sales", status: "Draft", decision: "Created", reason: null, changedBy: "Karim Adel", changedByRole: "Sales" },
        { stage: "Sales", status: "Submitted for Operations Review", decision: null, reason: null, changedBy: "Karim Adel", changedByRole: "Sales" },
        { stage: "Operations", status: "Under Operations Review", decision: null, reason: null, changedBy: "Yara Hassan", changedByRole: "Operations" },
        { stage: "Operations", status: "Payment Request Submitted", decision: "Approved", reason: null, changedBy: "Yara Hassan", changedByRole: "Operations" },
      ],
      [0, 2, 5, 4]
    );
    dupFirstAppId = appId(n);
    seeds.push({
      idx: n++,
      customer: dupCustomer,
      vehicle: dupVehicle,
      branch: BRANCHES[0],
      program: PROGRAMS[1],
      salesAgent: "Karim Adel",
      status: "Payment Request Submitted",
      history: h,
      loan: { price: 2_000_000, down: 400_000, loan: 1_600_000, rate: 22, tenor: 48, fees: 14_000, bank: BANKS[0].BANK_NAME, branch: BANKS[0].branches[0] },
    });
  }
  {
    clock = Date.now() - 1.5 * 24 * 3600 * 1000;
    const h = history(
      [{ stage: "Sales", status: "Draft", decision: "Created", reason: null, changedBy: "Mona Aziz", changedByRole: "Sales" }],
      [0]
    );
    seeds.push({
      idx: n++,
      customer: dupCustomer,
      vehicle: dupVehicle,
      branch: BRANCHES[0],
      program: PROGRAMS[1],
      salesAgent: "Mona Aziz",
      status: "Draft",
      history: h,
      isDuplicate: true,
      duplicateOf: dupFirstAppId,
    });
  }

  for (const s of seeds) {
    const id = appId(s.idx);
    const loanAmountCalculated = s.loan ? s.loan.price - s.loan.down : null;
    const subStatuses = deriveSubStatuses(s.status as any);

    await prisma.carLoanRequest.create({
      data: {
        APP_ID: id,
        APP_DATETIME: s.history[0].changedAt,
        APP_CUSTOMER_TYPE: s.customer.APP_CUSTOMER_TYPE,
        APP_PROGRAM_ID: s.program.APP_PROGRAM_ID,
        PROGRAM_NAME: s.program.PROGRAM_NAME,
        Branch: s.branch,
        STATUS: s.status,
        CREATION_DATE: "Seed data",

        CUSTOMER_NAME: s.customer.CUSTOMER_NAME,
        CUSTOMER_ID_NUMBER: s.customer.CUSTOMER_ID_NUMBER,
        CUSTOMER_GENDER: s.customer.CUSTOMER_GENDER,
        CUSTOMER_NATIONALITY: s.customer.CUSTOMER_NATIONALITY,
        CUSTOMER_TITLE: s.customer.CUSTOMER_TITLE,
        CUSTOMER_CLASS: s.customer.CUSTOMER_CLASS,
        ORGANIZATION_NAME: s.customer.ORGANIZATION_NAME ?? null,
        ORG_TYPE: s.customer.ORG_TYPE ?? null,
        ORG_REG_NUMBER: s.customer.ORG_REG_NUMBER ?? null,

        BRAND_NAME: s.vehicle.BRAND_NAME,
        MODEL: s.vehicle.MODEL,
        CarType: s.vehicle.CarType,
        CHASIS_NUMBER: s.vehicle.CHASIS_NUMBER,
        MOTOR_NUMBER: s.vehicle.MOTOR_NUMBER,
        COLOR: s.vehicle.COLOR,
        ENGINE_SIZE: s.vehicle.ENGINE_SIZE,
        YEAR_OF_PRODUCT: s.vehicle.YEAR_OF_PRODUCT,

        ContractType: "New Finance",
        ContractReadyStatus: s.contractReadyStatus ?? "Sent for Review",
        ContractSigningDate: s.loan ? s.history[0].changedAt : null,
        DRV_SALES_MAN: s.salesAgent,
        DRV_SALES_MANAGER: SALES_MANAGERS[s.idx % SALES_MANAGERS.length],
        InsuranceType: "Comprehensive",
        ReceivalMethod: "Branch Pickup",

        OperationNotes: s.operationNotes ?? null,
        DEVIATION: s.deviation ?? null,
        FEEDBACK: null,
        OperationsReviewedBy: s.history.find((e) => e.stage === "Operations")?.changedBy ?? null,
        OperationsReviewDate: s.history.find((e) => e.stage === "Operations")?.changedAt ?? null,

        PRICE: s.loan?.price ?? null,
        DOWN_PAYMENT: s.loan?.down ?? null,
        LOAN_AMOUNT: s.loan?.loan ?? null,
        LoanAmountCalculated: loanAmountCalculated,
        INTEREST_RATE: s.loan?.rate ?? null,
        TENOR_MONTH: s.loan?.tenor ?? null,
        ADMIN_FEES: s.loan?.fees ?? null,
        BANK_NAME: s.loan?.bank ?? null,
        BANK_BRANCH: s.loan?.branch ?? null,

        PaymentRequestStatus: (subStatuses.PaymentRequestStatus as string) ?? "Draft",
        DECISION: [...s.history].reverse().find((e) => e.decision)?.decision ?? null,
        REASON: [...s.history].reverse().find((e) => e.reason)?.reason ?? null,

        FinanceStatus: (subStatuses.FinanceStatus as string) ?? "Pending",
        FinanceNotes: null,
        ChequeNumber: s.cheque?.number ?? null,
        ChequeLocation: s.cheque?.location ?? null,
        Cheque: s.cheque ? "/uploads/seed-cheque-sample.txt" : null,
        FinanceReviewedBy: s.history.find((e) => e.stage === "Finance")?.changedBy ?? null,
        FinanceReviewDate: s.history.find((e) => e.stage === "Finance")?.changedAt ?? null,

        ChequeDeliveryStatus: (subStatuses.ChequeDeliveryStatus as string) ?? "Pending",
        ChequeHandoverToOperationsDate: s.status === "Cheque Delivered to Operations" || s.status === "Delivered to Customer" ? s.history.find((e) => e.status === "Cheque Delivered to Operations")?.changedAt ?? null : null,
        ChequeHandoverToOperationsBy: s.status === "Cheque Delivered to Operations" || s.status === "Delivered to Customer" ? s.history.find((e) => e.status === "Cheque Delivered to Operations")?.changedBy ?? null : null,
        ChequeDeliveredToCustomerDate: s.status === "Delivered to Customer" ? s.history.find((e) => e.status === "Delivered to Customer")?.changedAt ?? null : null,
        ChequeDeliveredToCustomerBy: s.status === "Delivered to Customer" ? s.history.find((e) => e.status === "Delivered to Customer")?.changedBy ?? null : null,
        CustomerAcknowledgementFile: s.ackFile ?? null,

        DuplicateCheckKey: computeDuplicateCheckKey(s.customer.CUSTOMER_ID_NUMBER, s.vehicle.CHASIS_NUMBER, s.loan?.loan ?? null),
        IsPotentialDuplicate: !!s.isDuplicate,
        DuplicateOfAppID: s.duplicateOf ?? null,

        StatusHistoryLog: JSON.stringify(s.history),
        AuditTrail: JSON.stringify(audit(s.history)),
        CreatedBy: s.history[0].changedBy,
        CreatedOn: s.history[0].changedAt,
        ModifiedBy: s.history[s.history.length - 1].changedBy,
        IsLocked: s.status === "Delivered to Customer",
      },
    });
  }

  console.log(`Seeded ${seeds.length} CarLoanRequest records.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
