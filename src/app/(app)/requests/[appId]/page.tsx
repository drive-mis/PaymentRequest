import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toExact } from "@/lib/serialize";
import { StatusBadge } from "@/components/StatusBadge";
import { ReadOnlyPanel } from "@/components/ReadOnlyPanel";
import { HistoryTimeline } from "@/components/HistoryTimeline";
import { formatDate, formatDateTime, formatCurrency } from "@/lib/format";
import { ActionPanel } from "./ActionPanel";
import type { StatusHistoryEntry } from "@/lib/types";

export default async function RequestDetailPage({ params }: { params: { appId: string } }) {
  const session = getSession();
  if (!session) redirect("/login");

  const raw = await prisma.carLoanRequest.findUnique({ where: { APP_ID: params.appId } });
  if (!raw) notFound();
  const r = toExact(raw) as Record<string, any>;
  const history = r.StatusHistoryLog as StatusHistoryEntry[];
  const latestReturn = r.STATUS.startsWith("Returned by")
    ? [...history].reverse().find((e) => e.status === r.STATUS)
    : undefined;

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div>
          <div className="flex items-center gap-3">
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
            <p className="text-sm text-blue-800 mt-1">“{latestReturn.reason}”</p>
            <p className="text-xs text-blue-600 mt-1">
              {latestReturn.changedBy} · {formatDateTime(latestReturn.changedAt)}
            </p>
          </div>
        )}

        <ReadOnlyPanel
          title="Customer Data"
          sourceLabel="sourced from system"
          fields={[
            { label: "Name", value: r.CUSTOMER_NAME },
            { label: "ID Number", value: r.CUSTOMER_ID_NUMBER },
            { label: "Type", value: r.APP_CUSTOMER_TYPE },
            { label: "Gender", value: r.CUSTOMER_GENDER },
            { label: "Nationality", value: r.CUSTOMER_NATIONALITY },
            { label: "Title", value: r.CUSTOMER_TITLE },
            { label: "Class", value: r.CUSTOMER_CLASS },
            ...(r.ORGANIZATION_NAME
              ? [
                  { label: "Organization", value: r.ORGANIZATION_NAME },
                  { label: "Org Type", value: r.ORG_TYPE },
                  { label: "Reg. Number", value: r.ORG_REG_NUMBER },
                ]
              : []),
          ]}
        />

        <ReadOnlyPanel
          title="Vehicle Data"
          sourceLabel="sourced from system"
          fields={[
            { label: "Brand", value: r.BRAND_NAME },
            { label: "Model", value: r.MODEL },
            { label: "Type", value: r["Car Type"] },
            { label: "Chassis No.", value: r.CHASIS_NUMBER },
            { label: "Motor No.", value: r.MOTOR_NUMBER },
            { label: "Color", value: r.COLOR },
            { label: "Engine Size", value: r.ENGINE_SIZE },
            { label: "Year", value: r.YEAR_OF_PRODUCT },
          ]}
        />

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-df-text mb-3">Contract &amp; Application</h3>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-sm">
            {[
              ["Program", r.PROGRAM_NAME],
              ["Branch", r.Branch],
              ["Contract Type", r["Contract Type"]],
              ["Contract Ready Status", r["Contract Ready Status"]],
              ["Signing Date", formatDate(r["Contract Signing Date"])],
              ["Sales Agent", r.DRV_SALES_MAN],
              ["Sales Manager", r.DRV_SALES_MANAGER],
              ["Insurance Type", r["Insurance Type"]],
              ["Receival Method", r["Receival Method"]],
            ].map(([label, value]) => (
              <div key={label as string}>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
                <dd className="text-slate-700 mt-0.5">{(value as string) || "—"}</dd>
              </div>
            ))}
          </dl>
        </div>

        {(r.PRICE || r.LOAN_AMOUNT) && (
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-df-text mb-3">Financial / Loan Details</h3>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-sm">
              {[
                ["Price", formatCurrency(r.PRICE)],
                ["Down Payment", formatCurrency(r.DOWN_PAYMENT)],
                ["Loan Amount", formatCurrency(r.LOAN_AMOUNT)],
                ["Loan Amount (calc.)", formatCurrency(r["Loan Amount Calculated"])],
                ["Interest Rate", r.INTEREST_RATE ? `${r.INTEREST_RATE}%` : "—"],
                ["Tenor", r.TENOR_MONTH ? `${r.TENOR_MONTH} months` : "—"],
                ["Admin Fees", formatCurrency(r.ADMIN_FEES)],
                ["Bank", r.BANK_NAME],
                ["Bank Branch", r.BANK_BRANCH],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
                  <dd className="text-slate-700 mt-0.5">{value || "—"}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

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
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
                  <dd className="text-slate-700 mt-0.5">{value || "—"}</dd>
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
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Actions ({session.role})</h3>
          <ActionPanel role={session.role} name={session.name} record={r} />
        </div>
      </div>
    </div>
  );
}
