import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RequestsTable } from "@/components/RequestsTable";

export default async function OperationsReviewQueuePage() {
  const session = getSession();
  if (!session) redirect("/login");

  const rows = await prisma.carLoanRequest.findMany({
    where: { STATUS: { in: ["Submitted for Operations Review", "Under Operations Review"] } },
    orderBy: { APP_DATETIME: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-df-text">Operations Review Queue</h1>
        <p className="text-sm text-slate-500 mt-1">Contracts submitted by Sales (or Operations) awaiting your review.</p>
      </div>
      <RequestsTable rows={rows} emptyMessage="Nothing waiting for review. Nicely done." />
    </div>
  );
}
