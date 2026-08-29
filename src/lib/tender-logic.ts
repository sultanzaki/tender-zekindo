import { MILESTONE_DEFS, MILESTONE_KEYS, type MilestoneKey, type Tender } from "./types";

const MONTHS_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDateID(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS_EN[m - 1]} ${y}`;
}

export function formatRupiah(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "—";
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  return "Rp " + Math.round(num).toLocaleString("id-ID");
}

export function daysBetween(iso: string, anchor: string): number {
  const a = new Date(iso + "T00:00:00");
  const b = new Date(anchor + "T00:00:00");
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

/** Tone used for a milestone-date table cell / timeline dot. */
export type DateTone = "empty" | "past" | "urgent" | "soon" | "normal";

export function dateTone(
  iso: string | null | undefined,
  result: string | null | undefined,
  anchor: string
): DateTone {
  if (!iso) return "empty";
  const diff = daysBetween(iso, anchor);
  if (diff < 0) return "past";
  if (!result) {
    if (diff < 7) return "urgent";
    if (diff <= 14) return "soon";
  }
  return "normal";
}

export interface NextMilestone {
  key: MilestoneKey;
  label: string;
  date: string;
  diff: number;
}

export function nextMilestone(tender: Tender, anchor: string): NextMilestone | null {
  let best: NextMilestone | null = null;
  for (const d of MILESTONE_DEFS) {
    const iso = tender.milestones[d.key];
    if (!iso) continue;
    const diff = daysBetween(iso, anchor);
    if (diff >= 0 && (!best || diff < best.diff)) {
      best = { key: d.key, label: d.label, date: iso, diff };
    }
  }
  return best;
}

export type ResultTone = "success" | "running" | "error" | "neutral";

export function resultTone(result: string | null | undefined): ResultTone {
  if (result === "WIN") return "success";
  if (!result) return "running";
  if (result.indexOf("LOSS") === 0) return "error";
  return "neutral";
}

export interface DeadlineRow {
  tenderId: string;
  days: number;
  daysLabel: string;
  customer: string;
  product: string;
  milestoneLabel: string;
  dateFormatted: string;
  urgent: boolean;
}

export function computeDeadlines(tenders: Tender[], anchor: string): DeadlineRow[] {
  const rows: DeadlineRow[] = [];
  for (const t of tenders) {
    if (t.result) continue;
    const nm = nextMilestone(t, anchor);
    if (nm && nm.diff <= 14) {
      rows.push({
        tenderId: t.id,
        days: nm.diff,
        daysLabel: nm.diff === 0 ? "D-0" : `D-${nm.diff}`,
        customer: t.customer || "—",
        product: t.product || "—",
        milestoneLabel: nm.label,
        dateFormatted: formatDateID(nm.date) ?? "—",
        urgent: nm.diff < 7,
      });
    }
  }
  rows.sort((a, b) => a.days - b.days);
  return rows;
}

export interface StalledRow {
  tenderId: string;
  customer: string;
  product: string;
  area: string;
  period: string;
  lastMilestoneLabel: string | null;
  lastMilestoneDateFormatted: string | null;
  lastMilestoneDateIso: string | null;
}

/** Active (no result yet) tenders with no future-dated milestone left to
 * track — likely stuck waiting on a customer decision. */
export function computeStalled(tenders: Tender[], anchor: string): StalledRow[] {
  const rows: StalledRow[] = [];
  for (const t of tenders) {
    if (t.result) continue;
    if (nextMilestone(t, anchor)) continue;
    let last: { label: string; date: string } | null = null;
    for (const d of MILESTONE_DEFS) {
      const iso = t.milestones[d.key];
      if (!iso) continue;
      if (!last || iso > last.date) last = { label: d.label, date: iso };
    }
    rows.push({
      tenderId: t.id,
      customer: t.customer || "—",
      product: t.product || "—",
      area: t.area || "—",
      period: t.period,
      lastMilestoneLabel: last?.label ?? null,
      lastMilestoneDateFormatted: last ? formatDateID(last.date) : null,
      lastMilestoneDateIso: last?.date ?? null,
    });
  }
  rows.sort((a, b) => (b.lastMilestoneDateIso || "").localeCompare(a.lastMilestoneDateIso || ""));
  return rows;
}

export interface DashboardStats {
  running: number;
  awaiting: number;
  winRatePct: string;
  winRateCaption: string;
  periodTotal: number;
}

export interface LossBreakdownItem {
  label: string;
  count: number;
  pct: number;
  color: string;
}

export const LOSS_CATEGORIES: { label: string; match: (r: string | null | undefined) => boolean; color: string }[] = [
  { label: "Price Loss", match: (r) => r === "LOSS PRICE", color: "var(--zk-error)" },
  { label: "Technical Loss", match: (r) => !!r && r.indexOf("LOSS TECHNICAL") === 0, color: "var(--zk-warning)" },
  { label: "PQ Admin Loss", match: (r) => r === "LOSS PQ ADMIN", color: "var(--zk-gray-500)" },
  { label: "Registration Loss", match: (r) => r === "LOSS REGIST", color: "var(--zk-gray-400)" },
];

export function currentPeriod(periods: string[]): string {
  return periods[0] || "";
}

export function computeStats(tenders: Tender[], period: string, anchor: string): DashboardStats {
  const activeTenders = tenders.filter((t) => !t.result);
  const awaiting = activeTenders.filter((t) => !nextMilestone(t, anchor)).length;
  const periodTenders = tenders.filter((t) => t.period === period);
  const decided = periodTenders.filter((t) => t.result === "WIN" || (t.result && t.result.indexOf("LOSS") === 0));
  const wins = periodTenders.filter((t) => t.result === "WIN").length;
  const winRatePct = decided.length ? Math.round((wins / decided.length) * 100) + "%" : "—";
  const winRateCaption = decided.length ? `${wins} won out of ${decided.length} decided` : "No results yet";
  return {
    running: activeTenders.length,
    awaiting,
    winRatePct,
    winRateCaption,
    periodTotal: periodTenders.length,
  };
}

export function computeLossBreakdown(tenders: Tender[], period: string): LossBreakdownItem[] {
  const periodTenders = tenders.filter((t) => t.period === period);
  const counts = LOSS_CATEGORIES.map((c) => ({
    label: c.label,
    color: c.color,
    count: periodTenders.filter((t) => c.match(t.result)).length,
  }));
  const max = Math.max(1, ...counts.map((c) => c.count));
  return counts.map((c) => ({ ...c, pct: Math.round((c.count / max) * 100) }));
}

export function distinctSorted(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));
}

export function periodsSorted(periods: (string | null | undefined)[]): string[] {
  return [...new Set(periods.filter((v): v is string => !!v))].sort((a, b) => {
    const yearA = parseInt(a.slice(0, 4), 10);
    const yearB = parseInt(b.slice(0, 4), 10);
    return yearB - yearA;
  });
}

export type SortKey =
  | "rowNo"
  | "area"
  | "tenderNo"
  | "customer"
  | "product"
  | "entitas"
  | "period"
  | "oe"
  | "qty"
  | "nilaiPenawaran"
  | "pnl"
  | "result"
  | MilestoneKey;

export type SortDirection = "asc" | "desc";

function getSortValue(t: Tender, key: SortKey): string | number | null {
  if ((MILESTONE_KEYS as readonly string[]).includes(key)) return t.milestones[key as MilestoneKey];
  switch (key) {
    case "rowNo":
      return t.rowNo;
    case "area":
      return t.area;
    case "tenderNo":
      return t.tenderNo;
    case "customer":
      return t.customer;
    case "product":
      return t.product;
    case "entitas":
      return t.entitas;
    case "period":
      return t.period;
    case "oe":
      return t.oe;
    case "qty":
      return t.qty;
    case "nilaiPenawaran":
      return t.nilaiPenawaran;
    case "pnl":
      return t.pnl ? 1 : 0;
    case "result":
      return t.result;
    default:
      return null;
  }
}

/** Nulls always sort last, regardless of direction — sensible default for a
 * "which of these still needs a date" table rather than a strict total order. */
export function sortTenders(tenders: Tender[], key: SortKey, direction: SortDirection): Tender[] {
  const withValue = tenders.map((t) => ({ t, v: getSortValue(t, key) }));
  const known = withValue.filter((x) => x.v !== null && x.v !== undefined && x.v !== "");
  const unknown = withValue.filter((x) => x.v === null || x.v === undefined || x.v === "");
  known.sort((a, b) => {
    let cmp: number;
    if (typeof a.v === "string" && typeof b.v === "string") cmp = a.v.localeCompare(b.v);
    else cmp = (a.v as number) < (b.v as number) ? -1 : (a.v as number) > (b.v as number) ? 1 : 0;
    return direction === "asc" ? cmp : -cmp;
  });
  return [...known, ...unknown].map((x) => x.t);
}

export interface MilestoneOrderIssue {
  earlierLabel: string;
  laterLabel: string;
}

/** Flags milestone pairs entered out of their expected chronological order
 * (e.g. PQ dated before Registration). Advisory only — real tenders do
 * sometimes genuinely skip around, so callers should warn, not block. */
export function findOutOfOrderMilestones(milestones: Partial<Record<MilestoneKey, string>>): MilestoneOrderIssue[] {
  const dated = MILESTONE_DEFS.map((d) => ({ ...d, iso: milestones[d.key] })).filter((d) => d.iso);
  const issues: MilestoneOrderIssue[] = [];
  for (let i = 0; i < dated.length; i++) {
    for (let j = i + 1; j < dated.length; j++) {
      if (dated[i].iso! > dated[j].iso!) {
        issues.push({ earlierLabel: dated[j].label, laterLabel: dated[i].label });
      }
    }
  }
  return issues;
}

/** Case-insensitive duplicate check against other tenders' numbers (advisory). */
export function findDuplicateTenderNo(
  tenderNo: string,
  tenders: { id: string; tenderNo: string | null }[],
  excludeId?: string
): boolean {
  const needle = tenderNo.trim().toLowerCase();
  if (!needle) return false;
  return tenders.some((t) => t.id !== excludeId && (t.tenderNo || "").trim().toLowerCase() === needle);
}

export function filterTenders(tenders: Tender[], filters: {
  period: string;
  area: string;
  entitas: string;
  customer: string;
  result: string;
  search: string;
}): Tender[] {
  const search = (filters.search || "").toLowerCase();
  return tenders.filter((t) => {
    if (filters.period !== "all" && t.period !== filters.period) return false;
    if (filters.area !== "all" && t.area !== filters.area) return false;
    if (filters.entitas !== "all" && t.entitas !== filters.entitas) return false;
    if (filters.customer !== "all" && t.customer !== filters.customer) return false;
    if (filters.result === "__EMPTY__") {
      if (t.result) return false;
    } else if (filters.result !== "all" && t.result !== filters.result) {
      return false;
    }
    if (search) {
      const hay = `${t.tenderNo || ""} ${t.product || ""}`.toLowerCase();
      if (hay.indexOf(search) === -1) return false;
    }
    return true;
  });
}
