"use client";

import { useStore } from "@/lib/store";
import { RequestsTable } from "@/components/RequestsTable";
import { LoadingScreen } from "@/components/Guard";
import { formatCurrency } from "@/lib/format";

export default function FinanceReviewQueuePage() {
  const { hydrated, requests } = useStore();
  if (!hydrated) return <LoadingScreen />;

  const rows = requests
    .filter((r) => ["Payment Request Submitted", "Under Finance Review"].includes(r.STATUS))
    .sort((a, b) => new Date(a.APP_DATETIME).getTime() - new Date(b.APP_DATETIME).getTime());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-df-text">Finance Review Queue</h1>
        <p className="text-sm text-slate-500 mt-1">Payment requests from Operations awaiting Finance decision.</p>
      </div>
      <RequestsTable
        rows={rows}
        emptyMessage="No payment requests waiting for Finance."
        extraColumn={{ header: "Loan Amount", render: (r) => formatCurrency(r.LOAN_AMOUNT) }}
      />
    </div>
  );
}
