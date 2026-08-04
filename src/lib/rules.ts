import type { CarLoanRequest, Role, Status } from "./types";

// ---------------------------------------------------------------------------
// Section 5: business rules & validation.
//
// This module is pure and framework-free — no storage access, no React. In the
// original full-stack build these rules ran server-side; in this frontend-only
// build the store (src/lib/store.tsx) is the single choke point that applies
// them, so every mutation still goes through exactly one enforcement path and
// the UI can never skip a rule by rendering a button.
// ---------------------------------------------------------------------------

export class RuleViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleViolation";
  }
}

// ---- Stage ownership (Section 5.1) — which fields a role may edit, and when.

// Customer type and finance program are NOT here: both arrive with the customer
// record from the source system and are locked, same as the rest of their
// master data. Branch and the creation note stay agent-set.
export const SECTION_4_1_CREATE_FIELDS = ["Branch", "CREATION_DATE"] as const;

export const SECTION_4_4_CONTRACT_FIELDS = [
  "Car Type",
  "Contract Type",
  "Contract Ready Status",
  "Contract Signing Date",
  // DRV_SALES_MAN is deliberately absent: it comes from the uploaded
  // assignment and is what routes the deal, so no role may retype it.
  "DRV_SALES_MANAGER",
  "Insurance Type",
  "Receival Method",
  // The nine contract-stage document uploads.
  "Cheque",
  "Invoice",
  "Pricing",
  "Receipt",
  "Inspection",
  "Car Documents",
  "Benefciary Documents",
  "External Contract",
  "Customer Cheque",
] as const;

// DEVIATION and FEEDBACK are deliberately absent: both are credit-system
// output that arrives with the uploaded application, so Operations reads them
// rather than writing them. Only their own note is editable here.
export const SECTION_4_5_OPERATIONS_REVIEW_FIELDS = ["Operation Notes"] as const;

/**
 * Financial / loan terms. Listed for documentation only — they are NOT in any
 * role's editable set. Like the customer and vehicle data, they arrive with the
 * uploaded application and are read-only for every role at every stage.
 */
export const SECTION_4_6_FINANCIAL_FIELDS = [
  "PRICE",
  "DOWN_PAYMENT",
  "LOAN_AMOUNT",
  "INTEREST_RATE",
  "TENOR_MONTH",
  "ADMIN_FEES",
  "BANK_NAME",
  "BANK_BRANCH",
] as const;

export const SECTION_4_7_PAYMENT_REQUEST_FIELDS = ["Payment Request File"] as const;

export const SECTION_4_8_FINANCE_FIELDS = [
  "Finance Notes",
  "Cheque Number",
  "Cheque Location",
  "Cheque",
  "Customer Cheque",
  "Payment Receipt",
  "Receipt",
] as const;

export const SECTION_4_9_HANDOVER_FIELDS = ["CustomerAcknowledgementFile"] as const;

/** Sales & Operations both use this when creating a brand-new contract (Draft). */
export function creatableFieldsFor(role: Role): readonly string[] {
  if (role === "Sales" || role === "Operations") {
    return [...SECTION_4_1_CREATE_FIELDS, ...SECTION_4_4_CONTRACT_FIELDS];
  }
  return [];
}

/**
 * Which fields a role may edit given the record's current STATUS.
 * Returns [] if nothing is editable right now.
 */
export function editableFieldsFor(role: Role, status: Status, createdByRole: Role): readonly string[] {
  if (role === "Sales") {
    if (createdByRole === "Sales" && (status === "Draft" || status === "Returned by Operations")) {
      return SECTION_4_4_CONTRACT_FIELDS;
    }
    return [];
  }
  if (role === "Operations") {
    if (status === "Draft" || status === "Returned by Operations") {
      // Operations can also be the creator of a Draft (same capability as Sales).
      if (createdByRole === "Operations") return SECTION_4_4_CONTRACT_FIELDS;
      return [];
    }
    if (
      status === "Submitted for Operations Review" ||
      status === "Under Operations Review" ||
      status === "Returned by Finance"
    ) {
      // Note: no SECTION_4_6_FINANCIAL_FIELDS — the loan terms are uploaded,
      // not entered here.
      return [
        ...SECTION_4_4_CONTRACT_FIELDS,
        ...SECTION_4_5_OPERATIONS_REVIEW_FIELDS,
        ...SECTION_4_7_PAYMENT_REQUEST_FIELDS,
      ];
    }
    if (status === "Cheque Issued" || status === "Cheque Delivered to Operations") {
      return SECTION_4_9_HANDOVER_FIELDS;
    }
    return [];
  }
  if (role === "Finance") {
    if (
      status === "Payment Request Submitted" ||
      status === "Under Finance Review" ||
      status === "Approved by Finance"
    ) {
      return SECTION_4_8_FINANCE_FIELDS;
    }
    return [];
  }
  return [];
}

