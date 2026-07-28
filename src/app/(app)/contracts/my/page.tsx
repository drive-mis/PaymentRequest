import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RequestsTable } from "@/components/RequestsTable";

export default async function MySubmissionsPage() {
  const session = getSession();
  if (!session) redirect("/login");

  const rows = await prisma.carLoanRequest.findMany({
    where: { OR: [{ CreatedBy: session.name }, { DRV_SALES_MAN: session.name }] },
    orderBy: { ModifiedOn: "desc" },
  });

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
          <h2 className="text-xs font-semibold uppercase tracking-wide text-status-blue mb-3">Returned — needs your attention</h2>
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
