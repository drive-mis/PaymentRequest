"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { findCustomers, findVehicles, type CustomerRecord, type VehicleRecord } from "@/lib/mockSource";
import { ReadOnlyPanel } from "@/components/ReadOnlyPanel";
import { FileField } from "@/components/FileField";
import {
  BRANCHES,
  PROGRAMS,
  CONTRACT_TYPES,
  INSURANCE_TYPES,
  RECEIVAL_METHODS,
  CONTRACT_READY_STATUSES,
  SALES_MANAGERS,
} from "@/lib/choices";
import type { Role } from "@/lib/types";
import { DuplicateWarning, useStore } from "@/lib/store";

function LookupPicker<T>({
  label,
  placeholder,
  search,
  renderOption,
  onPick,
  onClear,
  selectedLabel,
}: {
  label: string;
  placeholder: string;
  search: (q: string) => T[];
  renderOption: (item: T) => { title: string; subtitle: string };
  onPick: (item: T) => void;
  onClear: () => void;
  selectedLabel: string | null;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const results = q.trim() ? search(q) : [];

  if (selectedLabel) {
    return (
      <div>
        <label className="field-label">{label}</label>
        <div className="flex items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm">
          <span className="font-medium text-emerald-900">{selectedLabel}</span>
          <button
            type="button"
            className="text-xs text-emerald-700 underline"
            onClick={() => {
              onClear();
              setQ("");
              setOpen(false);
            }}
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <label className="field-label">{label}</label>
      <input
        className="input"
        placeholder={placeholder}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => q && setOpen(true)}
      />
      {open && q.trim() && (
        <div className="absolute z-20 mt-1 w-full card max-h-64 overflow-auto p-1">
          {results.length === 0 && <div className="px-3 py-2 text-sm text-slate-400">No matches</div>}
          {results.map((item, i) => {
            const { title, subtitle } = renderOption(item);
            return (
              <button
                type="button"
                key={i}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-df-indigo/5 text-sm"
                onClick={() => {
                  onPick(item);
                  setOpen(false);
                }}
              >
                <div className="font-medium text-df-text">{title}</div>
                <div className="text-xs text-slate-400">{subtitle}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function NewContractForm({ role }: { role: Role }) {
  const router = useRouter();
  const { createRequest, performAction } = useStore();

  const [customer, setCustomer] = useState<CustomerRecord | null>(null);
  const [vehicle, setVehicle] = useState<VehicleRecord | null>(null);
  const [programId, setProgramId] = useState(PROGRAMS[0].APP_PROGRAM_ID);
  const [branch, setBranch] = useState(BRANCHES[0]);
  const [creationNote, setCreationNote] = useState("");
  const [contractType, setContractType] = useState(CONTRACT_TYPES[0]);
  const [contractReadyStatus, setContractReadyStatus] = useState(CONTRACT_READY_STATUSES[0]);
  const [signingDate, setSigningDate] = useState("");
  const [salesMan, setSalesMan] = useState("");
  const [salesManager, setSalesManager] = useState(SALES_MANAGERS[0]);
  const [insuranceType, setInsuranceType] = useState(INSURANCE_TYPES[0]);
  const [receivalMethod, setReceivalMethod] = useState(RECEIVAL_METHODS[0]);
  const [files, setFiles] = useState<Record<string, string | null>>({
    "External Contract": null,
    "Car Documents": null,
    "Benefciary Documents": null,
    "All Customer Car Documents": null,
    Inspection: null,
    Pricing: null,
  });

  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ message: string; matches: string[] } | null>(null);
  const [busy, setBusy] = useState(false);

  function buildFields() {
    return {
      APP_PROGRAM_ID: programId,
      PROGRAM_NAME: PROGRAMS.find((p) => p.APP_PROGRAM_ID === programId)?.PROGRAM_NAME,
      Branch: branch,
      CREATION_DATE: creationNote || null,
      "Contract Type": contractType,
      "Contract Ready Status": contractReadyStatus,
      "Contract Signing Date": signingDate ? new Date(signingDate).toISOString() : null,
      DRV_SALES_MAN: salesMan,
      DRV_SALES_MANAGER: salesManager,
      "Insurance Type": insuranceType,
      "Receival Method": receivalMethod,
      ...files,
    };
  }

  function submit(mode: "draft" | "submit") {
    setError(null);
    if (!customer || !vehicle) {
      setError("Select both a customer and a vehicle before saving.");
      return;
    }
    setBusy(true);
    try {
      const created = createRequest({
        CUSTOMER_ID_NUMBER: customer.CUSTOMER_ID_NUMBER,
        CHASIS_NUMBER: vehicle.CHASIS_NUMBER,
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

  return (
    <div className="space-y-6">
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-df-text">1. Identify Customer &amp; Vehicle</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <LookupPicker<CustomerRecord>
            label="Customer (search by name or ID)"
            placeholder="e.g. Ahmed Samir or 2900101..."
            search={findCustomers}
            onPick={setCustomer}
            onClear={() => setCustomer(null)}
            selectedLabel={customer ? `${customer.CUSTOMER_NAME} · ${customer.CUSTOMER_ID_NUMBER}` : null}
            renderOption={(c) => ({ title: c.CUSTOMER_NAME, subtitle: c.CUSTOMER_ID_NUMBER })}
          />
          <LookupPicker<VehicleRecord>
            label="Vehicle (search by chassis, brand, or model)"
            placeholder="e.g. Corolla or WBA3A5..."
            search={findVehicles}
            onPick={setVehicle}
            onClear={() => setVehicle(null)}
            selectedLabel={vehicle ? `${vehicle.BRAND_NAME} ${vehicle.MODEL} · ${vehicle.CHASIS_NUMBER}` : null}
            renderOption={(v) => ({ title: `${v.BRAND_NAME} ${v.MODEL}`, subtitle: v.CHASIS_NUMBER })}
          />
        </div>

        {customer && (
          <ReadOnlyPanel
            title="Customer Data"
            sourceLabel="sourced from system"
            fields={[
              { label: "Name", value: customer.CUSTOMER_NAME },
              { label: "ID Number", value: customer.CUSTOMER_ID_NUMBER },
              { label: "Type", value: customer.APP_CUSTOMER_TYPE },
              { label: "Gender", value: customer.CUSTOMER_GENDER },
              { label: "Nationality", value: customer.CUSTOMER_NATIONALITY },
              { label: "Title", value: customer.CUSTOMER_TITLE },
              { label: "Class", value: customer.CUSTOMER_CLASS },
              ...(customer.ORGANIZATION_NAME
                ? [
                    { label: "Organization", value: customer.ORGANIZATION_NAME },
                    { label: "Org Type", value: customer.ORG_TYPE },
                    { label: "Reg. Number", value: customer.ORG_REG_NUMBER },
                  ]
                : []),
            ]}
          />
        )}
        {vehicle && (
          <ReadOnlyPanel
            title="Vehicle Data"
            sourceLabel="sourced from system"
            fields={[
              { label: "Brand", value: vehicle.BRAND_NAME },
              { label: "Model", value: vehicle.MODEL },
              { label: "Type", value: vehicle["Car Type"] },
              { label: "Chassis No.", value: vehicle.CHASIS_NUMBER },
              { label: "Motor No.", value: vehicle.MOTOR_NUMBER },
              { label: "Color", value: vehicle.COLOR },
              { label: "Engine Size", value: vehicle.ENGINE_SIZE },
              { label: "Year", value: vehicle.YEAR_OF_PRODUCT },
            ]}
          />
        )}
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-df-text">2. Application Details</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="field-label">Finance Program</label>
            <select className="input" value={programId} onChange={(e) => setProgramId(Number(e.target.value))}>
              {PROGRAMS.map((p) => (
                <option key={p.APP_PROGRAM_ID} value={p.APP_PROGRAM_ID}>
                  {p.PROGRAM_NAME}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Branch</label>
            <select className="input" value={branch} onChange={(e) => setBranch(e.target.value)}>
              {BRANCHES.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Creation Note</label>
            <input
              className="input"
              value={creationNote}
              onChange={(e) => setCreationNote(e.target.value)}
              placeholder="Optional free-text note"
            />
          </div>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-df-text">3. Contract Stage ({role})</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="field-label">Contract Type</label>
            <select className="input" value={contractType} onChange={(e) => setContractType(e.target.value)}>
              {CONTRACT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Contract Ready Status</label>
            <select
              className="input"
              value={contractReadyStatus}
              onChange={(e) => setContractReadyStatus(e.target.value)}
            >
              {CONTRACT_READY_STATUSES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Contract Signing Date</label>
            <input type="date" className="input" value={signingDate} onChange={(e) => setSigningDate(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Sales Agent</label>
            <input className="input" value={salesMan} onChange={(e) => setSalesMan(e.target.value)} placeholder="Agent name" />
          </div>
          <div>
            <label className="field-label">Sales Manager</label>
            <select className="input" value={salesManager} onChange={(e) => setSalesManager(e.target.value)}>
              {SALES_MANAGERS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Insurance Type</label>
            <select className="input" value={insuranceType} onChange={(e) => setInsuranceType(e.target.value)}>
              {INSURANCE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Receival Method</label>
            <select className="input" value={receivalMethod} onChange={(e) => setReceivalMethod(e.target.value)}>
              {RECEIVAL_METHODS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
          {Object.keys(files).map((key) => (
            <FileField
              key={key}
              label={key}
              value={files[key]}
              onChange={(name) => setFiles((f) => ({ ...f, [key]: name }))}
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
        <button className="btn-secondary" disabled={busy} onClick={() => submit("draft")}>
          Save as Draft
        </button>
        <button className="btn-primary" disabled={busy} onClick={() => submit("submit")}>
          Save &amp; Submit for Operations Review
        </button>
      </div>
    </div>
  );
}
