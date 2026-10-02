-- Upstream / downstream: satu tabel, satu kolom pembeda.
--
-- Keputusan desain (dan alasannya):
--
-- 1. DUA JALUR, SATU TABEL. Yang membedakan keduanya hanya katalog milestone
--    bawaannya — tabel, kolom, riwayat, dokumen, reminder, dan export
--    seluruhnya sama. Tabel `tenders` kedua adalah duplikasi yang pasti akan
--    menyimpang: setiap perbaikan harus dikerjakan dua kali, dan setiap query
--    laporan harus UNION dua tempat. Jadi cukup satu kolom `track`.
--
-- 2. KATALOG TERPISAH PER JALUR, KEY TETAP UNIK GLOBAL. Tanggal milestone
--    hidup di `tenders.milestones` (jsonb) dengan `key` sebagai kuncinya. Kalau
--    kedua jalur boleh memakai key yang sama (mis. `regist` untuk berbeda
--    label), maka mengganti nama di satu jalur akan diam-diam mengubah arti
--    tanggal di jalur lain — tanpa error, dan ketahuan setelah datanya salah.
--    Karena itu milestone downstream memakai awalan `ds`, dan constraint
--    `key unique` dari migrasi 0006 TIDAK dilonggarkan.
--
-- 3. DOWNSTREAM DEFAULT-NYA `show_in_table = true` untuk lima milestone yang
--    menandai gerbang proses (Pendaftaran, Prakualifikasi, Prebid, Bidding,
--    Negosiasi 3) — jumlah kolom di tabel jadi sama dengan upstream yang
--    menampilkan 5 dari 12. Sisanya tetap bisa dinyalakan lewat menu Columns
--    atau kotak "In table" di halaman Manage milestones.
--
-- 4. NILAI BAWAAN `upstream`. Semua baris yang sudah ada — 270 tender dan
--    12 milestone — otomatis menjadi upstream, tanpa satu pun baris berubah
--    nilai. Tidak ada DELETE data di migrasi ini.
--
-- 5. `notification_counts()` (0005/0008) TIDAK diubah. Lonceng memang harus
--    menghitung kedua jalur sekaligus, dan karena key unik global, fungsi itu
--    sudah benar apa adanya.
--
-- 6. KENAPA ADA LANGKAH PERBAIKAN KATALOG (bagian 0).
--    Migrasi 0006 membuat tabelnya dengan `create table if not exists` — dan
--    `create table if not exists` TIDAK menambahkan kolom ke tabel yang sudah
--    ada. Kalau tabel `milestone_types` dibuat dari revisi 0006 yang lebih
--    lama, kolom seperti `show_in_table` tidak pernah masuk, dan insert di
--    bawah gagal dengan:
--      ERROR: 42703: column "show_in_table" of relation "milestone_types"
--      does not exist
--    Lebih buruk lagi: query aplikasi yang membaca kolom itu ikut gagal, dan
--    aplikasi diam-diam jatuh ke 12 milestone bawaan — halaman Manage
--    milestones tampak normal padahal katalog di database tidak pernah dipakai.
--    Bagian 0 menutup celah itu, sekaligus mengisi 12 milestone upstream kalau
--    seed 0006 dulu ikut gagal.
--
-- Aman dijalankan berulang. Tidak ada DROP tabel dan tidak ada DELETE data.

-- ---------------------------------------------------------------------------
-- 0. Perbaikan katalog milestone
-- ---------------------------------------------------------------------------

alter table public.milestone_types add column if not exists id uuid default gen_random_uuid();
alter table public.milestone_types add column if not exists key text;
alter table public.milestone_types add column if not exists label text;
alter table public.milestone_types add column if not exists sort_order integer not null default 0;
alter table public.milestone_types add column if not exists show_in_table boolean not null default true;
alter table public.milestone_types add column if not exists archived_at timestamptz;
alter table public.milestone_types add column if not exists created_by uuid references public.profiles (id) on delete set null;
alter table public.milestone_types add column if not exists created_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- 1. Jalur pada tender
-- ---------------------------------------------------------------------------

alter table public.tenders add column if not exists track text not null default 'upstream';

alter table public.tenders drop constraint if exists tenders_track_check;
alter table public.tenders add constraint tenders_track_check
  check (track in ('upstream', 'downstream'));

