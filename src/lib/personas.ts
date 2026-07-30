import type { Role, User } from "./types";

/**
 * The starting roster, used only to seed the user list on first run. After
 * that, users are managed by Admin and live in localStorage — edit them in
 * the app, not here.
 */
export const DEFAULT_USERS: User[] = [
  { name: "Mona Aziz", role: "Sales", title: "Sales Agent", active: true },
  { name: "Karim Adel", role: "Sales", title: "Sales Agent", active: true },
  { name: "Yara Hassan", role: "Operations", title: "Operations Officer", active: true },
  { name: "Tarek Fathy", role: "Operations", title: "Operations Officer", active: true },
  { name: "Nadia Salem", role: "Finance", title: "Finance Officer", active: true },
  { name: "Omar Ibrahim", role: "Finance", title: "Treasury Officer", active: true },
  { name: "System Administrator", role: "Admin", title: "MIS / Administrator", active: true },
];

export const ROLE_BLURB: Record<Role, string> = {
  Sales: "Create contract requests from assigned applications and track them through Operations and Finance.",
  Operations: "Review contracts, build payment requests, and hand cheques to customers.",
  Finance: "Review payment requests, approve funding, and execute cheque payments.",
  Admin: "Manage users and load the customer, vehicle and program data.",
};

/** Resolve a role from a name against a given roster. */
export function roleForUserName(users: User[], name: string): Role | null {
  return users.find((u) => u.name === name)?.role ?? null;
}
