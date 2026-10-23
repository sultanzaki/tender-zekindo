import { PageHeading } from "@/components/PageHeading";
import { requireUser } from "@/lib/auth/dal";
import { MoneyValue, MoneyAccessNotice } from "@/components/MoneyValue";
import styles from "@/components/Workspace.module.css";
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
  statusBreakdown,
  trackComparison,
} from "@/lib/analytics";
import { KpiCards } from "@/components/charts/KpiCards";
import { WinRateTrendChart } from "@/components/charts/WinRateTrendChart";
import { OutcomeVolumeChart } from "@/components/charts/OutcomeVolumeChart";
import { LossReasonTrendChart } from "@/components/charts/LossReasonTrendChart";
import { GroupWinRateChart } from "@/components/charts/GroupWinRateChart";
import { PipelineValueChart } from "@/components/charts/PipelineValueChart";
import { TenderStatusDonut } from "@/components/charts/TenderStatusDonut";
import { TrackComparisonChart } from "@/components/charts/TrackComparisonChart";
import { AnalyticsFilters } from "@/components/AnalyticsFilters";
import { TRACK_LABELS, type Track } from "@/lib/types";
import shared from "@/components/shared.module.css";
import chartStyles from "@/components/charts/charts.module.css";

export const dynamic = "force-dynamic";

