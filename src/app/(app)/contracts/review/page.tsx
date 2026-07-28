"use client";

import { useStore } from "@/lib/store";
import { RequestsTable } from "@/components/RequestsTable";
import { LoadingScreen } from "@/components/Guard";

export default function OperationsReviewQueuePage() {
  const { hydrated, requests } = useStore();
  if (!hydrated) return <LoadingScreen />;

  const rows = requests
    .filter((r) => ["Submitted for Operations Review", "Under Operations Review"].includes(r.STATUS))
    .sort((a, b) => new Date(a.APP_DATETIME).getTime() - new Date(b.APP_DATETIME).getTime());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-df-text">Operations Review Queue</h1>
        <p className="text-sm text-slate-500 mt-1">
          Contracts submitted by Sales (or Operations) awaiting your review.
        </p>
      </div>
      <RequestsTable rows={rows} emptyMessage="Nothing waiting for review. Nicely done." />
    </div>
  );
}
