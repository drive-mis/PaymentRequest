// Prisma model field identifiers can't contain spaces, so a handful of the
// business's exact field names (which DO contain spaces, or a pre-existing
// typo like "Benefciary Documents") are stored under a Prisma-safe identifier
// and @map()'d to the real column name in schema.prisma. This module maps
// between the two so that every JSON payload the API sends/receives — and
// therefore the frontend and anyone consuming this API — uses the exact
// field names from Section 4 of the brief, not the internal Prisma names.

export const PRISMA_TO_EXACT: Record<string, string> = {
  CarType: "Car Type",
  ContractType: "Contract Type",
  ContractReadyStatus: "Contract Ready Status",
  ContractSigningDate: "Contract Signing Date",
  InsuranceType: "Insurance Type",
  ReceivalMethod: "Receival Method",
  ExternalContract: "External Contract",
  CarDocuments: "Car Documents",
  BenefciaryDocuments: "Benefciary Documents",
  AllCustomerCarDocuments: "All Customer Car Documents",
  OperationNotes: "Operation Notes",
  LoanAmountCalculated: "Loan Amount Calculated",
  PaymentRequestStatus: "Payment Request Status",
  PaymentRequestFile: "Payment Request File",
  FinanceStatus: "Finance Status",
  FinanceNotes: "Finance Notes",
  ChequeNumber: "Cheque Number",
  ChequeLocation: "Cheque Location",
  CustomerCheque: "Customer Cheque",
  PaymentReceipt: "Payment Receipt",
};

export const EXACT_TO_PRISMA: Record<string, string> = Object.fromEntries(
  Object.entries(PRISMA_TO_EXACT).map(([prismaKey, exactKey]) => [exactKey, prismaKey])
);

/** DB record (Prisma keys) -> exact business field names, with JSON fields parsed. */
export function toExact(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    const exactKey = PRISMA_TO_EXACT[key] ?? key;
    if (key === "StatusHistoryLog" || key === "AuditTrail") {
      out[exactKey] = typeof value === "string" ? JSON.parse(value) : value;
    } else {
      out[exactKey] = value;
    }
  }
  return out;
}

/** Exact business field names -> Prisma keys, for building update/create payloads. */
export function toPrisma(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    const prismaKey = EXACT_TO_PRISMA[key] ?? key;
    out[prismaKey] = value;
  }
  return out;
}
