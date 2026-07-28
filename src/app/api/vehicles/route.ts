import { NextRequest, NextResponse } from "next/server";
import { findVehicles } from "@/lib/mockSource";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  return NextResponse.json(findVehicles(q));
}
