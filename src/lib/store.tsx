"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type {
  AuditEntry,
  CarLoanRequest,
  LifecycleAction,
  PendingApplication,
  Role,
  StatusHistoryEntry,
  User,
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
import { buildSeedAssignments } from "./seedAssignments";
import { DEFAULT_USERS, roleForUserName } from "./personas";

// Bump a version suffix whenever the stored shape changes, so browsers holding
// older data re-seed instead of rendering records missing new fields.
// requests v2: Car Type became an agent-chosen New/Used dropdown, the program
//   moved onto the customer record, branch list replaced, documents changed.
// requests v3: loan terms are uploaded with the application, so every record
//   carries them from creation — including Drafts, which previously had none.
// requests v4: monthly instalment added; DEVIATION / FEEDBACK became uploaded
//   credit-system output instead of Operations-entered notes.
// requests v5: contract signing method (ACH / Cheques) added; attachments now
//   store an IndexedDB reference rather than a bare filename.
// requests v6: showroom name / code / address / tax id added.
const REQUESTS_KEY = "df_requests_v6";
const SESSION_KEY = "df_session_v1";
const USERS_KEY = "df_users_v1";
// assignments v2: financial / loan terms moved into the upload, so they are
//   system-sourced and read-only like the customer and vehicle data.
// assignments v3: monthly instalment, plus DEVIATION / FEEDBACK from credit.
// assignments v4: showroom details added to the upload.
const ASSIGNMENTS_KEY = "df_assignments_v4";

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

/**
 * Which records the signed-in user is allowed to see.
 *
 * Sales agents are scoped to their own book of business — a request counts as
 * theirs if they created it or are the named sales agent on it. Operations,
 * Finance and Admin keep full visibility: the first two review work that
 * originates with other people, and Admin needs oversight of everything.
 */
export function visibleTo(requests: CarLoanRequest[], session: Session | null): CarLoanRequest[] {
  if (!session) return [];
  if (session.role !== "Sales") return requests;
  return requests.filter((r) => r.CreatedBy === session.name || r.DRV_SALES_MAN === session.name);
}

/** Pending applications a user may act on. Sales see only their assignments. */
export function assignmentsVisibleTo(
  assignments: PendingApplication[],
  session: Session | null
): PendingApplication[] {
  if (!session) return [];
  if (session.role !== "Sales") return assignments;
  return assignments.filter((a) => a.DRV_SALES_MAN === session.name);
}

export interface CreateInput {
  /** The pending application this contract is being raised from. */
  ASSIGNMENT_ID: string;
  fields: Record<string, unknown>;
  acknowledgeSimilar?: boolean;
  /**
   * Submit for Operations review as part of the same operation. Done inside
   * the store rather than as a follow-up performAction call because React
   * state has not flushed yet at that point — the new record would not be
   * found. One atomic create-and-submit, one write.
   */
  submitForReview?: boolean;
}

export interface ActionInput {
  action: LifecycleAction;
  reason?: string | null;
  fields?: Record<string, unknown>;
  acknowledgeSimilar?: boolean;
}

export type UploadMode = "replace" | "append";

interface StoreValue {
  hydrated: boolean;
  /** Every record in storage. Prefer `requests` unless you truly need all. */
  allRequests: CarLoanRequest[];
  /** Records the signed-in user may see (see visibleTo). */
  requests: CarLoanRequest[];
  session: Session | null;

  users: User[];
  addUser: (user: User) => void;
  updateUser: (originalName: string, user: User) => void;
  removeUser: (name: string) => void;

  /** All uploaded applications, including ones already turned into contracts. */
  allAssignments: PendingApplication[];
  /** Still-pending applications the signed-in user may raise a contract from. */
  openAssignments: PendingApplication[];
  saveAssignments: (incoming: PendingApplication[], mode: UploadMode) => { added: number; skipped: number };
  clearAssignments: () => void;

