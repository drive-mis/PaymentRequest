"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import type { Role } from "@/lib/types";

export function RoleSwitchLink({ name, role }: { name: string; role: Role }) {
  const { signOut, resetData } = useStore();
  const router = useRouter();

  function handleSignOut() {
    signOut();
    router.push("/login");
  }

  function handleReset() {
    if (!window.confirm("Reset all data back to the original sample requests? Any changes you've made will be lost.")) {
      return;
    }
    resetData();
    router.push("/dashboard");
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
      <button onClick={handleReset} className="btn-ghost !px-2 !py-1 text-xs" title="Restore the original sample data">
        Reset data
      </button>
      <button onClick={handleSignOut} className="btn-ghost !px-2 !py-1 text-xs">
        Sign out
      </button>
    </div>
  );
}
