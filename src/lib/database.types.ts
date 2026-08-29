import type { Milestones, TenderEventAction, TenderEventChange, UserRole } from "./types";

/** Hand-written to match supabase/migrations/*.sql — regenerate with
 * `supabase gen types typescript` once this can run against the live project. */
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
          oe_catatan: string | null;
          idr_per_l: number | null;
          milestones: Milestones;
          result: string | null;
          carry_over: string | null;
          remarks: string | null;
          remark: string | null;
          pnl: boolean;
          catatan_internal: string | null;
          nilai_penawaran: number | null;
          archived_at: string | null;
          created_by: string | null;
          updated_by: string | null;
          updated_at: string;
          created_at: string;
        };
        // id/row_no are optional on insert: the `tenders_set_defaults`
        // trigger (see supabase/migrations/0001_init.sql) fills them in
        // from a sequence when omitted.
        Insert: Partial<Database["public"]["Tables"]["tenders"]["Row"]> & {
          period: string;
          area: string;
          customer: string;
        };
        Update: Partial<Database["public"]["Tables"]["tenders"]["Row"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          name: string;
          role: UserRole;
          password_hash: string | null;
          created_at: string;
        };
        // id defaults to gen_random_uuid() (see 0004_custom_auth.sql) — no
        // longer supplied by a Supabase Auth trigger.
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { email: string; name: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      tender_events: {
        Row: {
          id: string;
          tender_id: string | null;
          tender_label: string;
          actor_id: string | null;
          actor_name: string;
          action: TenderEventAction;
          changes: Record<string, TenderEventChange> | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tender_events"]["Row"]> & {
          tender_label: string;
          actor_name: string;
          action: TenderEventAction;
        };
        Update: Partial<Database["public"]["Tables"]["tender_events"]["Row"]>;
        Relationships: [];
      };
      select_options: {
        Row: {
          id: string;
          field: string;
          value: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["select_options"]["Row"]> & { field: string; value: string };
        Update: Partial<Database["public"]["Tables"]["select_options"]["Row"]>;
        Relationships: [];
      };
      error_log: {
        Row: {
          id: string;
          message: string;
          stack: string | null;
          path: string | null;
          actor_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["error_log"]["Row"]> & { message: string };
        Update: Partial<Database["public"]["Tables"]["error_log"]["Row"]>;
        Relationships: [];
      };
      document_types: {
        Row: {
          id: string;
          label: string;
          is_default: boolean;
          archived_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["document_types"]["Row"]> & { label: string };
        Update: Partial<Database["public"]["Tables"]["document_types"]["Row"]>;
        Relationships: [];
      };
      tender_documents: {
        Row: {
          id: string;
          tender_id: string;
          document_type_id: string;
          checked: boolean;
          file_path: string | null;
          file_name: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["tender_documents"]["Row"]> & {
          tender_id: string;
          document_type_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["tender_documents"]["Row"]>;
        Relationships: [];
      };
      sessions: {
        Row: {
          id: string;
          user_id: string;
          created_at: string;
          expires_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["sessions"]["Row"]> & {
          id: string;
          user_id: string;
          expires_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["sessions"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}

export type TenderRow = Database["public"]["Tables"]["tenders"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type TenderEventRow = Database["public"]["Tables"]["tender_events"]["Row"];
export type SelectOptionRow = Database["public"]["Tables"]["select_options"]["Row"];
export type ErrorLogRow = Database["public"]["Tables"]["error_log"]["Row"];
export type DocumentTypeRow = Database["public"]["Tables"]["document_types"]["Row"];
export type TenderDocumentRow = Database["public"]["Tables"]["tender_documents"]["Row"];
export type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
