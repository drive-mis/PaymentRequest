export interface ReadOnlyField {
  label: string;
  value: React.ReactNode;
}

/**
 * System-sourced data (customer / vehicle / program). Rendered as disabled
 * input boxes rather than plain text so it reads unmistakably as "these are
 * fields, and they are locked" — no role may edit any of them, at any stage.
 * Every field is always rendered, showing "—" when the source record has no
 * value, so the panel is a complete and consistent view of the record.
 */
export function ReadOnlyPanel({
  title,
  sourceLabel,
  fields,
  columns = 3,
}: {
  title: string;
  sourceLabel: string;
  fields: ReadOnlyField[];
  columns?: 2 | 3 | 4;
}) {
  const colClass = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4" }[columns];

  return (
    <div className="rounded-df border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-df-text">{title}</h3>
        <span className="badge badge-slate shrink-0">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M4.5 7V5a3.5 3.5 0 1 1 7 0v2M3.5 7h9v6h-9V7Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
          {sourceLabel}
        </span>
      </div>
      <div className={`grid grid-cols-1 ${colClass} gap-x-4 gap-y-3`}>
        {fields.map((f) => {
          const isEmpty = f.value === null || f.value === undefined || f.value === "";
          return (
            <div key={f.label}>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                {f.label}
              </label>
              <div
                className={`w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm cursor-not-allowed select-text truncate ${
                  isEmpty ? "text-slate-400" : "text-slate-700"
                }`}
                title={isEmpty ? undefined : String(f.value)}
                aria-readonly="true"
              >
                {isEmpty ? "—" : f.value}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
