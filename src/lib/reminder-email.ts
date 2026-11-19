export type ReminderRow = {
  days: number; date: string; track: string; customer: string;
  product: string; tenderNo: string; milestone: string;
};

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c] ?? c));

const groups = [
  { days: 0, label: "Due today", color: "#b91c1c", bg: "#fef2f2" },
  { days: 1, label: "Due tomorrow", color: "#92400e", bg: "#fffbeb" },
  { days: 3, label: "Due in 3 days", color: "#1d4ed8", bg: "#eff6ff" },
];

export function renderReminderHtml(rows: ReminderRow[], day: string, dashboard: string): string {
  const e = escape;
  const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: "UTC" }).format(new Date(day + "T00:00:00Z"));
  const summary = groups.map(g => `<td width="33%" valign="top" style="padding:4px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${g.bg};border-radius:8px"><tr><td style="padding:12px 8px;color:${g.color}"><div style="font-size:26px;font-weight:bold">${rows.filter(r => r.days === g.days).length}</div><div style="font-size:12px">${g.label}</div></td></tr></table></td>`).join("");
  const details = rows.map(r => {
    const g = groups.find(x => x.days === r.days) ?? groups[2];
    return `<tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td width="4" bgcolor="${g.color}"></td><td style="padding:4px 12px;font-size:14px;line-height:1.5"><strong>${e(r.milestone)}</strong><br>${e(r.customer)}<br><span style="font-size:12px;color:#475569">${e(r.product || "—")} · ${e(r.track)}<br>${e(r.tenderNo || "—")} · ${e(r.date)}</span></td><td valign="top" align="right" style="color:${g.color};font-size:12px;font-weight:bold;white-space:nowrap">H-${r.days}</td></tr></table></td></tr>`;
  }).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Daily Tender Briefing</title></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#172b42"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f1f5f9"><tr><td align="center" style="padding:16px 8px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e8f0"><tr><td bgcolor="#123354" style="padding:24px;color:#ffffff"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#ffffff" style="background:#ffffff;padding:10px 14px;border-radius:6px"><img src="${e(new URL("/logo.png", dashboard).href)}" alt="ZEKINDO" width="150" style="display:block;width:150px;max-width:100%;height:auto;border:0;color:#123354;font-size:20px;font-weight:bold"></td></tr></table><div style="font-size:10px;color:#cbd5e1;letter-spacing:1px">TENDER MANAGEMENT SYSTEM</div><div style="border-top:1px solid #526b83;margin-top:18px;padding-top:18px;font-size:22px;font-weight:bold">Daily Tender Briefing</div><div style="font-size:13px;color:#dbeafe;margin-top:6px">${e(date)} · WIB</div></td></tr><tr><td style="padding:16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${summary}</tr></table><div style="font-size:11px;letter-spacing:1px;font-weight:bold;color:#475569;margin-top:24px">UPCOMING DEADLINES · ${rows.length}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${details}</table><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px"><tr><td bgcolor="#123354" align="center" style="border-radius:6px"><a href="${e(dashboard)}" style="display:block;padding:14px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none">View Tender Dashboard &rarr;</a></td></tr></table></td></tr><tr><td align="center" style="padding:16px;background:#f8fafc;color:#64748b;font-size:11px;line-height:1.6">Automated notification · Zekindo Tender Management<br>PT Zeus Kimiatama Indonesia</td></tr></table></td></tr></table></body></html>`;
}
