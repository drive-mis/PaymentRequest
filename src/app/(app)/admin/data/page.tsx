"use client";

import { useState } from "react";
import Link from "next/link";
import { Guard } from "@/components/Guard";
import { useStore, type UploadMode } from "@/lib/store";
import { COLUMNS, buildTemplateCsv, parseUploadFile, type ParseResult } from "@/lib/uploadSchema";
import { formatCurrency, formatDateTime } from "@/lib/format";

export default function AdminDataPage() {
  return <Guard allow={["Admin"]}>{() => <DataManager />}</Guard>;
}

function DataManager() {
  const { allAssignments, saveAssignments, clearAssignments, users } = useStore();
  const [mode, setMode] = useState<UploadMode>("append");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const salesNames = new Set(users.filter((u) => u.role === "Sales").map((u) => u.name));
  const pending = allAssignments.filter((a) => !a.ConsumedByAppId);
  const consumed = allAssignments.filter((a) => a.ConsumedByAppId);

  function downloadTemplate() {
    // UTF-8 BOM so Excel opens Arabic and accented text correctly.
    const blob = new Blob(["﻿" + buildTemplateCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pending-applications-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked after a fix
    if (!file) return;

    setBusy(true);
    setError(null);
    setOutcome(null);
    setResult(null);
    try {
      const parsed = await parseUploadFile(file);
      setResult(parsed);

      if (parsed.applications.length === 0) {
        setError("Nothing was imported — every row was rejected. See the errors below.");
        return;
      }
      const { added, skipped } = saveAssignments(parsed.applications, mode);
      setOutcome(
        `Imported ${added} application${added === 1 ? "" : "s"}` +
          (skipped ? `, skipped ${skipped} already present.` : ".") +
          (parsed.errors.length ? ` ${parsed.errors.length} row(s) were rejected — see below.` : "")
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? `Could not read the file: ${err.message}`
          : "Could not read the file."
      );
    } finally {
      setBusy(false);
    }
  }

  const unknownAgents = Array.from(
    new Set(pending.filter((a) => !salesNames.has(a.DRV_SALES_MAN)).map((a) => a.DRV_SALES_MAN))
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-df-text">Application Data</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload the customer, vehicle and program data. Each row is one application awaiting a contract, assigned to
          a sales agent. This data is read-only everywhere in the app — no agent can edit it.
        </p>
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-df-text">Upload a sheet</h2>
            <p className="text-xs text-slate-500 mt-1">Accepts .xlsx and .csv. First row must be the column headers.</p>
          </div>
          <button className="btn-secondary" onClick={downloadTemplate}>
            Download template
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label">If a row already exists</label>
            <select className="input" value={mode} onChange={(e) => setMode(e.target.value as UploadMode)}>
              <option value="append">Append — keep existing, add new rows only</option>
              <option value="replace">Replace — clear pending rows, load this sheet</option>
            </select>
          </div>
          <div>
            <label className="field-label">File</label>
            <label className="btn-primary cursor-pointer w-full justify-center">
              {busy ? "Reading…" : "Choose .xlsx or .csv"}
              <input type="file" accept=".xlsx,.csv" className="hidden" onChange={handleFile} disabled={busy} />
            </label>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Rows are matched on chassis number + customer ID. Applications already turned into a contract are never
          removed, even by Replace, so request history stays intact.
        </p>
      </div>

      {error && <div className="card p-3 border-status-red bg-red-50 text-sm text-status-red">{error}</div>}
      {outcome && <div className="card p-3 border-emerald-300 bg-emerald-50 text-sm text-emerald-800">{outcome}</div>}

      {result && result.errors.length > 0 && (
        <div className="card p-4 border-status-amber bg-amber-50">
          <p className="text-sm font-semibold text-amber-900">
            {result.errors.length} row{result.errors.length === 1 ? "" : "s"} rejected
          </p>
          <ul className="mt-2 space-y-1 max-h-60 overflow-auto">
            {result.errors.map((e, i) => (
              <li key={i} className="text-xs text-amber-900">
                {e.row > 0 ? <strong>Row {e.row}:</strong> : null} {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result && result.unrecognizedHeaders.length > 0 && (
        <div className="card p-3 border-slate-300 bg-slate-50 text-xs text-slate-600">
          Ignored unrecognized column(s): {result.unrecognizedHeaders.join(", ")}
        </div>
      )}

      {unknownAgents.length > 0 && (
        <div className="card p-4 border-status-amber bg-amber-50">
          <p className="text-sm font-semibold text-amber-900">Assigned to names that are not Sales users</p>
          <p className="text-xs text-amber-900 mt-1">
            {unknownAgents.join(", ")} — these applications will not appear in anyone&apos;s queue until a matching
            Sales user exists. Add them under{" "}
            <Link href="/admin/users" className="underline font-medium">
              Users
            </Link>
            .
          </p>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending</div>
          <div className="text-2xl font-bold text-df-text mt-1">{pending.length}</div>
          <div className="text-xs text-slate-400">awaiting a contract</div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contract Created</div>
          <div className="text-2xl font-bold text-df-text mt-1">{consumed.length}</div>
          <div className="text-xs text-slate-400">already used</div>
        </div>
        <div className="card p-4 flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Danger zone</div>
            <div className="text-xs text-slate-400 mt-1">Removes pending rows only.</div>
          </div>
          <button
            className="btn-secondary !text-status-red mt-2"
            disabled={pending.length === 0}
            onClick={() => {
              if (window.confirm(`Delete all ${pending.length} pending application(s)? Rows already turned into contracts are kept.`)) {
                clearAssignments();
                setOutcome("Cleared all pending applications.");
              }
            }}
          >
            Clear pending
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
          Loaded applications ({allAssignments.length})
        </h2>
        {allAssignments.length === 0 ? (
          <div className="card p-8 text-center text-sm text-slate-400">
            No application data loaded yet. Download the template, fill it in, and upload it above.
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-zebra">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="text-left px-4 py-2.5">Sales Agent</th>
                    <th className="text-left px-4 py-2.5">Customer</th>
                    <th className="text-left px-4 py-2.5">Customer ID</th>
                    <th className="text-left px-4 py-2.5">Vehicle</th>
                    <th className="text-left px-4 py-2.5">Chassis</th>
                    <th className="text-left px-4 py-2.5">Program</th>
                    <th className="text-left px-4 py-2.5">Loan Amount</th>
                    <th className="text-left px-4 py-2.5">Bank</th>
                    <th className="text-left px-4 py-2.5">Uploaded</th>
                    <th className="text-left px-4 py-2.5">State</th>
                  </tr>
                </thead>
                <tbody>
                  {allAssignments.map((a) => (
                    <tr key={a.ASSIGNMENT_ID} className="hover:bg-df-indigo/5">
                      <td className="px-4 py-2.5">
                        <span className={salesNames.has(a.DRV_SALES_MAN) ? "" : "text-status-red"}>
                          {a.DRV_SALES_MAN}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">{a.CUSTOMER_NAME}</td>
                      <td className="px-4 py-2.5 text-slate-500">{a.CUSTOMER_ID_NUMBER}</td>
                      <td className="px-4 py-2.5">
                        {a.BRAND_NAME} {a.MODEL}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{a.CHASIS_NUMBER}</td>
                      <td className="px-4 py-2.5 text-slate-500">{a.PROGRAM_NAME}</td>
                      <td className="px-4 py-2.5">{formatCurrency(a.LOAN_AMOUNT)}</td>
                      <td className="px-4 py-2.5 text-slate-500">{a.BANK_NAME}</td>
                      <td className="px-4 py-2.5 text-slate-400">{formatDateTime(a.UploadedAt)}</td>
                      <td className="px-4 py-2.5">
                        {a.ConsumedByAppId ? (
                          <Link href={`/requests/${a.ConsumedByAppId}`} className="badge badge-green hover:underline">
                            {a.ConsumedByAppId}
                          </Link>
                        ) : (
                          <span className="badge badge-amber">Pending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <details className="card p-4">
        <summary className="text-sm font-semibold text-df-text cursor-pointer">Expected columns</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="text-left py-1.5 pr-4">Column</th>
                <th className="text-left py-1.5 pr-4">Required</th>
                <th className="text-left py-1.5 pr-4">Example</th>
                <th className="text-left py-1.5">Also accepted as</th>
              </tr>
            </thead>
            <tbody>
              {COLUMNS.map((c) => (
                <tr key={c.header} className="border-t border-slate-100">
                  <td className="py-1.5 pr-4 font-mono text-df-text">{c.header}</td>
                  <td className="py-1.5 pr-4">{c.required ? "Yes" : "Optional"}</td>
                  <td className="py-1.5 pr-4 text-slate-500">{c.example || "—"}</td>
                  <td className="py-1.5 text-slate-400">{(c.aliases ?? []).join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
