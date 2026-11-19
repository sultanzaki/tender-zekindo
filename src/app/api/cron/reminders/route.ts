import { timingSafeEqual } from "node:crypto";
import { supabaseServer } from "@/lib/supabase-server";
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

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.REMINDER_FROM_EMAIL;
    const to = [...new Set((process.env.REMINDER_RECIPIENTS ?? "").split(",").map(x => x.trim()).filter(Boolean))];
    const appUrl = new URL(process.env.APP_URL ?? "");
    if (!apiKey || !from || !to.length || to.length > 50 || to.some(x => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)) || appUrl.protocol !== "https:") throw new Error("Invalid reminder configuration");
    const db = supabaseServer();
    const day = todayISO();
    const existing = await db.from("reminder_digest").select("*").eq("day", day).maybeSingle();
    if (existing.error) throw existing.error;
    let digest = existing.data;
    if (!digest) {
      const catalog: { key: string; track: string; label: string }[] = [];
      for (let offset = 0; ; offset += 500) {
        const r = await db.from("milestone_types").select("key,track,label").is("archived_at", null).order("id").range(offset, offset + 499);
        if (r.error) throw r.error;
        catalog.push(...r.data);
        if (r.data.length < 500) break;
      }
      const lines: { days: number; line: string }[] = [];
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
            lines.push({ days, line: ["H-" + days, date, t.track, t.customer, t.product ?? "", t.tender_no ?? "", m.label].join(" | ") });
          }
        }
        if (r.data.length < 500) break;
      }
      if (!lines.length) return Response.json({ status: "no_deadlines" });
      lines.sort((a,b) => a.days - b.days || a.line.localeCompare(b.line));
      const payload = { from, to, subject: "Zekindo Tender Reminder | " + day, text: ["ZEKINDO — TENDER MANAGEMENT", "", "Upcoming milestones (Jakarta time):", ...lines.map(x => x.line), "", new URL("/notifications", appUrl).href].join("\n") };
      const saved = await db.from("reminder_digest").upsert({ day, payload }, { onConflict: "day", ignoreDuplicates: true });
      if (saved.error) throw saved.error;
      const read = await db.from("reminder_digest").select("*").eq("day", day).single();
      if (read.error) throw read.error;
      digest = read.data;
    }
    if (digest.sent_at) return Response.json({ status: "already_sent" });
    // Do not send yesterday's payload or retry after the local day changes.
    if (todayISO() !== day) return Response.json({ status: "day_changed" }, { status: 409 });
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json", "Idempotency-Key": "zekindo-tender-digest/" + day },
      body: JSON.stringify(digest.payload),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return Response.json({ error: "Email provider rejected request", providerStatus: response.status }, { status: 502 });
    const result = await response.json() as { id?: string };
    if (!result.id) throw new Error("Missing provider id");
    const saved = await db.from("reminder_digest").update({ sent_at: new Date().toISOString(), provider_id: result.id }).eq("day", day);
    if (saved.error) throw saved.error;
    return Response.json({ status: "sent" });
  } catch {
    return Response.json({ error: "Reminder job failed; check server configuration and database migration" }, { status: 500 });
  }
}
