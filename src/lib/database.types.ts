import type { Milestones } from "./types";

/** Hand-written to match supabase/migrations/0001_init.sql — regenerate with
 * `supabase gen types typescript` once a live project exists. */
export interface Database {
  public: {
    Tables: {
      tenders: {
        Row: {
          id: string;
          row_no: number;
          period: string;
          area: string;
          tender_no: string | null;
          customer: string;
          product: string | null;
          entitas: string | null;
          qty: number | null;
          oe: number | null;
          idr_per_l: number | null;
          milestones: Milestones;
          result: string | null;
          carry_over: string | null;
          remarks: string | null;
          nilai_penawaran: number | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tenders"]["Row"]> & {
          id: string;
          row_no: number;
          period: string;
          area: string;
          customer: string;
        };
        Update: Partial<Database["public"]["Tables"]["tenders"]["Row"]>;
      };
    };
  };
}

export type TenderRow = Database["public"]["Tables"]["tenders"]["Row"];
