import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import { formatDateTime } from "@/lib/format";

export interface TableRecord {
  APP_ID: string;
  CUSTOMER_NAME: string;
  BRAND_NAME: string;
  MODEL: string;
  Branch: string;
  STATUS: string;
  ModifiedOn: Date | string;
  [key: string]: unknown;
}

export function RequestsTable({
  rows,
  emptyMessage = "Nothing here right now.",
  extraColumn,
}: {
  rows: TableRecord[];
  emptyMessage?: string;
  extraColumn?: { header: string; render: (r: TableRecord) => React.ReactNode };
}) {
  if (!rows.length) {
    return <div className="card p-8 text-center text-sm text-slate-400">{emptyMessage}</div>;
  }
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm table-zebra">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="text-left px-5 py-2.5">App ID</th>
            <th className="text-left px-5 py-2.5">Customer</th>
            <th className="text-left px-5 py-2.5">Vehicle</th>
            <th className="text-left px-5 py-2.5">Branch</th>
            <th className="text-left px-5 py-2.5">Status</th>
            {extraColumn && <th className="text-left px-5 py-2.5">{extraColumn.header}</th>}
            <th className="text-left px-5 py-2.5">Updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.APP_ID} className="hover:bg-df-indigo/5">
              <td className="px-5 py-2.5">
                <Link href={`/requests/${r.APP_ID}`} className="font-medium text-df-indigo hover:underline">
                  {r.APP_ID}
                </Link>
              </td>
              <td className="px-5 py-2.5">{r.CUSTOMER_NAME}</td>
              <td className="px-5 py-2.5">
                {r.BRAND_NAME} {r.MODEL}
              </td>
              <td className="px-5 py-2.5 text-slate-500">{r.Branch}</td>
              <td className="px-5 py-2.5">
                <StatusBadge status={r.STATUS} />
              </td>
              {extraColumn && <td className="px-5 py-2.5">{extraColumn.render(r)}</td>}
              <td className="px-5 py-2.5 text-slate-400">{formatDateTime(r.ModifiedOn)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
