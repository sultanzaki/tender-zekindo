import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { restoreTenderForm } from "@/lib/actions";
import { getTenderById } from "@/lib/tenders";
import { getTenderDocuments } from "@/lib/documents";
import { MILESTONE_DEFS } from "@/lib/types";
import { dateTone, formatDateID, formatRupiah, todayISO } from "@/lib/tender-logic";
import { ResultBadge } from "@/components/ResultBadge";
import { DocumentChecklist } from "@/components/DocumentChecklist";
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
  const documents = await getTenderDocuments(tender.id);

  const anchor = todayISO();

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
          {MILESTONE_DEFS.map((d, i) => {
            const iso = tender.milestones[d.key];
            const tone = dateTone(iso, tender.result, anchor);
            const isLast = i === MILESTONE_DEFS.length - 1;
            return (
              <div key={d.key} className={styles.timelineRow}>
                <div className={styles.timelineRail}>
                  <div className={styles.timelineDot} style={{ background: DOT_COLOR[tone] }} />
                  {!isLast && <div className={styles.timelineLine} />}
                </div>
                <div className={styles.timelineBody}>
                  <div className={styles.timelineLabel}>{d.label}</div>
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
