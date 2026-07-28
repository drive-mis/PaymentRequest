"use client";

import { useStore } from "@/lib/store";
import { RequestsTable } from "@/components/RequestsTable";
import { LoadingScreen } from "@/components/Guard";

const PAYMENT_STAGES = [
  "Payment Request Submitted",
  "Under Finance Review",
  "Returned by Finance",
  "Rejected by Finance",
  "Approved by Finance",
  "Cheque Issued",
  "Cheque Delivered to Operations",
  "Delivered to Customer",
];

export default function MyPaymentRequestsPage() {
  const { hydrated, requests } = useStore();
  if (!hydrated) return <LoadingScreen />;

  const rows = requests
    .filter((r) => PAYMENT_STAGES.includes(r.STATUS))
    .sort((a, b) => new Date(b.ModifiedOn).getTime() - new Date(a.ModifiedOn).getTime());

  const returned = rows.filter((r) => r.STATUS === "Returned by Finance");
  const rest = rows.filter((r) => r.STATUS !== "Returned by Finance");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-df-text">My Payment Requests</h1>
        <p className="text-sm text-slate-500 mt-1">Payment requests Operations has submitted to Finance.</p>
      </div>

      {returned.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-status-blue mb-3">
            Returned by Finance — needs fixing
          </h2>
          <RequestsTable rows={returned} />
        </div>
      )}

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">All Payment Requests</h2>
        <RequestsTable rows={rest} emptyMessage="No payment requests submitted yet." />
      </div>
    </div>
  );
}
