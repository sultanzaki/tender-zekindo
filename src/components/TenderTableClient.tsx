"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { PageHeading } from "./PageHeading";
import { MoneyValue, MoneyAccessNotice } from "./MoneyValue";
import { TableViews } from "./TableViews";
import { Modal } from "./Modal";
import { useStoredJSON } from "./useStoredJSON";
import { readTenderFilters, tenderQuery } from "@/lib/table-state";
import { TrackSwitch } from "./TrackSwitch";
import { useRouter } from "next/navigation";
import {
  bulkArchiveTenders,
  quickUpdateMilestone,
  quickUpdateResult,
} from "@/lib/actions";
import {
  DEFAULT_FILTERS,
  RESULT_ENUM,
  type FilterOptions,
  type MilestoneType,
  type Tender,
  type TenderFilters,
  type Track,
  TRACK_LABELS,
} from "@/lib/types";
import { TrackBadge } from "./TrackBadge";
import {
  dateTone,
  filterTenders,
  formatDateID,
  sortTenders,
  type SortDirection,
  type SortKey,
} from "@/lib/tender-logic";
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

/** Non-milestone columns that the Columns menu can toggle. */
const FIELD_TOGGLES: { key: string; label: string }[] = [
  { key: "track", label: "Track" },
  { key: "period", label: "Period" },
  { key: "oe", label: "OE (Rp)" },
  { key: "qty", label: "Qty" },
  { key: "pnl", label: "P&L" },
];

const FIELD_TOGGLE_DEFAULTS: Record<string, boolean> = {
  // Visible by default: "which kind of tender is this" is not an optional extra,
  // it changes which milestones the row has at all.
  track: true,
  period: false,
  oe: false,
  qty: false,
  pnl: false,
};

/** Milestone labels are admin-authored and can be long ("Chemical Sample
 * Received at Lab Test"), which would blow up this deliberately dense table.
 * The full label stays available via the header's title attribute. */
const HEADER_MAX = 16;
function shortHeader(label: string): string {
  return label.length > HEADER_MAX
    ? label.slice(0, HEADER_MAX - 1).trimEnd() + "…"
    : label;
}

const PAGE_SIZES = [25, 50, 100];

interface EditingCell {
  tenderId: string;
  column: string; // "result", or a milestone key
}

function SortIndicator({
  active,
  direction,
}: {
  active: boolean;
  direction: SortDirection;
}) {
  if (!active) return null;
  return (
    <span className={styles.sortArrow}>{direction === "asc" ? "▲" : "▼"}</span>
  );
}

