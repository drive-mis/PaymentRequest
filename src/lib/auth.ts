import { cookies } from "next/headers";
import type { Role } from "./types";

export { PERSONAS, roleForPersonaName, type Persona } from "./personas";

const COOKIE_NAME = "df_session";

export interface Session {
  name: string;
  role: Role;
}

export function getSession(): Session | null {
  const raw = cookies().get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.name && parsed?.role) return parsed as Session;
    return null;
  } catch {
    return null;
  }
}

export function sessionCookieName() {
  return COOKIE_NAME;
}
