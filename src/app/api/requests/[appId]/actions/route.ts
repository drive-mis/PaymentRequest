import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, roleForPersonaName } from "@/lib/auth";
import { toExact, toPrisma } from "@/lib/serialize";
import {
  assertFieldsEditable,
  checkDuplicates,
  computeDuplicateCheckKey,
  deriveSubStatuses,
  RuleViolation,
  TERMINAL_STATUSES,
  validateTransition,
} from "@/lib/rules";
import type { AuditEntry, LifecycleAction, Role, Status, StatusHistoryEntry } from "@/lib/types";

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

export async function POST(req: NextRequest, { params }: { params: { appId: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const record = await prisma.carLoanRequest.findUnique({ where: { APP_ID: params.appId } });
  if (!record) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = (await req.json()) as {
    action: LifecycleAction;
    reason?: string;
    fields?: Record<string, unknown>;
    acknowledgeSimilar?: boolean;
  };
  const { action, reason, fields, acknowledgeSimilar } = body;

  if (TERMINAL_STATUSES.includes(record.STATUS as Status) || record.IsLocked) {
    return NextResponse.json({ error: "This request is closed and cannot be actioned further." }, { status: 423 });
  }

  const prismaFields = fields ? toPrisma(fields) : {};

  const createdByRole = (roleForPersonaName(record.CreatedBy) ?? "Sales") as Role;
  try {
    if (fields) {
      assertFieldsEditable(prismaFields, session.role, record.STATUS as Status, createdByRole);
    }
  } catch (err) {
    if (err instanceof RuleViolation) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  // Virtual merged record used for gate checks (e.g. cheque-issuance gate can
  // be satisfied by fields submitted in this very same call).
  const merged: Record<string, unknown> = { ...record, ...prismaFields };

  let rule;
  try {
    rule = validateTransition(action, record.STATUS as Status, session.role, reason, merged);
  } catch (err) {
    if (err instanceof RuleViolation) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }

  // Re-run duplicate detection with the real loan amount once it's known.
  let duplicateUpdate: Record<string, unknown> = {};
  if (action === "SUBMIT_PAYMENT_REQUEST") {
    const loanAmount = (merged.LOAN_AMOUNT as number | null) ?? null;
    const existing = await prisma.carLoanRequest.findMany({
      where: { APP_ID: { not: record.APP_ID } },
      select: { APP_ID: true, CUSTOMER_ID_NUMBER: true, CHASIS_NUMBER: true, LOAN_AMOUNT: true, STATUS: true },
    });
    const dup = checkDuplicates(record.CUSTOMER_ID_NUMBER, record.CHASIS_NUMBER, loanAmount, existing);
    if (dup.exactMatch) {
      return NextResponse.json(
        { error: `Duplicate payment request — matches ${dup.exactMatch.APP_ID}.`, duplicate: dup },
        { status: 422 }
      );
    }
    if (dup.similarMatches.length && !acknowledgeSimilar) {
      return NextResponse.json(
        {
          error: "Similar existing request(s) found for this customer and vehicle. Acknowledge to continue.",
          duplicate: dup,
        },
        { status: 409 }
      );
    }
    duplicateUpdate = {
      DuplicateCheckKey: computeDuplicateCheckKey(record.CUSTOMER_ID_NUMBER, record.CHASIS_NUMBER, loanAmount),
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

  const auditTrail: AuditEntry[] = JSON.parse(record.AuditTrail || "[]");
  auditTrail.push({
    action,
    field: "STATUS",
    oldValue: record.STATUS,
    newValue: rule.to,
    user: session.name,
    role: session.role,
    timestamp: now,
  });
  for (const [key, newValue] of Object.entries(prismaFields)) {
    const oldValue = (record as Record<string, unknown>)[key];
    if (oldValue !== newValue) {
      auditTrail.push({ action, field: key, oldValue, newValue, user: session.name, role: session.role, timestamp: now });
    }
  }

  const statusHistory: StatusHistoryEntry[] = JSON.parse(record.StatusHistoryLog || "[]");
  statusHistory.push(historyEntry);

  const subStatuses = deriveSubStatuses(rule.to);

  const reviewStamps: Record<string, unknown> = {};
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

  const nextPrice = (prismaFields.PRICE as number | undefined) ?? record.PRICE;
  const nextDown = (prismaFields.DOWN_PAYMENT as number | undefined) ?? record.DOWN_PAYMENT;
  const loanAmountCalculated =
    nextPrice !== null && nextPrice !== undefined && nextDown !== null && nextDown !== undefined
      ? nextPrice - nextDown
      : undefined;

  const updated = await prisma.carLoanRequest.update({
    where: { APP_ID: params.appId },
    data: {
      ...prismaFields,
      ...(loanAmountCalculated !== undefined ? { LoanAmountCalculated: loanAmountCalculated } : {}),
      ...duplicateUpdate,
      ...reviewStamps,
      STATUS: rule.to,
      ...subStatuses,
      ...(decision ? { DECISION: decision } : {}),
      ...(reason !== undefined ? { REASON: reason ?? null } : {}),
      ...(rule.to === "Delivered to Customer" ? { IsLocked: true } : {}),
      StatusHistoryLog: JSON.stringify(statusHistory),
      AuditTrail: JSON.stringify(auditTrail),
      ModifiedBy: session.name,
    },
  });

  return NextResponse.json(toExact(updated));
}
