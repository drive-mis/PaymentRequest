import type { CarLoanRequest } from "./types";

function hoursBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000;
}

const NON_TERMINAL = new Set([
  "Draft",
  "Submitted for Operations Review",
  "Under Operations Review",
  "Returned by Operations",
  "Payment Request Submitted",
  "Under Finance Review",
  "Returned by Finance",
  "Approved by Finance",
  "Cheque Issued",
  "Cheque Delivered to Operations",
]);

/** Pure aggregation over the in-memory records — Section 8 metrics. */
export function computeReports(records: CarLoanRequest[]) {
  const byStatus: Record<string, number> = {};
  const byBranch: Record<string, number> = {};
  const byProgram: Record<string, number> = {};
  const bySalesAgent: Record<string, number> = {};
  const byOpsReviewer: Record<string, number> = {};
  const byFinanceReviewer: Record<string, number> = {};

  const opsReasons: Record<string, number> = {};
  const financeReasons: Record<string, number> = {};
  let opsReturns = 0;
  let opsRejects = 0;
  let financeReturns = 0;
  let financeRejects = 0;
  let flaggedDuplicates = 0;

  const stageDurations: Record<string, number[]> = {
    "Sales -> Operations Review": [],
    "Operations -> Finance Review": [],
    "Finance Approval -> Cheque Issued": [],
    "Cheque Issued -> Delivered": [],
  };

  const agingBuckets = { "0-1 day": 0, "1-3 days": 0, "3-7 days": 0, "7+ days": 0 };

  for (const r of records) {
    byStatus[r.STATUS] = (byStatus[r.STATUS] ?? 0) + 1;
    if (r.Branch) byBranch[r.Branch] = (byBranch[r.Branch] ?? 0) + 1;
    if (r.PROGRAM_NAME) byProgram[r.PROGRAM_NAME] = (byProgram[r.PROGRAM_NAME] ?? 0) + 1;
    if (r.DRV_SALES_MAN) bySalesAgent[r.DRV_SALES_MAN] = (bySalesAgent[r.DRV_SALES_MAN] ?? 0) + 1;
    if (r.OperationsReviewedBy)
      byOpsReviewer[r.OperationsReviewedBy] = (byOpsReviewer[r.OperationsReviewedBy] ?? 0) + 1;
    if (r.FinanceReviewedBy)
      byFinanceReviewer[r.FinanceReviewedBy] = (byFinanceReviewer[r.FinanceReviewedBy] ?? 0) + 1;
    if (r.IsPotentialDuplicate) flaggedDuplicates += 1;

    if (NON_TERMINAL.has(r.STATUS)) {
      const ageDays = hoursBetween(r.ModifiedOn, new Date().toISOString()) / 24;
      if (ageDays <= 1) agingBuckets["0-1 day"] += 1;
      else if (ageDays <= 3) agingBuckets["1-3 days"] += 1;
      else if (ageDays <= 7) agingBuckets["3-7 days"] += 1;
      else agingBuckets["7+ days"] += 1;
    }

    const log = r.StatusHistoryLog ?? [];
    const find = (status: string) => log.find((e) => e.status === status);
    const created = log[0];
    const underOps = find("Under Operations Review");
    const paymentSubmitted = find("Payment Request Submitted");
    const approved = find("Approved by Finance");
    const chequeIssued = find("Cheque Issued");
    const delivered = find("Delivered to Customer");

    if (created && underOps)
      stageDurations["Sales -> Operations Review"].push(hoursBetween(created.changedAt, underOps.changedAt));
    if (paymentSubmitted && approved)
      stageDurations["Operations -> Finance Review"].push(hoursBetween(paymentSubmitted.changedAt, approved.changedAt));
    if (approved && chequeIssued)
      stageDurations["Finance Approval -> Cheque Issued"].push(hoursBetween(approved.changedAt, chequeIssued.changedAt));
    if (chequeIssued && delivered)
      stageDurations["Cheque Issued -> Delivered"].push(hoursBetween(chequeIssued.changedAt, delivered.changedAt));

    for (const entry of log) {
      if (entry.status === "Returned by Operations") {
        opsReturns += 1;
        if (entry.reason) opsReasons[entry.reason] = (opsReasons[entry.reason] ?? 0) + 1;
      }
      if (entry.status === "Rejected by Operations") opsRejects += 1;
      if (entry.status === "Returned by Finance") {
        financeReturns += 1;
        if (entry.reason) financeReasons[entry.reason] = (financeReasons[entry.reason] ?? 0) + 1;
      }
      if (entry.status === "Rejected by Finance") financeRejects += 1;
    }
  }

  const total = records.length;
  const cancelled = byStatus["Cancelled"] ?? 0;
  const delivered = byStatus["Delivered to Customer"] ?? 0;
  const completionRate = total - cancelled > 0 ? delivered / (total - cancelled) : 0;

  const avgStageDurationHours = Object.fromEntries(
    Object.entries(stageDurations).map(([k, arr]) => [
      k,
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null,
    ])
  );

  const topReasons = (reasons: Record<string, number>) =>
    Object.entries(reasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason, count]) => ({ reason, count }));

  return {
    total,
    byStatus,
    completionRate,
    returns: {
      operations: { count: opsReturns, topReasons: topReasons(opsReasons) },
      finance: { count: financeReturns, topReasons: topReasons(financeReasons) },
    },
    rejects: { operations: opsRejects, finance: financeRejects },
    duplicates: { flaggedAndAcknowledged: flaggedDuplicates },
    avgStageDurationHours,
    aging: agingBuckets,
    byBranch,
    byProgram,
    activity: { salesAgents: bySalesAgent, opsReviewers: byOpsReviewer, financeReviewers: byFinanceReviewer },
  };
}

export type ReportsData = ReturnType<typeof computeReports>;
