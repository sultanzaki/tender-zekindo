import { requireUser } from "@/lib/auth/dal";
import { getAllTenders } from "@/lib/tenders";
import { ascendingPeriods, outcomesByPeriod, lossReasonByPeriod, winRateByGroup, pipelineValueByGroup, overallWinRate, totalPipelineValue, runningCount } from "@/lib/analytics";
import { KpiCards } from "@/components/charts/KpiCards";
import { WinRateTrendChart } from "@/components/charts/WinRateTrendChart";
import { OutcomeVolumeChart } from "@/components/charts/OutcomeVolumeChart";
import { LossReasonTrendChart } from "@/components/charts/LossReasonTrendChart";
import { GroupWinRateChart } from "@/components/charts/GroupWinRateChart";
import { PipelineValueChart } from "@/components/charts/PipelineValueChart";
import shared from "@/components/shared.module.css";
import chartStyles from "@/components/charts/charts.module.css";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  await requireUser();
  const tenders = await getAllTenders();

  const periods = ascendingPeriods(tenders.map((t) => t.period));
  const outcomeRows = outcomesByPeriod(tenders, periods);
  const lossRows = lossReasonByPeriod(tenders, periods);
  const winRateByArea = winRateByGroup(tenders, (t) => t.area);
  const winRateByEntitas = winRateByGroup(tenders, (t) => t.entitas);
  const pipelineByArea = pipelineValueByGroup(tenders, (t) => t.area);

  const overall = overallWinRate(tenders);
  const kpiData = {
    pipelineValue: totalPipelineValue(tenders),
    runningCount: runningCount(tenders),
    winRatePct: overall.pct,
    winCount: overall.win,
    lossCount: overall.loss,
    decidedCount: overall.decided,
  };

  return (
    <div className={shared.pagePad} style={{ maxWidth: 1376, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 600, color: "var(--color-fg1)" }}>Analytics</h1>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--color-fg3)" }}>
        Win rate, loss reasons, and pipeline value across all tracked tenders.
      </p>

      <KpiCards data={kpiData} />

      <div className={chartStyles.grid2} style={{ marginBottom: 20 }}>
        <div className={shared.card} style={{ overflow: "hidden" }}>
          <div className={shared.cardHeader}>
            <h2 className={shared.cardTitle}>Win Rate Trend</h2>
            <span className={shared.cardMeta}>By period, decided tenders only</span>
          </div>
          <WinRateTrendChart data={outcomeRows} />
        </div>

        <div className={shared.card} style={{ overflow: "hidden" }}>
          <div className={shared.cardHeader}>
            <h2 className={shared.cardTitle}>Outcome Volume</h2>
            <span className={shared.cardMeta}>Tender count by outcome, per period</span>
          </div>
          <OutcomeVolumeChart data={outcomeRows} />
        </div>
      </div>

      <div className={shared.card} style={{ marginBottom: 20, overflow: "hidden" }}>
        <div className={shared.cardHeader}>
          <h2 className={shared.cardTitle}>Loss Reason Mix</h2>
          <span className={shared.cardMeta}>Share of losses by reason, per period</span>
        </div>
        <LossReasonTrendChart data={lossRows} />
      </div>

      <div className={chartStyles.grid2} style={{ marginBottom: 20 }}>
        <div className={shared.card} style={{ overflow: "hidden" }}>
          <div className={shared.cardHeader}>
            <h2 className={shared.cardTitle}>Win Rate by Area</h2>
            <span className={shared.cardMeta}>Areas with at least 3 decided tenders</span>
          </div>
          <GroupWinRateChart data={winRateByArea} emptyMessage="Not enough decided tenders per area yet." />
        </div>

        <div className={shared.card} style={{ overflow: "hidden" }}>
          <div className={shared.cardHeader}>
            <h2 className={shared.cardTitle}>Win Rate by Entity</h2>
            <span className={shared.cardMeta}>Entities with at least 3 decided tenders</span>
          </div>
          <GroupWinRateChart data={winRateByEntitas} emptyMessage="Not enough decided tenders per entity yet." />
        </div>
      </div>

      <div className={shared.card} style={{ overflow: "hidden" }}>
        <div className={shared.cardHeader}>
          <h2 className={shared.cardTitle}>Pipeline Value by Area</h2>
          <span className={shared.cardMeta}>OE of currently running tenders, top 8 areas</span>
        </div>
        <PipelineValueChart data={pipelineByArea} emptyMessage="No running tenders with an OE value yet." />
      </div>
    </div>
  );
}
