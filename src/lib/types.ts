export type Role = "Sales" | "Operations" | "Finance";

export const ROLES: Role[] = ["Sales", "Operations", "Finance"];

export const STATUSES = [
  "Draft",
  "Submitted for Operations Review",
  "Under Operations Review",
  "Returned by Operations",
  "Rejected by Operations",
  "Payment Request Submitted",
  "Under Finance Review",
  "Returned by Finance",
  "Rejected by Finance",
  "Approved by Finance",
  "Cheque Issued",
  "Cheque Delivered to Operations",
  "Delivered to Customer",
  "Cancelled",
] as const;

export type Status = (typeof STATUSES)[number];

export const PAYMENT_REQUEST_STATUSES = [
  "Draft",
  "Submitted",
  "Under Review",
  "Approved",
  "Returned",
  "Rejected",
  "Paid",
] as const;
export type PaymentRequestStatusT = (typeof PAYMENT_REQUEST_STATUSES)[number];

export const FINANCE_STATUSES = ["Pending", "Cheque Prepared", "Cheque Issued", "Released"] as const;
export type FinanceStatusT = (typeof FINANCE_STATUSES)[number];

export const CHEQUE_DELIVERY_STATUSES = [
  "Pending",
  "Delivered to Operations",
  "Delivered to Customer",
] as const;
export type ChequeDeliveryStatusT = (typeof CHEQUE_DELIVERY_STATUSES)[number];

export interface StatusHistoryEntry {
  stage: string;
  status: string;
  decision?: string | null;
  reason?: string | null;
  changedBy: string;
  changedByRole: Role;
  changedAt: string; // ISO UTC
}

export interface AuditEntry {
  action: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  user: string;
  role: Role;
  timestamp: string; // ISO UTC
}

/**
 * The single record type for the whole system (BUILD PROMPT Section 4).
 * Field names are the EXACT names already in use across the business —
 * including the ones containing spaces and the pre-existing "Benefciary"
 * spelling. Nothing renames them anywhere in the app.
 */
export interface CarLoanRequest {
  // 4.1 Application / Identification
  APP_ID: string;
  APP_DATETIME: string;
  APP_CUSTOMER_TYPE: string;
  APP_PROGRAM_ID: number;
  PROGRAM_NAME: string;
  Branch: string;
  /** System-computed only — never an editable input anywhere in the UI. */
  STATUS: Status;
  CREATION_DATE: string | null;

  // 4.2 Customer Information — read-only, sourced from system data
  CUSTOMER_NAME: string;
  CUSTOMER_ID_NUMBER: string;
  CUSTOMER_GENDER: string | null;
  CUSTOMER_NATIONALITY: string | null;
  CUSTOMER_TITLE: string | null;
  CUSTOMER_CLASS: string | null;
  ORGANIZATION_NAME: string | null;
  ORG_TYPE: string | null;
  ORG_REG_NUMBER: string | null;

  // 4.3 Car / Asset Information — read-only, sourced from system data
  BRAND_NAME: string;
  MODEL: string;
  "Car Type": string;
  CHASIS_NUMBER: string;
  MOTOR_NUMBER: string;
  COLOR: string;
  ENGINE_SIZE: string;
  YEAR_OF_PRODUCT: number;

  // 4.4 Contract Stage (Sales)
  "Contract Type": string | null;
  "Contract Ready Status": string;
  "Contract Signing Date": string | null;
  DRV_SALES_MAN: string | null;
  DRV_SALES_MANAGER: string | null;
  "Insurance Type": string | null;
  "Receival Method": string | null;
  "External Contract": string | null;
  "Car Documents": string | null;
  "Benefciary Documents": string | null;
  "All Customer Car Documents": string | null;
  Inspection: string | null;
  Pricing: string | null;

  // 4.5 Operations Review
  "Operation Notes": string | null;
  DEVIATION: string | null;
  FEEDBACK: string | null;
  OperationsReviewedBy: string | null;
  OperationsReviewDate: string | null;

  // 4.6 Financial / Loan Details
  PRICE: number | null;
  DOWN_PAYMENT: number | null;
  LOAN_AMOUNT: number | null;
  "Loan Amount Calculated": number | null;
  INTEREST_RATE: number | null;
  TENOR_MONTH: number | null;
  ADMIN_FEES: number | null;
  BANK_NAME: string | null;
  BANK_BRANCH: string | null;

  // 4.7 Payment Request (Operations -> Finance)
  "Payment Request Status": PaymentRequestStatusT;
  "Payment Request File": string | null;
  DECISION: string | null;
  REASON: string | null;

  // 4.8 Finance Execution (cheque issuance)
  "Finance Status": FinanceStatusT;
  "Finance Notes": string | null;
  "Cheque Number": string | null;
  "Cheque Location": string | null;
  Cheque: string | null;
  "Customer Cheque": string | null;
  "Payment Receipt": string | null;
  Receipt: string | null;
  FinanceReviewedBy: string | null;
  FinanceReviewDate: string | null;

  // 4.9 Cheque Handover & Delivery
  ChequeDeliveryStatus: ChequeDeliveryStatusT;
  ChequeHandoverToOperationsDate: string | null;
  ChequeHandoverToOperationsBy: string | null;
  ChequeDeliveredToCustomerDate: string | null;
  ChequeDeliveredToCustomerBy: string | null;
  CustomerAcknowledgementFile: string | null;

  // 4.10 Duplicate Detection
  DuplicateCheckKey: string | null;
  IsPotentialDuplicate: boolean;
  DuplicateOfAppID: string | null;

  // 4.11 Audit Trail (embedded — the system's "history table")
  StatusHistoryLog: StatusHistoryEntry[];
  AuditTrail: AuditEntry[];
  CreatedBy: string;
  CreatedOn: string;
  ModifiedBy: string | null;
  ModifiedOn: string;
  IsLocked: boolean;
}

export type LifecycleAction =
  | "SUBMIT_FOR_OPERATIONS_REVIEW"
  | "START_OPERATIONS_REVIEW"
  | "RETURN_BY_OPERATIONS"
  | "REJECT_BY_OPERATIONS"
  | "SUBMIT_PAYMENT_REQUEST"
  | "START_FINANCE_REVIEW"
  | "RETURN_BY_FINANCE"
  | "REJECT_BY_FINANCE"
  | "APPROVE_BY_FINANCE"
  | "ISSUE_CHEQUE"
  | "CONFIRM_CHEQUE_RECEIVED_BY_OPERATIONS"
  | "CONFIRM_DELIVERED_TO_CUSTOMER"
  | "CANCEL";

export const STATUS_COLOR: Record<string, "green" | "amber" | "red" | "slate" | "blue"> = {
  Draft: "slate",
  "Submitted for Operations Review": "amber",
  "Under Operations Review": "amber",
  "Returned by Operations": "blue",
  "Rejected by Operations": "red",
  "Payment Request Submitted": "amber",
  "Under Finance Review": "amber",
  "Returned by Finance": "blue",
  "Rejected by Finance": "red",
  "Approved by Finance": "green",
  "Cheque Issued": "green",
  "Cheque Delivered to Operations": "green",
  "Delivered to Customer": "green",
  Cancelled: "slate",
};
