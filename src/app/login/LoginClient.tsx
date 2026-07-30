"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ROLE_BLURB } from "@/lib/personas";
import { Logo } from "@/components/Logo";
import { useStore } from "@/lib/store";
import { ROLES, type Role, type User } from "@/lib/types";

export function LoginClient() {
  const router = useRouter();
  const params = useSearchParams();
  const { hydrated, users, signIn } = useStore();
  const [loading, setLoading] = useState<string | null>(null);

  function pick(user: User) {
    setLoading(user.name);
    signIn(user.name);
    router.push(params.get("from") || "/dashboard");
  }

  const active = users.filter((u) => u.active);
  const rolesWithUsers = ROLES.filter((r) => active.some((u) => u.role === r));

  return (
    <div className="min-h-screen bg-[#f5f6fb] flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo />
          <span className="text-xs text-slate-400">Internal Treasury Tool</span>
        </div>
        <div className="h-[3px] bg-df-gradient" />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-14 relative overflow-hidden">
        <div className="kpi-ellipse bg-df-indigo w-[460px] h-[460px] -top-32 -left-32 opacity-[0.08]" />
        <div className="kpi-ellipse bg-df-teal w-[380px] h-[380px] -bottom-28 -right-20 opacity-[0.08]" />

        <div className="relative z-10 text-center mb-10">
          <h1 className="text-3xl font-bold text-df-text tracking-tight">Treasury Execution System</h1>
          <p className="text-slate-500 mt-2 text-sm">
            Sign in by selecting who you are — no password needed for this internal tool.
          </p>
        </div>

        {!hydrated ? (
          <p className="relative z-10 text-sm text-slate-400">Loading users…</p>
        ) : active.length === 0 ? (
          <div className="relative z-10 card p-6 max-w-md text-center">
            <p className="text-sm font-semibold text-df-text">No active users</p>
            <p className="text-sm text-slate-500 mt-1">
              Every user has been deactivated, so nobody can sign in. Clear this site&apos;s data in your browser to
              restore the default roster.
            </p>
          </div>
        ) : (
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl w-full">
            {rolesWithUsers.map((role: Role) => (
              <div key={role} className="card p-5">
                <div className="text-xs font-semibold tracking-wide uppercase text-df-indigo mb-1">{role}</div>
                <p className="text-xs text-slate-500 mb-4 leading-relaxed">{ROLE_BLURB[role]}</p>
                <div className="space-y-2">
                  {active
                    .filter((u) => u.role === role)
                    .map((user) => (
                      <button
                        key={user.name}
                        onClick={() => pick(user)}
                        disabled={loading !== null}
                        className="w-full flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-left hover:bg-df-indigo/5 hover:border-df-indigo/40 transition disabled:opacity-50"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-df-text truncate">{user.name}</span>
                          <span className="block text-xs text-slate-500 truncate">{user.title}</span>
                        </span>
                        {loading === user.name ? (
                          <span className="text-xs text-df-indigo shrink-0">Signing in…</span>
                        ) : (
                          <span className="text-df-indigo text-lg shrink-0">→</span>
                        )}
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
