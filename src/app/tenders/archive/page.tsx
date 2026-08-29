import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { deleteTenderPermanentlyForm, restoreTenderForm } from "@/lib/actions";
import { getArchivedTenders } from "@/lib/tenders";
import { formatDateID } from "@/lib/tender-logic";
import { ConfirmButton } from "@/components/ConfirmButton";
import shared from "@/components/shared.module.css";
import tableStyles from "@/components/TenderTable.module.css";
import styles from "@/components/ArchivedTable.module.css";

export const dynamic = "force-dynamic";

export default async function ArchivedTendersPage() {
  await requireAdmin();
  const tenders = await getArchivedTenders();

  return (
    <div style={{ padding: "24px 32px" }}>
      <Link href="/tenders" className={shared.cardMeta} style={{ display: "inline-block", marginBottom: 16 }}>
        &larr; Back to table
      </Link>
      <div className={shared.card}>
        <div className={shared.cardHeader}>
          <h2 className={shared.cardTitle}>Archived tenders</h2>
          <span className={shared.cardMeta}>{tenders.length} archived</span>
        </div>
        {tenders.length > 0 ? (
          <div className={tableStyles.scroll}>
            <table className={tableStyles.table}>
              <thead>
                <tr className={tableStyles.theadRow}>
                  <th className={tableStyles.th}>Area</th>
                  <th className={tableStyles.th}>Tender No.</th>
                  <th className={tableStyles.th}>Customer</th>
                  <th className={tableStyles.th}>Package</th>
                  <th className={tableStyles.th}>Archived</th>
                  <th className={tableStyles.th}></th>
                </tr>
              </thead>
              <tbody>
                {tenders.map((t) => (
                  <tr key={t.id} className={tableStyles.bodyRow} style={{ cursor: "default" }}>
                    <td className={tableStyles.td}>{t.area}</td>
                    <td className={`${tableStyles.td} ${tableStyles.tdNoWrap}`}>{t.tenderNo || "—"}</td>
                    <td className={`${tableStyles.td} ${tableStyles.tdEllipsis}`} style={{ maxWidth: 200 }} title={t.customer}>
                      <Link href={`/tenders/${t.id}`}>{t.customer}</Link>
                    </td>
                    <td className={`${tableStyles.td} ${tableStyles.tdEllipsis}`} style={{ maxWidth: 320 }} title={t.product ?? undefined}>
                      {t.product || "—"}
                    </td>
                    <td className={`${tableStyles.td} ${tableStyles.tdNoWrap}`}>
                      {t.archivedAt ? formatDateID(t.archivedAt.slice(0, 10)) : "—"}
                    </td>
                    <td className={`${tableStyles.td} ${tableStyles.tdNoWrap}`} style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 12 }}>
                        <form action={restoreTenderForm.bind(null, t.id)}>
                          <button type="submit" className={styles.restoreButton}>
                            Restore
                          </button>
                        </form>
                        <form action={deleteTenderPermanentlyForm.bind(null, t.id)}>
                          <ConfirmButton
                            confirmText="Permanently delete this tender? This cannot be undone."
                            className={styles.deleteButton}
                          >
                            Delete
                          </ConfirmButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={tableStyles.emptyBox}>
            <div className={tableStyles.emptyText}>No archived tenders.</div>
          </div>
        )}
      </div>
    </div>
  );
}
