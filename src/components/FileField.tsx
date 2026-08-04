"use client";

import { useState } from "react";
import { parseFileRef, saveFile } from "@/lib/fileStore";
import { DocumentLink } from "./DocumentLink";

/**
 * Picks a file, stores its bytes in IndexedDB, and hands back a reference for
 * the record. Keeping the bytes out of localStorage is what makes attachments
 * actually viewable later without blowing the storage quota.
 */
export function FileField({
  label,
  sublabel,
  value,
  onChange,
  required,
}: {
  label: string;
  sublabel?: string;
  value: string | null | undefined;
  onChange: (fileRef: string) => void;
  required?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsed = parseFileRef(value);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file after an error
    if (!file) return;

    setBusy(true);
    setError(null);
    try {
      onChange(await saveFile(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not attach that file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <label className="block text-sm font-semibold text-df-text mb-0.5" dir="auto">
        {label} {required && <span className="text-status-red">*</span>}
      </label>
      {sublabel && <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-2">{sublabel}</p>}
      <div className="flex items-center gap-2 flex-wrap">
        <label className="btn-secondary cursor-pointer !py-1 !px-2.5 !text-xs">
          {busy ? "Saving…" : parsed ? "Replace" : "Choose file"}
          <input type="file" className="hidden" onChange={handleFile} disabled={busy} />
        </label>
        {parsed ? <DocumentLink value={value} /> : <span className="text-xs text-slate-400">No file</span>}
      </div>
      {error && <p className="text-xs text-status-red mt-1">{error}</p>}
    </div>
  );
}
