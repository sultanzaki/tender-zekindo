import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenderById } from "@/lib/tenders";
import { MILESTONE_DEFS } from "@/lib/types";
import { dateTone, formatDateID, formatRupiah, todayISO } from "@/lib/tender-logic";
import { ResultBadge } from "@/components/ResultBadge";
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
  const { id } = await params;
  const tender = await getTenderById(id);
  if (!tender) notFound();

  const anchor = todayISO();

  return (
    <div className={styles.page}>
      <Link href="/tenders" className={styles.backLink}>
        &larr; Kembali ke tabel
      </Link>

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
          <ResultBadge result={tender.result} />
        </div>
        <div className={styles.factGrid}>
          <div>
            <div className={styles.factLabel}>Entitas / Konsorsium</div>
            <div className={styles.factValue}>{tender.entitas || "—"}</div>
          </div>
          <div>
            <div className={styles.factLabel}>Qty</div>
            <div className={styles.factValue}>{tender.qty ?? "—"}</div>
          </div>
          <div>
            <div className={styles.factLabel}>OE (Rp)</div>
            <div className={styles.factValue}>{formatRupiah(tender.oe)}</div>
          </div>
          <div>
            <div className={styles.factLabel}>Nilai Penawaran Kita</div>
            <div className={styles.factValue}>{formatRupiah(tender.nilaiPenawaran)}</div>
          </div>
        </div>
      </div>

      <div className={styles.grid2}>
        <div className={`${shared.card} ${styles.panel}`}>
          <h2 className={styles.panelTitle}>Timeline Milestone</h2>
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
                    {iso ? formatDateID(iso) : "Belum ditentukan"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className={`${shared.card} ${styles.panel}`}>
          <h2 className={styles.remarksTitle}>Remarks</h2>
          {tender.carryOver && <div className={styles.carryOverBadge}>{tender.carryOver}</div>}
          <div className={styles.remarksText}>{tender.remarks || "Belum ada catatan."}</div>
        </div>
      </div>
    </div>
  );
}
