import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { restoreTenderForm } from "@/lib/actions";
import { getTenderById } from "@/lib/tenders";
import { getTenderDocuments } from "@/lib/documents";
import { buildDocumentSections, getTenderFileTree, type SectionDescriptor } from "@/lib/folders";
import { getMilestoneTypes } from "@/lib/milestones";
import {
  dateTone,
  formatDateID,
  formatRupiah,
  resolveTenderMilestones,
  todayISO,
  type MilestoneCatalog,
} from "@/lib/tender-logic";
import { ResultBadge } from "@/components/ResultBadge";
import { TrackBadge } from "@/components/TrackBadge";
import { DocumentChecklist } from "@/components/DocumentChecklist";
import { DocumentExplorer } from "@/components/DocumentExplorer";
import shared from "@/components/shared.module.css";
import styles from "@/components/TenderDetail.module.css";

export const dynamic = "force-dynamic";

const DOT_COLOR = {
  empty: "var(--zk-gray-300)",
  past: "var(--zk-success)",
  urgent: "var(--zk-error)",
  soon: "var(--zk-warning)",
  normal: "var(--color-primary)",
};

const DATE_COLOR = {
  empty: "var(--color-fg3)",
  past: "var(--zk-success)",
  urgent: "var(--zk-error)",
  soon: "var(--zk-warning-text)",
  normal: "var(--color-fg1)",
};