/** All metrics require a validated session. Filters live in the URL. */
export default async function AnalyticsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    area?: string;
    period?: string;
    track?: string;
    customer?: string;
  }>;
}) {
  const ctx = await requireUser();
  const params = await searchParams;
  // The default here differs from the tender list on purpose: this is an
  // overview, so it starts on BOTH tracks and you narrow it yourself. A stale
  // bookmark naming a track we do not recognise falls back to both rather than
  // to an empty dashboard.
  const track: Track | "all" =
    params.track === "upstream" || params.track === "downstream"
      ? params.track
      : "all";

  // Scoped to the chosen track first: the area/period options offered, and the
  // "X of Y" denominator, must describe the track you are actually looking at.
  const allTenders = await getAllTenders({ track });
  const canViewMoney = !!ctx;
  const options = getFilterOptions(allTenders);

  // A value that no longer exists is treated as "no filter" rather than as an
  // empty result: a stale bookmark for a renamed area should show the data, not
  // look like an empty database.
  const area =
    params.area && options.areas.includes(params.area) ? params.area : "all";
  const period =
    params.period && options.periods.includes(params.period)
      ? params.period
      : "all";

  const customer =
    params.customer && options.customers.includes(params.customer)
      ? params.customer
      : "all";
  const exportParams = new URLSearchParams({ track, area, period, customer });
  const tenders = allTenders.filter(
    (t) =>
      (area === "all" || t.area === area) &&
      (period === "all" || t.period === period) &&
      (customer === "all" || t.customer === customer),
  );

  // Every figure below — KPI cards and charts alike — comes from the filtered
  // set. That includes the trend charts: with one period selected a "trend" is a
  // single bar, which is the honest answer to "show me only this one".
  const periods = ascendingPeriods(tenders.map((t) => t.period));
  const outcomeRows = outcomesByPeriod(tenders, periods);
  const lossRows = lossReasonByPeriod(tenders, periods);
  const winRateByArea = winRateByGroup(tenders, (t) => t.area);
  const winRateByEntitas = winRateByGroup(tenders, (t) => t.entitas);
  const pipelineByArea = canViewMoney
    ? pipelineValueByGroup(tenders, (t) => t.area)
    : [];
  const statusData = statusBreakdown(tenders);
  const trackData = trackComparison(tenders);

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
    customer === "all" ? null : `Customer: ${customer}`,
  ].filter((v): v is string => !!v);

  return (
    <div className={styles.page}>
      <PageHeading
        eyebrow="PERFORMANCE & INSIGHTS"
        title="Tender analytics"
        actions={
          <a
            href={`/tenders/export?${exportParams}`}
            className="button button-secondary"
          >
            Export this scope
          </a>
        }
        description={
          <>
            Explore outcomes, customer performance, and known pipeline value.{" "}
            {activeFilters.join(" · ")} · {tenders.length} tenders
          </>
        }
      />
      <AnalyticsFilters
        areas={options.areas}
        periods={options.periods}
        customers={options.customers}
        customer={customer}
        area={area}
        period={period}
        track={track}
      />

      {!canViewMoney && (
        <MoneyAccessNotice returnTo={`/analytics?${exportParams}`} />
      )}
      <KpiCards data={kpiData} canViewMoney={canViewMoney} />
      <div className={styles.note}>
        Win rate = WIN ÷ (WIN + LOSS). Canceled, withdrawn, retender, and
        no-info outcomes are excluded. Pipeline = known OE of active tenders
        only.{" "}
        {canViewMoney && (
          <>
            {tenders.filter((t) => !t.result && t.oe === null).length} active
            tenders have no OE;{" "}
            {
              tenders.filter(
                (t) => t.result === "WIN" && t.nilaiPenawaran === null,
              ).length
            }{" "}
            won tenders have no recorded bid value.
          </>
        )}
      </div>

      {
        <div className={chartStyles.grid2} style={{ marginBottom: 20 }}>
          <div className={shared.card} style={{ overflow: "hidden" }}>
            <div className={shared.cardHeader}>
              <h2 className={shared.cardTitle}>Win Rate Trend</h2>
              <span className={shared.cardMeta}>
                By period, decided tenders only
              </span>
            </div>
            <WinRateTrendChart data={outcomeRows} />
          </div>

          <div className={shared.card} style={{ overflow: "hidden" }}>
            <div className={shared.cardHeader}>
              <h2 className={shared.cardTitle}>Outcome Volume</h2>
              <span className={shared.cardMeta}>
                Tender count by outcome, per period
              </span>
            </div>
            <OutcomeVolumeChart data={outcomeRows} />
          </div>
        </div>
      }

      <div
        className={shared.card}
        style={{ marginBottom: 20, overflow: "hidden" }}
      >
        <div className={shared.cardHeader}>
          <h2 className={shared.cardTitle}>Loss Reason Mix</h2>
          <span className={shared.cardMeta}>
            Share of losses by reason, per period
          </span>
        </div>
        <LossReasonTrendChart data={lossRows} />
      </div>

      <div className={chartStyles.grid2} style={{ marginBottom: 20 }}>
        <div className={shared.card} style={{ overflow: "hidden" }}>
          <div className={shared.cardHeader}>
            <h2 className={shared.cardTitle}>Tender Status</h2>
            <span className={shared.cardMeta}>
              Breakdown of all tenders by outcome
            </span>
          </div>
          <TenderStatusDonut data={statusData} />
        </div>

        <div className={shared.card} style={{ overflow: "hidden" }}>
          <div className={shared.cardHeader}>
            <h2 className={shared.cardTitle}>Track Comparison</h2>
            <span className={shared.cardMeta}>Upstream vs downstream</span>
          </div>
          <TrackComparisonChart data={trackData} canViewMoney={canViewMoney} />
        </div>
      </div>

      <div className={chartStyles.grid2} style={{ marginBottom: 20 }}>
        <div className={shared.card} style={{ overflow: "hidden" }}>
          <div className={shared.cardHeader}>
            <h2 className={shared.cardTitle}>Win Rate by Area</h2>
            <span className={shared.cardMeta}>
              Areas with at least 3 decided tenders
            </span>
          </div>
          <GroupWinRateChart
            data={winRateByArea}
            emptyMessage="Not enough decided tenders per area yet."
          />
        </div>

        <div className={shared.card} style={{ overflow: "hidden" }}>
          <div className={shared.cardHeader}>
            <h2 className={shared.cardTitle}>Win Rate by Entity</h2>
            <span className={shared.cardMeta}>
              Entities with at least 3 decided tenders
            </span>
          </div>
          <GroupWinRateChart
            data={winRateByEntitas}
            emptyMessage="Not enough decided tenders per entity yet."
          />
        </div>
      </div>

      {
        <div className={shared.card} style={{ overflow: "hidden" }}>
          <div className={shared.cardHeader}>
            <h2 className={shared.cardTitle}>Pipeline Value by Area</h2>
            <span className={shared.cardMeta}>
              OE of currently running tenders, top 8 areas
            </span>
          </div>
          {canViewMoney ? (
            <PipelineValueChart
              data={pipelineByArea}
              emptyMessage="No running tenders with an OE value yet."
            />
          ) : (
            <div style={{ padding: "48px 20px", textAlign: "center" }}>
              <MoneyValue canView={false} />
            </div>
          )}
        </div>
      }
      <section className={shared.card} style={{ marginBottom: 24 }}>
        <div className={shared.cardHeader}>
          <h2 className={shared.cardTitle}>Customer performance</h2>
          <span className={shared.cardMeta}>
            At least 3 decided tenders · largest samples first
          </span>
        </div>
        <GroupWinRateChart
          data={winRateByGroup(tenders, (t) => t.customer)}
          emptyMessage="Not enough decided tenders per customer yet."
        />
      </section>
      <details className={shared.card}>
        <summary
          style={{
            padding: 20,
            cursor: "pointer",
            fontWeight: 500,
            fontSize: 13,
          }}
        >
          View underlying outcome data
        </summary>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption>Exact counts for the selected scope</caption>
            <thead>
              <tr>
                <th>Period</th>
                <th>Won</th>
                <th>Lost</th>
                <th>Other outcomes</th>
                <th>Decided</th>
                <th>Win rate</th>
              </tr>
            </thead>
            <tbody>
              {outcomeRows.map((row) => (
                <tr key={row.period}>
                  <td>{row.period}</td>
                  <td>{row.win}</td>
                  <td>{row.loss}</td>
                  <td>{row.other}</td>
                  <td>{row.decided}</td>
                  <td>
                    {row.winRatePct === null ? "—" : `${row.winRatePct}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
