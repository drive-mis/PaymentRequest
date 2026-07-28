import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RequestsTable } from "@/components/RequestsTable";
import { formatCurrency } from "@/lib/format";

export default async function FinanceReviewQueuePage() {
  const session = getSession();
  if (!session) redirect("/login");

  const rows = await prisma.carLoanRequest.findMany({
    where: { STATUS: { in: ["Payment Request Submitted", "Under Finance Review"] } },
    orderBy: { APP_DATETIME: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-df-text">Finance Review Queue</h1>
        <p className="text-sm text-slate-500 mt-1">Payment requests from Operations awaiting Finance decision.</p>
      </div>
      <RequestsTable
        rows={rows}
        emptyMessage="No payment requests waiting for Finance."
        extraColumn={{ header: "Loan Amount", render: (r) => formatCurrency(r.LOAN_AMOUNT as number | null) }}
      />
    </div>
  );
}
