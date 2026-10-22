import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthContext } from "@/lib/auth/dal";
import { getTenderById } from "@/lib/tenders";
import { getMilestoneTypes, getMilestoneLabels } from "@/lib/milestones";
import { getTenderDocuments } from "@/lib/documents";
import {
  getTenderFileTree,
  buildDocumentSections,
  type SectionDescriptor,
} from "@/lib/folders";
import { getTenderActivity } from "@/lib/activity";
import {
  resolveTenderMilestones,
  formatDateID,
  formatRupiah,
  dateTone,
  todayISO,
} from "@/lib/tender-logic";
import { safeNextPath } from "@/lib/validation";
import { PageHeading } from "@/components/PageHeading";
import { ResultBadge } from "@/components/ResultBadge";
import { TrackBadge } from "@/components/TrackBadge";
import { DocumentChecklist } from "@/components/DocumentChecklist";
import { DocumentExplorer } from "@/components/DocumentExplorer";
import { ArchiveAction } from "@/components/ArchiveAction";
import workspace from "@/components/Workspace.module.css";
import styles from "@/components/TenderDetail.module.css";
export const dynamic = "force-dynamic";
const tones = {
  empty: "var(--zk-gray-300)",
  past: "#247345",
  urgent: "var(--zk-error)",
  soon: "var(--zk-warning-text)",
  normal: "var(--color-primary)",
};
export default async function Detail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; returnTo?: string }>;
}) {
  const [{ id }, query, ctx] = await Promise.all([
    params,
    searchParams,
    getAuthContext(),
  ]);
  const tender = await getTenderById(id);
  const isAdmin = ctx?.profile.role === "admin";
  if (!tender || (tender.archivedAt && !isAdmin)) notFound();
  const catalog = await getMilestoneTypes(tender.track);
  const milestones = resolveTenderMilestones(tender, {
    [tender.track]: catalog,
  });
  const tab =
    query.tab === "documents"
      ? "documents"
      : query.tab === "activity" && isAdmin
        ? "activity"
        : "overview";
  const returnTo =
    query.returnTo && safeNextPath(query.returnTo).startsWith("/tenders")
      ? safeNextPath(query.returnTo)
      : tender.track === "downstream"
        ? "/tenders?track=downstream"
        : "/tenders";
  const tabHref = (value: string) =>
    `/tenders/${id}?${new URLSearchParams({ tab: value, returnTo })}`;
  const [documents, tree] =
    tab === "documents"
      ? await Promise.all([getTenderDocuments(id), getTenderFileTree(id)])
      : [[], null];
  const historicalKeys = tree
    ? [
        ...new Set(
          [...tree.folders, ...tree.files]
            .map((row) => row.milestoneKey)
            .filter(
              (key): key is string =>
                !!key && !milestones.some((m) => m.key === key),
            ),
        ),
      ]
    : [];
  const historicalLabels = await getMilestoneLabels(historicalKeys);
  const sections = tree
    ? buildDocumentSections(tree, [
        ...documents.map((doc): SectionDescriptor => ({
          id: `checklist:${doc.documentTypeId}`,
          title: doc.label,
          kind: "checklist",
          milestoneKey: null,
          documentTypeId: doc.documentTypeId,
        })),
        ...historicalKeys.map((key, index): SectionDescriptor => ({
          id: `historical:${key}`,
          title:
            historicalLabels.get(key) ||
            `Additional milestone files ${index + 1}`,
          kind: "milestone",
          milestoneKey: key,
          documentTypeId: null,
        })),
        ...milestones.map((m): SectionDescriptor => ({
          id: `milestone:${m.key}`,
          title: m.label,
          kind: "milestone",
          milestoneKey: m.key,
          documentTypeId: null,
        })),
      ])
    : [];
  const activity = tab === "activity" ? await getTenderActivity(id) : null;
  return (
    <div className={workspace.page}>
      <Link href={returnTo} className={styles.backLink}>
        ← Back to table
      </Link>
      <PageHeading
        eyebrow={`${tender.tenderNo || `TENDER #${tender.rowNo}`} · ${tender.period}`}
        title={tender.product || tender.customer}
        description={
          <>
            {tender.customer} · {tender.area}
          </>
        }
        actions={
          <>
            <TrackBadge track={tender.track} />
            <ResultBadge result={tender.result} />
            {isAdmin &&
              (tender.archivedAt ? (
                <ArchiveAction tenderId={id} action="restore" />
              ) : (
                <Link
                  href={`/tenders/${id}/edit`}
                  className="button button-primary"
                >
                  Edit tender
                </Link>
              ))}
          </>
        }
      />
      {tender.archivedAt && (
        <p className={workspace.note}>
          Archived on {formatDateID(tender.archivedAt.slice(0, 10))}. Restore
          this tender to include it in active views.
        </p>
      )}
      <nav className={workspace.pills} aria-label="Tender sections">
        {[
          ["overview", "Overview"],
          ["documents", "Documents"],
          ...(isAdmin ? [["activity", "Activity"]] : []),
        ].map(([key, label]) => (
          <Link
            key={key}
            href={tabHref(key)}
            aria-current={tab === key ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      {tab === "overview" && (
        <>
          <div className={workspace.metrics}>
            {[
              ["Entity / Consortium", tender.entitas || "—"],
              ["Quantity", tender.qty?.toLocaleString("id-ID") ?? "—"],
              ["OE value", formatRupiah(tender.oe)],
              ["Our bid value", formatRupiah(tender.nilaiPenawaran)],
            ].map(([label, value]) => (
              <div key={label} className={workspace.metric}>
                <span className={workspace.metricLabel}>{label}</span>
                <strong className={styles.detailValue}>{value}</strong>
                {label === "OE value" && tender.oeCatatan && (
                  <span className={workspace.metricFoot}>
                    {tender.oeCatatan}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className={workspace.grid}>
            <section className={workspace.panel}>
              <div className={workspace.panelHead}>
                <div>
                  <h2>Milestone timeline</h2>
                  <p>
                    Dates describe scheduled milestones, not completion
                    confirmations.
                  </p>
                </div>
              </div>
              <div className={styles.panel}>
                {milestones.map((m, i) => (
                  <div key={m.key} className={styles.timelineRow}>
                    <div className={styles.timelineRail}>
                      <div
                        className={styles.timelineDot}
                        style={{
                          background:
                            tones[dateTone(m.date, tender.result, todayISO())],
                        }}
                      />
                      {i < milestones.length - 1 && (
                        <div className={styles.timelineLine} />
                      )}
                    </div>
                    <div className={styles.timelineBody}>
                      <div className={styles.timelineLabel}>{m.label}</div>
                      <div className={styles.timelineDate}>
                        {m.date ? formatDateID(m.date) : "Not scheduled"}
                      </div>
                    </div>
                  </div>
                ))}
                {!milestones.length && (
                  <p className="muted">
                    No milestones selected for this tender.
                  </p>
                )}
              </div>
            </section>
            <div className={styles.sidePanels}>
              <section className={workspace.panel}>
                <div className={workspace.panelHead}>
                  <h2>Remarks & context</h2>
                </div>
                <div className={styles.panel}>
                  {tender.carryOver && (
                    <p className={styles.carryOverBadge}>{tender.carryOver}</p>
                  )}
                  <p className={styles.remarksText}>
                    {tender.remarks || "No remarks recorded."}
                  </p>
                  {tender.remark && (
                    <>
                      <h3 className={styles.panelTitle}>Additional remark</h3>
                      <p className={styles.remarksText}>{tender.remark}</p>
                    </>
                  )}
                </div>
              </section>
              {isAdmin && (
                <section className={workspace.panel}>
                  <div className={workspace.panelHead}>
                    <h2>
                      Internal notes <span className="muted">· admin only</span>
                    </h2>
                  </div>
                  <div className={styles.panel}>
                    <p className={styles.remarksText}>
                      {tender.catatanInternal || "No internal notes."}
                    </p>
                  </div>
                </section>
              )}
              <section className={workspace.panel}>
                <div className={workspace.panelHead}>
                  <h2>Tender record</h2>
                </div>
                <div className={styles.panel}>
                  <p className="muted">
                    {tender.pnl ? "P&L flagged" : "No P&L flag"}
                    <br />
                    Last updated:{" "}
                    {tender.updatedAt
                      ? formatDateID(tender.updatedAt.slice(0, 10))
                      : "—"}
                    {isAdmin && tender.updatedByName
                      ? ` by ${tender.updatedByName}`
                      : ""}
                  </p>
                  <Link
                    href={tabHref("documents")}
                    className="button button-secondary"
                  >
                    Open documents →
                  </Link>
                </div>
              </section>
            </div>
          </div>
        </>
      )}
      {tab === "documents" && (
        <div className={workspace.grid}>
          <section className={workspace.panel}>
            <div className={workspace.panelHead}>
              <div>
                <h2>Document workspace</h2>
                <p>Files organized by checklist item and milestone.</p>
              </div>
            </div>
            <div className={styles.panel}>
              <DocumentExplorer
                tenderId={id}
                sections={sections}
                isAdmin={isAdmin}
              />
            </div>
          </section>
          <section className={workspace.panel}>
            <div className={workspace.panelHead}>
              <div>
                <h2>Readiness checklist</h2>
                <p>
                  {documents.filter((d) => d.checked).length} of{" "}
                  {documents.length} items ready
                </p>
              </div>
            </div>
            <div className={styles.panel}>
              <DocumentChecklist
                tenderId={id}
                documents={documents}
                isAdmin={isAdmin}
              />
            </div>
          </section>
        </div>
      )}
      {tab === "activity" && activity && (
        <section className={workspace.panel}>
          <div className={workspace.panelHead}>
            <div>
              <h2>Activity history</h2>
              <p>Latest 50 recorded changes · administrator access</p>
            </div>
          </div>
          {activity.error && (
            <p className="feedback feedback-error" role="alert">
              {activity.error}
            </p>
          )}
          {activity.events.map((event) => (
            <div key={event.id} className={workspace.row}>
              <div className={workspace.rowMain}>
                <span className={workspace.rowTitle}>
                  {event.actor_name} · {event.action}
                </span>
                <span className={workspace.rowSub}>
                  {event.changes
                    ? Object.keys(event.changes)
                        .filter((key) => key !== "updated_by")
                        .map((key) => key.replace(/_/g, " "))
                        .join(", ")
                    : "Tender status changed"}
                </span>
              </div>
              <span className={workspace.rowMeta}>
                {new Intl.DateTimeFormat("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Asia/Jakarta",
                }).format(new Date(event.created_at))}{" "}
                WIB
              </span>
            </div>
          ))}
          {!activity.events.length && !activity.error && (
            <div className={workspace.empty}>No activity recorded yet.</div>
          )}
        </section>
      )}
    </div>
  );
}
