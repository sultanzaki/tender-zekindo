import type { DeadlineRow } from "./tender-logic";
function escapeICS(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\r/g, "");
}
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  let output = "",
    bytes = 0;
  for (const character of line) {
    const length = encoder.encode(character).length;
    if (bytes + length > 75) {
      output += "\r\n ";
      bytes = 1;
    }
    output += character;
    bytes += length;
  }
  return output;
}
export function deadlineCalendar(
  rows: DeadlineRow[],
  stamp = new Date(),
): string {
  const created = stamp
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const events = rows.map((row) => {
    const date = row.dateIso.replace(/-/g, "");
    const end = new Date(`${row.dateIso}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    return [
      "BEGIN:VEVENT",
      `UID:${row.tenderId}-${row.milestoneKey}-${date}@zekindo`,
      `DTSTAMP:${created}`,
      `DTSTART;VALUE=DATE:${date}`,
      `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replace(/-/g, "")}`,
      `SUMMARY:${escapeICS(`${row.milestoneLabel} · ${row.customer}`)}`,
      `DESCRIPTION:${escapeICS(row.product)}`,
      "END:VEVENT",
    ]
      .map(foldLine)
      .join("\r\n");
  });
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Zekindo//Tender Workspace//EN",
    "CALSCALE:GREGORIAN",
    ...events,
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
