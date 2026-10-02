import { requireUser } from "@/lib/auth/dal";
import { getAllTenders } from "@/lib/tenders";
import { getMilestoneTypes } from "@/lib/milestones";
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
import shared from "@/components/shared.module.css";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireUser();
  const [tenders, catalog] = await Promise.all([getAllTenders(), getMilestoneTypes()]);
  const anchor = todayISO();
  const period = currentPeriod(periodsSorted(tenders.map((t) => t.period)));

  const deadlines = computeDeadlines(tenders, anchor, catalog);
  const stats = computeStats(tenders, period, anchor, catalog);
  const lossBreakdown = computeLossBreakdown(tenders, period);

  return (
    <div className={shared.pagePad} style={{ maxWidth: 1376, margin: "0 auto" }}>
      <DeadlinesCard deadlines={deadlines} anchorFormatted={formatDateID(anchor) ?? anchor} />
      <StatsGrid stats={stats} periodLabel={period} />
      <LossBreakdownCard items={lossBreakdown} periodLabel={period} />
    </div>
  );
}
