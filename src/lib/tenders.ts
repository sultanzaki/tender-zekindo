import "server-only";
import { cache } from "react";
import { supabaseServer } from "./supabase-server";
import type { TenderRow } from "./database.types";
import type { FilterOptions, Tender } from "./types";
import { distinctSorted, periodsSorted } from "./tender-logic";
import { getProfilesByIds } from "./users";

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

export const getAllTenders = cache(async (options?: { includeArchived?: boolean }): Promise<Tender[]> => {
  let query = supabaseServer().from("tenders").select("*").order("row_no", { ascending: true });
  if (!options?.includeArchived) query = query.is("archived_at", null);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load tenders: ${error.message}`);
  return withNames(data ?? []);
});

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

/** Area options available in the New/Edit Tender form: existing tender
 * areas plus anything an admin has added via addSelectOption("area", ...),
 * even if no tender uses it yet. */
export async function getAreaOptions(tenders: Tender[]): Promise<string[]> {
  const { data, error } = await supabaseServer().from("select_options").select("value").eq("field", "area");
  if (error) throw new Error(`Failed to load area options: ${error.message}`);
  const fromOptions = (data ?? []).map((r) => r.value);
  return distinctSorted([...tenders.map((t) => t.area), ...fromOptions]);
}
