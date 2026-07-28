"use client";

// Frontend-only build: there's no upload endpoint and no file storage, so
// picking a file records its name against the record (enough to demo the
// document/attachment gates and show what was attached). File contents are
// never read or stored — swapping this for a real upload later only needs
// onChange to receive a URL instead of a filename.
export function FileField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (fileName: string) => void;
  required?: boolean;
}) {
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onChange(file.name);
  }

  return (
    <div>
      <label className="field-label">
        {label} {required && <span className="text-status-red">*</span>}
      </label>
      <div className="flex items-center gap-3">
        <label className="btn-secondary cursor-pointer !py-1.5">
          {value ? "Replace file" : "Choose file"}
          <input type="file" className="hidden" onChange={handleFile} />
        </label>
        {value && <span className="text-xs text-slate-500 truncate max-w-[180px]" title={value}>{value}</span>}
      </div>
    </div>
  );
}
