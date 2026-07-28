import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { KpiTile } from "@/components/KpiTile";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/format";

export default async function DashboardPage() {
  const session = getSession();
  if (!session) redirect("/login");
  const { name, role } = session;

  const all = await prisma.carLoanRequest.findMany({ orderBy: { ModifiedOn: "desc" } });
  const total = all.length;
  const nonCancelled = all.filter((r) => r.STATUS !== "Cancelled").length;
  const delivered = all.filter((r) => r.STATUS === "Delivered to Customer").length;
  const completionRate = nonCancelled ? Math.round((delivered / nonCancelled) * 100) : 0;
  const returnedCount = all.filter((r) => r.STATUS === "Returned by Operations" || r.STATUS === "Returned by Finance").length;

  let roleTiles: { label: string; value: number; sub?: string; href: string }[] = [];
  let recent = all;

  if (role === "Sales") {
    const mine = all.filter((r) => r.CreatedBy === name || r.DRV_SALES_MAN === name);
    roleTiles = [
      { label: "My Drafts", value: mine.filter((r) => r.STATUS === "Draft").length, href: "/contracts/my" },
      { label: "Returned to Me", value: mine.filter((r) => r.STATUS === "Returned by Operations").length, href: "/contracts/my" },
      { label: "Awaiting Review", value: mine.filter((r) => ["Submitted for Operations Review", "Under Operations Review"].includes(r.STATUS)).length, href: "/contracts/my" },
      { label: "Delivered", value: mine.filter((r) => r.STATUS === "Delivered to Customer").length, href: "/contracts/my" },
    ];
    recent = mine;
  } else if (role === "Operations") {
    roleTiles = [
      { label: "Pending My Review", value: all.filter((r) => ["Submitted for Operations Review", "Under Operations Review"].includes(r.STATUS)).length, href: "/contracts/review" },
      { label: "Pending Finance", value: all.filter((r) => ["Payment Request Submitted", "Under Finance Review", "Returned by Finance"].includes(r.STATUS)).length, href: "/payment-requests/my" },
      { label: "My Drafts", value: all.filter((r) => r.CreatedBy === name && r.STATUS === "Draft").length, href: "/contracts/new" },
      { label: "Cheque Handover Pending", value: all.filter((r) => ["Cheque Issued", "Cheque Delivered to Operations"].includes(r.STATUS)).length, href: "/cheque-handover" },
    ];
  } else {
    roleTiles = [
      { label: "Pending My Review", value: all.filter((r) => ["Payment Request Submitted", "Under Finance Review"].includes(r.STATUS)).length, href: "/payment-requests/review" },
      { label: "Ready to Issue Cheque", value: all.filter((r) => r.STATUS === "Approved by Finance").length, href: "/payment-execution" },
      { label: "Returned by Me", value: all.filter((r) => r.STATUS === "Returned by Finance").length, href: "/payment-requests/review" },
      { label: "Delivered", value: all.filter((r) => r.STATUS === "Delivered to Customer").length, href: "/reporting" },
    ];
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-df-text">Welcome, {name.split(" ")[0]}</h1>
        <p className="text-sm text-slate-500 mt-1">Here's what needs your attention as {role}.</p>
      </div>

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">My Workload</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {roleTiles.map((t) => (
            <Link key={t.label} href={t.href}>
              <KpiTile label={t.label} value={t.value} accent="indigo" />
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Company-wide KPIs</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiTile label="Total Requests" value={total} accent="purple" />
          <KpiTile label="Completion Rate" value={`${completionRate}%`} sub={`${delivered} delivered`} accent="teal" />
          <KpiTile label="Currently Returned" value={returnedCount} sub="awaiting fix & resubmit" accent="purple" />
          <KpiTile label="Delivered to Customer" value={delivered} accent="indigo" />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-df-text">Recently Updated</h2>
          <Link href="/reporting" className="text-xs text-df-indigo font-medium">
            View reporting →
          </Link>
        </div>
        <table className="w-full text-sm table-zebra">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="text-left px-5 py-2.5">App ID</th>
              <th className="text-left px-5 py-2.5">Customer</th>
              <th className="text-left px-5 py-2.5">Vehicle</th>
              <th className="text-left px-5 py-2.5">Status</th>
              <th className="text-left px-5 py-2.5">Updated</th>
            </tr>
          </thead>
          <tbody>
            {recent.slice(0, 10).map((r) => (
              <tr key={r.APP_ID} className="hover:bg-df-indigo/5 cursor-default">
                <td className="px-5 py-2.5">
                  <Link href={`/requests/${r.APP_ID}`} className="font-medium text-df-indigo hover:underline">
                    {r.APP_ID}
                  </Link>
                </td>
                <td className="px-5 py-2.5">{r.CUSTOMER_NAME}</td>
                <td className="px-5 py-2.5">
                  {r.BRAND_NAME} {r.MODEL}
                </td>
                <td className="px-5 py-2.5">
                  <StatusBadge status={r.STATUS} />
                </td>
                <td className="px-5 py-2.5 text-slate-400">{formatDateTime(r.ModifiedOn)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
