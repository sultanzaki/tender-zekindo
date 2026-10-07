import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { supabaseServer } from "./supabase-server";
import type { TenderRow } from "./database.types";
import type { FilterOptions, SelectOptionsMap, Tender, Track } from "./types";
import { distinctSorted, periodsSorted } from "./tender-logic";
import { getProfilesByIds } from "./users";
import { rowTrack } from "./milestones";
import { TENDERS_TAG } from "./cache-tags";

// PostgREST (Supabase's REST layer) serializes `numeric` columns as JSON
// strings, not numbers, to avoid precision loss — so despite the DB column
// type, these can arrive as "30644000000" rather than 30644000000. Coerce
// once here so the rest of the app can rely on Tender's numeric fields
// actually being numbers (sorting, sums for analytics, etc.).
function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function mapRow(row: TenderRow, names: Map<string, string>): Tender {
  return {
    id: row.id,
    rowNo: row.row_no,
    track: rowTrack(row.track),
    period: row.period,
    area: row.area,
    tenderNo: row.tender_no,
    customer: row.customer,
    product: row.product,
    entitas: row.entitas,
    qty: toNumber(row.qty),
    oe: toNumber(row.oe),
    oeCatatan: row.oe_catatan,
    idrPerL: toNumber(row.idr_per_l),
    milestones: row.milestones,
    milestoneOrder: row.milestone_order,
    result: row.result,
    carryOver: row.carry_over,
    remarks: row.remarks,
    remark: row.remark,
    pnl: row.pnl,
    catatanInternal: row.catatan_internal,
    nilaiPenawaran: toNumber(row.nilai_penawaran),
    archivedAt: row.archived_at,
    createdBy: row.created_by,
    createdByName: row.created_by ? (names.get(row.created_by) ?? null) : null,
    updatedBy: row.updated_by,
    updatedByName: row.updated_by ? (names.get(row.updated_by) ?? null) : null,
    updatedAt: row.updated_at,
  };
}

async function withNames(rows: TenderRow[]): Promise<Tender[]> {
  const ids = rows.flatMap((r) => [r.created_by, r.updated_by].filter((v): v is string => !!v));
  const profiles = await getProfilesByIds(ids);
  const names = new Map<string, string>();
  profiles.forEach((p, id) => names.set(id, p.name));
  return rows.map((r) => mapRow(r, names));
}

// The full tender list is read by the dashboard, /tenders, /analytics and the
// nav badge path. It was re-fetched from Supabase (two cross-continent round
// trips: the rows, then the profile names) on every one of those renders.
//
// `unstable_cache` keeps the result across requests and is invalidated by
// `revalidateTag(TENDERS_TAG)` from every mutation in actions.ts /
// document-actions.ts, so the app is never more than one write behind. The 30s
// `revalidate` is a backstop for any write that bypasses those Server Actions
// (e.g. SQL pasted straight into the Supabase editor).
const getTendersCached = unstable_cache(
  async (includeArchived: boolean, track: Track | "all"): Promise<Tender[]> => {
    let query = supabaseServer().from("tenders").select("*").order("row_no", { ascending: true });
    if (!includeArchived) query = query.is("archived_at", null);
    // "all" is what the screens that span both tracks ask for: /notifications,
    // the nav badge path and the analytics "both" option.
    if (track !== "all") query = query.eq("track", track);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to load tenders: ${error.message}`);
    return withNames(data ?? []);
  },
  ["tenders:list"],
  { tags: [TENDERS_TAG], revalidate: 30 },
);

// `cache()` on top so several components in one render share a single lookup.
export const getAllTenders = cache(
  async (options?: { includeArchived?: boolean; track?: Track | "all" }): Promise<Tender[]> =>
    getTendersCached(Boolean(options?.includeArchived), options?.track ?? "all"),
);

export interface NotificationCounts {
  /** Milestones due within 3 days — the reminder an admin acts on. */
  dueH3: number;
  /** Milestones due within 14 days, for planning ahead. */
  dueSoon: number;
  /** Active tenders with nothing scheduled ahead at all. */
  stalled: number;
}

/**
 * The numbers behind the nav bell, counted in Postgres rather than by pulling
 * every tender across the wire — see
 * supabase/migrations/0008_milestone_reminders.sql for the equivalence with
 * computeDeadlines()/computeStalled(), including the per-tender
 * `milestone_order` override.
 *
 * Deliberately NOT wrapped in unstable_cache: after this it is a single cheap
 * round trip, and skipping the cache keeps the badge exact rather than
 * up-to-30s stale.
 */
export async function getNotificationCounts(): Promise<NotificationCounts> {
  const { data, error } = await supabaseServer().rpc("notification_counts");
  if (error) throw new Error(`Failed to load notification counts: ${error.message}`);
  const row = data?.[0];
  return {
    dueH3: row?.due_h3 ?? 0,
    dueSoon: row?.due_soon ?? 0,
    stalled: row?.stalled ?? 0,
  };
}

export async function getArchivedTenders(): Promise<Tender[]> {
  const { data, error } = await supabaseServer()
    .from("tenders")
    .select("*")
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false });
  if (error) throw new Error(`Failed to load archived tenders: ${error.message}`);
  return withNames(data ?? []);
}

export async function getTenderById(id: string): Promise<Tender | null> {
  const { data, error } = await supabaseServer().from("tenders").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Failed to load tender: ${error.message}`);
  if (!data) return null;
  const [tender] = await withNames([data]);
  return tender;
}

export function getFilterOptions(tenders: Tender[]): FilterOptions {
  return {
    periods: periodsSorted(tenders.map((t) => t.period)),
    areas: distinctSorted(tenders.map((t) => t.area)),
    customers: distinctSorted(tenders.map((t) => t.customer)),
    entitasList: distinctSorted(tenders.map((t) => t.entitas)),
  };
}

/** Dropdown options for every extendable field (Area, Customer, Entity):
 * existing tender values plus anything an admin added via
 * addSelectOption(), even if no tender uses it yet. */
export async function getSelectOptions(tenders: Tender[]): Promise<SelectOptionsMap> {
  const { data, error } = await supabaseServer().from("select_options").select("field, value");
  if (error) throw new Error(`Failed to load select options: ${error.message}`);

  const fromOptions: Record<string, string[]> = {};
  for (const row of data ?? []) {
    (fromOptions[row.field] ??= []).push(row.value);
  }

  return {
    area: distinctSorted([...tenders.map((t) => t.area), ...(fromOptions.area ?? [])]),
    customer: distinctSorted([...tenders.map((t) => t.customer), ...(fromOptions.customer ?? [])]),
    entitas: distinctSorted([...tenders.map((t) => t.entitas), ...(fromOptions.entitas ?? [])]),
  };
}
