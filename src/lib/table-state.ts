import { DEFAULT_FILTERS, RESULT_ENUM, type TenderFilters } from "./types";
export function readTenderFilters(
  params: Pick<URLSearchParams, "get">,
): TenderFilters {
  const filters = { ...DEFAULT_FILTERS };
  for (const key of Object.keys(filters) as (keyof TenderFilters)[]) {
    const value = params.get(key);
    if (value) filters[key] = value.slice(0, 500);
  }
  if (!["all", "__EMPTY__", ...RESULT_ENUM].includes(filters.result))
    filters.result = "all";
  return filters;
}
export function tenderQuery(filters: TenderFilters, track: string): string {
  const params = new URLSearchParams();
  if (track !== "upstream") params.set("track", track);
  for (const [key, value] of Object.entries(filters))
    if (value && value !== "all") params.set(key, value);
  return params.toString();
}
