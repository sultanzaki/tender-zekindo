import type { TenderFormValues } from "./types";
/** Forms submit canonical dot-decimal strings, never locale-formatted amounts. */
export function parseNumericInput(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;
  if (!/^\d+(\.\d+)?$/.test(value)) return NaN;
  const number = Number(value);
  return Number.isFinite(number) && number <= Number.MAX_SAFE_INTEGER
    ? number
    : NaN;
}
export function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function validateTender(values: TenderFormValues): string | null {
  if (!values.area.trim()) return "Area is required.";
  if (!values.customer.trim()) return "Customer is required.";
  if (values.track !== "upstream" && values.track !== "downstream")
    return "Choose a valid track.";
  for (const [field, raw] of [
    ["Quantity", values.qty],
    ["OE", values.oe],
    ["Bid value", values.nilaiPenawaran],
  ]) {
    if (Number.isNaN(parseNumericInput(raw)))
      return `${field} must be a valid, non-negative number (use a decimal point).`;
  }
  for (const value of Object.values(values.milestones)) {
    if (value && !isISODate(value)) return "Enter a valid milestone date.";
  }
  return null;
}
export function safeNextPath(value: string | undefined): string {
  return value &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !/[\x00-\x1f]/.test(value)
    ? value
    : "/";
}
