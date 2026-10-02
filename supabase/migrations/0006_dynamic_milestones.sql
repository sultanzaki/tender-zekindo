-- Milestone dinamis: katalog milestone + urutan per-tender.
--
-- DESAIN (berubah dari rencana awal — sengaja):
--
-- Rencana awal kami adalah memindahkan 270 tender dari kolom jsonb
-- `tenders.milestones` ke tabel `tender_milestones` per-tender. Itu berarti
-- menggerakkan data tanggal MILIK SEMUA tender lama, dan menciptakan dua
-- sumber kebenaran selama masa transisi: kode baru menulis ke tabel, kode
-- lama menulis ke jsonb. Kalau salah satu tertinggal, badge notifikasi dan
-- hitungan deadline jadi salah tanpa error apa pun.
--
-- Yang sebenarnya diminta adalah "bisa ubah / tambah / hapus URUTAN
-- milestone". Itu soal urutan dan ketersediaan milestone — bukan soal pindah
-- data tanggal. Jadi:
--
--   1. Tanggal milestone TETAP di `tenders.milestones` (jsonb) seperti
--      sekarang. Tidak ada satu pun tanggal yang dipindah. Tidak ada risiko
--      ke 270 tender lama.
--   2. `milestone_types` = katalog global (key, label, urutan default,
--      arsip). Di-seed dengan 12 milestone yang ada sekarang.
--   3. `tenders.milestone_order` (text[]) = urutan + pilihan milestone KHUSUS
--      untuk tender itu. NULL berarti "pakai urutan default dari katalog".
--
-- Hasilnya: hapus = keluarkan key dari array (tanggalnya tetap tersimpan),
-- tambah = tambah baris katalog + masukkan key-nya ke array tender itu,
-- ubah urutan = susun ulang arraynya. Per-tender, tanpa menyentuh data lama.
--
-- Aman dijalankan berulang (idempotent). Tidak ada DROP, tidak ada
-- DELETE, tidak ada UPDATE terhadap data yang ada.

-- ---------------------------------------------------------------------------
-- 1. Katalog milestone global
-- ---------------------------------------------------------------------------

create table if not exists public.milestone_types (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  sort_order integer not null default 0,
  -- Whether this milestone is shown by default in the (very dense) tender
  -- table. The Columns menu can still toggle it per session; this is only the
  -- starting state. Without it the table would have to show every milestone,
  -- and a custom one with a long label would wreck the layout.
  show_in_table boolean not null default true,
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Sama seperti tabel lain di project ini: RLS aktif tanpa policy, sehingga
-- hanya service-role key (dipakai server-side oleh app) yang bisa akses.
alter table public.milestone_types enable row level security;

-- 12 milestone yang sekarang di-hardcode di src/lib/types.ts MILESTONE_DEFS.
-- sort_order berjarak 10 supaya gampang menyisipkan di antaranya nanti.
-- show_in_table menyalin persis DEFAULT_VISIBLE_COLUMNS yang lama, supaya
-- tampilan tabel setelah migrasi ini tidak berubah sedikit pun.
-- `on conflict (key) do nothing` = aman dijalankan ulang, dan TIDAK menimpa
-- label/urutan kalau kamu sudah mengubahnya lewat aplikasi.
insert into public.milestone_types (key, label, sort_order, show_in_table) values
  ('regist',            'Registration',                              10, true),
  ('pq',                'PQ',                                        20, true),
  ('technicalPq',       'Technical PQ',                              30, false),
  ('prebid',            'Prebid',                                    40, true),
  ('secondPrebid',      'Second Prebid',                             50, false),
  ('technicalBidding',  'Technical Bidding',                         60, false),
  ('sampelLab',         'Chemical Sample Received at Lab Test',      70, false),
  ('pengirimanBukti',   'Independent Lab Payment Proof Sent',        80, false),
  ('pemasukanDokumen',  'Bid Document Submission',                   90, false),
  ('fieldTest',         'Field Test',                               100, true),
  ('openBid',           'Open Bid',                                 110, true),
  ('firstDelivery',     'First Delivery',                           120, false)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Urutan + pilihan milestone per tender
-- ---------------------------------------------------------------------------

-- NULL = pakai urutan default katalog. Array = urutan eksplisit tender ini;
-- key yang tidak ada di array berarti milestone itu disembunyikan/dihapus
-- untuk tender ini (tanggalnya TIDAK dihapus dari tenders.milestones).
alter table public.tenders add column if not exists milestone_order text[];

comment on column public.tenders.milestone_order is
  'Urutan + pilihan milestone khusus untuk tender ini. NULL = pakai urutan default dari milestone_types.sort_order. Tanggal milestone tetap disimpan di tenders.milestones (jsonb).';

-- ---------------------------------------------------------------------------
-- Catatan: fungsi notification_counts() dari migrasi 0005 TIDAK diubah.
-- Karena tanggal tetap di tenders.milestones, hitungan badge tetap benar
-- tanpa penyesuaian. Migrasi ini tidak bergantung pada 0005.
-- ---------------------------------------------------------------------------
