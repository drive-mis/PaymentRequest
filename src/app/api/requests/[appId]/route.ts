import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, roleForPersonaName } from "@/lib/auth";
import { toExact, toPrisma } from "@/lib/serialize";
import { assertFieldsEditable, RuleViolation } from "@/lib/rules";
import type { AuditEntry, Status } from "@/lib/types";

export async function GET(_req: NextRequest, { params }: { params: { appId: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const record = await prisma.carLoanRequest.findUnique({ where: { APP_ID: params.appId } });
  if (!record) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json(toExact(record));
}

export async function PATCH(req: NextRequest, { params }: { params: { appId: string } }) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const record = await prisma.carLoanRequest.findUnique({ where: { APP_ID: params.appId } });
  if (!record) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (record.IsLocked) {
    return NextResponse.json({ error: "This request is locked and can no longer be edited." }, { status: 423 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const createdByRole = roleForPersonaName(record.CreatedBy) ?? "Sales";
  const prismaFields = toPrisma(body);

  try {
    assertFieldsEditable(prismaFields, session.role, record.STATUS as Status, createdByRole);
  } catch (err) {
    if (err instanceof RuleViolation) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const now = new Date().toISOString();
  const auditTrail: AuditEntry[] = JSON.parse(record.AuditTrail || "[]");
  for (const [key, newValue] of Object.entries(prismaFields)) {
    const oldValue = (record as Record<string, unknown>)[key];
    if (oldValue !== newValue) {
      auditTrail.push({
        action: "FIELD_UPDATE",
        field: key,
        oldValue,
        newValue,
        user: session.name,
        role: session.role,
        timestamp: now,
      });
    }
  }

  // Keep Loan Amount Calculated in sync when Price/Down Payment change.
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
      AuditTrail: JSON.stringify(auditTrail),
      ModifiedBy: session.name,
    },
  });

  return NextResponse.json(toExact(updated));
}
