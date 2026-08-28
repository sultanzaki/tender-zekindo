import { getAllTenders } from "@/lib/tenders";
import {
  computeDeadlines,
  computeLossBreakdown,
  computeStats,
  currentPeriod,
  formatDateID,
  todayISO,
} from "@/lib/tender-logic";
import { periodsSorted } from "@/lib/tender-logic";
import { DeadlinesCard } from "@/components/DeadlinesCard";
import { StatsGrid } from "@/components/StatsGrid";
import { LossBreakdownCard } from "@/components/LossBreakdownCard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const tenders = await getAllTenders();
  const anchor = todayISO();
  const period = currentPeriod(periodsSorted(tenders.map((t) => t.period)));

  const deadlines = computeDeadlines(tenders, anchor);
  const stats = computeStats(tenders, period, anchor);
  const lossBreakdown = computeLossBreakdown(tenders, period);

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1376, margin: "0 auto" }}>
      <DeadlinesCard deadlines={deadlines} anchorFormatted={formatDateID(anchor) ?? anchor} />
      <StatsGrid stats={stats} periodLabel={period} />
      <LossBreakdownCard items={lossBreakdown} periodLabel={period} />
    </div>
  );
}
