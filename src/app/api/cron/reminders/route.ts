import { timingSafeEqual } from "node:crypto";
import { supabaseServer } from "@/lib/supabase-server";
import { renderReminderHtml, type ReminderRow } from "@/lib/reminder-email";
import { todayISO, daysBetween } from "@/lib/tender-logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return false;
  const expected = Buffer.from("Bearer " + secret);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let stage = "config_validation";
  const requestId = crypto.randomUUID();
  const log = (event: string, fields: Record<string, unknown> = {}) => console.info("[tender-reminder]", { requestId, stage, event, ...fields });
  try {
    log("started");
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.REMINDER_FROM_EMAIL;
    const to = [...new Set((process.env.REMINDER_RECIPIENTS ?? "").split(",").map(x => x.trim()).filter(Boolean))];
    const invalid: string[] = [];
    if (!apiKey?.trim()) invalid.push("RESEND_API_KEY");
    if (!from?.trim()) invalid.push("REMINDER_FROM_EMAIL");
    if (!to.length || to.length > 50 || to.some(x => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x))) invalid.push("REMINDER_RECIPIENTS");
    let appUrl: URL | undefined;
    try { appUrl = new URL(process.env.APP_URL ?? ""); } catch { /* reported below */ }
    if (appUrl?.protocol !== "https:") invalid.push("APP_URL");
    if (!process.env.SUPABASE_URL?.trim()) invalid.push("SUPABASE_URL");
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) invalid.push("SUPABASE_SERVICE_ROLE_KEY");
    if (invalid.length || !apiKey || !from || !appUrl) {
      log("invalid_configuration", { variables: invalid });
      return Response.json({ error: "Invalid reminder configuration", stage, requestId, variables: invalid }, { status: 500 });
    }
    stage = "database_connection";
    const db = supabaseServer();
    const day = todayISO();
    stage = "digest_lookup";
    const existing = await db.from("reminder_digest").select("*").eq("day", day).maybeSingle();
    if (existing.error) throw existing.error;
    let digest = existing.data;
    if (!digest) {
      stage = "milestone_query";
      const catalog: { key: string; track: string; label: string }[] = [];
      for (let offset = 0; ; offset += 500) {
        const r = await db.from("milestone_types").select("key,track,label").is("archived_at", null).order("id").range(offset, offset + 499);
        if (r.error) throw r.error;
        catalog.push(...r.data);
        if (r.data.length < 500) break;
      }
      log("catalog_loaded", { count: catalog.length });
      stage = "tender_query";
      const lines: (ReminderRow & { line: string })[] = [];
      for (let offset = 0; ; offset += 500) {
        const r = await db.from("tenders").select("id,track,customer,product,tender_no,milestones,milestone_order,result").is("archived_at", null).order("id").range(offset, offset + 499);
        if (r.error) throw r.error;
        for (const t of r.data) {
          if (t.result) continue;
          for (const m of catalog) {
            if (m.track !== t.track || (t.milestone_order != null && !t.milestone_order.includes(m.key))) continue;
            const date = t.milestones[m.key];
            if (!date) continue;
            const days = daysBetween(date, day);
            if (![0, 1, 3].includes(days)) continue;
            lines.push({ days, date, track: t.track, customer: t.customer, product: t.product ?? "", tenderNo: t.tender_no ?? "", milestone: m.label, line: ["H-" + days, date, t.track, t.customer, t.product ?? "", t.tender_no ?? "", m.label].join(" | ") });
          }
        }
        if (r.data.length < 500) break;
      }
      log("milestones_matched", { count: lines.length });
      if (!lines.length) return Response.json({ status: "no_deadlines" });
      stage = "email_template_generation";
      lines.sort((a,b) => a.days - b.days || a.line.localeCompare(b.line));
      const payload = { from, to, html: renderReminderHtml(lines, day, new URL("/notifications", appUrl).href), subject: "Zekindo Tender Reminder | " + day, text: ["ZEKINDO — TENDER MANAGEMENT", "", "Upcoming milestones (Jakarta time):", ...lines.map(x => x.line), "", new URL("/notifications", appUrl).href].join("\n") };
      stage = "digest_persistence";
      const saved = await db.from("reminder_digest").upsert({ day, payload }, { onConflict: "day", ignoreDuplicates: true });
      if (saved.error) throw saved.error;
      stage = "digest_reload";
      const read = await db.from("reminder_digest").select("*").eq("day", day).single();
      if (read.error) throw read.error;
      digest = read.data;
    }
    if (digest.sent_at) return Response.json({ status: "already_sent" });
    // Do not send yesterday's payload or retry after the local day changes.
    if (todayISO() !== day) return Response.json({ status: "day_changed" }, { status: 409 });
    stage = "resend_api_request";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json", "Idempotency-Key": "zekindo-tender-digest/" + day },
      body: JSON.stringify(digest.payload),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      log("provider_rejected", { providerStatus: response.status });
      return Response.json({ error: "Email provider rejected request", providerStatus: response.status, stage, requestId }, { status: 502 });
    }
    stage = "delivery_confirmation";
    const result = await response.json() as { id?: string };
    if (!result.id) throw new Error("Missing provider id");
    stage = "delivery_persistence";
    const saved = await db.from("reminder_digest").update({ sent_at: new Date().toISOString(), provider_id: result.id }).eq("day", day);
    if (saved.error) throw saved.error;
    log("sent");
    return Response.json({ status: "sent" });
  } catch (error: unknown) {
    // Never log raw exception messages, request headers, credentials or tender payloads.
    const rawCode = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    const code = typeof rawCode === "string" && /^(?:[0-9A-Z]{5}|PGRST[0-9]{3})$/.test(rawCode) ? rawCode : undefined;
    const kind = error instanceof TypeError ? "TypeError" : error instanceof RangeError ? "RangeError" : error instanceof Error ? "Error" : "DatabaseOrUnknownError";
    console.error("[tender-reminder]", { requestId, stage, event: "failed", kind, code });
    return Response.json({ error: "Reminder job failed", stage, requestId, code }, { status: 500 });
  }
}

// Also support authenticated manual retries.
export async function POST(request: Request) {
  return GET(request);
}
