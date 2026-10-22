import Link from "next/link";
import { getAllTenders } from "@/lib/tenders";
import { getMilestoneCatalog } from "@/lib/milestones";
import {
  computeDeadlines,
  computeStalled,
  todayISO,
  formatDateID,
  formatRupiah,
} from "@/lib/tender-logic";
import { overallWinRate, totalPipelineValue } from "@/lib/analytics";
import { PageHeading } from "@/components/PageHeading";
import { TrackBadge } from "@/components/TrackBadge";
import { Icon } from "@/components/Icon";
import type { Track } from "@/lib/types";
import styles from "@/components/Workspace.module.css";
export const dynamic = "force-dynamic";
export default async function Overview({
  searchParams,
}: {
  searchParams: Promise<{ track?: string }>;
}) {
  const params = await searchParams;
  const track: Track | "all" =
    params.track === "upstream" || params.track === "downstream"
      ? params.track
      : "all";
  const [tenders, catalog] = await Promise.all([
    getAllTenders({ track }),
    getMilestoneCatalog(),
  ]);
  const today = todayISO();
  const deadlines = computeDeadlines(tenders, today, catalog);
  const followups = computeStalled(tenders, today, catalog);
  const running = tenders.filter((t) => !t.result);
  const winRate = overallWinRate(tenders);
  const updated = [...tenders]
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
    .slice(0, 5);
  const known = running.filter((t) => t.oe !== null).length;
  const list = (extra: Record<string, string> = {}) => {
    const query = new URLSearchParams({
      ...(track !== "upstream" ? { track } : {}),
      ...extra,
    });
    return `/tenders${query.size ? `?${query}` : ""}`;
  };
  const analyticsHref =
    track === "all" ? "/analytics" : `/analytics?track=${track}`;
  const deadlineHref = (view = "all") =>
    `/notifications?${new URLSearchParams({ view, ...(track !== "all" ? { track } : {}) })}`;
  return (
    <div className={styles.page}>
      <PageHeading
        eyebrow="WORKSPACE OVERVIEW"
        title="Your tender workday, at a glance."
        description={
          <>
            Priorities, upcoming milestones, and the latest tender updates.{" "}
            <span>{formatDateID(today)} · WIB</span>
          </>
        }
        actions={
          <Link href={analyticsHref} className="button button-secondary">
            <Icon name="analytics" />
            Explore analytics
          </Link>
        }
      />
      <nav className={styles.pills} aria-label="Overview track">
        {[
          ["all", "All tenders"],
          ["upstream", "Upstream"],
          ["downstream", "Downstream"],
        ].map(([value, label]) => (
          <Link
            key={value}
            href={value === "all" ? "/" : `/?track=${value}`}
            aria-current={track === value ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className={styles.metrics}>
        {[
          {
            label: "Active tenders",
            value: running.length,
            foot: `${tenders.length} tenders in this scope`,
            href: list({ result: "__EMPTY__" }),
          },
          {
            label: "Due in 7 days",
            value: deadlines.filter((d) => d.days <= 7).length,
            foot: "Next milestone per active tender",
            href: deadlineHref("week"),
          },
          {
            label: "Needs follow-up",
            value: followups.length,
            foot: "Active, no upcoming milestone",
            href: deadlineHref("followup"),
          },
          {
            label: "Win rate",
            value: winRate.pct === null ? "—" : `${winRate.pct}%`,
            foot: `${winRate.win} wins / ${winRate.decided} decided tenders`,
            href: analyticsHref,
          },
        ].map((metric) => (
          <Link className={styles.metric} key={metric.label} href={metric.href}>
            <span className={styles.metricLabel}>
              {metric.label}
              <Icon name="arrow" width={13} height={13} />
            </span>
            <strong className={styles.metricValue}>{metric.value}</strong>
            <span className={styles.metricFoot}>{metric.foot}</span>
          </Link>
        ))}
      </div>
      <div className={styles.grid}>
        <div className={styles.stack}>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2>Upcoming milestones</h2>
                <p>Nearest deadline per tender · next 14 days</p>
              </div>
              <Link href={deadlineHref()}>View all →</Link>
            </div>
            {deadlines.length ? (
              deadlines.slice(0, 6).map((d) => (
                <Link
                  className={styles.row}
                  href={`/tenders/${d.tenderId}`}
                  key={d.tenderId}
                >
                  <span
                    className={`${styles.day} ${d.urgent ? styles.urgent : ""}`}
                  >
                    {d.days === 0 ? "0" : d.days}
                    <small>{d.days === 0 ? "TODAY" : "DAYS"}</small>
                  </span>
                  <span className={styles.rowMain}>
                    <span className={styles.rowTitle}>{d.customer}</span>
                    <span className={styles.rowSub}>{d.product}</span>
                  </span>
                  <span className={styles.rowMeta}>
                    {d.milestoneLabel}
                    <br />
                    {d.dateFormatted}
                  </span>
                </Link>
              ))
            ) : (
              <div className={styles.empty}>
                No deadlines in the next 14 days. Review active tenders to keep
                their schedules up to date.
              </div>
            )}
          </section>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2>Recently updated tenders</h2>
                <p>Latest saved changes across this workspace</p>
              </div>
              <Link href={list()}>Open tenders →</Link>
            </div>
            {updated.map((t) => (
              <Link href={`/tenders/${t.id}`} key={t.id} className={styles.row}>
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>
                    {t.tenderNo || t.customer} <TrackBadge track={t.track} />
                  </span>
                  <span className={styles.rowSub}>
                    {t.product || t.customer}
                  </span>
                </span>
                <span className={styles.rowMeta}>
                  {t.updatedAt ? formatDateID(t.updatedAt.slice(0, 10)) : "—"}
                </span>
              </Link>
            ))}
            {!updated.length && (
              <div className={styles.empty}>No tenders yet.</div>
            )}
          </section>
        </div>
        <div className={styles.stack}>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2>Pipeline snapshot</h2>
                <p>Active opportunities in the selected scope</p>
              </div>
            </div>
            <div className={styles.insight}>
              <div>
                <p>Known pipeline value · OE</p>
                <strong>{formatRupiah(totalPipelineValue(tenders))}</strong>
                <p>
                  {known} of {running.length} active tenders have an OE value.
                </p>
              </div>
            </div>
            <div className={styles.insight}>
              <div>
                <strong>{followups.length}</strong>
                <p>
                  tenders have no scheduled next step. They may be awaiting a
                  result or need updated dates.
                </p>
              </div>
              <Link href={deadlineHref("followup")}>Review →</Link>
            </div>
            <div className={styles.insight}>
              <div>
                <strong>{deadlines.filter((d) => d.days <= 3).length}</strong>
                <p>milestones are due within 3 days.</p>
              </div>
              <Link href={deadlineHref("urgent")}>Open →</Link>
            </div>
          </section>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2>Follow-up queue</h2>
                <p>Most recently active tenders without a next date</p>
              </div>
            </div>
            {followups.slice(0, 5).map((t) => (
              <Link
                href={`/tenders/${t.tenderId}`}
                key={t.tenderId}
                className={styles.row}
              >
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>{t.customer}</span>
                  <span className={styles.rowSub}>{t.product}</span>
                </span>
                <span className={styles.rowMeta}>
                  {t.lastMilestoneLabel || "No dates set"}
                  <br />
                  {t.lastMilestoneDateFormatted}
                </span>
              </Link>
            ))}
            {!followups.length && (
              <div className={styles.empty}>
                Every active tender has an upcoming milestone.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
