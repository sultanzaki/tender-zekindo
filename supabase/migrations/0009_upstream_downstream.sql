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
-- 4. NILAI BAWAAN `upstream`. Semua baris yang sudah ada — 270 tender dan 12
--    milestone — otomatis menjadi upstream, tanpa satu pun baris berubah nilai.
--    Tidak ada UPDATE dan tidak ada DELETE di migrasi ini.
--
-- 5. `notification_counts()` (0005/0008) TIDAK diubah. Lonceng memang harus
--    menghitung kedua jalur sekaligus, dan karena key unik global, fungsi itu
--    sudah benar apa adanya.
--
-- Aman dijalankan berulang.

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
-- 3. Tujuh milestone bawaan downstream
-- ---------------------------------------------------------------------------
--
-- `on conflict (key) do nothing` = aman dijalankan ulang dan TIDAK menimpa
-- label/urutan kalau kamu sudah mengubahnya lewat aplikasi.

insert into public.milestone_types (key, label, sort_order, show_in_table, track) values
  ('dsPendaftaran',    'Pendaftaran',    10, true,  'downstream'),
  ('dsPrakualifikasi', 'Prakualifikasi', 20, true,  'downstream'),
  ('dsPrebid',         'Prebid',         30, true,  'downstream'),
  ('dsBidding',        'Bidding',        40, true,  'downstream'),
  ('dsNegosiasi1',     'Negosiasi 1',    50, false, 'downstream'),
  ('dsNegosiasi2',     'Negosiasi 2',    60, false, 'downstream'),
  ('dsNegosiasi3',     'Negosiasi 3',    70, true,  'downstream')
on conflict (key) do nothing;
