export function KpiTile({
  label,
  value,
  sub,
  accent = "indigo",
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "indigo" | "teal" | "purple" | "black";
}) {
  const dot = { indigo: "bg-df-indigo", teal: "bg-df-teal", purple: "bg-df-purple", black: "bg-df-black" }[accent];
  return (
    <div className="card relative overflow-hidden p-5">
      <div className={`kpi-ellipse ${dot} w-28 h-28 -top-8 -right-8`} />
      <div className="relative z-10">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
        <div className="text-3xl font-bold text-df-text mt-1.5">{value}</div>
        {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
      </div>
    </div>
  );
}
