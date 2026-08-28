"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase-server";
import { currentPeriod, periodsSorted } from "./tender-logic";
import { MILESTONE_KEYS, RESULT_ENUM, type Milestones, type TenderEditFormValues, type TenderFormValues } from "./types";

export interface ActionError {
  error: string;
}

function parseNumericInput(raw: string): number | null {
  const digits = raw.replace(/[^0-9]/g, "");
  return digits ? Number(digits) : null;
}

function buildMilestones(input: TenderFormValues["milestones"]): Milestones {
  const out = {} as Milestones;
  for (const key of MILESTONE_KEYS) {
    out[key] = input[key] || null;
  }
  return out;
}

function validate(values: TenderFormValues): string | null {
  if (!values.area.trim()) return "Area wajib dipilih.";
  if (!values.customer.trim()) return "Customer wajib diisi.";
  return null;
}

async function resolveCurrentPeriod(): Promise<string> {
  const { data, error } = await supabaseServer().from("tenders").select("period");
  if (error) throw new Error(`Gagal memuat periode: ${error.message}`);
  const periods = periodsSorted((data ?? []).map((r) => r.period));
  return currentPeriod(periods) || new Date().getFullYear().toString();
}

export async function createTender(values: TenderFormValues): Promise<ActionError | undefined> {
  const validationError = validate(values);
  if (validationError) return { error: validationError };

  let period: string;
  try {
    period = await resolveCurrentPeriod();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menentukan periode." };
  }

  const { data, error } = await supabaseServer()
    .from("tenders")
    .insert({
      period,
      area: values.area,
      tender_no: values.tenderNo || null,
      customer: values.customer.trim(),
      product: values.product || null,
      entitas: values.entitas || null,
      qty: parseNumericInput(values.qty),
      oe: parseNumericInput(values.oe),
      nilai_penawaran: parseNumericInput(values.nilaiPenawaran),
      milestones: buildMilestones(values.milestones),
    })
    .select("id")
    .single();

  if (error) return { error: `Gagal menyimpan tender: ${error.message}` };

  revalidatePath("/");
  revalidatePath("/tenders");
  redirect(`/tenders/${data.id}`);
}

export async function updateTender(id: string, values: TenderEditFormValues): Promise<ActionError | undefined> {
  const validationError = validate(values);
  if (validationError) return { error: validationError };
  if (values.result && !(RESULT_ENUM as readonly string[]).includes(values.result)) {
    return { error: "Result tidak valid." };
  }

  const { error } = await supabaseServer()
    .from("tenders")
    .update({
      area: values.area,
      tender_no: values.tenderNo || null,
      customer: values.customer.trim(),
      product: values.product || null,
      entitas: values.entitas || null,
      qty: parseNumericInput(values.qty),
      oe: parseNumericInput(values.oe),
      nilai_penawaran: parseNumericInput(values.nilaiPenawaran),
      milestones: buildMilestones(values.milestones),
      result: values.result || null,
      carry_over: values.carryOver || null,
      remarks: values.remarks || null,
    })
    .eq("id", id);

  if (error) return { error: `Gagal menyimpan perubahan: ${error.message}` };

  revalidatePath("/");
  revalidatePath("/tenders");
  revalidatePath(`/tenders/${id}`);
  redirect(`/tenders/${id}`);
}
