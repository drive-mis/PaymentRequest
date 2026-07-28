import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { toExact, toPrisma } from "@/lib/serialize";
import { checkDuplicates, computeDuplicateCheckKey, creatableFieldsFor } from "@/lib/rules";
import { nextAppId } from "@/lib/format";
import { MOCK_CUSTOMERS, MOCK_VEHICLES } from "@/lib/mockSource";
import type { StatusHistoryEntry } from "@/lib/types";

export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status");
  const q = req.nextUrl.searchParams.get("q");

  const records = await prisma.carLoanRequest.findMany({
    where: {
      ...(status ? { STATUS: status } : {}),
      ...(q
        ? {
            OR: [
              { APP_ID: { contains: q } },
              { CUSTOMER_NAME: { contains: q } },
              { BRAND_NAME: { contains: q } },
              { MODEL: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { APP_DATETIME: "desc" },
  });

  return NextResponse.json(records.map(toExact));
}

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (session.role !== "Sales" && session.role !== "Operations") {
    return NextResponse.json({ error: "Only Sales or Operations may create contracts." }, { status: 403 });
  }

  const body = await req.json();
  const {
    CUSTOMER_ID_NUMBER,
    CHASIS_NUMBER,
    acknowledgeSimilar,
    ...rest
  } = body as Record<string, unknown> & { acknowledgeSimilar?: boolean };

  const customer = MOCK_CUSTOMERS.find((c) => c.CUSTOMER_ID_NUMBER === CUSTOMER_ID_NUMBER);
  const vehicle = MOCK_VEHICLES.find((v) => v.CHASIS_NUMBER === CHASIS_NUMBER);
  if (!customer) return NextResponse.json({ error: "Unknown customer — select one from lookup." }, { status: 400 });
  if (!vehicle) return NextResponse.json({ error: "Unknown vehicle — select one from lookup." }, { status: 400 });

  const allowedKeys = new Set(creatableFieldsFor(session.role));
  const restPrisma = toPrisma(rest);
  const editable: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(restPrisma)) {
    if (allowedKeys.has(key)) editable[key] = value;
  }

  const existing = await prisma.carLoanRequest.findMany({
    select: { APP_ID: true, CUSTOMER_ID_NUMBER: true, CHASIS_NUMBER: true, LOAN_AMOUNT: true, STATUS: true },
  });
  const dup = checkDuplicates(CUSTOMER_ID_NUMBER as string, CHASIS_NUMBER as string, null, existing);

  if (dup.exactMatch) {
    return NextResponse.json(
      {
        error: `A matching in-flight request already exists (${dup.exactMatch.APP_ID}).`,
        duplicate: dup,
      },
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

  const last = await prisma.carLoanRequest.findFirst({ orderBy: { APP_ID: "desc" }, select: { APP_ID: true } });
  const APP_ID = nextAppId(last?.APP_ID ?? null);

  const historyEntry: StatusHistoryEntry = {
    stage: "Sales",
    status: "Draft",
    decision: "Created",
    reason: null,
    changedBy: session.name,
    changedByRole: session.role,
    changedAt: new Date().toISOString(),
  };

  const record = await prisma.carLoanRequest.create({
    data: {
      APP_ID,
      APP_CUSTOMER_TYPE: customer.APP_CUSTOMER_TYPE,
      CUSTOMER_NAME: customer.CUSTOMER_NAME,
      CUSTOMER_ID_NUMBER: customer.CUSTOMER_ID_NUMBER,
      CUSTOMER_GENDER: customer.CUSTOMER_GENDER,
      CUSTOMER_NATIONALITY: customer.CUSTOMER_NATIONALITY,
      CUSTOMER_TITLE: customer.CUSTOMER_TITLE,
      CUSTOMER_CLASS: customer.CUSTOMER_CLASS,
      ORGANIZATION_NAME: customer.ORGANIZATION_NAME,
      ORG_TYPE: customer.ORG_TYPE,
      ORG_REG_NUMBER: customer.ORG_REG_NUMBER,
      BRAND_NAME: vehicle.BRAND_NAME,
      MODEL: vehicle.MODEL,
      CarType: vehicle.CarType,
      CHASIS_NUMBER: vehicle.CHASIS_NUMBER,
      MOTOR_NUMBER: vehicle.MOTOR_NUMBER,
      COLOR: vehicle.COLOR,
      ENGINE_SIZE: vehicle.ENGINE_SIZE,
      YEAR_OF_PRODUCT: vehicle.YEAR_OF_PRODUCT,
      STATUS: "Draft",
      DuplicateCheckKey: computeDuplicateCheckKey(CUSTOMER_ID_NUMBER as string, CHASIS_NUMBER as string, null),
      IsPotentialDuplicate: dup.similarMatches.length > 0,
      DuplicateOfAppID: dup.similarMatches[0]?.APP_ID ?? null,
      StatusHistoryLog: JSON.stringify([historyEntry]),
      AuditTrail: JSON.stringify([]),
      CreatedBy: session.name,
      ModifiedBy: session.name,
      ...editable,
    } as Prisma.CarLoanRequestUncheckedCreateInput,
  });

  return NextResponse.json(toExact(record), { status: 201 });
}
