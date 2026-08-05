import { MOCK_CUSTOMERS, MOCK_VEHICLES } from "./mockSource";
import {
  BRANCHES,
  BANKS,
  SALES_MANAGERS,
  CAR_TYPES,
  CONTRACT_TYPES,
  INSURANCE_TYPES,
  RECEIVAL_METHODS,
  SIGNING_METHODS,
  SHOWROOMS,
} from "./choices";
import { computeDuplicateCheckKey, deriveSubStatuses } from "./rules";
import type { AuditEntry, CarLoanRequest, Role, Status, StatusHistoryEntry } from "./types";

// Sample data covering every stage of the lifecycle. Built at runtime (rather
// than checked in as a static JSON blob) so timestamps are always relative to
// "now" — the aging buckets and average-time-per-stage metrics on the
// Reporting screen stay meaningful no matter when the app is opened.

interface HistoryStep {
  stage: string;
  status: Status;
  decision?: string | null;
  reason?: string | null;
  changedBy: string;
  changedByRole: Role;
}

interface SeedSpec {
  idx: number;
  customer: (typeof MOCK_CUSTOMERS)[number];
  vehicle: (typeof MOCK_VEHICLES)[number];
  branch: string;
  salesAgent: string;
  status: Status;
  startDaysAgo: number;
  steps: HistoryStep[];
  gapsHours: number[];
  loan?: {
    price: number;
    down: number;
    loan: number;
    rate: number;
    tenor: number;
    fees: number;
    bank: string;
    bankBranch: string;
  };
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

function buildHistory(spec: SeedSpec): StatusHistoryEntry[] {
  let clock = Date.now() - spec.startDaysAgo * 24 * 3600 * 1000;
  return spec.steps.map((step, i) => {
    clock += (spec.gapsHours[i] ?? 6) * 3600 * 1000;
    return { ...step, changedAt: new Date(clock).toISOString() };
  });
}

function buildAudit(history: StatusHistoryEntry[]): AuditEntry[] {
  return history.map((h) => ({
    action: "STATUS_CHANGE",
    field: "STATUS",
    oldValue: null,
    newValue: h.status,
    user: h.changedBy,
    role: h.changedByRole,
    timestamp: h.changedAt,
  }));
}

function step(stage: string, status: Status, changedBy: string, changedByRole: Role, decision?: string | null, reason?: string | null): HistoryStep {
  return { stage, status, changedBy, changedByRole, decision: decision ?? null, reason: reason ?? null };
}

function buildSpecs(): SeedSpec[] {
  const specs: SeedSpec[] = [];
  let n = 1;

  // 1. Plain Draft (Sales)
  specs.push({
    idx: n++, customer: MOCK_CUSTOMERS[0], vehicle: MOCK_VEHICLES[0], branch: BRANCHES[0], salesAgent: "Mona Aziz", status: "Draft", startDaysAgo: 2,
    steps: [step("Sales", "Draft", "Mona Aziz", "Sales", "Created")], gapsHours: [0],
    contractReadyStatus: "Not Ready",
  });

  // 2. Draft created by Operations (same create capability as Sales)
  specs.push({
    idx: n++, customer: MOCK_CUSTOMERS[1], vehicle: MOCK_VEHICLES[1], branch: BRANCHES[1], salesAgent: "Yara Hassan", status: "Draft", startDaysAgo: 1,
    steps: [step("Operations", "Draft", "Yara Hassan", "Operations", "Created")], gapsHours: [0],
    contractReadyStatus: "Ready for Review",
  });

  // 3. Submitted for Operations Review
  specs.push({
    idx: n++, customer: MOCK_CUSTOMERS[2], vehicle: MOCK_VEHICLES[2], branch: BRANCHES[2], salesAgent: "Karim Adel", status: "Submitted for Operations Review", startDaysAgo: 6,
    steps: [
      step("Sales", "Draft", "Karim Adel", "Sales", "Created"),
      step("Sales", "Submitted for Operations Review", "Karim Adel", "Sales"),
    ], gapsHours: [0, 4], contractReadyStatus: "Sent for Review",
  });

  // 4. Under Operations Review
  specs.push({
    idx: n++, customer: MOCK_CUSTOMERS[3], vehicle: MOCK_VEHICLES[3], branch: BRANCHES[0], salesAgent: "Mona Aziz", status: "Under Operations Review", startDaysAgo: 5,
    steps: [
      step("Sales", "Draft", "Mona Aziz", "Sales", "Created"),
      step("Sales", "Submitted for Operations Review", "Mona Aziz", "Sales"),
      step("Operations", "Under Operations Review", "Tarek Fathy", "Operations"),
    ], gapsHours: [0, 3, 10], contractReadyStatus: "Sent for Review",
    operationNotes: "Documents look complete, verifying pricing before proceeding.",
  });

  // 5. Returned by Operations — still sitting with Sales
  specs.push({
    idx: n++, customer: MOCK_CUSTOMERS[4], vehicle: MOCK_VEHICLES[4], branch: BRANCHES[3], salesAgent: "Karim Adel", status: "Returned by Operations", startDaysAgo: 4,
    steps: [
      step("Sales", "Draft", "Karim Adel", "Sales", "Created"),
      step("Sales", "Submitted for Operations Review", "Karim Adel", "Sales"),
      step("Operations", "Under Operations Review", "Yara Hassan", "Operations"),
      step("Operations", "Returned by Operations", "Yara Hassan", "Operations", "Returned",
        "Missing beneficiary ID documents — please re-upload a clear scan."),
    ], gapsHours: [0, 2, 8, 5], contractReadyStatus: "Sent for Review",
    deviation: "Beneficiary documents illegible",
  });

  // 6. Returned by Operations, then fixed & resubmitted
  specs.push({
    idx: n++, customer: MOCK_CUSTOMERS[5], vehicle: MOCK_VEHICLES[5], branch: BRANCHES[1], salesAgent: "Mona Aziz", status: "Submitted for Operations Review", startDaysAgo: 9,
    steps: [
      step("Sales", "Draft", "Mona Aziz", "Sales", "Created"),
      step("Sales", "Submitted for Operations Review", "Mona Aziz", "Sales"),
      step("Operations", "Under Operations Review", "Tarek Fathy", "Operations"),
      step("Operations", "Returned by Operations", "Tarek Fathy", "Operations", "Returned",
        "Down payment on the pricing sheet doesn't match the contract — please correct and resend."),
      step("Sales", "Submitted for Operations Review", "Mona Aziz", "Sales"),
    ], gapsHours: [0, 3, 6, 4, 18], contractReadyStatus: "Sent for Review",
  });

  // 7. Rejected by Operations
  specs.push({
    idx: n++, customer: MOCK_CUSTOMERS[6], vehicle: MOCK_VEHICLES[6], branch: BRANCHES[4], salesAgent: "Karim Adel", status: "Rejected by Operations", startDaysAgo: 10,
    steps: [
      step("Sales", "Draft", "Karim Adel", "Sales", "Created"),
      step("Sales", "Submitted for Operations Review", "Karim Adel", "Sales"),
      step("Operations", "Under Operations Review", "Yara Hassan", "Operations"),
      step("Operations", "Rejected by Operations", "Yara Hassan", "Operations", "Rejected",
        "Customer failed internal credit policy checks."),
    ], gapsHours: [0, 2, 6, 4],
  });

  // 8. Payment Request Submitted — awaiting Finance pickup
  specs.push({
    idx: n++, customer: MOCK_CUSTOMERS[7], vehicle: MOCK_VEHICLES[7], branch: BRANCHES[0], salesAgent: "Tarek Fathy", status: "Payment Request Submitted", startDaysAgo: 7,
    steps: [
      step("Sales", "Draft", "Mona Aziz", "Sales", "Created"),
      step("Sales", "Submitted for Operations Review", "Mona Aziz", "Sales"),
      step("Operations", "Under Operations Review", "Tarek Fathy", "Operations"),
      step("Operations", "Payment Request Submitted", "Tarek Fathy", "Operations", "Approved"),
    ], gapsHours: [0, 3, 8, 6], contractReadyStatus: "Sent for Review",
    loan: { price: 2_450_000, down: 490_000, loan: 1_960_000, rate: 22.5, tenor: 48, fees: 15_000, bank: BANKS[0].BANK_NAME, bankBranch: BANKS[0].branches[0] },
  });

  // 9. Under Finance Review
  specs.push({
    idx: n++, customer: MOCK_CUSTOMERS[8], vehicle: MOCK_VEHICLES[8], branch: BRANCHES[5], salesAgent: "Yara Hassan", status: "Under Finance Review", startDaysAgo: 6,
    steps: [
      step("Sales", "Draft", "Karim Adel", "Sales", "Created"),
      step("Sales", "Submitted for Operations Review", "Karim Adel", "Sales"),
      step("Operations", "Under Operations Review", "Yara Hassan", "Operations"),
      step("Operations", "Payment Request Submitted", "Yara Hassan", "Operations", "Approved"),
      step("Finance", "Under Finance Review", "Nadia Salem", "Finance"),
    ], gapsHours: [0, 2, 6, 5, 9],
    loan: { price: 1_850_000, down: 370_000, loan: 1_480_000, rate: 21, tenor: 36, fees: 12_000, bank: BANKS[1].BANK_NAME, bankBranch: BANKS[1].branches[0] },
  });

  // 10. Returned by Finance — still sitting with Operations
  specs.push({
    idx: n++, customer: MOCK_CUSTOMERS[9], vehicle: MOCK_VEHICLES[9], branch: BRANCHES[2], salesAgent: "Tarek Fathy", status: "Returned by Finance", startDaysAgo: 8,
    steps: [
      step("Sales", "Draft", "Mona Aziz", "Sales", "Created"),
      step("Sales", "Submitted for Operations Review", "Mona Aziz", "Sales"),
      step("Operations", "Under Operations Review", "Tarek Fathy", "Operations"),
      step("Operations", "Payment Request Submitted", "Tarek Fathy", "Operations", "Approved"),
      step("Finance", "Under Finance Review", "Omar Ibrahim", "Finance"),
      step("Finance", "Returned by Finance", "Omar Ibrahim", "Finance", "Returned",
        "Down payment percentage is below the 20% policy floor for this program — please revise."),
    ], gapsHours: [0, 3, 5, 4, 7, 6],
    loan: { price: 1_600_000, down: 160_000, loan: 1_440_000, rate: 23, tenor: 60, fees: 10_000, bank: BANKS[2].BANK_NAME, bankBranch: BANKS[2].branches[0] },
  });

  // 11. Returned by Finance, then fixed & resubmitted
  specs.push({
    idx: n++, customer: MOCK_CUSTOMERS[0], vehicle: MOCK_VEHICLES[9], branch: BRANCHES[0], salesAgent: "Karim Adel", status: "Payment Request Submitted", startDaysAgo: 12,
    steps: [
      step("Sales", "Draft", "Karim Adel", "Sales", "Created"),
      step("Sales", "Submitted for Operations Review", "Karim Adel", "Sales"),
      step("Operations", "Under Operations Review", "Yara Hassan", "Operations"),
      step("Operations", "Payment Request Submitted", "Yara Hassan", "Operations", "Approved"),
      step("Finance", "Under Finance Review", "Nadia Salem", "Finance"),
      step("Finance", "Returned by Finance", "Nadia Salem", "Finance", "Returned",
        "Bank branch code on file doesn't match the customer's provided bank letter."),
      step("Operations", "Payment Request Submitted", "Yara Hassan", "Operations", "Approved"),
    ], gapsHours: [0, 2, 5, 4, 6, 5, 8],
    loan: { price: 2_100_000, down: 420_000, loan: 1_680_000, rate: 22, tenor: 48, fees: 14_000, bank: BANKS[3].BANK_NAME, bankBranch: BANKS[3].branches[0] },
  });

  // 12. Rejected by Finance
  specs.push({
    idx: n++, customer: MOCK_CUSTOMERS[1], vehicle: MOCK_VEHICLES[8], branch: BRANCHES[3], salesAgent: "Mona Aziz", status: "Rejected by Finance", startDaysAgo: 13,
    steps: [
      step("Sales", "Draft", "Mona Aziz", "Sales", "Created"),
      step("Sales", "Submitted for Operations Review", "Mona Aziz", "Sales"),
      step("Operations", "Under Operations Review", "Tarek Fathy", "Operations"),
      step("Operations", "Payment Request Submitted", "Tarek Fathy", "Operations", "Approved"),
      step("Finance", "Under Finance Review", "Omar Ibrahim", "Finance"),
      step("Finance", "Rejected by Finance", "Omar Ibrahim", "Finance", "Rejected",
        "Treasury flagged insufficient collateral coverage for this loan amount."),
    ], gapsHours: [0, 2, 6, 5, 7, 4],
    loan: { price: 3_200_000, down: 320_000, loan: 2_880_000, rate: 24, tenor: 60, fees: 20_000, bank: BANKS[0].BANK_NAME, bankBranch: BANKS[0].branches[1] },
  });

  // 13. Approved by Finance — ready for cheque issuance
  specs.push({
    idx: n++, customer: MOCK_CUSTOMERS[2], vehicle: MOCK_VEHICLES[7], branch: BRANCHES[1], salesAgent: "Karim Adel", status: "Approved by Finance", startDaysAgo: 5,
    steps: [
      step("Sales", "Draft", "Karim Adel", "Sales", "Created"),
      step("Sales", "Submitted for Operations Review", "Karim Adel", "Sales"),
      step("Operations", "Under Operations Review", "Yara Hassan", "Operations"),
      step("Operations", "Payment Request Submitted", "Yara Hassan", "Operations", "Approved"),
      step("Finance", "Under Finance Review", "Nadia Salem", "Finance"),
      step("Finance", "Approved by Finance", "Nadia Salem", "Finance", "Approved"),
    ], gapsHours: [0, 2, 5, 4, 6, 5],
    loan: { price: 1_750_000, down: 350_000, loan: 1_400_000, rate: 21.5, tenor: 42, fees: 11_000, bank: BANKS[1].BANK_NAME, bankBranch: BANKS[1].branches[1] },
  });

  // 14. Cheque Issued — awaiting Operations pickup
  specs.push({
    idx: n++, customer: MOCK_CUSTOMERS[3], vehicle: MOCK_VEHICLES[6], branch: BRANCHES[4], salesAgent: "Mona Aziz", status: "Cheque Issued", startDaysAgo: 11,
    steps: [
      step("Sales", "Draft", "Mona Aziz", "Sales", "Created"),
      step("Sales", "Submitted for Operations Review", "Mona Aziz", "Sales"),
      step("Operations", "Under Operations Review", "Tarek Fathy", "Operations"),
      step("Operations", "Payment Request Submitted", "Tarek Fathy", "Operations", "Approved"),
      step("Finance", "Under Finance Review", "Omar Ibrahim", "Finance"),
      step("Finance", "Approved by Finance", "Omar Ibrahim", "Finance", "Approved"),
      step("Finance", "Cheque Issued", "Omar Ibrahim", "Finance"),
    ], gapsHours: [0, 2, 5, 4, 6, 5, 8],
    loan: { price: 1_950_000, down: 390_000, loan: 1_560_000, rate: 22, tenor: 48, fees: 13_000, bank: BANKS[2].BANK_NAME, bankBranch: BANKS[2].branches[1] },
    cheque: { number: "CHQ-0098213", location: "Treasury Safe — HQ" },
  });

  // 15. Cheque Delivered to Operations — awaiting customer delivery
  specs.push({
    idx: n++, customer: MOCK_CUSTOMERS[4], vehicle: MOCK_VEHICLES[5], branch: BRANCHES[0], salesAgent: "Karim Adel", status: "Cheque Delivered to Operations", startDaysAgo: 14,
    steps: [
      step("Sales", "Draft", "Karim Adel", "Sales", "Created"),
      step("Sales", "Submitted for Operations Review", "Karim Adel", "Sales"),
      step("Operations", "Under Operations Review", "Yara Hassan", "Operations"),
      step("Operations", "Payment Request Submitted", "Yara Hassan", "Operations", "Approved"),
      step("Finance", "Under Finance Review", "Nadia Salem", "Finance"),
      step("Finance", "Approved by Finance", "Nadia Salem", "Finance", "Approved"),
      step("Finance", "Cheque Issued", "Nadia Salem", "Finance"),
      step("Operations", "Cheque Delivered to Operations", "Tarek Fathy", "Operations"),
    ], gapsHours: [0, 2, 5, 4, 6, 5, 4, 6],
    loan: { price: 2_650_000, down: 530_000, loan: 2_120_000, rate: 23, tenor: 54, fees: 18_000, bank: BANKS[3].BANK_NAME, bankBranch: BANKS[3].branches[1] },
    cheque: { number: "CHQ-0098214", location: "In transit to Nasr City branch" },
  });

  // 16 & 17. Delivered to Customer — fully completed and locked
  const SALES_TWO = ["Mona Aziz", "Karim Adel"];
  const OPS_TWO = ["Yara Hassan", "Tarek Fathy"];
  const FIN_TWO = ["Nadia Salem", "Omar Ibrahim"];
  for (let k = 0; k < 2; k++) {
    const sales = SALES_TWO[k];
    const ops = OPS_TWO[k];
    const fin = FIN_TWO[k];
    specs.push({
      idx: n++, customer: MOCK_CUSTOMERS[6 + k], vehicle: MOCK_VEHICLES[3 + k],
      branch: BRANCHES[k % BRANCHES.length],
      salesAgent: sales, status: "Delivered to Customer", startDaysAgo: 18 + k * 2,
      steps: [
        step("Sales", "Draft", sales, "Sales", "Created"),
        step("Sales", "Submitted for Operations Review", sales, "Sales"),
        step("Operations", "Under Operations Review", ops, "Operations"),
        step("Operations", "Payment Request Submitted", ops, "Operations", "Approved"),
        step("Finance", "Under Finance Review", fin, "Finance"),
        step("Finance", "Approved by Finance", fin, "Finance", "Approved"),
        step("Finance", "Cheque Issued", fin, "Finance"),
        step("Operations", "Cheque Delivered to Operations", ops, "Operations"),
        step("Operations", "Delivered to Customer", ops, "Operations"),
      ], gapsHours: [0, 2, 5, 4, 6, 5, 4, 5, 7],
      loan: {
        price: 1_800_000 + k * 200_000, down: 360_000 + k * 40_000, loan: 1_440_000 + k * 160_000,
        rate: 21 + k, tenor: 36 + k * 6, fees: 12_000 + k * 1_000,
        bank: BANKS[k % BANKS.length].BANK_NAME, bankBranch: BANKS[k % BANKS.length].branches[0],
      },
      cheque: { number: `CHQ-009821${5 + k}`, location: "Delivered" },
      ackFile: "customer-acknowledgement-signed.pdf",
    });
  }

  // 18. Cancelled
  specs.push({
    idx: n++, customer: MOCK_CUSTOMERS[5], vehicle: MOCK_VEHICLES[4], branch: BRANCHES[2], salesAgent: "Mona Aziz", status: "Cancelled", startDaysAgo: 3,
    steps: [
      step("Sales", "Draft", "Mona Aziz", "Sales", "Created"),
      step("System", "Cancelled", "Mona Aziz", "Sales", "Cancelled",
        "Customer withdrew the application after finding alternative financing."),
    ], gapsHours: [0, 5],
  });

  // 19 & 20. Duplicate-flagged pair: same customer + same vehicle, different amount
  const dupCustomer = MOCK_CUSTOMERS[7];
  const dupVehicle = MOCK_VEHICLES[2];
  const dupFirstId = appId(n);
  specs.push({
    idx: n++, customer: dupCustomer, vehicle: dupVehicle, branch: BRANCHES[0], salesAgent: "Karim Adel", status: "Payment Request Submitted", startDaysAgo: 16,
    steps: [
      step("Sales", "Draft", "Karim Adel", "Sales", "Created"),
      step("Sales", "Submitted for Operations Review", "Karim Adel", "Sales"),
      step("Operations", "Under Operations Review", "Yara Hassan", "Operations"),
      step("Operations", "Payment Request Submitted", "Yara Hassan", "Operations", "Approved"),
    ], gapsHours: [0, 2, 5, 4],
    loan: { price: 2_000_000, down: 400_000, loan: 1_600_000, rate: 22, tenor: 48, fees: 14_000, bank: BANKS[0].BANK_NAME, bankBranch: BANKS[0].branches[0] },
  });
  specs.push({
    idx: n++, customer: dupCustomer, vehicle: dupVehicle, branch: BRANCHES[0], salesAgent: "Mona Aziz", status: "Draft", startDaysAgo: 2,
    steps: [step("Sales", "Draft", "Mona Aziz", "Sales", "Created")], gapsHours: [0],
    isDuplicate: true, duplicateOf: dupFirstId,
  });

  return specs;
}

function toRecord(spec: SeedSpec): CarLoanRequest {
  const history = buildHistory(spec);
  const sub = deriveSubStatuses(spec.status);
  const firstOps = history.find((e) => e.stage === "Operations");
  const firstFin = history.find((e) => e.stage === "Finance");
  const handover = history.find((e) => e.status === "Cheque Delivered to Operations");
  const delivered = history.find((e) => e.status === "Delivered to Customer");
  const latestDecision = [...history].reverse().find((e) => e.decision);
  const latestReason = [...history].reverse().find((e) => e.reason);

  // Loan terms now arrive with the uploaded application, so every record has
  // them from the moment it is created — including Drafts.
  const bank = BANKS[spec.idx % BANKS.length];
  const showroom = SHOWROOMS[spec.idx % SHOWROOMS.length];
  const fallbackPrice = 1_500_000 + (spec.idx % 7) * 200_000;
  const loan = spec.loan ?? {
    price: fallbackPrice,
    down: Math.round(fallbackPrice * 0.2),
    loan: fallbackPrice - Math.round(fallbackPrice * 0.2),
    rate: 21 + (spec.idx % 4) * 0.5,
    tenor: [36, 42, 48, 60][spec.idx % 4],
    fees: 10_000 + (spec.idx % 5) * 1_000,
    bank: bank.BANK_NAME,
    bankBranch: bank.branches[0],
  };

  return {
    APP_ID: appId(spec.idx),
    APP_DATETIME: history[0].changedAt,
    APP_CUSTOMER_TYPE: spec.customer.APP_CUSTOMER_TYPE,
    APP_PROGRAM_ID: spec.customer.APP_PROGRAM_ID,
    PROGRAM_NAME: spec.customer.PROGRAM_NAME,
    Branch: spec.branch,
    STATUS: spec.status,
    CREATION_DATE: "Sample data",

    CUSTOMER_NAME: spec.customer.CUSTOMER_NAME,
    CUSTOMER_ID_NUMBER: spec.customer.CUSTOMER_ID_NUMBER,
    CUSTOMER_GENDER: spec.customer.CUSTOMER_GENDER,
    CUSTOMER_NATIONALITY: spec.customer.CUSTOMER_NATIONALITY,
    CUSTOMER_TITLE: spec.customer.CUSTOMER_TITLE,
    CUSTOMER_CLASS: spec.customer.CUSTOMER_CLASS,
    ORGANIZATION_NAME: spec.customer.ORGANIZATION_NAME ?? null,
    ORG_TYPE: spec.customer.ORG_TYPE ?? null,
    ORG_REG_NUMBER: spec.customer.ORG_REG_NUMBER ?? null,

    BRAND_NAME: spec.vehicle.BRAND_NAME,
    MODEL: spec.vehicle.MODEL,
    CHASIS_NUMBER: spec.vehicle.CHASIS_NUMBER,
    MOTOR_NUMBER: spec.vehicle.MOTOR_NUMBER,
    COLOR: spec.vehicle.COLOR,
    ENGINE_SIZE: spec.vehicle.ENGINE_SIZE,
    YEAR_OF_PRODUCT: spec.vehicle.YEAR_OF_PRODUCT,

    SHOWROOM_NAME: showroom.SHOWROOM_NAME,
    SHOWROOM_CODE: showroom.SHOWROOM_CODE,
    SHOWROOM_ADDRESS: showroom.SHOWROOM_ADDRESS,
    SHOWROOM_TAX_ID: showroom.SHOWROOM_TAX_ID,

    // Cycle the dropdown values across the sample set so every option appears.
    "Car Type": CAR_TYPES[spec.idx % CAR_TYPES.length],
    "Contract Type": CONTRACT_TYPES[spec.idx % CONTRACT_TYPES.length],
    "Contract Ready Status": spec.contractReadyStatus ?? "Sent for Review",
    "Contract Signing Method": SIGNING_METHODS[spec.idx % SIGNING_METHODS.length],
    "Contract Signing Date": spec.loan ? history[0].changedAt : null,
    DRV_SALES_MAN: spec.salesAgent,
    DRV_SALES_MANAGER: SALES_MANAGERS[spec.idx % SALES_MANAGERS.length],
    "Insurance Type": INSURANCE_TYPES[spec.idx % INSURANCE_TYPES.length],
    "Receival Method": RECEIVAL_METHODS[spec.idx % RECEIVAL_METHODS.length],
    "External Contract": "external-contract.pdf",
    "Car Documents": "car-documents.pdf",
    "Benefciary Documents": "beneficiary-documents.pdf",
    "All Customer Car Documents": null,
    Inspection: "inspection-report.pdf",
    Pricing: "pricing-sheet.pdf",
    Invoice: "invoice.pdf",
    Receipt: "receipt.pdf",

    "Operation Notes": spec.operationNotes ?? null,
    // Credit-system output that arrives with the application, not Operations' notes.
    DEVIATION: spec.deviation ?? null,
    FEEDBACK: spec.deviation
      ? "Approved with condition: supporting documents to be verified before disbursement."
      : "Credit approved — no conditions.",
    OperationsReviewedBy: firstOps?.changedBy ?? null,
    OperationsReviewDate: firstOps?.changedAt ?? null,

    PRICE: loan.price,
    DOWN_PAYMENT: loan.down,
    LOAN_AMOUNT: loan.loan,
    "Loan Amount Calculated": loan.price - loan.down,
    MONTHLY_INSTALLMENT: Math.round((loan.loan * 1.35) / loan.tenor),
    INTEREST_RATE: loan.rate,
    TENOR_MONTH: loan.tenor,
    ADMIN_FEES: loan.fees,
    BANK_NAME: loan.bank,
    BANK_BRANCH: loan.bankBranch,

    "Payment Request Status": sub["Payment Request Status"] ?? "Draft",
    "Payment Request File": null,
    DECISION: latestDecision?.decision ?? null,
    REASON: latestReason?.reason ?? null,

    "Finance Status": sub["Finance Status"] ?? "Pending",
    "Finance Notes": null,
    "Cheque Number": spec.cheque?.number ?? null,
    "Cheque Location": spec.cheque?.location ?? null,
    // Cheque / Customer Cheque are captured at contract stage and may be
    // re-attached by Finance at issuance; Receipt is set with the other
    // contract documents above.
    Cheque: "customer-cheque-photo.jpg",
    "Customer Cheque": "customer-cheque-copy.jpg",
    "Payment Receipt": null,
    FinanceReviewedBy: firstFin?.changedBy ?? null,
    FinanceReviewDate: firstFin?.changedAt ?? null,

    ChequeDeliveryStatus: sub.ChequeDeliveryStatus ?? "Pending",
    ChequeHandoverToOperationsDate: handover?.changedAt ?? null,
    ChequeHandoverToOperationsBy: handover?.changedBy ?? null,
    ChequeDeliveredToCustomerDate: delivered?.changedAt ?? null,
    ChequeDeliveredToCustomerBy: delivered?.changedBy ?? null,
    CustomerAcknowledgementFile: spec.ackFile ?? null,

    DuplicateCheckKey: computeDuplicateCheckKey(
      spec.customer.CUSTOMER_ID_NUMBER,
      spec.vehicle.CHASIS_NUMBER,
      spec.loan?.loan ?? null
    ),
    IsPotentialDuplicate: !!spec.isDuplicate,
    DuplicateOfAppID: spec.duplicateOf ?? null,

    StatusHistoryLog: history,
    AuditTrail: buildAudit(history),
    CreatedBy: history[0].changedBy,
    CreatedOn: history[0].changedAt,
    ModifiedBy: history[history.length - 1].changedBy,
    ModifiedOn: history[history.length - 1].changedAt,
    IsLocked: spec.status === "Delivered to Customer",
  };
}

export function buildSeedData(): CarLoanRequest[] {
  return buildSpecs().map(toRecord);
}
