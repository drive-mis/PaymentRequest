import { NextRequest, NextResponse } from "next/server";
import { PERSONAS, sessionCookieName } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const persona = PERSONAS.find((p) => p.name === body.name);
  if (!persona) {
    return NextResponse.json({ error: "Unknown persona." }, { status: 400 });
  }
  const res = NextResponse.json({ name: persona.name, role: persona.role });
  res.cookies.set(sessionCookieName(), JSON.stringify({ name: persona.name, role: persona.role }), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(sessionCookieName());
  return res;
}
