import { STATUS_COLOR } from "@/lib/types";

export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? "slate";
  return <span className={`badge badge-${color}`}>{status}</span>;
}
