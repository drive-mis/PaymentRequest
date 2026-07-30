"use client";

import { useState } from "react";
import { Guard } from "@/components/Guard";
import { useStore } from "@/lib/store";
import { RequestsTable } from "@/components/RequestsTable";
import { STATUSES } from "@/lib/types";

export default function AdminRequestsPage() {
  return <Guard allow={["Admin"]}>{() => <AllRequests />}</Guard>;
}

function AllRequests() {
  const { allRequests } = useStore();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");

  const term = q.trim().toLowerCase();
  const rows = allRequests
    .filter((r) => (status ? r.STATUS === status : true))
    .filter((r) =>
      term
        ? [r.APP_ID, r.CUSTOMER_NAME, r.CHASIS_NUMBER, r.DRV_SALES_MAN ?? "", r.BRAND_NAME, r.MODEL]
            .join(" ")
            .toLowerCase()
            .includes(term)
        : true
    )
    .sort((a, b) => new Date(b.ModifiedOn).getTime() - new Date(a.ModifiedOn).getTime());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-df-text">All Requests</h1>
        <p className="text-sm text-slate-500 mt-1">
          Every request in the system, across all agents and stages. Read-only oversight — Admin does not act on the
          workflow.
        </p>
      </div>

      <div className="card p-4 grid sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="field-label">Search</label>
          <input
            className="input"
            placeholder="App ID, customer, chassis, sales agent, vehicle…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label">Status</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Showing {rows.length} of {allRequests.length} request{allRequests.length === 1 ? "" : "s"}.
      </p>

      <RequestsTable
        rows={rows}
        emptyMessage="No requests match those filters."
        extraColumn={{ header: "Sales Agent", render: (r) => r.DRV_SALES_MAN || "—" }}
      />
    </div>
  );
}
