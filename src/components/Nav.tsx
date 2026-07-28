import Link from "next/link";
import { Logo } from "./Logo";
import type { Role } from "@/lib/types";
import { RoleSwitchLink } from "./RoleSwitchLink";

const LINKS_BY_ROLE: Record<Role, { href: string; label: string }[]> = {
  Sales: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/contracts/new", label: "New Contract" },
    { href: "/contracts/my", label: "My Submissions" },
    { href: "/reporting", label: "Reporting" },
  ],
  Operations: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/contracts/new", label: "New Contract" },
    { href: "/contracts/review", label: "Review Queue" },
    { href: "/payment-requests/my", label: "My Payment Requests" },
    { href: "/cheque-handover", label: "Cheque Handover" },
    { href: "/reporting", label: "Reporting" },
  ],
  Finance: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/payment-requests/review", label: "Review Queue" },
    { href: "/payment-execution", label: "Cheque Issuance" },
    { href: "/reporting", label: "Reporting" },
  ],
};

export function Nav({ name, role }: { name: string; role: Role }) {
  const links = LINKS_BY_ROLE[role];
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/dashboard">
            <Logo />
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-df-indigo hover:bg-df-indigo/5 transition"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <RoleSwitchLink name={name} role={role} />
      </div>
      <div className="h-[3px] bg-df-gradient" />
    </header>
  );
}