export function assertFieldsEditable(
  fields: Record<string, unknown>,
  role: Role,
  status: Status,
  createdByRole: Role
) {
  const allowed = new Set(editableFieldsFor(role, status, createdByRole));
  for (const key of Object.keys(fields)) {
    if (!allowed.has(key)) {
      throw new RuleViolation(`${role} cannot edit field "${key}" while STATUS is "${status}".`);
    }
  }
}

// ---- Lifecycle transitions (Section 5.2) -----------------------------------

interface TransitionRule {
  from: Status[];
  to: Status;
  actorRoles: Role[];
  requiresReason?: boolean;
  /** Extra business gate beyond "reason present" (Section 5.6 / 5.7). */
  gate?: (record: Record<string, unknown>) => string | null;
}

const CHEQUE_ISSUE_GATE = (r: Record<string, unknown>): string | null => {
  const missing: string[] = [];
  if (!r["Cheque Number"]) missing.push("Cheque Number");
  if (!r["Cheque"]) missing.push("Cheque (photo)");
  if (!r["BANK_NAME"]) missing.push("Bank Name");
  if (!r["BANK_BRANCH"]) missing.push("Bank Branch");
  if (missing.length) return `Cannot issue cheque — missing: ${missing.join(", ")}.`;
  return null;
};

const DELIVERY_GATE = (r: Record<string, unknown>): string | null => {
  if (!r["CustomerAcknowledgementFile"]) {
    return "Cannot confirm delivery — customer acknowledgement file is required.";
  }
  return null;
};

const PAYMENT_REQUEST_GATE = (r: Record<string, unknown>): string | null => {
  const missing: string[] = [];
  if (r["PRICE"] === null || r["PRICE"] === undefined) missing.push("Price");
  if (r["DOWN_PAYMENT"] === null || r["DOWN_PAYMENT"] === undefined) missing.push("Down Payment");
  if (r["LOAN_AMOUNT"] === null || r["LOAN_AMOUNT"] === undefined) missing.push("Loan Amount");
  if (!r["BANK_NAME"]) missing.push("Bank Name");
  if (!r["BANK_BRANCH"]) missing.push("Bank Branch");
  if (missing.length) return `Cannot submit payment request — missing: ${missing.join(", ")}.`;
  return null;
};

export const TRANSITIONS: Record<string, TransitionRule> = {
  SUBMIT_FOR_OPERATIONS_REVIEW: {
    from: ["Draft", "Returned by Operations"],
    to: "Submitted for Operations Review",
    actorRoles: ["Sales", "Operations"],
  },
  START_OPERATIONS_REVIEW: {
    from: ["Submitted for Operations Review"],
    to: "Under Operations Review",
    actorRoles: ["Operations"],
  },
  RETURN_BY_OPERATIONS: {
    from: ["Under Operations Review"],
    to: "Returned by Operations",
    actorRoles: ["Operations"],
    requiresReason: true,
  },
  REJECT_BY_OPERATIONS: {
    from: ["Under Operations Review"],
    to: "Rejected by Operations",
    actorRoles: ["Operations"],
  },
  SUBMIT_PAYMENT_REQUEST: {
    from: ["Under Operations Review", "Returned by Finance"],
    to: "Payment Request Submitted",
    actorRoles: ["Operations"],
    gate: PAYMENT_REQUEST_GATE,
  },
  START_FINANCE_REVIEW: {
    from: ["Payment Request Submitted"],
    to: "Under Finance Review",
    actorRoles: ["Finance"],
  },
  RETURN_BY_FINANCE: {
    from: ["Under Finance Review"],
    to: "Returned by Finance",
    actorRoles: ["Finance"],
    requiresReason: true,
  },
  REJECT_BY_FINANCE: {
    from: ["Under Finance Review"],
    to: "Rejected by Finance",
    actorRoles: ["Finance"],
  },
  APPROVE_BY_FINANCE: {
    from: ["Under Finance Review"],
    to: "Approved by Finance",
    actorRoles: ["Finance"],
  },
  ISSUE_CHEQUE: {
    from: ["Approved by Finance"],
    to: "Cheque Issued",
    actorRoles: ["Finance"],
    gate: CHEQUE_ISSUE_GATE,
  },
  CONFIRM_CHEQUE_RECEIVED_BY_OPERATIONS: {
    from: ["Cheque Issued"],
    to: "Cheque Delivered to Operations",
    actorRoles: ["Operations"],
  },
  CONFIRM_DELIVERED_TO_CUSTOMER: {
    from: ["Cheque Delivered to Operations"],
    to: "Delivered to Customer",
    actorRoles: ["Operations"],
    gate: DELIVERY_GATE,
  },
  CANCEL: {
    from: [
      "Draft",
      "Submitted for Operations Review",
      "Under Operations Review",
      "Returned by Operations",
      "Payment Request Submitted",
      "Under Finance Review",
      "Returned by Finance",
      "Approved by Finance",
      "Cheque Issued",
      "Cheque Delivered to Operations",
    ],
    to: "Cancelled",
    actorRoles: ["Sales", "Operations", "Finance"],
    requiresReason: true,
  },
};