export default async function TenderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireUser();
  const isAdmin = ctx.profile.role === "admin";

  const { id } = await params;
  const tender = await getTenderById(id);
  if (!tender) notFound();
  // Independent reads — issued together rather than one after the other.
  const [documents, milestoneTypes, fileTree] = await Promise.all([
    getTenderDocuments(tender.id),
    // This tender's own track only: the other track's milestones are unrelated
    // to it, and a shared catalog would show them as its milestones.
    getMilestoneTypes(tender.track),
    getTenderFileTree(tender.id),
  ]);

  const anchor = todayISO();
  // This tender's own milestone order/subset, falling back to the catalog order.
  const catalog: MilestoneCatalog = { [tender.track]: milestoneTypes };
  const milestones = resolveTenderMilestones(tender, catalog);

  // The checklist keeps its own tree, and every milestone gets one — both in the
  // same panel. Labels come from the catalog / checklist, so a rename shows up
  // in both places.
  const documentSections = buildDocumentSections(fileTree, [
    ...documents.map(
      (doc): SectionDescriptor => ({
        id: `checklist:${doc.documentTypeId}`,
        title: doc.label,
        kind: "checklist",
        milestoneKey: null,
        documentTypeId: doc.documentTypeId,
      })
    ),
    ...milestones.map(
      (m): SectionDescriptor => ({
        id: `milestone:${m.key}`,
        title: m.label,
        kind: "milestone",
        milestoneKey: m.key,
        documentTypeId: null,
      })
    ),
  ]);

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <Link href="/tenders" className={styles.backLink} style={{ marginBottom: 0 }}>
          &larr; Back to table
        </Link>
        {isAdmin && (
          <div style={{ display: "flex", gap: 10 }}>
            {tender.archivedAt ? (
              <form action={restoreTenderForm.bind(null, tender.id)}>
                <button type="submit" className={styles.editButton}>
                  Restore
                </button>
              </form>
            ) : (
              <Link href={`/tenders/${tender.id}/edit`} className={styles.editButton}>
                Edit Tender
              </Link>
            )}
          </div>
        )}
      </div>

      {tender.archivedAt && (
        <div className={styles.archivedBanner}>
          Archived on {formatDateID(tender.archivedAt.slice(0, 10))}. It&apos;s hidden from the dashboard and table until restored.
        </div>
      )}

      <div className={`${shared.card} ${styles.headerCard}`}>
        <div className={styles.headerTop}>
          <div>
            <div className={styles.metaLine}>
              <span className={styles.metaText}>{tender.tenderNo || "—"}</span>
              <span className={styles.metaDivider}>&middot;</span>
              <span className={styles.metaText}>{tender.period}</span>
              <span className={styles.metaDivider}>&middot;</span>
              <span className={styles.metaText}>{tender.area}</span>
            </div>
            <h1 className={styles.title}>{tender.product || "—"}</h1>
            <div className={styles.customer}>{tender.customer || "—"}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <TrackBadge track={tender.track} />
            {tender.pnl && <span className={styles.pnlBadge}>P&amp;L</span>}
            <ResultBadge result={tender.result} />
          </div>
        </div>
        <div className={styles.factGrid}>
          <div>
            <div className={styles.factLabel}>Entity / Consortium</div>
            <div className={styles.factValue}>{tender.entitas || "—"}</div>
          </div>
          <div>
            <div className={styles.factLabel}>Qty</div>
            <div className={styles.factValue}>{tender.qty ?? "—"}</div>
          </div>
          <div>
            <div className={styles.factLabel}>OE (Rp)</div>
            <div className={styles.factValue}>
              {formatRupiah(tender.oe)}
              {tender.oeCatatan && <span className={styles.factNote}> ({tender.oeCatatan})</span>}
            </div>
          </div>
          <div>
            <div className={styles.factLabel}>Our Bid Value</div>
            <div className={styles.factValue}>{formatRupiah(tender.nilaiPenawaran)}</div>
          </div>
        </div>
      </div>

      <div className={styles.grid2}>
        <div className={`${shared.card} ${styles.panel}`}>
          <h2 className={styles.panelTitle}>Milestone Timeline</h2>
          {milestones.map((m, i) => {
            const iso = m.date;
            const tone = dateTone(iso, tender.result, anchor);
            const isLast = i === milestones.length - 1;
            return (
              <div key={m.key} className={styles.timelineRow}>
                <div className={styles.timelineRail}>
                  <div className={styles.timelineDot} style={{ background: DOT_COLOR[tone] }} />
                  {!isLast && <div className={styles.timelineLine} />}
                </div>
                <div className={styles.timelineBody}>
                  <div className={styles.timelineLabel}>{m.label}</div>
                  <div className={styles.timelineDate} style={{ color: DATE_COLOR[tone] }}>
                    {iso ? formatDateID(iso) : "Not yet set"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className={`${shared.card} ${styles.panel}`}>
            <h2 className={styles.remarksTitle}>Remarks</h2>
            {tender.carryOver && <div className={styles.carryOverBadge}>{tender.carryOver}</div>}
            <div className={styles.remarksText}>{tender.remarks || "No notes yet."}</div>
            {tender.remark && (
              <>
                <div className={styles.factLabel} style={{ marginTop: 14 }}>
                  Remark
                </div>
                <div className={styles.remarksText} style={{ minHeight: 0 }}>
                  {tender.remark}
                </div>
              </>
            )}
          </div>

          <div className={`${shared.card} ${styles.panel}`}>
            <h2 className={styles.remarksTitle}>Documents</h2>
            <DocumentChecklist tenderId={tender.id} documents={documents} isAdmin={isAdmin} />

            {/* Two trees in one panel: one section per checklist item, one per
                milestone. Assembled from a single flat read — see
                src/lib/folders.ts. */}
            <div style={{ marginTop: 14 }}>
              <DocumentExplorer tenderId={tender.id} sections={documentSections} isAdmin={isAdmin} />
            </div>
          </div>

          {isAdmin && tender.catatanInternal && (
            <div className={`${shared.card} ${styles.panel}`}>
              <h2 className={styles.remarksTitle}>
                Internal Notes <span className={styles.factNote}>(admin only)</span>
              </h2>
              <div className={styles.remarksText} style={{ minHeight: 0 }}>
                {tender.catatanInternal}
              </div>
            </div>
          )}

          {isAdmin && (
            <div className={styles.auditFooter}>
              {tender.createdByName && <div>Added by {tender.createdByName}</div>}
              {tender.updatedByName && (
                <div>
                  Last updated by {tender.updatedByName} on {formatDateID(tender.updatedAt.slice(0, 10))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
