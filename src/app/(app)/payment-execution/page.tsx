"use client";

import { useStore } from "@/lib/store";
import { RequestsTable } from "@/components/RequestsTable";
import { LoadingScreen } from "@/components/Guard";
import { formatCurrency } from "@/lib/format";

export default function PaymentExecutionPage() {
  const { hydrated, requests } = useStore();
  if (!hydrated) return <LoadingScreen />;

  const rows = requests.filter((r) => r.STATUS === "Approved by Finance");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-df-text">Payment Execution — Cheque Issuance</h1>
        <p className="text-sm text-slate-500 mt-1">
          Approved requests ready for cheque issuance. Open a request to capture cheque details.
        </p>
      </div>
      <RequestsTable
        rows={rows}
        emptyMessage="Nothing approved and waiting for cheque issuance."
        extraColumn={{ header: "Loan Amount", render: (r) => formatCurrency(r.LOAN_AMOUNT) }}
      />
    </div>
  );
}
