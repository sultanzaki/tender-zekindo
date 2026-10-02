export const MILESTONE_KEYS = [
  "regist",
  "pq",
  "technicalPq",
  "prebid",
  "secondPrebid",
  "technicalBidding",
  "sampelLab",
  "pengirimanBukti",
  "pemasukanDokumen",
  "fieldTest",
  "openBid",
  "firstDelivery",
] as const;

export type MilestoneKey = (typeof MILESTONE_KEYS)[number];

/** The 12 milestones the app shipped with.
 *
 * NOTE: these are now only the *seed* for the `milestone_types` table (see
 * supabase/migrations/0006_dynamic_milestones.sql) and a fallback for when the
 * catalog can't be loaded. At runtime the app reads the catalog from the
 * database, because an admin can add, rename, reorder and archive milestones —
 * see src/lib/milestones.ts and resolveTenderMilestones() in tender-logic.ts.
 * Do not reintroduce hardcoded milestone rendering: custom milestones are
 * keyed by arbitrary strings, not by this union. */
export const MILESTONE_DEFS: { key: MilestoneKey; label: string }[] = [
  { key: "regist", label: "Registration" },
  { key: "pq", label: "PQ" },
  { key: "technicalPq", label: "Technical PQ" },
  { key: "prebid", label: "Prebid" },
  { key: "secondPrebid", label: "Second Prebid" },
  { key: "technicalBidding", label: "Technical Bidding" },
  { key: "sampelLab", label: "Chemical Sample Received at Lab Test" },
  { key: "pengirimanBukti", label: "Independent Lab Payment Proof Sent" },
  { key: "pemasukanDokumen", label: "Bid Document Submission" },
  { key: "fieldTest", label: "Field Test" },
  { key: "openBid", label: "Open Bid" },
  { key: "firstDelivery", label: "First Delivery" },
];

export const RESULT_ENUM = [
  "WIN",
  "LOSS PRICE",
  "LOSS TECHNICAL",
  "LOSS TECHNICAL (BOTTLE TEST)",
  "LOSS TECHNICAL (FIELD TRIAL)",
  "LOSS PQ ADMIN",
  "LOSS REGIST",
  "WITHDRAW",
  "CANCELED",
  "RETENDER",
  "NO INFO",
] as const;

export type ResultValue = (typeof RESULT_ENUM)[number];

export type Milestones = Record<string, string | null>;

export type UserRole = "viewer" | "admin";

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface Tender {
  id: string;
  rowNo: number;
  period: string;
  area: string;
  tenderNo: string | null;
  customer: string;
  product: string | null;
  entitas: string | null;
  qty: number | null;
  oe: number | null;
  oeCatatan: string | null;
  idrPerL: number | null;
  milestones: Milestones;
  /** Per-tender milestone order and subset. `null` means "use the catalog's
   * default order and show every milestone in it". See
   * resolveTenderMilestones() in tender-logic.ts. */
  milestoneOrder: string[] | null;
  result: string | null;
  carryOver: string | null;
  remarks: string | null;
  remark: string | null;
  pnl: boolean;
  catatanInternal: string | null;
  nilaiPenawaran: number | null;
  archivedAt: string | null;
  createdBy: string | null;
  createdByName: string | null;
  updatedBy: string | null;
  updatedByName: string | null;
  updatedAt: string;
}

/** A row of the global milestone catalog (`milestone_types`) — milestones are
 * admin-manageable now. See src/lib/milestones.ts and migration
 * 0006_dynamic_milestones.sql. */
export interface MilestoneType {
  id: string;
  key: string;
  label: string;
  sortOrder: number;
  /** Starting visibility in the dense tender table (togglable per session). */
  showInTable: boolean;
}

/** A catalog row as shown on the admin page — includes archived milestones.
 * Lives here rather than in the server-only milestones module so the client
 * component can type its props without importing a `server-only` file. */
export interface MilestoneTypeAdmin extends MilestoneType {
  archivedAt: string | null;
}

export interface DocumentType {
  id: string;
  label: string;
  isDefault: boolean;
}

export interface TenderDocument {
  documentTypeId: string;
  label: string;
  checked: boolean;
  filePath: string | null;
  fileName: string | null;
  fileUrl: string | null;
  updatedAt: string | null;
}

export type TenderEventAction = "create" | "update" | "archive" | "restore" | "delete";

export interface TenderEventChange {
  from: unknown;
  to: unknown;
}

export interface TenderEvent {
  id: string;
  tenderId: string | null;
  tenderLabel: string;
  actorId: string | null;
  actorName: string;
  action: TenderEventAction;
  changes: Record<string, TenderEventChange> | null;
  createdAt: string;
}

// ── Column toggles on the tender table ──────────────────────────────────────
// The milestone half of this list is now derived from `milestone_types` at
// runtime (see TenderTableClient); only the plain field columns are fixed here.

export interface TenderFilters {
  period: string;
  area: string;
  entitas: string;
  customer: string;
  result: string;
  search: string;
}

export const DEFAULT_FILTERS: TenderFilters = {
  period: "all",
  area: "all",
  entitas: "all",
  customer: "all",
  result: "all",
  search: "",
};

/** Shape shared by the new-tender and edit-tender forms (before parsing). */
export interface TenderFormValues {
  area: string;
  tenderNo: string;
  customer: string;
  product: string;
  entitas: string;
  qty: string;
  oe: string;
  oeCatatan: string;
  nilaiPenawaran: string;
  milestones: Record<string, string>;
}

export interface TenderEditFormValues extends TenderFormValues {
  result: string; // "" means still running (null in the DB)
  carryOver: string;
  remarks: string;
  remark: string;
  pnl: boolean;
  catatanInternal: string;
}

export interface FilterOptions {
  periods: string[];
  areas: string[];
  customers: string[];
  entitasList: string[];
}

/** Fields whose dropdown options are admin-extendable at runtime, backed by
 * the `select_options` table (see addSelectOption in src/lib/actions.ts).
 * Kept as an explicit allowlist: the Server Action used to accept any field
 * string, so a caller could write arbitrary rows. */
export const EXTENDABLE_FIELDS = ["area", "customer", "entitas"] as const;

export type ExtendableField = (typeof EXTENDABLE_FIELDS)[number];

/** Dropdown options per extendable field: everything already present on a
 * tender row, merged with anything an admin has added via select_options
 * (so a freshly added value is pickable before any tender uses it). */
export type SelectOptionsMap = Record<ExtendableField, string[]>;