  signIn: (name: string) => void;
  signOut: () => void;
  getRequest: (appId: string) => CarLoanRequest | undefined;
  createRequest: (input: CreateInput) => CarLoanRequest;
  patchRequest: (appId: string, fields: Record<string, unknown>) => void;
  performAction: (appId: string, input: ActionInput) => void;
  resetData: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function readJson<T>(key: string, fallback: () => T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      const seeded = fallback();
      window.localStorage.setItem(key, JSON.stringify(seeded));
      return seeded;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback();
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Could not persist ${key} to localStorage`, err);
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
export function asFieldMap(record: CarLoanRequest): Record<string, unknown> {
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
  const [users, setUsers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<PendingApplication[]>([]);
  const [session, setSession] = useState<Session | null>(null);

  // localStorage is browser-only, so load after mount to avoid an SSR/client
  // hydration mismatch. Screens render a loading state until this completes.
  useEffect(() => {
    setRequests(readJson(REQUESTS_KEY, buildSeedData));
    setUsers(readJson(USERS_KEY, () => DEFAULT_USERS));
    setAssignments(readJson(ASSIGNMENTS_KEY, buildSeedAssignments));
    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      setSession(raw ? (JSON.parse(raw) as Session) : null);
    } catch {
      setSession(null);
    }
    setHydrated(true);
  }, []);

  const persistRequests = useCallback((next: CarLoanRequest[]) => {
    setRequests(next);
    writeJson(REQUESTS_KEY, next);
  }, []);

  const persistUsers = useCallback((next: User[]) => {
    setUsers(next);
    writeJson(USERS_KEY, next);
  }, []);

  const persistAssignments = useCallback((next: PendingApplication[]) => {
    setAssignments(next);
    writeJson(ASSIGNMENTS_KEY, next);
  }, []);

  // ---- Session ------------------------------------------------------------

  const signIn = useCallback(
    (name: string) => {
      const user = users.find((u) => u.name === name && u.active);
      if (!user) return;
      const next = { name: user.name, role: user.role };
      setSession(next);
      writeJson(SESSION_KEY, next);
    },
    [users]
  );

  const signOut = useCallback(() => {
    setSession(null);
    window.localStorage.removeItem(SESSION_KEY);
  }, []);

  // ---- User management (Admin) -------------------------------------------

  const addUser = useCallback(
    (user: User) => {
      const name = user.name.trim();
      if (!name) throw new RuleViolation("User name is required.");
      if (users.some((u) => u.name.toLowerCase() === name.toLowerCase())) {
        throw new RuleViolation(`A user named "${name}" already exists.`);
      }
      persistUsers([...users, { ...user, name }]);
    },
    [users, persistUsers]
  );

  const updateUser = useCallback(
    (originalName: string, user: User) => {
      const name = user.name.trim();
      if (!name) throw new RuleViolation("User name is required.");
      if (
        name.toLowerCase() !== originalName.toLowerCase() &&
        users.some((u) => u.name.toLowerCase() === name.toLowerCase())
      ) {
        throw new RuleViolation(`A user named "${name}" already exists.`);
      }
      persistUsers(users.map((u) => (u.name === originalName ? { ...user, name } : u)));
    },
    [users, persistUsers]
  );

  const removeUser = useCallback(
    (name: string) => {
      // Requests and assignments reference users by name, so removing someone
      // who owns work would orphan it. Deactivate instead in that case.
      const ownsRequests = requests.some((r) => r.CreatedBy === name || r.DRV_SALES_MAN === name);
      const ownsAssignments = assignments.some((a) => a.DRV_SALES_MAN === name);
      if (ownsRequests || ownsAssignments) {
        throw new RuleViolation(
          `"${name}" is referenced by existing requests or assignments and cannot be deleted. Set them to inactive instead.`
        );
      }
      if (session?.name === name) {
        throw new RuleViolation("You cannot delete the user you are signed in as.");
      }
      persistUsers(users.filter((u) => u.name !== name));
    },
    [users, requests, assignments, session, persistUsers]
  );

  // ---- Application data upload (Admin) -----------------------------------

  const saveAssignments = useCallback(
    (incoming: PendingApplication[], mode: UploadMode) => {
      if (mode === "replace") {
        // Keep rows already turned into contracts, so replacing the sheet can
        // never erase the provenance of an existing request.
        const consumed = assignments.filter((a) => a.ConsumedByAppId);
        const consumedIds = new Set(consumed.map((a) => a.ASSIGNMENT_ID));
        const fresh = incoming.filter((a) => !consumedIds.has(a.ASSIGNMENT_ID));
        persistAssignments([...consumed, ...fresh]);
        return { added: fresh.length, skipped: incoming.length - fresh.length };
      }

      const existingIds = new Set(assignments.map((a) => a.ASSIGNMENT_ID));
      const fresh = incoming.filter((a) => !existingIds.has(a.ASSIGNMENT_ID));
      persistAssignments([...assignments, ...fresh]);
      return { added: fresh.length, skipped: incoming.length - fresh.length };
    },
    [assignments, persistAssignments]
  );

  const clearAssignments = useCallback(() => {
    persistAssignments(assignments.filter((a) => a.ConsumedByAppId));
  }, [assignments, persistAssignments]);

  const resetData = useCallback(() => {
    persistRequests(buildSeedData());
    persistAssignments(buildSeedAssignments());
    persistUsers(DEFAULT_USERS);
  }, [persistRequests, persistAssignments, persistUsers]);

  // ---- Requests -----------------------------------------------------------

  // Scoped on purpose: a Sales agent opening another agent's request by URL
  // gets nothing back, so the detail page renders its not-found state rather
  // than leaking the record.
  const getRequest = useCallback(
    (appId: string) => visibleTo(requests, session).find((r) => r.APP_ID === appId),
    [requests, session]
  );

  const createRequest = useCallback(
    (input: CreateInput): CarLoanRequest => {
      if (!session) throw new RuleViolation("Not signed in.");
      if (session.role !== "Sales" && session.role !== "Operations") {
        throw new RuleViolation("Only Sales or Operations may create contracts.");
      }

      const assignment = assignmentsVisibleTo(assignments, session).find(
        (a) => a.ASSIGNMENT_ID === input.ASSIGNMENT_ID
      );
      if (!assignment) {
        throw new RuleViolation("That application is not assigned to you, or no longer exists.");
      }
      if (assignment.ConsumedByAppId) {
        throw new RuleViolation(
          `A contract was already created from this application (${assignment.ConsumedByAppId}).`
        );
      }

      // Only agent-editable creation fields are accepted; customer, vehicle and
      // program data always come from the assignment, never from the form.
      const allowed = new Set(creatableFieldsFor(session.role));
      const editable: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(input.fields)) {
        if (allowed.has(k)) editable[k] = v;
      }

      const dup = checkDuplicates(
        assignment.CUSTOMER_ID_NUMBER,
        assignment.CHASIS_NUMBER,
        null,
        toCandidates(requests)
      );
      if (dup.exactMatch) {
        throw new RuleViolation(`A matching in-flight request already exists (${dup.exactMatch.APP_ID}).`);
      }
      if (dup.similarMatches.length && !input.acknowledgeSimilar) {
        throw new DuplicateWarning(
          "Similar existing request(s) found for this customer and vehicle. Acknowledge to continue.",
          dup
        );
      }

      const now = new Date().toISOString();
      const APP_ID = nextAppId(requests);

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
        APP_ID,
        APP_DATETIME: now,
        APP_CUSTOMER_TYPE: assignment.APP_CUSTOMER_TYPE,
        APP_PROGRAM_ID: assignment.APP_PROGRAM_ID,
        PROGRAM_NAME: assignment.PROGRAM_NAME,
        Branch: "",
        STATUS: "Draft",
        CREATION_DATE: null,

        CUSTOMER_NAME: assignment.CUSTOMER_NAME,
        CUSTOMER_ID_NUMBER: assignment.CUSTOMER_ID_NUMBER,
        CUSTOMER_GENDER: assignment.CUSTOMER_GENDER,
        CUSTOMER_NATIONALITY: assignment.CUSTOMER_NATIONALITY,
        CUSTOMER_TITLE: assignment.CUSTOMER_TITLE,
        CUSTOMER_CLASS: assignment.CUSTOMER_CLASS,
        ORGANIZATION_NAME: assignment.ORGANIZATION_NAME,
        ORG_TYPE: assignment.ORG_TYPE,
        ORG_REG_NUMBER: assignment.ORG_REG_NUMBER,

        BRAND_NAME: assignment.BRAND_NAME,
        MODEL: assignment.MODEL,
        CHASIS_NUMBER: assignment.CHASIS_NUMBER,
        MOTOR_NUMBER: assignment.MOTOR_NUMBER,
        COLOR: assignment.COLOR,
        ENGINE_SIZE: assignment.ENGINE_SIZE,
        YEAR_OF_PRODUCT: assignment.YEAR_OF_PRODUCT,

        SHOWROOM_NAME: assignment.SHOWROOM_NAME,
        SHOWROOM_CODE: assignment.SHOWROOM_CODE,
        SHOWROOM_ADDRESS: assignment.SHOWROOM_ADDRESS,
        SHOWROOM_TAX_ID: assignment.SHOWROOM_TAX_ID,

        "Car Type": null,
        "Contract Type": null,
        "Contract Ready Status": "Not Ready",
        "Contract Signing Method": null,
        "Contract Signing Date": null,
        // The assignment decides whose deal this is — not a free-text field.
        DRV_SALES_MAN: assignment.DRV_SALES_MAN,
        DRV_SALES_MANAGER: null,
        "Insurance Type": null,
        "Receival Method": null,
        "External Contract": null,
        "Car Documents": null,
        "Benefciary Documents": null,
        "All Customer Car Documents": null,
        Inspection: null,
        Pricing: null,
        Invoice: null,

        "Operation Notes": null,
        // Credit-system output, carried over with the application.
        DEVIATION: assignment.DEVIATION,
        FEEDBACK: assignment.FEEDBACK,
        OperationsReviewedBy: null,
        OperationsReviewDate: null,

        // Financial terms come from the assignment, like the customer and
        // vehicle data — no role types these in.
        PRICE: assignment.PRICE,
        DOWN_PAYMENT: assignment.DOWN_PAYMENT,
        LOAN_AMOUNT: assignment.LOAN_AMOUNT,
        "Loan Amount Calculated": assignment.PRICE - assignment.DOWN_PAYMENT,
        MONTHLY_INSTALLMENT: assignment.MONTHLY_INSTALLMENT,
        INTEREST_RATE: assignment.INTEREST_RATE,
        TENOR_MONTH: assignment.TENOR_MONTH,
        ADMIN_FEES: assignment.ADMIN_FEES,
        BANK_NAME: assignment.BANK_NAME,
        BANK_BRANCH: assignment.BANK_BRANCH,

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
          assignment.CUSTOMER_ID_NUMBER,
          assignment.CHASIS_NUMBER,
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

      // Apply the submit transition in-memory so it still goes through the
      // same rule check, but lands in a single write alongside the create.
      let finalRecord = record;
      if (input.submitForReview) {
        const rule = validateTransition(
          "SUBMIT_FOR_OPERATIONS_REVIEW",
          record.STATUS,
          session.role,
          null,
          asFieldMap(record)
        );
        finalRecord = {
          ...record,
          STATUS: rule.to,
          ...deriveSubStatuses(rule.to),
          StatusHistoryLog: [
            ...record.StatusHistoryLog,
            {
              stage: session.role,
              status: rule.to,
              decision: null,
              reason: null,
              changedBy: session.name,
              changedByRole: session.role,
              changedAt: now,
            },
          ],
          AuditTrail: [
            ...record.AuditTrail,
            {
              action: "SUBMIT_FOR_OPERATIONS_REVIEW",
              field: "STATUS",
              oldValue: record.STATUS,
              newValue: rule.to,
              user: session.name,
              role: session.role,
              timestamp: now,
            },
          ],
        };
      }

      persistRequests([...requests, finalRecord]);
      persistAssignments(
        assignments.map((a) =>
          a.ASSIGNMENT_ID === assignment.ASSIGNMENT_ID ? { ...a, ConsumedByAppId: APP_ID } : a
        )
      );
      return finalRecord;
    },
    [requests, assignments, session, persistRequests, persistAssignments]
  );

  const patchRequest = useCallback(
    (appId: string, fields: Record<string, unknown>) => {
      if (!session) throw new RuleViolation("Not signed in.");
      // Looked up through the visibility scope, so a Sales agent cannot mutate
      // a request belonging to another agent even by calling this directly.
      const record = visibleTo(requests, session).find((r) => r.APP_ID === appId);
      if (!record) throw new RuleViolation("Request not found.");
      if (record.IsLocked) {
        throw new RuleViolation("This request is locked and can no longer be edited.");
      }

      const createdByRole = roleForUserName(users, record.CreatedBy) ?? "Sales";
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

      persistRequests(requests.map((r) => (r.APP_ID === appId ? updated : r)));
    },
    [requests, users, session, persistRequests]
  );

  const performAction = useCallback(
    (appId: string, input: ActionInput) => {
      if (!session) throw new RuleViolation("Not signed in.");
      const record = visibleTo(requests, session).find((r) => r.APP_ID === appId);
      if (!record) throw new RuleViolation("Request not found.");

      const { action, reason, fields, acknowledgeSimilar } = input;

      if (TERMINAL_STATUSES.includes(record.STATUS) || record.IsLocked) {
        throw new RuleViolation("This request is closed and cannot be actioned further.");
      }

      const createdByRole = roleForUserName(users, record.CreatedBy) ?? "Sales";
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
          throw new RuleViolation(`Duplicate payment request — matches ${dup.exactMatch.APP_ID}.`);
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

      persistRequests(requests.map((r) => (r.APP_ID === appId ? updated : r)));
    },
    [requests, users, session, persistRequests]
  );

  const value = useMemo<StoreValue>(
    () => ({
      hydrated,
      allRequests: requests,
      requests: visibleTo(requests, session),
      session,
      users,
      addUser,
      updateUser,
      removeUser,
      allAssignments: assignments,
      openAssignments: assignmentsVisibleTo(assignments, session).filter((a) => !a.ConsumedByAppId),
      saveAssignments,
      clearAssignments,
      signIn,
      signOut,
      getRequest,
      createRequest,
      patchRequest,
      performAction,
      resetData,
    }),
    [
      hydrated,
      requests,
      session,
      users,
      assignments,
      addUser,
      updateUser,
      removeUser,
      saveAssignments,
      clearAssignments,
      signIn,
      signOut,
      getRequest,
      createRequest,
      patchRequest,
      performAction,
      resetData,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>.");
  return ctx;
}
