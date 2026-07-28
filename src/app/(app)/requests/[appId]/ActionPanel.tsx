"use client";

import { useState } from "react";
import { FileField } from "@/components/FileField";
import { BANKS } from "@/lib/choices";
import type { CarLoanRequest, LifecycleAction, Role } from "@/lib/types";
import { DuplicateWarning, useStore } from "@/lib/store";
import { roleForPersonaName } from "@/lib/personas";

function ReasonBar({
  label,
  buttonClass,
  requireReason,
  onConfirm,
  busy,
}: {
  label: string;
  buttonClass: string;
  requireReason: boolean;
  onConfirm: (reason: string) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (!open) {
    return (
      <button className={buttonClass} onClick={() => setOpen(true)} disabled={busy}>
        {label}
      </button>
    );
  }
  return (
    <div className="card p-3 space-y-2 border-slate-300 w-full">
      <label className="field-label">
        Reason {requireReason && <span className="text-status-red">*</span>}
      </label>
      <textarea
        className="input"
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Explain why…"
      />
      <div className="flex gap-2">
        <button
          className={buttonClass}
          disabled={busy || (requireReason && !reason.trim())}
          onClick={() => onConfirm(reason)}
        >
          Confirm {label}
        </button>
        <button className="btn-secondary" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function Num({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="field-label">
        {label} {required && <span className="text-status-red">*</span>}
      </label>
      <input
        type="number"
        className="input"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      />
    </div>
  );
}

export function ActionPanel({
  role,
  name,
  record,
}: {
  role: Role;
  name: string;
  record: CarLoanRequest;
}) {
  const { patchRequest, performAction } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ message: string; matches: string[] } | null>(null);

  const appId = record.APP_ID;
  const status = record.STATUS;

  const [contract, setContract] = useState({ DRV_SALES_MAN: record.DRV_SALES_MAN ?? "" });
  const [opsNotes, setOpsNotes] = useState({
    "Operation Notes": record["Operation Notes"] ?? "",
    DEVIATION: record.DEVIATION ?? "",
    FEEDBACK: record.FEEDBACK ?? "",
  });
  const [financial, setFinancial] = useState({
    PRICE: record.PRICE,
    DOWN_PAYMENT: record.DOWN_PAYMENT,
    LOAN_AMOUNT: record.LOAN_AMOUNT,
    INTEREST_RATE: record.INTEREST_RATE,
    TENOR_MONTH: record.TENOR_MONTH,
    ADMIN_FEES: record.ADMIN_FEES,
    BANK_NAME: record.BANK_NAME ?? BANKS[0].BANK_NAME,
    BANK_BRANCH: record.BANK_BRANCH ?? BANKS[0].branches[0],
  });
  const [financeExec, setFinanceExec] = useState({
    "Finance Notes": record["Finance Notes"] ?? "",
    "Cheque Number": record["Cheque Number"] ?? "",
    "Cheque Location": record["Cheque Location"] ?? "",
    Cheque: record.Cheque,
    "Customer Cheque": record["Customer Cheque"],
    "Payment Receipt": record["Payment Receipt"],
    Receipt: record.Receipt,
  });
  const [ackFile, setAckFile] = useState(record.CustomerAcknowledgementFile);

  function run(fn: () => void) {
    setBusy(true);
    setError(null);
    try {
      fn();
      setDuplicate(null);
    } catch (err) {
      if (err instanceof DuplicateWarning) {
        setDuplicate({
          message: err.message,
          matches: err.duplicate.similarMatches.map((m) => m.APP_ID),
        });
      } else {
        setError(err instanceof Error ? err.message : "Action failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  function act(action: LifecycleAction, extra: { reason?: string; fields?: Record<string, unknown> } = {}) {
    performAction(appId, { action, ...extra, acknowledgeSimilar: !!duplicate });
  }

  const createdByRole = roleForPersonaName(record.CreatedBy) ?? "Sales";
  const isCreator = record.CreatedBy === name;

  const canEditContract =
    (role === "Sales" || role === "Operations") &&
    (status === "Draft" || status === "Returned by Operations") &&
    isCreator &&
    createdByRole === role;

  const canStartOpsReview = role === "Operations" && status === "Submitted for Operations Review";
  const canActOpsReview = role === "Operations" && status === "Under Operations Review";
  const canResubmitPaymentRequest = role === "Operations" && status === "Returned by Finance";
  const canStartFinanceReview = role === "Finance" && status === "Payment Request Submitted";
  const canActFinanceReview = role === "Finance" && status === "Under Finance Review";
  const canIssueCheque = role === "Finance" && status === "Approved by Finance";
  const canConfirmChequeReceived = role === "Operations" && status === "Cheque Issued";
  const canConfirmDelivered = role === "Operations" && status === "Cheque Delivered to Operations";

  const canCancel = ![
    "Rejected by Operations",
    "Rejected by Finance",
    "Delivered to Customer",
    "Cancelled",
  ].includes(status);

  const nothingToDo =
    !canEditContract &&
    !canStartOpsReview &&
    !canActOpsReview &&
    !canResubmitPaymentRequest &&
    !canStartFinanceReview &&
    !canActFinanceReview &&
    !canIssueCheque &&
    !canConfirmChequeReceived &&
    !canConfirmDelivered &&
    !canCancel;

  return (
    <div className="space-y-5">
      {error && <div className="card p-3 border-status-red bg-red-50 text-sm text-status-red">{error}</div>}
      {duplicate && (
        <div className="card p-4 border-status-blue bg-blue-50 text-sm text-blue-900">
          <p className="font-semibold">Possible duplicate</p>
          <p className="mt-1">
            {duplicate.message} Matches: {duplicate.matches.join(", ") || "n/a"}.
          </p>
          <p className="text-xs text-blue-700 mt-1">Submit again to proceed and acknowledge.</p>
        </div>
      )}

      {nothingToDo && (
        <div className="card p-4 text-sm text-slate-500">
          No actions available to {role} while this request is &ldquo;{status}&rdquo;. You can still view the full
          record and its history.
        </div>
      )}

      {canEditContract && (
        <div className="card p-4 space-y-3">
          <h3 className="text-sm font-semibold">Edit &amp; Submit Contract</h3>
          <div>
            <label className="field-label">Sales Agent</label>
            <input
              className="input"
              value={contract.DRV_SALES_MAN}
              onChange={(e) => setContract({ DRV_SALES_MAN: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" disabled={busy} onClick={() => run(() => patchRequest(appId, contract))}>
              Save Changes
            </button>
            <button
              className="btn-primary"
              disabled={busy}
              onClick={() =>
                run(() => {
                  patchRequest(appId, contract);
                  act("SUBMIT_FOR_OPERATIONS_REVIEW");
                })
              }
            >
              {status === "Returned by Operations" ? "Fix & Resubmit" : "Submit for Operations Review"}
            </button>
          </div>
        </div>
      )}

      {canStartOpsReview && (
        <button className="btn-primary" disabled={busy} onClick={() => run(() => act("START_OPERATIONS_REVIEW"))}>
          Start Review
        </button>
      )}

      {(canActOpsReview || canResubmitPaymentRequest) && (
        <div className="card p-4 space-y-4">
          <h3 className="text-sm font-semibold">Operations Review &amp; Payment Request</h3>
          <div className="grid gap-3">
            <div>
              <label className="field-label">Operation Notes</label>
              <textarea
                className="input"
                rows={2}
                value={opsNotes["Operation Notes"]}
                onChange={(e) => setOpsNotes((o) => ({ ...o, "Operation Notes": e.target.value }))}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="field-label">Deviation</label>
                <input
                  className="input"
                  value={opsNotes.DEVIATION}
                  onChange={(e) => setOpsNotes((o) => ({ ...o, DEVIATION: e.target.value }))}
                />
              </div>
              <div>
                <label className="field-label">Feedback</label>
                <input
                  className="input"
                  value={opsNotes.FEEDBACK}
                  onChange={(e) => setOpsNotes((o) => ({ ...o, FEEDBACK: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
              Financial / Loan Details
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <Num label="Price" value={financial.PRICE} required onChange={(v) => setFinancial((f) => ({ ...f, PRICE: v }))} />
              <Num label="Down Payment" value={financial.DOWN_PAYMENT} required onChange={(v) => setFinancial((f) => ({ ...f, DOWN_PAYMENT: v }))} />
              <Num label="Loan Amount" value={financial.LOAN_AMOUNT} required onChange={(v) => setFinancial((f) => ({ ...f, LOAN_AMOUNT: v }))} />
              <Num label="Interest Rate %" value={financial.INTEREST_RATE} onChange={(v) => setFinancial((f) => ({ ...f, INTEREST_RATE: v }))} />
              <Num label="Tenor (months)" value={financial.TENOR_MONTH} onChange={(v) => setFinancial((f) => ({ ...f, TENOR_MONTH: v }))} />
              <Num label="Admin Fees" value={financial.ADMIN_FEES} onChange={(v) => setFinancial((f) => ({ ...f, ADMIN_FEES: v }))} />
              <div>
                <label className="field-label">
                  Bank <span className="text-status-red">*</span>
                </label>
                <select
                  className="input"
                  value={financial.BANK_NAME}
                  onChange={(e) => {
                    const bank = BANKS.find((b) => b.BANK_NAME === e.target.value)!;
                    setFinancial((f) => ({ ...f, BANK_NAME: bank.BANK_NAME, BANK_BRANCH: bank.branches[0] }));
                  }}
                >
                  {BANKS.map((b) => (
                    <option key={b.BANK_NAME}>{b.BANK_NAME}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">
                  Bank Branch <span className="text-status-red">*</span>
                </label>
                <select
                  className="input"
                  value={financial.BANK_BRANCH}
                  onChange={(e) => setFinancial((f) => ({ ...f, BANK_BRANCH: e.target.value }))}
                >
                  {(BANKS.find((b) => b.BANK_NAME === financial.BANK_NAME)?.branches ?? []).map((br) => (
                    <option key={br}>{br}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              className="btn-secondary"
              disabled={busy}
              onClick={() => run(() => patchRequest(appId, { ...opsNotes, ...financial }))}
            >
              Save Draft
            </button>
            {canActOpsReview && (
              <>
                <ReasonBar
                  label="Return to Sales"
                  buttonClass="btn-danger"
                  requireReason
                  busy={busy}
                  onConfirm={(reason) => run(() => act("RETURN_BY_OPERATIONS", { reason }))}
                />
                <ReasonBar
                  label="Reject"
                  buttonClass="btn-danger"
                  requireReason={false}
                  busy={busy}
                  onConfirm={(reason) => run(() => act("REJECT_BY_OPERATIONS", { reason }))}
                />
              </>
            )}
            <button
              className="btn-primary"
              disabled={busy}
              onClick={() => run(() => act("SUBMIT_PAYMENT_REQUEST", { fields: { ...opsNotes, ...financial } }))}
            >
              {canResubmitPaymentRequest ? "Fix & Resubmit Payment Request" : "Submit Payment Request to Finance"}
            </button>
          </div>
        </div>
      )}

      {canStartFinanceReview && (
        <button className="btn-primary" disabled={busy} onClick={() => run(() => act("START_FINANCE_REVIEW"))}>
          Start Review
        </button>
      )}

      {canActFinanceReview && (
        <div className="card p-4 space-y-3">
          <h3 className="text-sm font-semibold">Finance Decision</h3>
          <div className="flex flex-wrap gap-2">
            <ReasonBar
              label="Return to Operations"
              buttonClass="btn-danger"
              requireReason
              busy={busy}
              onConfirm={(reason) => run(() => act("RETURN_BY_FINANCE", { reason }))}
            />
            <ReasonBar
              label="Reject"
              buttonClass="btn-danger"
              requireReason={false}
              busy={busy}
              onConfirm={(reason) => run(() => act("REJECT_BY_FINANCE", { reason }))}
            />
            <button className="btn-primary" disabled={busy} onClick={() => run(() => act("APPROVE_BY_FINANCE"))}>
              Approve
            </button>
          </div>
        </div>
      )}

      {canIssueCheque && (
        <div className="card p-4 space-y-3">
          <h3 className="text-sm font-semibold">Payment Execution — Issue Cheque</h3>
          <div className="grid gap-3">
            <div>
              <label className="field-label">
                Cheque Number <span className="text-status-red">*</span>
              </label>
              <input
                className="input"
                value={financeExec["Cheque Number"]}
                onChange={(e) => setFinanceExec((f) => ({ ...f, "Cheque Number": e.target.value }))}
              />
            </div>
            <div>
              <label className="field-label">Cheque Location</label>
              <input
                className="input"
                value={financeExec["Cheque Location"]}
                onChange={(e) => setFinanceExec((f) => ({ ...f, "Cheque Location": e.target.value }))}
              />
            </div>
            <div>
              <label className="field-label">Finance Notes</label>
              <input
                className="input"
                value={financeExec["Finance Notes"]}
                onChange={(e) => setFinanceExec((f) => ({ ...f, "Finance Notes": e.target.value }))}
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <FileField label="Cheque Photo" required value={financeExec.Cheque} onChange={(p) => setFinanceExec((f) => ({ ...f, Cheque: p }))} />
            <FileField label="Customer Cheque Copy" value={financeExec["Customer Cheque"]} onChange={(p) => setFinanceExec((f) => ({ ...f, "Customer Cheque": p }))} />
            <FileField label="Payment Receipt" value={financeExec["Payment Receipt"]} onChange={(p) => setFinanceExec((f) => ({ ...f, "Payment Receipt": p }))} />
            <FileField label="Receipt" value={financeExec.Receipt} onChange={(p) => setFinanceExec((f) => ({ ...f, Receipt: p }))} />
          </div>
          <p className="text-xs text-slate-500">
            Bank: {record.BANK_NAME || "—"} — {record.BANK_BRANCH || "—"} (from loan details)
          </p>
          <button className="btn-primary" disabled={busy} onClick={() => run(() => act("ISSUE_CHEQUE", { fields: financeExec }))}>
            Issue Cheque
          </button>
        </div>
      )}

      {canConfirmChequeReceived && (
        <div className="card p-4 space-y-3">
          <h3 className="text-sm font-semibold">Cheque Handover</h3>
          <p className="text-sm text-slate-500">
            Confirm that Finance has physically handed over the cheque to you (Operations).
          </p>
          <button
            className="btn-primary"
            disabled={busy}
            onClick={() => run(() => act("CONFIRM_CHEQUE_RECEIVED_BY_OPERATIONS"))}
          >
            Confirm Cheque Received
          </button>
        </div>
      )}

      {canConfirmDelivered && (
        <div className="card p-4 space-y-3">
          <h3 className="text-sm font-semibold">Deliver Cheque to Customer</h3>
          <FileField label="Customer Acknowledgement" required value={ackFile} onChange={setAckFile} />
          <button
            className="btn-primary"
            disabled={busy}
            onClick={() =>
              run(() => act("CONFIRM_DELIVERED_TO_CUSTOMER", { fields: { CustomerAcknowledgementFile: ackFile } }))
            }
          >
            Confirm Delivered to Customer
          </button>
        </div>
      )}

      {canCancel && (
        <div className="pt-2 border-t border-slate-100">
          <ReasonBar
            label="Cancel Request"
            buttonClass="btn-danger"
            requireReason
            busy={busy}
            onConfirm={(reason) => run(() => act("CANCEL", { reason }))}
          />
        </div>
      )}
    </div>
  );
}
