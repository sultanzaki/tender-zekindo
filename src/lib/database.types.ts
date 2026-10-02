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
          /** upstream | downstream (migration 0009). Typed as string like the
           * other enum-ish columns; src/lib/tenders.ts narrows it to Track. */
          track: string;
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
          milestone_order: string[] | null;
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
      milestone_types: {
        Row: {
          id: string;
          key: string;
          track: string;
          label: string;
          sort_order: number;
          show_in_table: boolean;
          archived_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["milestone_types"]["Row"]> & {
          key: string;
          label: string;
        };
        Update: Partial<Database["public"]["Tables"]["milestone_types"]["Row"]>;
        Relationships: [];
      };
      /** Document folders — nested via parent_id. `milestone_key` marks a
       * milestone's document tree, `document_type_id` a checklist item's.
       * See supabase/migrations/0007_document_folders.sql. */
      tender_folders: {
        Row: {
          id: string;
          tender_id: string;
          parent_id: string | null;
          name: string;
          milestone_key: string | null;
          document_type_id: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tender_folders"]["Row"]> & {
          tender_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["tender_folders"]["Row"]>;
        Relationships: [];
      };
      /** One uploaded file. Its position is folder_id, or — when it sits at the
       * root of a tree — the matching milestone_key / document_type_id. */
      tender_files: {
        Row: {
          id: string;
          tender_id: string;
          folder_id: string | null;
          milestone_key: string | null;
          document_type_id: string | null;
          file_path: string;
          file_name: string;
          size_bytes: number | null;
          content_type: string | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tender_files"]["Row"]> & {
          tender_id: string;
          file_path: string;
          file_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["tender_files"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      /** Nav badge counts, computed in Postgres — see
       * supabase/migrations/0005_notification_counts.sql and
       * 0008_milestone_reminders.sql (which added due_h3). */
      notification_counts: {
        Args: Record<string, never>;
        Returns: { due_h3: number; due_soon: number; stalled: number }[];
      };
    };
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
export type MilestoneTypeRow = Database["public"]["Tables"]["milestone_types"]["Row"];
