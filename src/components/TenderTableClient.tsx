"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_FILTERS,
  DEFAULT_VISIBLE_COLUMNS,
  MILESTONE_DEFS,
  MILESTONE_TABLE_HEADERS,
  RESULT_ENUM,
  TOGGLEABLE_COLUMNS,
  type FilterOptions,
  type Tender,
  type TenderFilters,
  type VisibleColumns,
} from "@/lib/types";
import { dateTone, filterTenders, formatDateID, formatRupiah } from "@/lib/tender-logic";
import { ResultBadge } from "./ResultBadge";
import shared from "./shared.module.css";
import styles from "./TenderTable.module.css";

const DATE_TONE_CLASS = {
  empty: styles.dateEmpty,
  past: styles.datePast,
  urgent: styles.dateUrgent,
  soon: styles.dateSoon,
  normal: styles.dateNormal,
};

function DateCell({ iso, result, anchor }: { iso: string | null; result: string | null; anchor: string }) {
  const tone = dateTone(iso, result, anchor);
  return (
    <td className={`${styles.dateCell} ${DATE_TONE_CLASS[tone]}`}>
      {iso ? formatDateID(iso) : "—"}
    </td>
  );
}

const isMilestoneToggleable = (key: string) => TOGGLEABLE_COLUMNS.some((c) => c.key === key);

export function TenderTableClient({
  tenders,
  options,
  anchor,
}: {
  tenders: Tender[];
  options: FilterOptions;
  anchor: string;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<TenderFilters>(DEFAULT_FILTERS);
  const [visibleCols, setVisibleCols] = useState<VisibleColumns>(DEFAULT_VISIBLE_COLUMNS);
  const [showColMenu, setShowColMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showColMenu) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowColMenu(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [showColMenu]);

  const filtered = useMemo(() => filterTenders(tenders, filters), [tenders, filters]);

  const visibleMilestones = MILESTONE_DEFS.filter(
    (d) => !isMilestoneToggleable(d.key) || visibleCols[d.key]
  );

  return (
    <div className={styles.wrap}>
      <div className={shared.card} style={{ overflow: "visible" }}>
        <div className={styles.toolbar}>
          <input
            className={styles.search}
            placeholder="Cari no. tender atau nama paket..."
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
          <select
            className={styles.select}
            value={filters.period}
            onChange={(e) => setFilters((f) => ({ ...f, period: e.target.value }))}
          >
            <option value="all">Semua Periode</option>
            {options.periods.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            value={filters.area}
            onChange={(e) => setFilters((f) => ({ ...f, area: e.target.value }))}
          >
            <option value="all">Semua Area</option>
            {options.areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            value={filters.entitas}
            onChange={(e) => setFilters((f) => ({ ...f, entitas: e.target.value }))}
          >
            <option value="all">Semua Entitas</option>
            {options.entitasList.map((en) => (
              <option key={en} value={en}>
                {en}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            value={filters.customer}
            onChange={(e) => setFilters((f) => ({ ...f, customer: e.target.value }))}
          >
            <option value="all">Semua Customer</option>
            {options.customers.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            value={filters.result}
            onChange={(e) => setFilters((f) => ({ ...f, result: e.target.value }))}
          >
            <option value="all">Semua Result</option>
            <option value="__EMPTY__">(Berjalan / kosong)</option>
            {RESULT_ENUM.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <div className={styles.colMenuWrap} ref={menuRef}>
            <button className={styles.colMenuButton} onClick={() => setShowColMenu((v) => !v)}>
              Kolom
            </button>
            {showColMenu && (
              <div className={styles.colMenu}>
                {TOGGLEABLE_COLUMNS.map((c) => (
                  <label key={c.key} className={styles.colMenuItem}>
                    <input
                      type="checkbox"
                      checked={visibleCols[c.key]}
                      onChange={() => setVisibleCols((v) => ({ ...v, [c.key]: !v[c.key] }))}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          <button className={styles.resetButton} onClick={() => setFilters(DEFAULT_FILTERS)}>
            Reset filter
          </button>
          <span className={styles.resultCount}>
            {filtered.length} dari {tenders.length} tender
          </span>
        </div>

        {filtered.length > 0 ? (
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.theadRow}>
                  <th className={styles.th} style={{ width: 44 }}>
                    No
                  </th>
                  <th className={styles.th}>Area</th>
                  <th className={styles.th}>No. Tender</th>
                  <th className={styles.th} style={{ minWidth: 200 }}>
                    Customer
                  </th>
                  <th className={styles.th} style={{ minWidth: 280 }}>
                    Paket
                  </th>
                  <th className={styles.th}>Entitas</th>
                  {visibleCols.period && <th className={styles.th}>Periode</th>}
                  {visibleCols.oe && (
                    <th className={`${styles.th} ${styles.thRight}`}>OE (Rp)</th>
                  )}
                  {visibleCols.qty && (
                    <th className={`${styles.th} ${styles.thRight}`}>Qty</th>
                  )}
                  <th className={`${styles.th} ${styles.thRight}`}>Nilai Penawaran</th>
                  {visibleMilestones.map((d) => (
                    <th key={d.key} className={styles.th}>
                      {MILESTONE_TABLE_HEADERS[d.key]}
                    </th>
                  ))}
                  <th className={styles.th}>Result</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr
                    key={t.id}
                    className={styles.bodyRow}
                    onClick={() => router.push(`/tenders/${t.id}`)}
                  >
                    <td className={`${styles.td} ${styles.tdMuted}`}>{t.rowNo}</td>
                    <td className={styles.td}>{t.area}</td>
                    <td className={`${styles.td} ${styles.tdNoWrap}`} style={{ color: "var(--color-fg2)" }}>
                      {t.tenderNo || "—"}
                    </td>
                    <td className={`${styles.td} ${styles.tdEllipsis}`} style={{ maxWidth: 220 }} title={t.customer}>
                      {t.customer || "—"}
                    </td>
                    <td className={`${styles.td} ${styles.tdEllipsis}`} style={{ maxWidth: 340 }} title={t.product ?? undefined}>
                      {t.product || "—"}
                    </td>
                    <td className={`${styles.td} ${styles.tdNoWrap}`}>{t.entitas || "—"}</td>
                    {visibleCols.period && <td className={styles.td}>{t.period}</td>}
                    {visibleCols.oe && (
                      <td className={`${styles.td} ${styles.tdRight}`}>{formatRupiah(t.oe)}</td>
                    )}
                    {visibleCols.qty && (
                      <td className={`${styles.td} ${styles.tdRight}`}>{t.qty ?? "—"}</td>
                    )}
                    <td className={`${styles.td} ${styles.tdRight}`}>{formatRupiah(t.nilaiPenawaran)}</td>
                    {visibleMilestones.map((d) => (
                      <DateCell key={d.key} iso={t.milestones[d.key]} result={t.result} anchor={anchor} />
                    ))}
                    <td className={`${styles.td} ${styles.tdNoWrap}`}>
                      <ResultBadge result={t.result} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyBox}>
            <div className={styles.emptyText}>Tidak ada tender yang cocok dengan filter ini.</div>
            <button className={styles.emptyReset} onClick={() => setFilters(DEFAULT_FILTERS)}>
              Reset filter
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
