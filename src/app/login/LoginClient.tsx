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
    <div className="min-h-screen bg-df-black flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      <div className="kpi-ellipse bg-df-indigo w-[520px] h-[520px] -top-40 -left-40" />
      <div className="kpi-ellipse bg-df-teal w-[420px] h-[420px] -bottom-32 -right-24" />

      <div className="relative z-10 mb-10">
        <Logo dark className="scale-125" />
      </div>

      <div className="relative z-10 text-center mb-10">
        <h1 className="text-3xl font-bold text-white tracking-tight">Treasury Execution System</h1>
        <p className="text-slate-400 mt-2 text-sm">Sign in by selecting who you are — no password needed for this internal tool.</p>
      </div>

      {error && (
        <div className="relative z-10 mb-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-4 py-2">
          {error}
        </div>
      )}

      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl w-full">
        {roles.map((role) => (
          <div key={role} className="card !bg-white/[0.04] !border-white/10 p-5">
            <div className="text-xs font-semibold tracking-wide uppercase text-df-teal mb-1">{role}</div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">{ROLE_BLURB[role]}</p>
            <div className="space-y-2">
              {PERSONAS.filter((p) => p.role === role).map((persona) => (
                <button
                  key={persona.name}
                  onClick={() => pick(persona)}
                  disabled={loading !== null}
                  className="w-full flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-left hover:bg-df-indigo/20 hover:border-df-indigo/50 transition disabled:opacity-50"
                >
                  <span>
                    <span className="block text-sm font-semibold text-white">{persona.name}</span>
                    <span className="block text-xs text-slate-400">{persona.title}</span>
                  </span>
                  {loading === persona.name ? (
                    <span className="text-xs text-df-teal">Signing in…</span>
                  ) : (
                    <span className="text-df-teal text-lg">→</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