export const TERMINAL_STATUSES: Status[] = [
  "Rejected by Operations",
  "Rejected by Finance",
  "Delivered to Customer",
  "Cancelled",
];

export function validateTransition(
  action: string,
  currentStatus: Status,
  actorRole: Role,
  reason: string | null | undefined,
  record: Record<string, unknown>
): TransitionRule {
  const rule = TRANSITIONS[action];
  if (!rule) throw new RuleViolation(`Unknown action "${action}".`);
  if (!rule.from.includes(currentStatus)) {
    throw new RuleViolation(
      `Cannot perform "${action}" from STATUS "${currentStatus}". Valid source statuses: ${rule.from.join(", ")}.`
    );
  }
  if (!rule.actorRoles.includes(actorRole)) {
    throw new RuleViolation(`${actorRole} is not permitted to perform "${action}".`);
  }
  if (rule.requiresReason && !reason?.trim()) {
    throw new RuleViolation(`A reason is required to perform "${action}".`);
  }
  if (rule.gate) {
    const err = rule.gate(record);
    if (err) throw new RuleViolation(err);
  }
  return rule;
}

/** Keeps the sub-status fields (Sections 4.7/4.8/4.9) aligned with the master STATUS. */
export function deriveSubStatuses(newStatus: Status): Partial<CarLoanRequest> {
  switch (newStatus) {
    case "Draft":
      return { "Payment Request Status": "Draft" };
    case "Payment Request Submitted":
      return { "Payment Request Status": "Submitted" };
    case "Under Finance Review":
      return { "Payment Request Status": "Under Review" };
    case "Returned by Finance":
      return { "Payment Request Status": "Returned" };
    case "Rejected by Finance":
      return { "Payment Request Status": "Rejected" };
    case "Approved by Finance":
      return { "Payment Request Status": "Approved", "Finance Status": "Cheque Prepared" };
    case "Cheque Issued":
      return {
        "Payment Request Status": "Paid",
        "Finance Status": "Cheque Issued",
        ChequeDeliveryStatus: "Pending",
      };
    case "Cheque Delivered to Operations":
      return { "Finance Status": "Released", ChequeDeliveryStatus: "Delivered to Operations" };
    case "Delivered to Customer":
      return { ChequeDeliveryStatus: "Delivered to Customer" };
    default:
      return {};
  }
}

// ---- Duplicate detection (Section 5.4) -------------------------------------

export function computeDuplicateCheckKey(
  customerIdNumber: string,
  chassisNumber: string,
  loanAmount: number | null | undefined
): string {
  return `${customerIdNumber}|${chassisNumber}|${loanAmount ?? ""}`;
}

export interface DuplicateCandidate {
  APP_ID: string;
  CUSTOMER_ID_NUMBER: string;
  CHASIS_NUMBER: string;
  LOAN_AMOUNT: number | null;
  STATUS: string;
}

export interface DuplicateCheckResult {
  exactMatch: DuplicateCandidate | null;
  similarMatches: DuplicateCandidate[];
}

const NON_BLOCKING_TERMINALS = new Set(["Cancelled", "Rejected by Operations", "Rejected by Finance"]);

export function checkDuplicates(
  customerIdNumber: string,
  chassisNumber: string,
  loanAmount: number | null | undefined,
  existing: DuplicateCandidate[]
): DuplicateCheckResult {
  const live = existing.filter((r) => !NON_BLOCKING_TERMINALS.has(r.STATUS));

  const exactMatch =
    live.find(
      (r) =>
        r.CUSTOMER_ID_NUMBER === customerIdNumber &&
        r.CHASIS_NUMBER === chassisNumber &&
        (r.LOAN_AMOUNT ?? null) === (loanAmount ?? null)
    ) ?? null;

  const similarMatches = live.filter((r) => {
    if (exactMatch && r.APP_ID === exactMatch.APP_ID) return false;
    return r.CUSTOMER_ID_NUMBER === customerIdNumber && r.CHASIS_NUMBER === chassisNumber;
  });

  return { exactMatch, similarMatches };
}
