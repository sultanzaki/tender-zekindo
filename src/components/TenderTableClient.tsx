"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { bulkArchiveTenders, bulkDeleteTenders, quickUpdateMilestone, quickUpdateResult } from "@/lib/actions";
import {
  DEFAULT_FILTERS,
  DEFAULT_VISIBLE_COLUMNS,
  MILESTONE_DEFS,
  MILESTONE_TABLE_HEADERS,
  RESULT_ENUM,
  TOGGLEABLE_COLUMNS,
  type FilterOptions,
  type MilestoneKey,
  type Tender,
  type TenderFilters,
  type VisibleColumns,
} from "@/lib/types";
import { dateTone, filterTenders, formatDateID, formatRupiah, sortTenders, type SortDirection, type SortKey } from "@/lib/tender-logic";
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

const isMilestoneToggleable = (key: string) => TOGGLEABLE_COLUMNS.some((c) => c.key === key);

const PAGE_SIZES = [25, 50, 100];

interface EditingCell {
  tenderId: string;
  column: "result" | MilestoneKey;
}

function SortIndicator({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active) return null;
  return <span className={styles.sortArrow}>{direction === "asc" ? "▲" : "▼"}</span>;
}

export function TenderTableClient({
  tenders,
  options,
  anchor,
  isAdmin,
}: {
  tenders: Tender[];
  options: FilterOptions;
  anchor: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<TenderFilters>(DEFAULT_FILTERS);
  const [visibleCols, setVisibleCols] = useState<VisibleColumns>(DEFAULT_VISIBLE_COLUMNS);
  const [showColMenu, setShowColMenu] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [quickEditError, setQuickEditError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!showColMenu) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowColMenu(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [showColMenu]);

  const filtered = useMemo(() => filterTenders(tenders, filters), [tenders, filters]);
  const sorted = useMemo(
    () => (sort ? sortTenders(filtered, sort.key, sort.direction) : filtered),
    [filtered, sort]
  );

  // Clamped rather than reset-via-effect: whenever filtering/sorting shrinks
  // the result set below the current page, this naturally lands on the last
  // valid page instead of showing an empty page.
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageItems = useMemo(
    () => sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sorted, safePage, pageSize]
  );

  const visibleMilestones = MILESTONE_DEFS.filter((d) => !isMilestoneToggleable(d.key) || visibleCols[d.key]);

  // ── Bulk selection ──────────────────────────────────────────────────────
  const pageIds = pageItems.map((t) => t.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function runBulk(action: "archive" | "delete") {
    const ids = [...selected];
    if (!ids.length) return;

    if (action === "archive") {
      if (
        !confirm(
          `Archive ${ids.length} tender${ids.length === 1 ? "" : "s"}?\n\nThey'll disappear from the dashboard and table, and can be restored from /tenders/archive.`
        )
      ) {
        return;
      }
    } else {
      const typed = prompt(
        `Permanently delete ${ids.length} tender${ids.length === 1 ? "" : "s"}?\n\nThis removes the rows AND their uploaded documents. It cannot be undone.\n\nType DELETE to confirm:`
      );
      if (typed !== "DELETE") return;
    }

    setBulkBusy(true);
    setBulkMessage(null);
    try {
      const result = action === "archive" ? await bulkArchiveTenders(ids) : await bulkDeleteTenders(ids);
      if (result.error) {
        setBulkMessage(result.error);
        return;
      }
      setSelected(new Set());
      setBulkMessage(`${result.count} tender${result.count === 1 ? "" : "s"} ${action === "archive" ? "archived" : "deleted"}.`);
      router.refresh();
    } finally {
      setBulkBusy(false);
    }
  }

  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.period !== "all") params.set("period", filters.period);
    if (filters.area !== "all") params.set("area", filters.area);
    if (filters.entitas !== "all") params.set("entitas", filters.entitas);
    if (filters.customer !== "all") params.set("customer", filters.customer);
    if (filters.result !== "all") params.set("result", filters.result);
    if (filters.search) params.set("search", filters.search);
    const qs = params.toString();
    return "/tenders/export" + (qs ? `?${qs}` : "");
  }, [filters]);

  function toggleSort(key: SortKey) {
    setSort((s) => {
      if (!s || s.key !== key) return { key, direction: "asc" };
      if (s.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  }

  function handleQuickResult(tenderId: string, result: string) {
    setEditingCell(null);
    setQuickEditError(null);
    startTransition(async () => {
      const result_ = await quickUpdateResult(tenderId, result);
      if (result_?.error) setQuickEditError(result_.error);
    });
  }

  function handleQuickMilestone(tenderId: string, key: MilestoneKey, value: string) {
    setQuickEditError(null);
    startTransition(async () => {
      const result = await quickUpdateMilestone(tenderId, key, value);
      if (result?.error) setQuickEditError(result.error);
    });
  }

  function sortableHeader(key: SortKey, label: string, align: "left" | "right" = "left") {
    return (
      <th
        className={`${styles.th} ${align === "right" ? styles.thRight : ""} ${styles.thSortable}`}
        onClick={() => toggleSort(key)}
      >
        {label}
        <SortIndicator active={sort?.key === key} direction={sort?.direction ?? "asc"} />
      </th>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={shared.card} style={{ overflow: "visible" }}>
        <div className={styles.toolbar}>
          <input
            className={styles.search}
            placeholder="Search tender number or package title..."
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
          <select
            className={styles.select}
            value={filters.period}
            onChange={(e) => setFilters((f) => ({ ...f, period: e.target.value }))}
          >
            <option value="all">All Periods</option>
            {options.periods.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select className={styles.select} value={filters.area} onChange={(e) => setFilters((f) => ({ ...f, area: e.target.value }))}>
            <option value="all">All Areas</option>
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
            <option value="all">All Entities</option>
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
            <option value="all">All Customers</option>
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
            <option value="all">All Results</option>
            <option value="__EMPTY__">(Running / no result)</option>
            {RESULT_ENUM.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <div className={styles.colMenuWrap} ref={menuRef}>
            <button className={styles.colMenuButton} onClick={() => setShowColMenu((v) => !v)}>
              Columns
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
            Reset filters
          </button>
          <a href={exportHref} className={styles.resetButton}>
            Export to Excel
          </a>
          {isAdmin && (
            <Link href="/tenders/archive" className={styles.resetButton}>
              Archive
            </Link>
          )}
          <span className={styles.resultCount}>
            {filtered.length} of {tenders.length} tenders
          </span>
        </div>

        {isAdmin && selected.size > 0 && (
          <div className={styles.bulkBar}>
            <span className={styles.bulkCount}>{selected.size} selected</span>
            <button className={styles.bulkGhost} onClick={() => setSelected(new Set())} disabled={bulkBusy}>
              Clear
            </button>
            <span className={styles.bulkSpacer} />
            <button className={styles.bulkButton} onClick={() => runBulk("archive")} disabled={bulkBusy}>
              Archive selected
            </button>
            <button className={styles.bulkDanger} onClick={() => runBulk("delete")} disabled={bulkBusy}>
              Delete permanently
            </button>
          </div>
        )}

        {bulkMessage && <div className={styles.bulkMessage}>{bulkMessage}</div>}

        {quickEditError && <div className={styles.quickEditError}>{quickEditError}</div>}

        {pageItems.length > 0 ? (
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.theadRow}>
                  {isAdmin && (
                    <th className={`${styles.th} ${styles.checkboxCol}`}>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={allOnPageSelected}
                        onChange={toggleAllOnPage}
                        title="Select every row on this page"
                        aria-label="Select every row on this page"
                      />
                    </th>
                  )}
                  {sortableHeader("rowNo", "No")}
                  {sortableHeader("area", "Area")}
                  {sortableHeader("tenderNo", "Tender No.")}
                  {sortableHeader("customer", "Customer")}
                  {sortableHeader("product", "Package")}
                  {sortableHeader("entitas", "Entity")}
                  {visibleCols.period && sortableHeader("period", "Period")}
                  {visibleCols.oe && sortableHeader("oe", "OE (Rp)", "right")}
                  {visibleCols.qty && sortableHeader("qty", "Qty", "right")}
                  {sortableHeader("nilaiPenawaran", "Bid Value", "right")}
                  {visibleCols.pnl && sortableHeader("pnl", "P&L")}
                  {visibleMilestones.map((d) => sortableHeader(d.key, MILESTONE_TABLE_HEADERS[d.key]))}
                  {sortableHeader("result", "Result")}
                </tr>
              </thead>
              <tbody>
                {pageItems.map((t) => (
                  <tr
                    key={t.id}
                    className={`${styles.bodyRow} ${selected.has(t.id) ? styles.rowSelected : ""}`}
                    onClick={() => router.push(`/tenders/${t.id}`)}
                  >
                    {isAdmin && (
                      <td className={`${styles.td} ${styles.checkboxCol}`} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={selected.has(t.id)}
                          onChange={() => toggleRow(t.id)}
                          aria-label={`Select tender ${t.tenderNo || t.id}`}
                        />
                      </td>
                    )}
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
                    {visibleCols.oe && <td className={`${styles.td} ${styles.tdRight}`}>{formatRupiah(t.oe)}</td>}
                    {visibleCols.qty && <td className={`${styles.td} ${styles.tdRight}`}>{t.qty ?? "—"}</td>}
                    <td className={`${styles.td} ${styles.tdRight}`}>{formatRupiah(t.nilaiPenawaran)}</td>
                    {visibleCols.pnl && <td className={styles.td}>{t.pnl ? "Yes" : "—"}</td>}
                    {visibleMilestones.map((d) => {
                      const iso = t.milestones[d.key];
                      const tone = dateTone(iso, t.result, anchor);
                      const isEditing =
                        isAdmin && editingCell?.tenderId === t.id && editingCell.column === d.key;
                      if (isEditing) {
                        return (
                          <td key={d.key} className={styles.dateCell} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="date"
                              autoFocus
                              defaultValue={iso ?? ""}
                              className={styles.inlineDateInput}
                              onChange={(e) => handleQuickMilestone(t.id, d.key, e.target.value)}
                              onBlur={() => setEditingCell(null)}
                            />
                          </td>
                        );
                      }
                      return (
                        <td
                          key={d.key}
                          className={`${styles.dateCell} ${DATE_TONE_CLASS[tone]} ${isAdmin ? styles.editableCell : ""}`}
                          onClick={
                            isAdmin
                              ? (e) => {
                                  e.stopPropagation();
                                  setEditingCell({ tenderId: t.id, column: d.key });
                                }
                              : undefined
                          }
                          title={isAdmin ? "Click to edit" : undefined}
                        >
                          {iso ? formatDateID(iso) : "—"}
                        </td>
                      );
                    })}
                    <td className={`${styles.td} ${styles.tdNoWrap}`}>
                      {isAdmin && editingCell?.tenderId === t.id && editingCell.column === "result" ? (
                        <select
                          autoFocus
                          defaultValue={t.result ?? ""}
                          className={styles.inlineSelect}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleQuickResult(t.id, e.target.value)}
                          onBlur={() => setEditingCell(null)}
                        >
                          <option value="">(Running)</option>
                          {RESULT_ENUM.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          onClick={
                            isAdmin
                              ? (e) => {
                                  e.stopPropagation();
                                  setEditingCell({ tenderId: t.id, column: "result" });
                                }
                              : undefined
                          }
                          style={isAdmin ? { cursor: "pointer" } : undefined}
                          title={isAdmin ? "Click to edit" : undefined}
                        >
                          <ResultBadge result={t.result} />
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyBox}>
            <div className={styles.emptyText}>No tenders match this filter.</div>
            <button className={styles.emptyReset} onClick={() => setFilters(DEFAULT_FILTERS)}>
              Reset filters
            </button>
          </div>
        )}

        {sorted.length > 0 && (
          <div className={styles.pagination}>
            <div className={styles.pageSizeGroup}>
              <span>Rows per page</span>
              <select
                className={styles.select}
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.pageNav}>
              <button
                className={styles.pageButton}
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span className={styles.pageLabel}>
                Page {safePage} of {pageCount}
              </span>
              <button
                className={styles.pageButton}
                disabled={safePage >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
