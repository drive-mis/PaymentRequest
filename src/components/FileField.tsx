"use client";

// Frontend-only build: there's no upload endpoint and no file storage, so
// picking a file records its name against the record (enough to demo the
// document/attachment gates and show what was attached). File contents are
// never read or stored — swapping this for a real upload later only needs
// onChange to receive a URL instead of a filename.
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
  onChange: (fileName: string) => void;
  required?: boolean;
}) {
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onChange(file.name);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <label className="block text-sm font-semibold text-df-text mb-0.5" dir="auto">
        {label} {required && <span className="text-status-red">*</span>}
      </label>
      {sublabel && <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-2">{sublabel}</p>}
      <div className="flex items-center gap-2 flex-wrap">
        <label className="btn-secondary cursor-pointer !py-1 !px-2.5 !text-xs">
          {value ? "Replace" : "Choose file"}
          <input type="file" className="hidden" onChange={handleFile} />
        </label>
        {value ? (
          <span className="text-xs text-emerald-700 truncate max-w-[150px]" title={value}>
            ✓ {value}
          </span>
        ) : (
          <span className="text-xs text-slate-400">No file</span>
        )}
      </div>
    </div>
  );
}
