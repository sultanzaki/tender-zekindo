import { LOSS_CATEGORIES, periodsSorted } from "./tender-logic";
import type { Tender } from "./types";

export type Outcome = "win" | "loss" | "other";

function outcomeOf(result: string | null | undefined): Outcome | null {
  if (!result) return null;
  if (result === "WIN") return "win";
  if (result.indexOf("LOSS") === 0) return "loss";
  return "other";
}

/** Chronological (oldest-first) period order for trend charts — the
 * opposite of periodsSorted(), which is newest-first for filter dropdowns. */
export function ascendingPeriods(periods: (string | null | undefined)[]): string[] {
  return [...periodsSorted(periods)].reverse();
}

export interface PeriodOutcomeRow {
  period: string;
  win: number;
  loss: number;
  other: number;
  decided: number;
  winRatePct: number | null;
}

export function outcomesByPeriod(tenders: Tender[], periods: string[]): PeriodOutcomeRow[] {
  return periods.map((period) => {
    let win = 0;
    let loss = 0;
    let other = 0;
    for (const t of tenders) {
      if (t.period !== period) continue;
      const o = outcomeOf(t.result);
      if (o === "win") win++;
      else if (o === "loss") loss++;
      else if (o === "other") other++;
    }
    const decided = win + loss;
    return { period, win, loss, other, decided, winRatePct: decided ? Math.round((win / decided) * 100) : null };
  });
}

export interface LossReasonPeriodRow {
  period: string;
  totalLoss: number;
  shares: { label: string; count: number; pct: number; color: string }[];
}

/** Loss-reason mix per period, as a share of that period's losses — only
 * periods with at least one loss are included (an empty period would just
 * be a meaningless 0-height bar). */
export function lossReasonByPeriod(tenders: Tender[], periods: string[]): LossReasonPeriodRow[] {
  const rows: LossReasonPeriodRow[] = [];
  for (const period of periods) {
    const periodTenders = tenders.filter((t) => t.period === period);
    const counts = LOSS_CATEGORIES.map((c) => ({
      label: c.label,
      color: c.color,
      count: periodTenders.filter((t) => c.match(t.result)).length,
    }));
    const totalLoss = counts.reduce((sum, c) => sum + c.count, 0);
    if (totalLoss === 0) continue;
    rows.push({
      period,
      totalLoss,
      shares: counts.map((c) => ({ ...c, pct: Math.round((c.count / totalLoss) * 100) })),
    });
  }
  return rows;
}

export interface GroupWinRateRow {
  group: string;
  win: number;
  loss: number;
  decided: number;
  winRatePct: number;
}

/** Win rate per group (area / entitas / customer), sorted by sample size.
 * Groups below minDecided are dropped — a 100% "win rate" on one decided
 * tender is noise, not a signal, and would mislead a bar chart reader. */
export function winRateByGroup(
  tenders: Tender[],
  groupFn: (t: Tender) => string | null | undefined,
  minDecided = 3,
  topN = 8
): GroupWinRateRow[] {
  const map = new Map<string, { win: number; loss: number }>();
  for (const t of tenders) {
    const key = groupFn(t);
    if (!key) continue;
    const o = outcomeOf(t.result);
    if (o !== "win" && o !== "loss") continue;
    const entry = map.get(key) ?? { win: 0, loss: 0 };
    if (o === "win") entry.win++;
    else entry.loss++;
    map.set(key, entry);
  }
  const rows: GroupWinRateRow[] = [];
  for (const [group, { win, loss }] of map) {
    const decided = win + loss;
    if (decided < minDecided) continue;
    rows.push({ group, win, loss, decided, winRatePct: Math.round((win / decided) * 100) });
  }
  rows.sort((a, b) => b.decided - a.decided);
  return rows.slice(0, topN);
}

export interface GroupValueRow {
  group: string;
  value: number;
  count: number;
}

/** Pipeline (OE) value of currently-running tenders, grouped by area/entitas. */
export function pipelineValueByGroup(tenders: Tender[], groupFn: (t: Tender) => string | null | undefined): GroupValueRow[] {
  const map = new Map<string, { value: number; count: number }>();
  for (const t of tenders) {
    if (t.result) continue;
    const key = groupFn(t);
    if (!key) continue;
    const entry = map.get(key) ?? { value: 0, count: 0 };
    entry.value += t.oe ?? 0;
    entry.count += 1;
    map.set(key, entry);
  }
  return [...map.entries()]
    .map(([group, v]) => ({ group, ...v }))
    .sort((a, b) => b.value - a.value);
}

