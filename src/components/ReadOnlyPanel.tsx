export function ReadOnlyPanel({
  title,
  sourceLabel,
  fields,
}: {
  title: string;
  sourceLabel: string;
  fields: { label: string; value: React.ReactNode }[];
}) {
  return (
    <div className="readonly-panel">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-df-text">{title}</h3>
        <span className="badge badge-slate">{sourceLabel}</span>
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
        {fields.map((f) => (
          <div key={f.label}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{f.label}</dt>
            <dd className="text-sm text-slate-700 mt-0.5">{f.value ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
