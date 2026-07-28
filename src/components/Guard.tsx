"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import type { Role } from "@/lib/types";

export function LoadingScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="text-sm text-slate-400">{label}</div>
    </div>
  );
}

/**
 * Client-side route guard. Replaces the server middleware from the full-stack
 * build: waits for localStorage hydration, then bounces to /login if there's
 * no session (or to /dashboard if the role isn't allowed on this screen).
 */
export function Guard({
  children,
  allow,
}: {
  children: (session: { name: string; role: Role }) => React.ReactNode;
  allow?: Role[];
}) {
  const { hydrated, session } = useStore();
  const router = useRouter();

  const denied = !!session && !!allow && !allow.includes(session.role);

  useEffect(() => {
    if (!hydrated) return;
    if (!session) router.replace("/login");
    else if (denied) router.replace("/dashboard");
  }, [hydrated, session, denied, router]);

  if (!hydrated) return <LoadingScreen />;
  if (!session) return <LoadingScreen label="Redirecting to sign in…" />;
  if (denied) return <LoadingScreen label="Redirecting…" />;

  return <>{children(session)}</>;
}
