-- Reminder H-3 untuk milestone, dihitung di database.
--
-- Menambah `due_h3` (milestone terdekat dalam 3 hari) pada fungsi hitungan
-- lonceng, dan sekaligus memperbaiki satu ketidakcocokan yang sudah ada.
--
-- KETIDAKCOCOKAN YANG DIPERBAIKI
-- Versi 0005 mengambil tanggal terdekat dari SEMUA key di tenders.milestones.
-- Padahal TypeScript-nya lewat resolveTenderMilestones(), yang menghormati
-- tenders.milestone_order: kalau sebuah milestone disembunyikan untuk satu
-- tender (dikeluarkan dari array itu), tender tersebut TIDAK boleh diingatkan
-- tentang milestone itu. Versi 0005 tetap menghitungnya, jadi reminder bisa
-- muncul untuk milestone yang bahkan tidak ditampilkan di halaman tendernya.
--
-- Sekarang key yang dihitung mengikuti resolveTenderMilestones() persis:
--   * tender tanpa override  -> semua key yang masih ada di katalog
--   * tender dengan override -> hanya key di array itu, yang masih ada di katalog
-- Key yang sudah tidak ada di katalog (mis. milestone diarsipkan) diabaikan,
-- sama seperti `.filter()` di TypeScript.
--
-- SATU PERBEDAAN YANG DISENGAJA
-- resolveTenderMilestones() jatuh ke 12 milestone bawaan kalau katalognya kosong
-- (perilaku warisan dari masa sebelum migrasi 0006). Fungsi ini tidak: katalog
-- kosong berarti tidak ada yang dilacak, jadi tidak ada reminder. Menyalin 12
-- key itu ke SQL hanya akan menduplikasi data yang sudah ada di tabel katalog.
--
-- Aman dijalankan berulang. Tidak ada DROP tabel dan tidak ada DELETE.

create or replace function public.notification_counts()
returns table (due_h3 integer, due_soon integer, stalled integer)
language sql
stable
set search_path = public
as $$
  with active as (
    select t.id, t.milestones, t.milestone_order
      from public.tenders t
     where t.archived_at is null
       and t.result is null
  ),
  next_dates as (
    select
      a.id,
      (
        select min(m.value::date)
          from jsonb_each_text(a.milestones) as m(key, value)
         where m.value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
           and m.value::date >= current_date
           -- Milestone yang sudah tidak ada di katalog tidak ditampilkan di mana
           -- pun, jadi tidak boleh memicu reminder.
           and m.key in (select mt.key from public.milestone_types mt where mt.archived_at is null)
           -- Override per tender: hanya key yang tercantum di array itu.
           -- `cardinality = 0` diperlakukan sama dengan NULL, karena
           -- resolveTenderMilestones() memperlakukan array kosong sebagai
           -- "tidak ada override".
           and (
             coalesce(cardinality(a.milestone_order), 0) = 0
             or m.key = any(a.milestone_order)
           )
      ) as next_date
    from active a
  )
  select
    count(*) filter (where next_date is not null and next_date <= current_date + 3)::int as due_h3,
    count(*) filter (where next_date is not null and next_date <= current_date + 14)::int as due_soon,
    count(*) filter (where next_date is null)::int as stalled
  from next_dates;
$$;

comment on function public.notification_counts() is
  'Nav badge counts computed in the database: due_h3 (reminder, next milestone within 3 days), due_soon (within 14 days), stalled (nothing scheduled ahead). Mirrors computeDeadlines()/computeStalled() in src/lib/tender-logic.ts, including the per-tender tenders.milestone_order override.';
