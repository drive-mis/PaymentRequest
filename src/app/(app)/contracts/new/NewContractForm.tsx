"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CustomerPanel, ProgramPanel, VehiclePanel } from "@/components/SystemDataPanels";
import { FileField } from "@/components/FileField";
import {
  BRANCHES,
  CAR_TYPES,
  CONTRACT_TYPES,
  INSURANCE_TYPES,
  RECEIVAL_METHODS,
  CONTRACT_READY_STATUSES,
  CONTRACT_DOCUMENTS,
  SALES_MANAGERS,
} from "@/lib/choices";
import type { PendingApplication, Role } from "@/lib/types";
import { DuplicateWarning, useStore } from "@/lib/store";

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <select className="input" dir="auto" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

export function NewContractForm({ role }: { role: Role }) {
  const router = useRouter();
  const { createRequest, performAction, openAssignments } = useStore();

  const [selectedId, setSelectedId] = useState<string>("");
  const [search, setSearch] = useState("");

  const [branch, setBranch] = useState(BRANCHES[0]);
  const [creationNote, setCreationNote] = useState("");
  const [carType, setCarType] = useState(CAR_TYPES[0]);
  const [contractType, setContractType] = useState(CONTRACT_TYPES[0]);
  const [contractReadyStatus, setContractReadyStatus] = useState(CONTRACT_READY_STATUSES[0]);
  const [signingDate, setSigningDate] = useState("");
  const [salesManager, setSalesManager] = useState(SALES_MANAGERS[0]);
  const [insuranceType, setInsuranceType] = useState(INSURANCE_TYPES[0]);
  const [receivalMethod, setReceivalMethod] = useState(RECEIVAL_METHODS[0]);

  const [documents, setDocuments] = useState<Record<string, string | null>>(
    Object.fromEntries(CONTRACT_DOCUMENTS.map((d) => [d.field, null]))
  );

  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ message: string; matches: string[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const selected: PendingApplication | null =
    openAssignments.find((a) => a.ASSIGNMENT_ID === selectedId) ?? null;

  const term = search.trim().toLowerCase();
  const filtered = term
    ? openAssignments.filter((a) =>
        [a.CUSTOMER_NAME, a.CUSTOMER_ID_NUMBER, a.BRAND_NAME, a.MODEL, a.CHASIS_NUMBER, a.DRV_SALES_MAN]
          .join(" ")
          .toLowerCase()
          .includes(term)
      )
    : openAssignments;

  function buildFields() {
    return {
      Branch: branch,
      CREATION_DATE: creationNote || null,
      "Car Type": carType,
      "Contract Type": contractType,
      "Contract Ready Status": contractReadyStatus,
      "Contract Signing Date": signingDate ? new Date(signingDate).toISOString() : null,
      DRV_SALES_MANAGER: salesManager,
      "Insurance Type": insuranceType,
      "Receival Method": receivalMethod,
      ...documents,
    };
  }

  function submit(mode: "draft" | "submit") {
    setError(null);
    if (!selected) {
      setError("Select the application you are raising this contract for.");
      return;
    }
    setBusy(true);
    try {
      const created = createRequest({
        ASSIGNMENT_ID: selected.ASSIGNMENT_ID,
        fields: buildFields(),
        acknowledgeSimilar: !!duplicate,
      });
      if (mode === "submit") {
        performAction(created.APP_ID, { action: "SUBMIT_FOR_OPERATIONS_REVIEW" });
      }
      router.push(`/requests/${created.APP_ID}`);
    } catch (err) {
      if (err instanceof DuplicateWarning) {
        setDuplicate({
          message: err.message,
          matches: err.duplicate.similarMatches.map((m) => m.APP_ID),
        });
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (openAssignments.length === 0) {
    return (
      <div className="card p-8 text-center space-y-2">
        <h2 className="text-sm font-semibold text-df-text">No applications assigned to you</h2>
        <p className="text-sm text-slate-500">
          {role === "Sales"
            ? "Contracts are raised against applications assigned to you by Admin. Once data is uploaded with your name as the sales agent, it will appear here."
            : "No pending applications are loaded. Admin uploads the customer, vehicle and program data."}
        </p>
        {role === "Operations" && (
          <Link href="/admin/data" className="btn-ghost text-xs">
            Application Data →
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-df-text">
            1. Select the Application {role === "Sales" ? "assigned to you" : "to contract"}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {openAssignments.length} application{openAssignments.length === 1 ? "" : "s"} awaiting a contract. Customer,
            vehicle and program details come from this record and cannot be edited.
          </p>
        </div>

        {openAssignments.length > 5 && (
          <input
            className="input"
            placeholder="Filter by customer, ID, vehicle or chassis…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        )}

        <div className="grid gap-2 max-h-72 overflow-auto">
          {filtered.length === 0 && <p className="text-sm text-slate-400">No applications match that filter.</p>}
          {filtered.map((a) => {
            const isSelected = a.ASSIGNMENT_ID === selectedId;
            return (
              <button
                key={a.ASSIGNMENT_ID}
                type="button"
                onClick={() => setSelectedId(a.ASSIGNMENT_ID)}
                className={`w-full text-left rounded-lg border px-3.5 py-2.5 transition ${
                  isSelected
                    ? "border-df-indigo bg-df-indigo/5 ring-1 ring-df-indigo/30"
                    : "border-slate-200 bg-white hover:border-df-indigo/40 hover:bg-df-indigo/5"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-df-text truncate">{a.CUSTOMER_NAME}</span>
                    <span className="block text-xs text-slate-500 truncate">
                      {a.BRAND_NAME} {a.MODEL} · {a.CHASIS_NUMBER} · {a.PROGRAM_NAME}
                    </span>
                  </span>
                  <span className="text-xs text-slate-400 shrink-0">
                    {isSelected ? "Selected" : a.DRV_SALES_MAN}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-slate-400">
          The fields below are filled in automatically from system records. They are read-only and cannot be edited by
          any role.
        </p>

        <CustomerPanel data={selected} />
        <ProgramPanel data={selected} />
        <VehiclePanel data={selected} />
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-df-text">2. Contract Details ({role})</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <Select label="Branch" value={branch} options={BRANCHES} onChange={setBranch} />
          <Select label="Car Type" value={carType} options={CAR_TYPES} onChange={setCarType} />
          <Select label="Contract Type" value={contractType} options={CONTRACT_TYPES} onChange={setContractType} />
          <Select label="Insurance Type" value={insuranceType} options={INSURANCE_TYPES} onChange={setInsuranceType} />
          <Select
            label="Contract Receival Method"
            value={receivalMethod}
            options={RECEIVAL_METHODS}
            onChange={setReceivalMethod}
          />
          <Select
            label="Contract Ready Status"
            value={contractReadyStatus}
            options={CONTRACT_READY_STATUSES}
            onChange={setContractReadyStatus}
          />
          <div>
            <label className="field-label">Contract Signing Date</label>
            <input type="date" className="input" value={signingDate} onChange={(e) => setSigningDate(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Sales Agent</label>
            <div
              className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700 cursor-not-allowed truncate"
              title={selected?.DRV_SALES_MAN ?? undefined}
            >
              {selected?.DRV_SALES_MAN ?? "—"}
            </div>
          </div>
          <Select label="Sales Manager" value={salesManager} options={SALES_MANAGERS} onChange={setSalesManager} />
          <div className="sm:col-span-3">
            <label className="field-label">Creation Note</label>
            <input
              className="input"
              value={creationNote}
              onChange={(e) => setCreationNote(e.target.value)}
              placeholder="Optional free-text note"
            />
          </div>
        </div>
        <p className="text-xs text-slate-400">
          Sales Agent comes from the assignment — it is what routes this deal, so it is not editable here.
        </p>
      </div>

      <div className="card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-df-text">3. Documents</h2>
          <p className="text-xs text-slate-500 mt-1">Attach the contract package documents.</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {CONTRACT_DOCUMENTS.map((doc) => (
            <FileField
              key={doc.field}
              label={doc.labelAr}
              sublabel={doc.labelEn}
              value={documents[doc.field]}
              onChange={(name) => setDocuments((d) => ({ ...d, [doc.field]: name }))}
            />
          ))}
        </div>
      </div>

      {duplicate && (
        <div className="card p-4 border-status-blue bg-blue-50">
          <p className="text-sm font-semibold text-blue-900">Possible duplicate detected</p>
          <p className="text-sm text-blue-800 mt-1">
            {duplicate.message} Matching request(s): {duplicate.matches.join(", ") || "n/a"}.
          </p>
          <p className="text-xs text-blue-700 mt-1">Press the button again to proceed and acknowledge this warning.</p>
        </div>
      )}

      {error && <p className="text-sm text-status-red">{error}</p>}

      <div className="flex items-center gap-3">
        <button className="btn-secondary" disabled={busy || !selected} onClick={() => submit("draft")}>
          Save as Draft
        </button>
        <button className="btn-primary" disabled={busy || !selected} onClick={() => submit("submit")}>
          Save &amp; Submit for Operations Review
        </button>
      </div>
    </div>
  );
}
