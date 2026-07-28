"use client";

import { useStore } from "@/lib/store";
import { computeReports } from "@/lib/reports";
import { KpiTile } from "@/components/KpiTile";
import { LoadingScreen } from "@/components/Guard";
import { ReportingCharts } from "./ReportingCharts";

export default function ReportingPage() {
  const { hydrated, requests } = useStore();
  if (!hydrated) return <LoadingScreen />;

  const data = computeReports(requests);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-df-text">Reporting &amp; Monitoring</h1>
        <p className="text-sm text-slate-500 mt-1">
          Portfolio-wide metrics across Sales, Operations, and Finance.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile label="Total Requests" value={data.total} accent="indigo" />
        <KpiTile label="Completion Rate" value={`${Math.round(data.completionRate * 100)}%`} accent="teal" />
        <KpiTile
          label="Rejected (Ops + Finance)"
          value={data.rejects.operations + data.rejects.finance}
          accent="teal"
        />
        <KpiTile
          label="Duplicates Flagged & Acknowledged"
          value={data.duplicates.flaggedAndAcknowledged}
          accent="purple"
        />
      </div>

      <ReportingCharts data={data} />
    </div>
  );
}
