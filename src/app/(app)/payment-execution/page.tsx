import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RequestsTable } from "@/components/RequestsTable";
import { formatCurrency } from "@/lib/format";

export default async function PaymentExecutionPage() {
  const session = getSession();
  if (!session) redirect("/login");

  const rows = await prisma.carLoanRequest.findMany({
    where: { STATUS: "Approved by Finance" },
    orderBy: { OperationsReviewDate: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-df-text">Payment Execution — Cheque Issuance</h1>
        <p className="text-sm text-slate-500 mt-1">Approved requests ready for cheque issuance. Open a request to capture cheque details.</p>
      </div>
      <RequestsTable
        rows={rows}
        emptyMessage="Nothing approved and waiting for cheque issuance."
        extraColumn={{ header: "Loan Amount", render: (r) => formatCurrency(r.LOAN_AMOUNT as number | null) }}
      />
    </div>
  );
}
