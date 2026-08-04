"use client";

import { useState } from "react";
import { openStoredFile, parseFileRef } from "@/lib/fileStore";

/**
 * Renders an attached document. Where the bytes are available it opens them in
 * a new tab; where they aren't (sample data, or a file attached in a different
 * browser — attachments live in that browser's IndexedDB) it says so plainly
 * instead of offering a link that would do nothing.
 */
export function DocumentLink({ value }: { value: string | null | undefined }) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const parsed = parseFileRef(value);

  if (!parsed) return <span className="text-slate-400">Not attached</span>;

  async function view() {
    setBusy(true);
    setMessage(null);
    try {
      const opened = await openStoredFile(value!);
      if (!opened) setMessage("File not available in this browser");
    } catch {
      setMessage("Could not open the file");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span className="text-emerald-700 truncate max-w-[160px]" title={parsed.name}>
        ✓ {parsed.name}
      </span>
      {parsed.id && (
        <button
          type="button"
          onClick={view}
          disabled={busy}
          className="text-xs text-df-indigo underline hover:no-underline disabled:opacity-50 shrink-0"
        >
          {busy ? "Opening…" : "View"}
        </button>
      )}
      {message && <span className="text-[11px] text-slate-400 shrink-0">{message}</span>}
    </span>
  );
}
