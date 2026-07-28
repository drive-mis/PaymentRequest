import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { computeReports } from "@/lib/reports";

export async function GET() {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  return NextResponse.json(await computeReports());
}