-- Halaman Tenders selalu menyaring satu jalur, jadi indeks ini dipakai.
create index if not exists tenders_track_idx on public.tenders (track);

comment on column public.tenders.track is
  'upstream | downstream. Hanya menentukan katalog milestone bawaan yang dipakai; sisanya sama. Lihat migrasi 0009.';

-- ---------------------------------------------------------------------------
-- 2. Jalur pada katalog milestone
-- ---------------------------------------------------------------------------

alter table public.milestone_types add column if not exists track text not null default 'upstream';

alter table public.milestone_types drop constraint if exists milestone_types_track_check;
alter table public.milestone_types add constraint milestone_types_track_check
  check (track in ('upstream', 'downstream'));

comment on column public.milestone_types.track is
  'Milestone ini milik jalur mana. Katalog kedua jalur berdiri sendiri: menambah, mengganti nama, dan mengurutkan di satu jalur tidak menyentuh jalur lain.';

-- ---------------------------------------------------------------------------
-- 3. Dua belas milestone upstream, lalu tujuh milestone downstream
-- ---------------------------------------------------------------------------
--
-- `where not exists` = aman dijalankan ulang dan TIDAK menimpa label/urutan
-- kalau kamu sudah mengubahnya lewat aplikasi. Seed upstream di sini juga yang
-- mengisi katalog kalau seed migrasi 0006 dulu ikut gagal.

insert into public.milestone_types (key, label, sort_order, track)
select v.key, v.label, v.sort_order, 'upstream'
from (values
  ('regist',           'Registration',                            10),
  ('pq',               'PQ',                                      20),
  ('technicalPq',      'Technical PQ',                            30),
  ('prebid',           'Prebid',                                  40),
  ('secondPrebid',     'Second Prebid',                           50),
  ('technicalBidding', 'Technical Bidding',                       60),
  ('sampelLab',        'Chemical Sample Received at Lab Test',    70),
  ('pengirimanBukti',  'Independent Lab Payment Proof Sent',      80),
  ('pemasukanDokumen', 'Bid Document Submission',                 90),
  ('fieldTest',        'Field Test',                             100),
  ('openBid',          'Open Bid',                               110),
  ('firstDelivery',    'First Delivery',                         120)
) as v(key, label, sort_order)
where not exists (select 1 from public.milestone_types mt where mt.key = v.key);

insert into public.milestone_types (key, label, sort_order, track)
select v.key, v.label, v.sort_order, 'downstream'
from (values
  ('dsPendaftaran',    'Pendaftaran',    10),
  ('dsPrakualifikasi', 'Prakualifikasi', 20),
  ('dsPrebid',         'Prebid',         30),
  ('dsBidding',        'Bidding',        40),
  ('dsNegosiasi1',     'Negosiasi 1',    50),
  ('dsNegosiasi2',     'Negosiasi 2',    60),
  ('dsNegosiasi3',     'Negosiasi 3',    70)
) as v(key, label, sort_order)
where not exists (select 1 from public.milestone_types mt where mt.key = v.key);

-- ---------------------------------------------------------------------------
-- 4. Kolom yang tampil di tabel tender
-- ---------------------------------------------------------------------------
--
-- Hanya yang menandai gerbang proses, supaya tabel tetap ringkas (5 kolom per
-- jalur, sama seperti sebelumnya). Dijaga `if exists` supaya tidak gagal kalau
-- kolomnya belum ada karena alasan lain.

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'milestone_types'
               and column_name = 'show_in_table') then
    update public.milestone_types set show_in_table = true
      where key in ('regist', 'pq', 'prebid', 'fieldTest', 'openBid',
                    'dsPendaftaran', 'dsPrakualifikasi', 'dsPrebid', 'dsBidding', 'dsNegosiasi3');
    update public.milestone_types set show_in_table = false
      where key in ('technicalPq', 'secondPrebid', 'technicalBidding', 'sampelLab',
                    'pengirimanBukti', 'pemasukanDokumen', 'firstDelivery',
                    'dsNegosiasi1', 'dsNegosiasi2');
  end if;
end $$;

-- Hasil akhir: 12 milestone upstream + 7 milestone downstream.
select track, sort_order, key, label, show_in_table
from public.milestone_types
order by track, sort_order;
