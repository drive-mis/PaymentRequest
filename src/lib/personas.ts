import type { Role } from "./types";

export interface Persona {
  name: string;
  role: Role;
  title: string;
}

// No real auth in this system — a fixed roster of personas stands in for a
// login directory. Picking one sets the acting role for the session.
export const PERSONAS: Persona[] = [
  { name: "Mona Aziz", role: "Sales", title: "Sales Agent" },
  { name: "Karim Adel", role: "Sales", title: "Sales Agent" },
  { name: "Yara Hassan", role: "Operations", title: "Operations Officer" },
  { name: "Tarek Fathy", role: "Operations", title: "Operations Officer" },
  { name: "Nadia Salem", role: "Finance", title: "Finance Officer" },
  { name: "Omar Ibrahim", role: "Finance", title: "Treasury Officer" },
];

export function roleForPersonaName(name: string): Role | null {
  return PERSONAS.find((p) => p.name === name)?.role ?? null;
}
