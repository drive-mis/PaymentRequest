"use client";

import { useState } from "react";

export function FileField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (path: string) => void;
  required?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onChange(data.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="field-label">
        {label} {required && <span className="text-status-red">*</span>}
      </label>
      <div className="flex items-center gap-3">
        <label className="btn-secondary cursor-pointer !py-1.5">
          {busy ? "Uploading…" : value ? "Replace file" : "Upload file"}
          <input type="file" className="hidden" onChange={handleFile} disabled={busy} />
        </label>
        {value && (
          <a href={value} target="_blank" rel="noreferrer" className="text-xs text-df-indigo underline truncate max-w-[200px]">
            {value.split("/").pop()}
          </a>
        )}
      </div>
      {error && <p className="text-xs text-status-red mt-1">{error}</p>}
    </div>
  );
}
