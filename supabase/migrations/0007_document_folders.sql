-- Folder & multi-file untuk dokumen tender.
--
-- Model: setiap file tinggal DI DALAM sebuah folder. Ada dua jenis pohon,
-- dibedakan dari kolom yang terisi:
--
--   * milestone_key    -> folder itu milik area dokumen sebuah milestone
--   * document_type_id -> folder itu milik satu item di Document Checklist
--
-- Keduanya bisa bersarang sedalam apa pun lewat parent_id. Sebuah file juga
-- boleh berada langsung di akar salah satu pohon (folder_id null, dan salah
-- satu kolom jenis terisi).
--
-- Aman dijalankan berulang (idempotent). Tidak ada DROP dan tidak ada DELETE.
-- Baris lama di tender_documents TIDAK diubah: migrasi ini hanya menyalin file
-- yang sudah ada ke tabel baru supaya tidak hilang dari tampilan.

-- ---------------------------------------------------------------------------
-- 1. Folder
-- ---------------------------------------------------------------------------

create table if not exists public.tender_folders (
  id uuid primary key default gen_random_uuid(),
  tender_id text not null references public.tenders (id) on delete cascade,
  parent_id uuid references public.tender_folders (id) on delete cascade,
  name text not null,
  milestone_key text,
  document_type_id uuid references public.document_types (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists tender_folders_tender_idx on public.tender_folders (tender_id);
create index if not exists tender_folders_parent_idx on public.tender_folders (parent_id);

alter table public.tender_folders enable row level security;

-- ---------------------------------------------------------------------------
-- 2. File
-- ---------------------------------------------------------------------------

create table if not exists public.tender_files (
  id uuid primary key default gen_random_uuid(),
  tender_id text not null references public.tenders (id) on delete cascade,
  folder_id uuid references public.tender_folders (id) on delete cascade,
  milestone_key text,
  document_type_id uuid references public.document_types (id) on delete cascade,
  file_path text not null,
  file_name text not null,
  size_bytes bigint,
  content_type text,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists tender_files_tender_idx on public.tender_files (tender_id);
create index if not exists tender_files_folder_idx on public.tender_files (folder_id);

alter table public.tender_files enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Pindahkan file yang sudah ada
-- ---------------------------------------------------------------------------

-- tender_documents menyimpan satu file per jenis dokumen di kolom file_path.
-- Itu disalin ke tender_files sebagai file di akar pohon checklist, sehingga
-- tampilan baru tetap memperlihatkannya. Kolom lama sengaja TIDAK dihapus dan
-- TIDAK dikosongkan, jadi masih ada cadangannya.
insert into public.tender_files (tender_id, folder_id, document_type_id, file_path, file_name, uploaded_by, created_at)
select d.tender_id, null, d.document_type_id, d.file_path, d.file_name, d.updated_by, d.updated_at
  from public.tender_documents d
 where d.file_path is not null
   and not exists (
     select 1 from public.tender_files f where f.file_path = d.file_path
   );
