"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { KpiTile } from "@/components/KpiTile";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadingScreen } from "@/components/Guard";
import { formatDateTime } from "@/lib/format";
import type { CarLoanRequest } from "@/lib/types";

export default function DashboardPage() {
  const { hydrated, requests, session, users, allAssignments } = useStore();
  if (!hydrated || !session) return <LoadingScreen />;

  const { name, role } = session;
  const all = [...requests].sort(
    (a, b) => new Date(b.ModifiedOn).getTime() - new Date(a.ModifiedOn).getTime()
  );

  const total = all.length;
  const nonCancelled = all.filter((r) => r.STATUS !== "Cancelled").length;
  const delivered = all.filter((r) => r.STATUS === "Delivered to Customer").length;
  const completionRate = nonCancelled ? Math.round((delivered / nonCancelled) * 100) : 0;
  const returnedCount = all.filter(
    (r) => r.STATUS === "Returned by Operations" || r.STATUS === "Returned by Finance"
  ).length;

  let roleTiles: { label: string; value: number; href: string }[] = [];
  let recent: CarLoanRequest[] = all;

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
  } else if (role === "Finance") {
    roleTiles = [
      { label: "Pending My Review", value: all.filter((r) => ["Payment Request Submitted", "Under Finance Review"].includes(r.STATUS)).length, href: "/payment-requests/review" },
      { label: "Ready to Issue Cheque", value: all.filter((r) => r.STATUS === "Approved by Finance").length, href: "/payment-execution" },
      { label: "Returned by Me", value: all.filter((r) => r.STATUS === "Returned by Finance").length, href: "/payment-requests/review" },
      { label: "Delivered", value: delivered, href: "/reporting" },
    ];
  } else {
    // Admin — oversight of the roster and the uploaded application data.
    const openAssignments = allAssignments.filter((a) => !a.ConsumedByAppId);
    const salesNames = new Set(users.filter((u) => u.role === "Sales").map((u) => u.name));
    roleTiles = [
      { label: "Active Users", value: users.filter((u) => u.active).length, href: "/admin/users" },
      { label: "Pending Applications", value: openAssignments.length, href: "/admin/data" },
      {
        label: "Unassignable Rows",
        value: openAssignments.filter((a) => !salesNames.has(a.DRV_SALES_MAN)).length,
        href: "/admin/data",
      },
      { label: "All Requests", value: total, href: "/admin/requests" },
    ];
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-df-text">Welcome, {name.split(" ")[0]}</h1>
        <p className="text-sm text-slate-500 mt-1">Here&apos;s what needs your attention as {role}.</p>
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
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
          {role === "Sales" ? "My Portfolio" : "Company-wide KPIs"}
        </h2>
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
              <tr key={r.APP_ID} className="hover:bg-df-indigo/5">
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
            {recent.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                  Nothing here yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
