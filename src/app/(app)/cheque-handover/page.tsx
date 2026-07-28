import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RequestsTable } from "@/components/RequestsTable";

export default async function ChequeHandoverPage() {
  const session = getSession();
  if (!session) redirect("/login");

  const rows = await prisma.carLoanRequest.findMany({
    where: { STATUS: { in: ["Cheque Issued", "Cheque Delivered to Operations"] } },
    orderBy: { ModifiedOn: "asc" },
  });

  const awaitingReceipt = rows.filter((r) => r.STATUS === "Cheque Issued");
  const awaitingDelivery = rows.filter((r) => r.STATUS === "Cheque Delivered to Operations");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-df-text">Cheque Handover</h1>
        <p className="text-sm text-slate-500 mt-1">Receive cheques from Finance, then confirm delivery to the customer.</p>
      </div>

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Awaiting Receipt from Finance</h2>
        <RequestsTable rows={awaitingReceipt} emptyMessage="No cheques waiting for handover." />
      </div>

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Awaiting Delivery to Customer</h2>
        <RequestsTable rows={awaitingDelivery} emptyMessage="No cheques waiting to be delivered." />
      </div>
    </div>
  );
}
