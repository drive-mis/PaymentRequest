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
