"use client";

import Link from "next/link";
import { asFieldMap, useStore } from "@/lib/store";
import { StatusBadge } from "@/components/StatusBadge";
import { CreditPanel, CustomerPanel, FinancialPanel, ProgramPanel, VehiclePanel } from "@/components/SystemDataPanels";
import { HistoryTimeline } from "@/components/HistoryTimeline";
import { LoadingScreen } from "@/components/Guard";
import { formatDate, formatDateTime, formatCurrency } from "@/lib/format";
import { CONTRACT_DOCUMENTS } from "@/lib/choices";
import { ActionPanel } from "./ActionPanel";

export default function RequestDetailPage({ params }: { params: { appId: string } }) {
  const { hydrated, getRequest, session } = useStore();
  if (!hydrated || !session) return <LoadingScreen />;

  const r = getRequest(params.appId);
  if (!r) {
    return (
      <div className="card p-10 text-center">
        <h1 className="text-lg font-semibold text-df-text">Request not found</h1>
        <p className="text-sm text-slate-500 mt-1">No request exists with ID {params.appId}.</p>
        <Link href="/dashboard" className="btn-primary mt-4 inline-flex">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const history = r.StatusHistoryLog ?? [];
  const latestReturn = r.STATUS.startsWith("Returned by")
    ? [...history].reverse().find((e) => e.status === r.STATUS)
    : undefined;

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-df-text">{r.APP_ID}</h1>
            <StatusBadge status={r.STATUS} />
            {r.IsPotentialDuplicate && <span className="badge badge-amber">Possible Duplicate</span>}
            {r.IsLocked && <span className="badge badge-slate">Locked</span>}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {r.CUSTOMER_NAME} · {r.BRAND_NAME} {r.MODEL} · Created {formatDate(r.APP_DATETIME)} by {r.CreatedBy}
          </p>
        </div>

        {latestReturn && (
          <div className="card p-4 border-status-blue bg-blue-50">
            <p className="text-sm font-semibold text-blue-900">
              Returned by {latestReturn.changedByRole} — visible to all stakeholders
            </p>
            <p className="text-sm text-blue-800 mt-1">&ldquo;{latestReturn.reason}&rdquo;</p>
            <p className="text-xs text-blue-600 mt-1">
              {latestReturn.changedBy} · {formatDateTime(latestReturn.changedAt)}
            </p>
          </div>
        )}

        <CustomerPanel data={r} />
        <VehiclePanel data={r} />
        <ProgramPanel data={r} />

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-df-text mb-3">Contract &amp; Application</h3>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-sm">
            {[
              ["Branch", r.Branch],
              ["Car Type", r["Car Type"]],
              ["Contract Type", r["Contract Type"]],
              ["Contract Ready Status", r["Contract Ready Status"]],
              ["Signing Date", formatDate(r["Contract Signing Date"])],
              ["Sales Agent", r.DRV_SALES_MAN],
              ["Sales Manager", r.DRV_SALES_MANAGER],
              ["Insurance Type", r["Insurance Type"]],
              ["Contract Receival Method", r["Receival Method"]],
            ].map(([label, value]) => (
              <div key={label as string}>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
                <dd className="text-slate-700 mt-0.5" dir="auto">
                  {(value as string) || "—"}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-df-text mb-3">Documents</h3>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-sm">
            {CONTRACT_DOCUMENTS.map((doc) => {
              const file = asFieldMap(r)[doc.field] as string | null;
              return (
                <div key={doc.field}>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400" dir="auto">
                    {doc.labelAr}
                  </dt>
                  <dd className={`mt-0.5 ${file ? "text-emerald-700" : "text-slate-400"}`}>
                    {file ? `✓ ${file}` : "Not attached"}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>

        <FinancialPanel data={r} />
        <CreditPanel data={r} />

        {(r["Cheque Number"] || r.ChequeDeliveryStatus !== "Pending") && (
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-df-text mb-3">Cheque &amp; Delivery</h3>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-sm">
              {[
                ["Finance Status", r["Finance Status"]],
                ["Cheque Number", r["Cheque Number"]],
                ["Cheque Location", r["Cheque Location"]],
                ["Cheque Delivery Status", r.ChequeDeliveryStatus],
                ["Handed to Operations", formatDateTime(r.ChequeHandoverToOperationsDate)],
                ["Delivered to Customer", formatDateTime(r.ChequeDeliveredToCustomerDate)],
                ["Cheque File", r.Cheque],
                ["Customer Acknowledgement", r.CustomerAcknowledgementFile],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
                  <dd className="text-slate-700 mt-0.5">{(value as string) || "—"}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-df-text mb-4">Status History — visible to all roles</h3>
          <HistoryTimeline log={history} />
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
            Actions ({session.role})
          </h3>
          <ActionPanel role={session.role} name={session.name} record={r} />
        </div>
      </div>
    </div>
  );
}
