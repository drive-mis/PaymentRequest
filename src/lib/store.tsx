"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type {
  AuditEntry,
  CarLoanRequest,
  LifecycleAction,
  Role,
  Status,
  StatusHistoryEntry,
} from "./types";
import {
  assertFieldsEditable,
  checkDuplicates,
  computeDuplicateCheckKey,
  creatableFieldsFor,
  deriveSubStatuses,
  RuleViolation,
  TERMINAL_STATUSES,
  validateTransition,
  type DuplicateCheckResult,
} from "./rules";
import { buildSeedData } from "./seedData";
import { MOCK_CUSTOMERS, MOCK_VEHICLES } from "./mockSource";
import { roleForPersonaName } from "./personas";

const REQUESTS_KEY = "df_requests_v1";
const SESSION_KEY = "df_session_v1";

export interface Session {
  name: string;
  role: Role;
}

// ---------------------------------------------------------------------------
// Every mutation in the app funnels through this store, and the store always
// runs the Section 5 rules first. Screens never write a record directly, so a
// button rendered by mistake still cannot bypass a transition rule or gate —
// the same guarantee the server-side API layer gave in the full-stack version.
// ---------------------------------------------------------------------------

export class DuplicateWarning extends Error {
  duplicate: DuplicateCheckResult;
  constructor(message: string, duplicate: DuplicateCheckResult) {
    super(message);
    this.name = "DuplicateWarning";
    this.duplicate = duplicate;
  }
}

interface StoreValue {
  hydrated: boolean;
  requests: CarLoanRequest[];
  session: Session | null;
  signIn: (name: string) => void;
  signOut: () => void;
  getRequest: (appId: string) => CarLoanRequest | undefined;
  createRequest: (input: CreateInput) => CarLoanRequest;
  patchRequest: (appId: string, fields: Record<string, unknown>) => void;
  performAction: (appId: string, input: ActionInput) => void;
  resetData: () => void;
}

export interface CreateInput {
  CUSTOMER_ID_NUMBER: string;
  CHASIS_NUMBER: string;
  fields: Record<string, unknown>;
  acknowledgeSimilar?: boolean;
}

export interface ActionInput {
  action: LifecycleAction;
  reason?: string | null;
  fields?: Record<string, unknown>;
  acknowledgeSimilar?: boolean;
}

const StoreContext = createContext<StoreValue | null>(null);

