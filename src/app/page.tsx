import { requireUser } from "@/lib/auth/dal";
import { getAllTenders, getFilterOptions } from "@/lib/tenders";
import {
  ascendingPeriods,
  outcomesByPeriod,
  lossReasonByPeriod,
  winRateByGroup,
  pipelineValueByGroup,
  overallWinRate,
  totalPipelineValue,
  totalWinValue,
  runningCount,
} from "@/lib/analytics";
import { KpiCards } from "@/components/charts/KpiCards";
import { WinRateTrendChart } from "@/components/charts/WinRateTrendChart";
import { OutcomeVolumeChart } from "@/components/charts/OutcomeVolumeChart";
import { LossReasonTrendChart } from "@/components/charts/LossReasonTrendChart";
import { GroupWinRateChart } from "@/components/charts/GroupWinRateChart";
import { PipelineValueChart } from "@/components/charts/PipelineValueChart";
import { AnalyticsFilters } from "@/components/AnalyticsFilters";
import { TRACK_LABELS, type Track } from "@/lib/types";
import shared from "@/components/shared.module.css";
import chartStyles from "@/components/charts/charts.module.css";

export const dynamic = "force-dynamic";

/** The landing page IS the analytics dashboard. The old Deadlines / Stats / Loss
 * Breakdown widgets were dropped in favour of this (the "due soon" list still
 * lives on /notifications and in the nav bell). Everything here answers to the
 * area, period and track filters, which live in the URL so a filtered view can
 * be bookmarked and reached with the Back button. */
export default async function AnalyticsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; period?: string; track?: string }>;
}) {
  await requireUser();
  const params = await searchParams;

  // The default here differs from the tender list on purpose: this is an
  // overview, so it starts on BOTH tracks and you narrow it yourself. A stale
  // bookmark naming a track we do not recognise falls back to both rather than
  // to an empty dashboard.
  const track: Track | "all" =
    params.track === "upstream" || params.track === "downstream" ? params.track : "all";

  // Scoped to the chosen track first: the area/period options offered, and the
  // "X of Y" denominator, must describe the track you are actually looking at.
  const allTenders = await getAllTenders({ track });
  const options = getFilterOptions(allTenders);

  // A value that no longer exists is treated as "no filter" rather than as an
  // empty result: a stale bookmark for a renamed area should show the data, not
  // look like an empty database.
  const area = params.area && options.areas.includes(params.area) ? params.area : "all";
  const period = params.period && options.periods.includes(params.period) ? params.period : "all";

  const tenders = allTenders.filter(
    (t) => (area === "all" || t.area === area) && (period === "all" || t.period === period)
  );

  // Every figure below — KPI cards and charts alike — comes from the filtered
  // set. That includes the trend charts: with one period selected a "trend" is a
  // single bar, which is the honest answer to "show me only this one".
  const periods = ascendingPeriods(tenders.map((t) => t.period));
  const outcomeRows = outcomesByPeriod(tenders, periods);
  const lossRows = lossReasonByPeriod(tenders, periods);
  const winRateByArea = winRateByGroup(tenders, (t) => t.area);
  const winRateByEntitas = winRateByGroup(tenders, (t) => t.entitas);
  const pipelineByArea = pipelineValueByGroup(tenders, (t) => t.area);

  const overall = overallWinRate(tenders);
  const kpiData = {
    pipelineValue: totalPipelineValue(tenders),
    winValue: totalWinValue(tenders),
    runningCount: runningCount(tenders),
    winRatePct: overall.pct,
    winCount: overall.win,
    lossCount: overall.loss,
    decidedCount: overall.decided,
  };

  const activeFilters = [
    track === "all" ? null : `Track: ${TRACK_LABELS[track]}`,
    area === "all" ? null : `Area: ${area}`,
    period === "all" ? null : `Period: ${period}`,
  ].filter((v): v is string => !!v);

  return (
    <div className={shared.pagePad} style={{ maxWidth: 1376, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 600, color: "var(--color-fg1)" }}>Analytics</h1>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--color-fg3)" }}>
        Win rate, loss reasons, and pipeline value.
        {activeFilters.length > 0 && (
          <>
            {" "}
            <strong>{activeFilters.join(" · ")}</strong> — {tenders.length} of {allTenders.length} tenders.
          </>
        )}
      </p>

      <AnalyticsFilters
        areas={options.areas}
        periods={options.periods}
        area={area}
        period={period}
        track={track}
      />

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
