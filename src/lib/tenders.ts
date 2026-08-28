import "server-only";
import { supabaseServer } from "./supabase-server";
import type { TenderRow } from "./database.types";
import type { FilterOptions, Tender } from "./types";
import { distinctSorted, periodsSorted } from "./tender-logic";

function mapRow(row: TenderRow): Tender {
  return {
    id: row.id,
    rowNo: row.row_no,
    period: row.period,
    area: row.area,
    tenderNo: row.tender_no,
    customer: row.customer,
    product: row.product,
    entitas: row.entitas,
    qty: row.qty,
    oe: row.oe,
    idrPerL: row.idr_per_l,
    milestones: row.milestones,
    result: row.result,
    carryOver: row.carry_over,
    remarks: row.remarks,
    nilaiPenawaran: row.nilai_penawaran,
  };
}

export async function getAllTenders(): Promise<Tender[]> {
  const { data, error } = await supabaseServer()
    .from("tenders")
    .select("*")
    .order("row_no", { ascending: true });
  if (error) throw new Error(`Gagal memuat data tender: ${error.message}`);
  return (data ?? []).map(mapRow);
}

export async function getTenderById(id: string): Promise<Tender | null> {
  const { data, error } = await supabaseServer()
    .from("tenders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Gagal memuat data tender: ${error.message}`);
  return data ? mapRow(data) : null;
}

export function getFilterOptions(tenders: Tender[]): FilterOptions {
  return {
    periods: periodsSorted(tenders.map((t) => t.period)),
    areas: distinctSorted(tenders.map((t) => t.area)),
    customers: distinctSorted(tenders.map((t) => t.customer)),
    entitasList: distinctSorted(tenders.map((t) => t.entitas)),
  };
}
