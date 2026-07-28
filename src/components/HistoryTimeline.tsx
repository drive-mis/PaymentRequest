import type { StatusHistoryEntry } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";

export function HistoryTimeline({ log }: { log: StatusHistoryEntry[] }) {
  if (!log.length) return <p className="text-sm text-slate-400">No history yet.</p>;
  const ordered = [...log].reverse();
  return (
    <ol className="relative border-l border-slate-200 ml-2">
      {ordered.map((entry, i) => (
        <li key={i} className="mb-6 ml-5 last:mb-0">
          <span className="absolute -left-[7px] flex h-3.5 w-3.5 items-center justify-center rounded-full bg-df-indigo ring-4 ring-white" />
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={entry.status} />
            {entry.decision && <span className="text-xs font-semibold text-slate-500">{entry.decision}</span>}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {entry.changedBy} · {entry.changedByRole} · {formatDateTime(entry.changedAt)}
          </p>
          {entry.reason && (
            <p className="mt-1.5 text-sm bg-blue-50 border border-blue-100 text-blue-900 rounded-lg px-3 py-1.5">
              “{entry.reason}”
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
