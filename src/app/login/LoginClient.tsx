"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PERSONAS, type Persona } from "@/lib/personas";
import { Logo } from "@/components/Logo";

const ROLE_BLURB: Record<string, string> = {
  Sales: "Create contract requests and track their status through Operations and Finance.",
  Operations: "Review contracts, build payment requests, and hand cheques to customers.",
  Finance: "Review payment requests, approve funding, and execute cheque payments.",
};

export function LoginClient() {
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(persona: Persona) {
    setLoading(persona.name);
    setError(null);
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: persona.name }),
    });
    if (!res.ok) {
      setError("Could not sign in. Please try again.");
      setLoading(null);
      return;
    }
    const dest = params.get("from") || "/dashboard";
    router.push(dest);
    router.refresh();
  }

  const roles: Array<"Sales" | "Operations" | "Finance"> = ["Sales", "Operations", "Finance"];

  return (
    <div className="min-h-screen bg-[#f5f6fb] flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
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
          <p className="text-slate-500 mt-2 text-sm">Sign in by selecting who you are — no password needed for this internal tool.</p>
        </div>

        {error && (
          <div className="relative z-10 mb-4 rounded-lg bg-red-50 border border-red-200 text-status-red text-sm px-4 py-2">
            {error}
          </div>
        )}

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl w-full">
          {roles.map((role) => (
            <div key={role} className="card p-5">
              <div className="text-xs font-semibold tracking-wide uppercase text-df-indigo mb-1">{role}</div>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">{ROLE_BLURB[role]}</p>
              <div className="space-y-2">
                {PERSONAS.filter((p) => p.role === role).map((persona) => (
                  <button
                    key={persona.name}
                    onClick={() => pick(persona)}
                    disabled={loading !== null}
                    className="w-full flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-left hover:bg-df-indigo/5 hover:border-df-indigo/40 transition disabled:opacity-50"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-df-text">{persona.name}</span>
                      <span className="block text-xs text-slate-500">{persona.title}</span>
                    </span>
                    {loading === persona.name ? (
                      <span className="text-xs text-df-indigo">Signing in…</span>
                    ) : (
                      <span className="text-df-indigo text-lg">→</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