export function TenderTableClient({
  tenders,
  options,
  milestoneTypes,
  anchor,
  isAdmin,
  canViewMoney = false,
  track,
  initialFilters = DEFAULT_FILTERS,
}: {
  tenders: Tender[];
  options: FilterOptions;
  milestoneTypes: MilestoneType[];
  anchor: string;
  isAdmin: boolean;
  canViewMoney?: boolean;
  /** The track being shown. Carried into the export link so exporting cannot
   * silently dump the other track's tenders into the spreadsheet. */
  track: Track | "all";
  initialFilters?: TenderFilters;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<TenderFilters>(initialFilters);
  // Keyed by column key rather than a fixed union: milestone keys are data now,
  // so an admin-added milestone needs a visibility slot without a code change.
  // The starting state comes from `milestone_types.show_in_table`.
  const defaultCols = useMemo(() => {
    const initial: Record<string, boolean> = { ...FIELD_TOGGLE_DEFAULTS };
    for (const m of milestoneTypes) initial[m.key] = m.showInTable;
    return initial;
  }, [milestoneTypes]);
  const [storedCols, saveCols] = useStoredJSON(
    `zekindo-columns:${track}`,
    defaultCols,
  );
  const visibleCols: Record<string, boolean> = { ...defaultCols };
  if (storedCols && typeof storedCols === "object")
    for (const key of Object.keys(defaultCols))
      if (typeof storedCols[key] === "boolean")
        visibleCols[key] = storedCols[key];
  function setVisibleCols(
    update: (previous: Record<string, boolean>) => Record<string, boolean>,
  ) {
    saveCols(update(visibleCols));
  }
  const [showColMenu, setShowColMenu] = useState(false);
  const [sort, setSort] = useState<{
    key: SortKey;
    direction: SortDirection;
  } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [quickEditError, setQuickEditError] = useState<string | null>(null);
  const [quickEditPending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);
  const columnToggleRef = useRef<HTMLButtonElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!showColMenu) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setShowColMenu(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowColMenu(false);
        columnToggleRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showColMenu]);

  const deferredFilters = useDeferredValue(filters);
  useEffect(() => {
    const timer = setTimeout(() => {
      const query = tenderQuery(filters, track);
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${query ? `?${query}` : ""}`,
      );
    }, 200);
    return () => clearTimeout(timer);
  }, [filters, track]);
  useEffect(() => {
    function restore() {
      setFilters(
        readTenderFilters(new URLSearchParams(window.location.search)),
      );
      setPage(1);
      setSelected(new Set());
    }
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const filtered = useMemo(
    () => filterTenders(tenders, deferredFilters),
    [tenders, deferredFilters],
  );
  const sorted = useMemo(
    () => (sort ? sortTenders(filtered, sort.key, sort.direction) : filtered),
    [filtered, sort],
  );

  // Clamped rather than reset-via-effect: whenever filtering/sorting shrinks
  // the result set below the current page, this naturally lands on the last
  // valid page instead of showing an empty page.
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageItems = useMemo(
    () => sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sorted, safePage, pageSize],
  );

  const visibleMilestones = milestoneTypes.filter((m) => visibleCols[m.key]);

  function changeFilters(update: (previous: TenderFilters) => TenderFilters) {
    setFilters(update);
    setPage(1);
    setSelected(new Set());
  }

  function tenderHref(id: string) {
    return `/tenders/${id}?${new URLSearchParams({ returnTo: `/tenders?${tenderQuery(filters, track)}` })}`;
  }

  function resetFilters() {
    changeFilters(() => DEFAULT_FILTERS);
  }

  // ── Bulk selection ──────────────────────────────────────────────────────
  const pageIds = pageItems.map((t) => t.id);
  const allOnPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));

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

  async function runBulk() {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkBusy(true);
    setBulkMessage(null);
    setQuickEditError(null);
    try {
      const result = await bulkArchiveTenders(ids);
      if (result.error) {
        setQuickEditError(result.error);
        return;
      }
      setSelected(new Set());
      setBulkMessage(
        `${result.count} tender${result.count === 1 ? "" : "s"} archived.`,
      );
      router.refresh();
    } catch {
      setQuickEditError(
        "Could not complete the bulk action. Please try again.",
      );
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
    if (track !== "upstream") params.set("track", track);
    const qs = params.toString();
    return "/tenders/export" + (qs ? `?${qs}` : "");
  }, [filters, track]);

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

  function handleQuickMilestone(tenderId: string, key: string, value: string) {
    setQuickEditError(null);
    startTransition(async () => {
      const result = await quickUpdateMilestone(tenderId, key, value);
      if (result?.error) setQuickEditError(result.error);
    });
  }

  function sortableHeader(
    key: SortKey,
    label: string,
    align: "left" | "right" = "left",
    title?: string,
  ) {
    return (
      <th
        key={key}
        scope="col"
        aria-sort={
          sort?.key === key
            ? sort.direction === "asc"
              ? "ascending"
              : "descending"
            : "none"
        }
        className={`${styles.th} ${key === "tenderNo" ? styles.stickyIdentity : ""} ${align === "right" ? styles.thRight : ""} ${styles.thSortable}`}
        title={title}
      >
        <button
          type="button"
          className={styles.sortButton}
          disabled={!canViewMoney && (key === "oe" || key === "nilaiPenawaran")}
          onClick={() => toggleSort(key)}
        >
          {label}
          <SortIndicator
            active={sort?.key === key}
            direction={sort?.direction ?? "asc"}
          />
        </button>
      </th>
    );
  }

  return (
    <div className={styles.wrap}>
      <PageHeading
        eyebrow="TENDER WORKSPACE"
        title="Tenders"
        description="Find opportunities, track progress, and keep the next step moving."
        actions={
          <a href={exportHref} className="button button-primary">
            Export to Excel
          </a>
        }
      />
      {!canViewMoney && (
        <MoneyAccessNotice
          returnTo={`/tenders?${tenderQuery(filters, track)}`}
        />
      )}
      <TrackSwitch
        current={track}
        basePath="/tenders"
        params={Object.fromEntries(
          new URLSearchParams(tenderQuery(filters, track)),
        )}
      />
      <div className={styles.viewBar}>
        <div className={styles.quickViews} aria-label="Quick filters">
          {[
            ["all", "All results"],
            ["__EMPTY__", "Active"],
            ["WIN", "Won"],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={filters.result === value}
              onClick={() => changeFilters((f) => ({ ...f, result: value }))}
            >
              {label}
            </button>
          ))}
        </div>
        <TableViews
          track={track}
          filters={filters}
          onApply={(next) => changeFilters(() => next)}
        />
      </div>
      <div className={shared.card} style={{ overflow: "visible" }}>
        <div className={styles.toolbar}>
          <input
            aria-label="Search tenders"
            type="search"
            className={styles.search}
            placeholder="Search number, package, customer, area…"
            value={filters.search}
            onChange={(e) =>
              changeFilters((f) => ({ ...f, search: e.target.value }))
            }
          />
          <select
            className={styles.select}
            aria-label="Period"
            value={filters.period}
            onChange={(e) =>
              changeFilters((f) => ({ ...f, period: e.target.value }))
            }
          >
            <option value="all">All Periods</option>
            {options.periods.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            aria-label="Area"
            value={filters.area}
            onChange={(e) =>
              changeFilters((f) => ({ ...f, area: e.target.value }))
            }
          >
            <option value="all">All Areas</option>
            {options.areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            aria-label="Entity"
            value={filters.entitas}
            onChange={(e) =>
              changeFilters((f) => ({ ...f, entitas: e.target.value }))
            }
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
            aria-label="Customer"
            value={filters.customer}
            onChange={(e) =>
              changeFilters((f) => ({ ...f, customer: e.target.value }))
            }
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
            aria-label="Result"
            value={filters.result}
            onChange={(e) =>
              changeFilters((f) => ({ ...f, result: e.target.value }))
            }
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
            <button
              ref={columnToggleRef}
              aria-expanded={showColMenu}
              aria-controls="table-columns"
              className={styles.colMenuButton}
              onClick={() => setShowColMenu((v) => !v)}
            >
              Columns
            </button>
            {showColMenu && (
              <div id="table-columns" className={styles.colMenu}>
                {FIELD_TOGGLES.map((c) => (
                  <label key={c.key} className={styles.colMenuItem}>
                    <input
                      type="checkbox"
                      checked={!!visibleCols[c.key]}
                      onChange={() =>
                        setVisibleCols((v) => ({ ...v, [c.key]: !v[c.key] }))
                      }
                    />
                    {c.label}
                  </label>
                ))}
                {milestoneTypes.map((m) => (
                  <label key={m.key} className={styles.colMenuItem}>
                    <input
                      type="checkbox"
                      checked={!!visibleCols[m.key]}
                      onChange={() =>
                        setVisibleCols((v) => ({ ...v, [m.key]: !v[m.key] }))
                      }
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          <button className={styles.resetButton} onClick={resetFilters}>
            Reset filters
          </button>

          {isAdmin && (
            <Link href="/tenders/archive" className={styles.resetButton}>
              Archive
            </Link>
          )}
          <span className={styles.resultCount} role="status">
            {filtered.length} of {tenders.length} tenders
          </span>
        </div>

        {isAdmin && selected.size > 0 && (
          <div className={styles.bulkBar}>
            <span className={styles.bulkCount}>{selected.size} selected</span>
            <button
              className={styles.bulkGhost}
              onClick={() => setSelected(new Set())}
              disabled={bulkBusy}
            >
              Clear
            </button>
            <span className={styles.bulkSpacer} />
            <button
              className={styles.bulkButton}
              onClick={() => setArchiveConfirm(true)}
              disabled={bulkBusy}
            >
              Archive selected
            </button>
          </div>
        )}

        {bulkMessage && (
          <div role="status" className={styles.bulkMessage}>
            {bulkMessage}
          </div>
        )}

        {quickEditError && (
          <div role="alert" className={styles.quickEditError}>
            {quickEditError}
          </div>
        )}

        <div className={styles.mobileCards}>
          {pageItems.map((t) => (
            <Link
              href={tenderHref(t.id)}
              key={t.id}
              className={styles.tenderCard}
            >
              <span className={styles.cardTop}>
                <span>{t.tenderNo || `Tender #${t.rowNo}`}</span>
                <ResultBadge result={t.result} />
              </span>
              <strong>{t.product || t.customer}</strong>
              <span>{t.customer}</span>
              <span className={styles.cardMeta}>
                <TrackBadge track={t.track} />
                {t.area} · {t.period}
              </span>
              <span className={styles.cardMeta}>
                Bid:{" "}
                <MoneyValue value={t.nilaiPenawaran} canView={canViewMoney} />
              </span>
            </Link>
          ))}
        </div>
        {pageItems.length > 0 ? (
          <div
            className={styles.scroll}
            tabIndex={0}
            role="region"
            aria-label="Tender table; scroll horizontally for milestone columns"
          >
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
                  {visibleCols.track && (track as string) === "all" && (
                    <th className={styles.th} title="Upstream or downstream">
                      Track
                    </th>
                  )}
                  {sortableHeader("area", "Area")}
                  {sortableHeader("tenderNo", "Tender No.")}
                  {sortableHeader("customer", "Customer")}
                  {sortableHeader("product", "Package")}
                  {sortableHeader("result", "Result")}
                  {track !== "downstream" &&
                    sortableHeader("entitas", "Entity")}
                  {visibleCols.period && sortableHeader("period", "Period")}
                  {visibleCols.oe && sortableHeader("oe", "OE (Rp)", "right")}
                  {visibleCols.qty && sortableHeader("qty", "Qty", "right")}
                  {sortableHeader("nilaiPenawaran", "Bid Value", "right")}
                  {visibleCols.pnl && sortableHeader("pnl", "P&L")}
                  {visibleMilestones.map((m) =>
                    sortableHeader(
                      m.key,
                      shortHeader(m.label),
                      "left",
                      m.label,
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {pageItems.map((t) => (
                  <tr
                    key={t.id}
                    className={`${styles.bodyRow} ${selected.has(t.id) ? styles.rowSelected : ""}`}
                    onClick={() => router.push(tenderHref(t.id))}
                  >
                    {isAdmin && (
                      <td
                        className={`${styles.td} ${styles.checkboxCol}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={selected.has(t.id)}
                          onChange={() => toggleRow(t.id)}
                          aria-label={`Select tender ${t.tenderNo || t.id}`}
                        />
                      </td>
                    )}
                    <td className={`${styles.td} ${styles.tdMuted}`}>
                      {t.rowNo}
                    </td>
                    {visibleCols.track && (track as string) === "all" && (
                      <td className={`${styles.td} ${styles.tdNoWrap}`}>
                        {t.track === "downstream" ? (
                          <TrackBadge track={t.track} />
                        ) : (
                          <span style={{ color: "var(--color-fg3)" }}>
                            {TRACK_LABELS.upstream}
                          </span>
                        )}
                      </td>
                    )}
                    <td className={styles.td}>{t.area}</td>
                    <td
                      className={`${styles.td} ${styles.tdNoWrap} ${styles.stickyIdentity}`}
                      style={{ color: "var(--color-fg2)" }}
                    >
                      <Link
                        href={tenderHref(t.id)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {t.tenderNo || "View tender"}
                      </Link>
                    </td>
                    <td
                      className={`${styles.td} ${styles.tdEllipsis}`}
                      style={{ maxWidth: 220 }}
                      title={t.customer}
                    >
                      {t.customer || "—"}
                    </td>
                    <td
                      className={`${styles.td} ${styles.tdEllipsis}`}
                      style={{ maxWidth: 340 }}
                      title={t.product ?? undefined}
                    >
                      {t.product || "—"}
                    </td>
                    <td className={`${styles.td} ${styles.tdNoWrap}`}>
                      {isAdmin &&
                      editingCell?.tenderId === t.id &&
                      editingCell.column === "result" ? (
                        <select
                          aria-label={`Edit result for ${t.tenderNo || t.id}`}
                          autoFocus
                          defaultValue={t.result ?? ""}
                          className={styles.inlineSelect}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            handleQuickResult(t.id, e.target.value)
                          }
                          onBlur={() => setEditingCell(null)}
                        >
                          <option value="">(Running)</option>
                          {RESULT_ENUM.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      ) : isAdmin ? (
                        <button
                          type="button"
                          className={styles.cellButton}
                          disabled={quickEditPending}
                          aria-label={`Edit result for ${t.tenderNo || t.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCell({
                              tenderId: t.id,
                              column: "result",
                            });
                          }}
                        >
                          <ResultBadge result={t.result} />
                        </button>
                      ) : (
                        <ResultBadge result={t.result} />
                      )}
                    </td>
                    {track !== "downstream" && (
                      <td className={`${styles.td} ${styles.tdNoWrap}`}>
                        {t.entitas || "—"}
                      </td>
                    )}
                    {visibleCols.period && (
                      <td className={styles.td}>{t.period}</td>
                    )}
                    {visibleCols.oe && (
                      <td className={`${styles.td} ${styles.tdRight}`}>
                        <MoneyValue value={t.oe} canView={canViewMoney} />
                      </td>
                    )}
                    {visibleCols.qty && (
                      <td className={`${styles.td} ${styles.tdRight}`}>
                        {t.qty ?? "—"}
                      </td>
                    )}
                    <td className={`${styles.td} ${styles.tdRight}`}>
                      <MoneyValue
                        value={t.nilaiPenawaran}
                        canView={canViewMoney}
                      />
                    </td>
                    {visibleCols.pnl && (
                      <td className={styles.td}>{t.pnl ? "Yes" : "—"}</td>
                    )}
                    {visibleMilestones.map((m) => {
                      const iso = t.milestones[m.key] ?? null;
                      const tone = dateTone(iso, t.result, anchor);
                      const isEditing =
                        isAdmin &&
                        editingCell?.tenderId === t.id &&
                        editingCell.column === m.key;
                      if (isEditing) {
                        return (
                          <td
                            key={m.key}
                            className={styles.dateCell}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="date"
                              aria-label={`Edit ${m.label} for ${t.tenderNo || t.id}`}
                              autoFocus
                              defaultValue={iso ?? ""}
                              className={styles.inlineDateInput}
                              onChange={(e) =>
                                handleQuickMilestone(
                                  t.id,
                                  m.key,
                                  e.target.value,
                                )
                              }
                              onBlur={() => setEditingCell(null)}
                            />
                          </td>
                        );
                      }
                      return (
                        <td
                          key={m.key}
                          className={`${styles.dateCell} ${DATE_TONE_CLASS[tone]} ${isAdmin ? styles.editableCell : ""}`}
                          title={isAdmin ? `Click to edit ${m.label}` : m.label}
                        >
                          {isAdmin ? (
                            <button
                              type="button"
                              className={styles.cellButton}
                              disabled={quickEditPending}
                              aria-label={`Edit ${m.label} for ${t.tenderNo || t.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingCell({
                                  tenderId: t.id,
                                  column: m.key,
                                });
                              }}
                            >
                              {iso ? formatDateID(iso) : "—"}
                            </button>
                          ) : iso ? (
                            formatDateID(iso)
                          ) : (
                            "—"
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyBox}>
            <div className={styles.emptyText}>
              No tenders match this filter.
            </div>
            <button className={styles.emptyReset} onClick={resetFilters}>
              Reset filters
            </button>
          </div>
        )}

        {sorted.length > 0 && (
          <div className={styles.pagination}>
            <div className={styles.pageSizeGroup}>
              <span>Rows per page</span>
              <select
                aria-label="Rows per page"
                className={styles.select}
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
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
                onClick={() => setPage(Math.max(1, safePage - 1))}
              >
                Previous
              </button>
              <span className={styles.pageLabel}>
                Page {safePage} of {pageCount}
              </span>
              <button
                className={styles.pageButton}
                disabled={safePage >= pageCount}
                onClick={() => setPage(Math.min(pageCount, safePage + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      <Modal
        open={archiveConfirm}
        title={`Archive ${selected.size} selected tenders?`}
        onClose={() => {
          if (!bulkBusy) setArchiveConfirm(false);
        }}
      >
        <p className="muted">
          They will leave active lists and analytics. You can restore them from
          Archive at any time.
        </p>
        <div className="dialog-actions">
          <button
            className="button button-secondary"
            onClick={() => setArchiveConfirm(false)}
            disabled={bulkBusy}
          >
            Cancel
          </button>
          <button
            className="button button-primary"
            disabled={bulkBusy}
            onClick={() => {
              setArchiveConfirm(false);
              void runBulk();
            }}
          >
            Confirm archive
          </button>
        </div>
      </Modal>
    </div>
  );
}