function loadRequests(): CarLoanRequest[] {
  try {
    const raw = window.localStorage.getItem(REQUESTS_KEY);
    if (!raw) {
      const seeded = buildSeedData();
      window.localStorage.setItem(REQUESTS_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return JSON.parse(raw) as CarLoanRequest[];
  } catch {
    return buildSeedData();
  }
}

function loadSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function nextAppId(records: CarLoanRequest[]): string {
  const max = records.reduce((acc, r) => {
    const m = r.APP_ID.match(/(\d+)$/);
    return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
  }, 0);
  return `APP-${String(max + 1).padStart(6, "0")}`;
}

const STAGE_BY_ACTION: Record<LifecycleAction, string> = {
  SUBMIT_FOR_OPERATIONS_REVIEW: "Sales",
  START_OPERATIONS_REVIEW: "Operations",
  RETURN_BY_OPERATIONS: "Operations",
  REJECT_BY_OPERATIONS: "Operations",
  SUBMIT_PAYMENT_REQUEST: "Operations",
  START_FINANCE_REVIEW: "Finance",
  RETURN_BY_FINANCE: "Finance",
  REJECT_BY_FINANCE: "Finance",
  APPROVE_BY_FINANCE: "Finance",
  ISSUE_CHEQUE: "Finance",
  CONFIRM_CHEQUE_RECEIVED_BY_OPERATIONS: "Operations",
  CONFIRM_DELIVERED_TO_CUSTOMER: "Operations",
  CANCEL: "System",
};

const DECISION_LABEL: Partial<Record<LifecycleAction, string>> = {
  RETURN_BY_OPERATIONS: "Returned",
  REJECT_BY_OPERATIONS: "Rejected",
  SUBMIT_PAYMENT_REQUEST: "Approved",
  RETURN_BY_FINANCE: "Returned",
  REJECT_BY_FINANCE: "Rejected",
  APPROVE_BY_FINANCE: "Approved",
  CANCEL: "Cancelled",
};

/**
 * CarLoanRequest deliberately has no index signature (its field names are a
 * fixed, exact list), so reading an arbitrary field name off it needs one
 * explicit widening. Kept in one place rather than casting at each call site.
 */
function asFieldMap(record: CarLoanRequest): Record<string, unknown> {
  return record as unknown as Record<string, unknown>;
}

function toCandidates(records: CarLoanRequest[]) {
  return records.map((r) => ({
    APP_ID: r.APP_ID,
    CUSTOMER_ID_NUMBER: r.CUSTOMER_ID_NUMBER,
    CHASIS_NUMBER: r.CHASIS_NUMBER,
    LOAN_AMOUNT: r.LOAN_AMOUNT,
    STATUS: r.STATUS,
  }));
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [requests, setRequests] = useState<CarLoanRequest[]>([]);
  const [session, setSession] = useState<Session | null>(null);

  // localStorage is browser-only, so load after mount to avoid an SSR/client
  // hydration mismatch. Screens render a loading state until this completes.
  useEffect(() => {
    setRequests(loadRequests());
    setSession(loadSession());
    setHydrated(true);
  }, []);

  const persist = useCallback((next: CarLoanRequest[]) => {
    setRequests(next);
    try {
      window.localStorage.setItem(REQUESTS_KEY, JSON.stringify(next));
    } catch (err) {
      console.error("Could not persist requests to localStorage", err);
    }
  }, []);

  const signIn = useCallback((name: string) => {
    const role = roleForPersonaName(name);
    if (!role) return;
    const next = { name, role };
    setSession(next);
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(next));
  }, []);

  const signOut = useCallback(() => {
    setSession(null);
    window.localStorage.removeItem(SESSION_KEY);
  }, []);

  const resetData = useCallback(() => {
    const seeded = buildSeedData();
    persist(seeded);
  }, [persist]);

  const getRequest = useCallback(
    (appId: string) => requests.find((r) => r.APP_ID === appId),
    [requests]
  );

  const createRequest = useCallback(
    (input: CreateInput): CarLoanRequest => {
      if (!session) throw new RuleViolation("Not signed in.");
      if (session.role !== "Sales" && session.role !== "Operations") {
        throw new RuleViolation("Only Sales or Operations may create contracts.");
      }

      const customer = MOCK_CUSTOMERS.find((c) => c.CUSTOMER_ID_NUMBER === input.CUSTOMER_ID_NUMBER);
      const vehicle = MOCK_VEHICLES.find((v) => v.CHASIS_NUMBER === input.CHASIS_NUMBER);
      if (!customer) throw new RuleViolation("Unknown customer — select one from lookup.");
      if (!vehicle) throw new RuleViolation("Unknown vehicle — select one from lookup.");

      // Only agent-editable creation fields are accepted; customer/vehicle data
      // is always copied from the source lookup, never from the form.
      const allowed = new Set(creatableFieldsFor(session.role));
      const editable: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(input.fields)) {
        if (allowed.has(k)) editable[k] = v;
      }

      const dup = checkDuplicates(
        customer.CUSTOMER_ID_NUMBER,
        vehicle.CHASIS_NUMBER,
        null,
        toCandidates(requests)
      );
      if (dup.exactMatch) {
        throw new RuleViolation(
          `A matching in-flight request already exists (${dup.exactMatch.APP_ID}).`
        );
      }
      if (dup.similarMatches.length && !input.acknowledgeSimilar) {
        throw new DuplicateWarning(
          "Similar existing request(s) found for this customer and vehicle. Acknowledge to continue.",
          dup
        );
      }

      const now = new Date().toISOString();
      const historyEntry: StatusHistoryEntry = {
        stage: session.role,
        status: "Draft",
        decision: "Created",
        reason: null,
        changedBy: session.name,
        changedByRole: session.role,
        changedAt: now,
      };

      const record: CarLoanRequest = {
        APP_ID: nextAppId(requests),
        APP_DATETIME: now,
        APP_CUSTOMER_TYPE: customer.APP_CUSTOMER_TYPE,
        APP_PROGRAM_ID: 0,
        PROGRAM_NAME: "",
        Branch: "",
        STATUS: "Draft",
        CREATION_DATE: null,

        CUSTOMER_NAME: customer.CUSTOMER_NAME,
        CUSTOMER_ID_NUMBER: customer.CUSTOMER_ID_NUMBER,
        CUSTOMER_GENDER: customer.CUSTOMER_GENDER,
        CUSTOMER_NATIONALITY: customer.CUSTOMER_NATIONALITY,
        CUSTOMER_TITLE: customer.CUSTOMER_TITLE,
        CUSTOMER_CLASS: customer.CUSTOMER_CLASS,
        ORGANIZATION_NAME: customer.ORGANIZATION_NAME ?? null,
        ORG_TYPE: customer.ORG_TYPE ?? null,
        ORG_REG_NUMBER: customer.ORG_REG_NUMBER ?? null,

        BRAND_NAME: vehicle.BRAND_NAME,
        MODEL: vehicle.MODEL,
        "Car Type": vehicle["Car Type"],
        CHASIS_NUMBER: vehicle.CHASIS_NUMBER,
        MOTOR_NUMBER: vehicle.MOTOR_NUMBER,
        COLOR: vehicle.COLOR,
        ENGINE_SIZE: vehicle.ENGINE_SIZE,
        YEAR_OF_PRODUCT: vehicle.YEAR_OF_PRODUCT,

        "Contract Type": null,
        "Contract Ready Status": "Not Ready",
        "Contract Signing Date": null,
        DRV_SALES_MAN: null,
        DRV_SALES_MANAGER: null,
        "Insurance Type": null,
        "Receival Method": null,
        "External Contract": null,
        "Car Documents": null,
        "Benefciary Documents": null,
        "All Customer Car Documents": null,
        Inspection: null,
        Pricing: null,

        "Operation Notes": null,
        DEVIATION: null,
        FEEDBACK: null,
        OperationsReviewedBy: null,
        OperationsReviewDate: null,

        PRICE: null,
        DOWN_PAYMENT: null,
        LOAN_AMOUNT: null,
        "Loan Amount Calculated": null,
        INTEREST_RATE: null,
        TENOR_MONTH: null,
        ADMIN_FEES: null,
        BANK_NAME: null,
        BANK_BRANCH: null,

        "Payment Request Status": "Draft",
        "Payment Request File": null,
        DECISION: null,
        REASON: null,

        "Finance Status": "Pending",
        "Finance Notes": null,
        "Cheque Number": null,
        "Cheque Location": null,
        Cheque: null,
        "Customer Cheque": null,
        "Payment Receipt": null,
        Receipt: null,
        FinanceReviewedBy: null,
        FinanceReviewDate: null,

        ChequeDeliveryStatus: "Pending",
        ChequeHandoverToOperationsDate: null,
        ChequeHandoverToOperationsBy: null,
        ChequeDeliveredToCustomerDate: null,
        ChequeDeliveredToCustomerBy: null,
        CustomerAcknowledgementFile: null,

        DuplicateCheckKey: computeDuplicateCheckKey(
          customer.CUSTOMER_ID_NUMBER,
          vehicle.CHASIS_NUMBER,
          null
        ),
        IsPotentialDuplicate: dup.similarMatches.length > 0,
        DuplicateOfAppID: dup.similarMatches[0]?.APP_ID ?? null,

        StatusHistoryLog: [historyEntry],
        AuditTrail: [],
        CreatedBy: session.name,
        CreatedOn: now,
        ModifiedBy: session.name,
        ModifiedOn: now,
        IsLocked: false,
        ...editable,
      } as CarLoanRequest;

      persist([...requests, record]);
      return record;
    },
    [requests, session, persist]
  );

  const patchRequest = useCallback(
    (appId: string, fields: Record<string, unknown>) => {
      if (!session) throw new RuleViolation("Not signed in.");
      const record = requests.find((r) => r.APP_ID === appId);
      if (!record) throw new RuleViolation("Request not found.");
      if (record.IsLocked) {
        throw new RuleViolation("This request is locked and can no longer be edited.");
      }

      const createdByRole = roleForPersonaName(record.CreatedBy) ?? "Sales";
      assertFieldsEditable(fields, session.role, record.STATUS, createdByRole);

      const now = new Date().toISOString();
      const audit: AuditEntry[] = [...record.AuditTrail];
      for (const [field, newValue] of Object.entries(fields)) {
        const oldValue = asFieldMap(record)[field];
        if (oldValue !== newValue) {
          audit.push({
            action: "FIELD_UPDATE",
            field,
            oldValue,
            newValue,
            user: session.name,
            role: session.role,
            timestamp: now,
          });
        }
      }

      const merged = { ...record, ...fields } as CarLoanRequest;
      const price = merged.PRICE;
      const down = merged.DOWN_PAYMENT;
      const updated: CarLoanRequest = {
        ...merged,
        "Loan Amount Calculated":
          price !== null && price !== undefined && down !== null && down !== undefined
            ? price - down
            : merged["Loan Amount Calculated"],
        AuditTrail: audit,
        ModifiedBy: session.name,
        ModifiedOn: now,
      };

      persist(requests.map((r) => (r.APP_ID === appId ? updated : r)));
    },
    [requests, session, persist]
  );

  const performAction = useCallback(
    (appId: string, input: ActionInput) => {
      if (!session) throw new RuleViolation("Not signed in.");
      const record = requests.find((r) => r.APP_ID === appId);
      if (!record) throw new RuleViolation("Request not found.");

      const { action, reason, fields, acknowledgeSimilar } = input;

      if (TERMINAL_STATUSES.includes(record.STATUS) || record.IsLocked) {
        throw new RuleViolation("This request is closed and cannot be actioned further.");
      }

      const createdByRole = roleForPersonaName(record.CreatedBy) ?? "Sales";
      if (fields) {
        assertFieldsEditable(fields, session.role, record.STATUS, createdByRole);
      }

      // Gate checks run against the record merged with any fields submitted in
      // this same call, so e.g. the cheque-issuance gate can be satisfied by
      // the cheque number typed in the very form that triggers the transition.
      const merged = { ...record, ...(fields ?? {}) } as CarLoanRequest;

      const rule = validateTransition(action, record.STATUS, session.role, reason, asFieldMap(merged));

      let duplicateUpdate: Partial<CarLoanRequest> = {};
      if (action === "SUBMIT_PAYMENT_REQUEST") {
        const loanAmount = merged.LOAN_AMOUNT ?? null;
        const others = requests.filter((r) => r.APP_ID !== record.APP_ID);
        const dup = checkDuplicates(
          record.CUSTOMER_ID_NUMBER,
          record.CHASIS_NUMBER,
          loanAmount,
          toCandidates(others)
        );
        if (dup.exactMatch) {
          throw new RuleViolation(
            `Duplicate payment request — matches ${dup.exactMatch.APP_ID}.`
          );
        }
        if (dup.similarMatches.length && !acknowledgeSimilar) {
          throw new DuplicateWarning(
            "Similar existing request(s) found for this customer and vehicle. Acknowledge to continue.",
            dup
          );
        }
        duplicateUpdate = {
          DuplicateCheckKey: computeDuplicateCheckKey(
            record.CUSTOMER_ID_NUMBER,
            record.CHASIS_NUMBER,
            loanAmount
          ),
          IsPotentialDuplicate: dup.similarMatches.length > 0,
          DuplicateOfAppID: dup.similarMatches[0]?.APP_ID ?? null,
        };
      }

      const now = new Date().toISOString();
      const decision = DECISION_LABEL[action] ?? null;

      const historyEntry: StatusHistoryEntry = {
        stage: STAGE_BY_ACTION[action],
        status: rule.to,
        decision,
        reason: reason ?? null,
        changedBy: session.name,
        changedByRole: session.role,
        changedAt: now,
      };

      const audit: AuditEntry[] = [
        ...record.AuditTrail,
        {
          action,
          field: "STATUS",
          oldValue: record.STATUS,
          newValue: rule.to,
          user: session.name,
          role: session.role,
          timestamp: now,
        },
      ];
      for (const [field, newValue] of Object.entries(fields ?? {})) {
        const oldValue = asFieldMap(record)[field];
        if (oldValue !== newValue) {
          audit.push({
            action,
            field,
            oldValue,
            newValue,
            user: session.name,
            role: session.role,
            timestamp: now,
          });
        }
      }

      const reviewStamps: Partial<CarLoanRequest> = {};
      if (["RETURN_BY_OPERATIONS", "REJECT_BY_OPERATIONS", "SUBMIT_PAYMENT_REQUEST"].includes(action)) {
        reviewStamps.OperationsReviewedBy = session.name;
        reviewStamps.OperationsReviewDate = now;
      }
      if (["RETURN_BY_FINANCE", "REJECT_BY_FINANCE", "APPROVE_BY_FINANCE"].includes(action)) {
        reviewStamps.FinanceReviewedBy = session.name;
        reviewStamps.FinanceReviewDate = now;
      }
      if (action === "CONFIRM_CHEQUE_RECEIVED_BY_OPERATIONS") {
        reviewStamps.ChequeHandoverToOperationsDate = now;
        reviewStamps.ChequeHandoverToOperationsBy = session.name;
      }
      if (action === "CONFIRM_DELIVERED_TO_CUSTOMER") {
        reviewStamps.ChequeDeliveredToCustomerDate = now;
        reviewStamps.ChequeDeliveredToCustomerBy = session.name;
      }

      const price = merged.PRICE;
      const down = merged.DOWN_PAYMENT;

      const updated: CarLoanRequest = {
        ...merged,
        ...duplicateUpdate,
        ...reviewStamps,
        ...deriveSubStatuses(rule.to),
        STATUS: rule.to,
        "Loan Amount Calculated":
          price !== null && price !== undefined && down !== null && down !== undefined
            ? price - down
            : merged["Loan Amount Calculated"],
        ...(decision ? { DECISION: decision } : {}),
        ...(reason !== undefined ? { REASON: reason ?? null } : {}),
        ...(rule.to === "Delivered to Customer" ? { IsLocked: true } : {}),
        StatusHistoryLog: [...record.StatusHistoryLog, historyEntry],
        AuditTrail: audit,
        ModifiedBy: session.name,
        ModifiedOn: now,
      };

      persist(requests.map((r) => (r.APP_ID === appId ? updated : r)));
    },
    [requests, session, persist]
  );

  const value = useMemo<StoreValue>(
    () => ({
      hydrated,
      requests,
      session,
      signIn,
      signOut,
      getRequest,
      createRequest,
      patchRequest,
      performAction,
      resetData,
    }),
    [hydrated, requests, session, signIn, signOut, getRequest, createRequest, patchRequest, performAction, resetData]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>.");
  return ctx;
}
