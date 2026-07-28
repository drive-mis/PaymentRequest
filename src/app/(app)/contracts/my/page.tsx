"use client";

import { useStore } from "@/lib/store";
import { RequestsTable } from "@/components/RequestsTable";
import { LoadingScreen } from "@/components/Guard";

export default function MySubmissionsPage() {
  const { hydrated, requests, session } = useStore();
  if (!hydrated || !session) return <LoadingScreen />;

  const rows = requests
    .filter((r) => r.CreatedBy === session.name || r.DRV_SALES_MAN === session.name)
    .sort((a, b) => new Date(b.ModifiedOn).getTime() - new Date(a.ModifiedOn).getTime());

  const returned = rows.filter((r) => r.STATUS === "Returned by Operations");
  const rest = rows.filter((r) => r.STATUS !== "Returned by Operations");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-df-text">My Submissions</h1>
        <p className="text-sm text-slate-500 mt-1">Contracts you created or are the sales agent on.</p>
      </div>

      {returned.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-status-blue mb-3">
            Returned — needs your attention
          </h2>
          <RequestsTable rows={returned} />
        </div>
      )}

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">All My Submissions</h2>
        <RequestsTable rows={rest} emptyMessage="You haven't created any contracts yet." />
      </div>
    </div>
  );
}
