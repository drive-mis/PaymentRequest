"use client";

import Link from "next/link";
import type { Role } from "@/lib/types";

export function RoleSwitchLink({ name, role }: { name: string; role: Role }) {
  async function signOut() {
    await fetch("/api/session", { method: "DELETE" });
    window.location.href = "/login";
  }

  return (
    <div className="flex items-center gap-3">
      <div className="text-right hidden sm:block">
        <div className="text-sm font-semibold text-df-text leading-tight">{name}</div>
        <div className="text-xs text-slate-500 leading-tight">{role}</div>
      </div>
      <div className="h-8 w-8 rounded-full bg-df-gradient text-white flex items-center justify-center text-xs font-bold">
        {name
          .split(" ")
          .map((p) => p[0])
          .join("")}
      </div>
      <Link href="/login" className="btn-ghost !px-2 !py-1 text-xs">
        Switch
      </Link>
      <button onClick={signOut} className="btn-ghost !px-2 !py-1 text-xs">
        Sign out
      </button>
    </div>
  );
}
