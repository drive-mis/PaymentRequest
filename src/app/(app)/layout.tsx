"use client";

import { Nav } from "@/components/Nav";
import { Guard } from "@/components/Guard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Guard>
      {(session) => (
        <div className="min-h-screen">
          <Nav name={session.name} role={session.role} />
          <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
        </div>
      )}
    </Guard>
  );
}
