"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReportsData } from "@/lib/reports";

const PALETTE = ["#5655E5", "#4B2E9E", "#2FA9C9", "#DCE3F0", "#8A89EE", "#1E8E5A"];

function toChartData(obj: Record<string, number>) {
  return Object.entries(obj).map(([name, value]) => ({ name, value }));
}

function BarBlock({ title, data, color = "#5655E5" }: { title: string; data: { name: string; value: number }[]; color?: string }) {
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-df-text mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EDF0F8" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#5B6472" }} interval={0} angle={-20} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 11, fill: "#5B6472" }} allowDecimals={false} />
          <Tooltip contentStyle={{ borderRadius: 10, borderColor: "#DCE3F0", fontSize: 12 }} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ReportingCharts({ data }: { data: ReportsData }) {
  const statusData = toChartData(data.byStatus);
  const branchData = toChartData(data.byBranch);
  const programData = toChartData(data.byProgram);
  const agingData = toChartData(data.aging);
  const durationData = Object.entries(data.avgStageDurationHours).map(([name, hours]) => ({
    name,
    value: hours ? Math.round((hours as number) * 10) / 10 : 0,
  }));

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-5">
        <BarBlock title="Requests by Status" data={statusData} color="#5655E5" />
        <BarBlock title="Aging — Non-Terminal Requests" data={agingData} color="#2FA9C9" />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <BarBlock title="Average Time per Stage (hours)" data={durationData} color="#4B2E9E" />
        <BarBlock title="Requests by Branch" data={branchData} color="#5655E5" />
      </div>

      <BarBlock title="Requests by Finance Program" data={programData} color="#2FA9C9" />

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-df-text mb-3">Top Return Reasons — Operations ({data.returns.operations.count} total)</h3>
          {data.returns.operations.topReasons.length ? (
            <ul className="space-y-2">
              {data.returns.operations.topReasons.map((r) => (
                <li key={r.reason} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 truncate pr-3">{r.reason}</span>
                  <span className="badge badge-blue">{r.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">No returns yet.</p>
          )}
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-df-text mb-3">Top Return Reasons — Finance ({data.returns.finance.count} total)</h3>
          {data.returns.finance.topReasons.length ? (
            <ul className="space-y-2">
              {data.returns.finance.topReasons.map((r) => (
                <li key={r.reason} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 truncate pr-3">{r.reason}</span>
                  <span className="badge badge-blue">{r.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">No returns yet.</p>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {(
          [
            ["Sales Agent Activity", data.activity.salesAgents],
            ["Operations Reviewer Activity", data.activity.opsReviewers],
            ["Finance Reviewer Activity", data.activity.financeReviewers],
          ] as const
        ).map(([title, obj]) => (
          <div className="card p-5" key={title}>
            <h3 className="text-sm font-semibold text-df-text mb-3">{title}</h3>
            <ul className="space-y-1.5">
              {Object.entries(obj).map(([name, count]) => (
                <li key={name} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{name}</span>
                  <span className="font-semibold text-df-indigo">{count}</span>
                </li>
              ))}
              {Object.keys(obj).length === 0 && <li className="text-sm text-slate-400">No activity yet.</li>}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