export interface OverallWinRate {
  win: number;
  loss: number;
  decided: number;
  pct: number | null;
}

export function overallWinRate(tenders: Tender[]): OverallWinRate {
  let win = 0;
  let loss = 0;
  for (const t of tenders) {
    const o = outcomeOf(t.result);
    if (o === "win") win++;
    else if (o === "loss") loss++;
  }
  const decided = win + loss;
  return { win, loss, decided, pct: decided ? Math.round((win / decided) * 100) : null };
}

export function totalPipelineValue(tenders: Tender[]): number {
  return tenders.filter((t) => !t.result).reduce((sum, t) => sum + (t.oe ?? 0), 0);
}

/** Total nilai_penawaran (bid value) for WIN tenders. */
export function totalWinValue(tenders: Tender[]): number {
  return tenders
    .filter((t) => t.result === "WIN")
    .reduce((sum, t) => sum + (t.nilaiPenawaran ?? 0), 0);
}

/* ── Status breakdown ───────────────────────────────────── */

export interface StatusBreakdown {
  key: string;
  label: string;
  count: number;
}

/** Breakdown of all tenders by their outcome status. */
export function statusBreakdown(tenders: Tender[]): StatusBreakdown[] {
  let running = 0, win = 0, loss = 0, canceled = 0, withdrawn = 0;
  for (const t of tenders) {
    if (!t.result) { running++; continue; }
    if (t.result === "WIN") { win++; continue; }
    if (t.result === "CANCELED") { canceled++; continue; }
    if (t.result === "WITHDRAW") { withdrawn++; continue; }
    loss++;
  }
  return [
    { key: "running", label: "Running", count: running },
    { key: "win", label: "Win", count: win },
    { key: "loss", label: "Loss", count: loss },
    { key: "canceled", label: "Canceled", count: canceled },
    { key: "withdrawn", label: "Withdrawn", count: withdrawn },
  ].filter((s) => s.count > 0);
}

/* ── Track comparison ────────────────────────────────────── */

export interface TrackComparisonRow {
  track: string;
  label: string;
  count: number;
  pipelineValue: number;
  winValue: number;
  winRate: number | null;
}

/** Metrics side-by-side for upstream vs downstream. */
export function trackComparison(tenders: Tender[]): TrackComparisonRow[] {
  const map = new Map<string, { count: number; pv: number; wv: number; win: number; loss: number }>();
  for (const t of tenders) {
    const tr = t.track || "upstream";
    let e = map.get(tr);
    if (!e) {
      e = { count: 0, pv: 0, wv: 0, win: 0, loss: 0 };
      map.set(tr, e);
    }
    e.count++;
    e.pv += t.oe ?? 0;
    if (t.result === "WIN") {
      e.win++;
      e.wv += t.nilaiPenawaran ?? 0;
    } else if (t.result && t.result !== "CANCELED" && t.result !== "WITHDRAW") {
      e.loss++;
    }
  }
  return ["upstream", "downstream"]
    .filter((tr) => map.has(tr))
    .map((tr) => {
      const e = map.get(tr)!;
      const decided = e.win + e.loss;
      return {
        track: tr,
        label: tr === "upstream" ? "Upstream" : "Downstream",
        count: e.count,
        pipelineValue: e.pv,
        winValue: e.wv,
        winRate: decided ? Math.round((e.win / decided) * 100) : null,
      };
    });
}

export function runningCount(tenders: Tender[]): number {
  return tenders.filter((t) => !t.result).length;
}

/** Compact "Rp 1.2 B" / "Rp 850 Jt" style label for chart axes and KPI
 * cards — formatRupiah's full digit-grouped form is too wide for either. */
export function formatCompactRupiah(n: number): string {
  if (n === 0) return "Rp 0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")} B`;
  if (abs >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")} Jt`;
  if (abs >= 1_000) return `Rp ${(n / 1_000).toFixed(1).replace(/\.0$/, "")} Rb`;
  return `Rp ${Math.round(n)}`;
}
