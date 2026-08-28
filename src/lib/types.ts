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

export const MILESTONE_DEFS: { key: MilestoneKey; label: string }[] = [
  { key: "regist", label: "Regist" },
  { key: "pq", label: "PQ" },
  { key: "technicalPq", label: "Technical PQ" },
  { key: "prebid", label: "Prebid" },
  { key: "secondPrebid", label: "Second Prebid" },
  { key: "technicalBidding", label: "Technical Bidding" },
  { key: "sampelLab", label: "Sampel Chemical diterima di Lab Test" },
  { key: "pengirimanBukti", label: "Pengiriman Bukti Pembayaran Lab Independent" },
  { key: "pemasukanDokumen", label: "Pemasukan Dokumen Penawaran" },
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

export type Milestones = Record<MilestoneKey, string | null>;

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
  idrPerL: number | null;
  milestones: Milestones;
  result: string | null;
  carryOver: string | null;
  remarks: string | null;
  nilaiPenawaran: number | null;
}

/** Short header labels for the milestone columns on the dense tender table
 * (the long form is used in the detail timeline and the new-tender form). */
export const MILESTONE_TABLE_HEADERS: Record<MilestoneKey, string> = {
  regist: "Regist",
  pq: "PQ",
  technicalPq: "Technical PQ",
  prebid: "Prebid",
  secondPrebid: "2nd Prebid",
  technicalBidding: "Technical Bidding",
  sampelLab: "Sampel di Lab",
  pengirimanBukti: "Bukti Bayar Lab",
  pemasukanDokumen: "Pemasukan Dok.",
  fieldTest: "Field Test",
  openBid: "Open Bid",
  firstDelivery: "First Delivery",
};

/** Columns that can be shown/hidden via the "Kolom" menu on the tender table. */
export const TOGGLEABLE_COLUMNS: { key: "period" | "oe" | "qty" | MilestoneKey; label: string }[] = [
  { key: "period", label: "Periode" },
  { key: "oe", label: "OE (Rp)" },
  { key: "qty", label: "Qty" },
  { key: "technicalPq", label: "Technical PQ" },
  { key: "secondPrebid", label: "Second Prebid" },
  { key: "technicalBidding", label: "Technical Bidding" },
  { key: "sampelLab", label: "Sampel di Lab Test" },
  { key: "pengirimanBukti", label: "Bukti Bayar Lab Independent" },
  { key: "pemasukanDokumen", label: "Pemasukan Dokumen" },
  { key: "firstDelivery", label: "First Delivery" },
];

export type VisibleColumns = Record<(typeof TOGGLEABLE_COLUMNS)[number]["key"], boolean>;

export const DEFAULT_VISIBLE_COLUMNS: VisibleColumns = {
  period: false,
  oe: false,
  qty: false,
  regist: true,
  pq: true,
  technicalPq: false,
  prebid: true,
  secondPrebid: false,
  technicalBidding: false,
  sampelLab: false,
  pengirimanBukti: false,
  pemasukanDokumen: false,
  fieldTest: true,
  openBid: true,
  firstDelivery: false,
};

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
  nilaiPenawaran: string;
  milestones: Partial<Record<MilestoneKey, string>>;
}

export interface TenderEditFormValues extends TenderFormValues {
  result: string; // "" means still running (null in the DB)
  carryOver: string;
  remarks: string;
}

export interface FilterOptions {
  periods: string[];
  areas: string[];
  customers: string[];
  entitasList: string[];
}
