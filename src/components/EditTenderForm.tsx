"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { updateTender } from "@/lib/actions";
import {
  MILESTONE_DEFS,
  RESULT_ENUM,
  type FilterOptions,
  type MilestoneKey,
  type Tender,
  type TenderEditFormValues,
} from "@/lib/types";
import shared from "./shared.module.css";
import styles from "./NewTenderForm.module.css";

function toFormValues(tender: Tender): TenderEditFormValues {
  const milestones: Partial<Record<MilestoneKey, string>> = {};
  for (const d of MILESTONE_DEFS) {
    milestones[d.key] = tender.milestones[d.key] || "";
  }
  return {
    area: tender.area,
    tenderNo: tender.tenderNo || "",
    customer: tender.customer,
    product: tender.product || "",
    entitas: tender.entitas || "",
    qty: tender.qty != null ? String(tender.qty) : "",
    oe: tender.oe != null ? String(tender.oe) : "",
    nilaiPenawaran: tender.nilaiPenawaran != null ? String(tender.nilaiPenawaran) : "",
    milestones,
    result: tender.result || "",
    carryOver: tender.carryOver || "",
    remarks: tender.remarks || "",
  };
}

export function EditTenderForm({ tender, options }: { tender: Tender; options: FilterOptions }) {
  const [formData, setFormData] = useState<TenderEditFormValues>(() => toFormValues(tender));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function field<K extends keyof TenderEditFormValues>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setFormData((f) => ({ ...f, [key]: e.target.value }));
  }

  function setMilestone(key: MilestoneKey, value: string) {
    setFormData((f) => ({ ...f, milestones: { ...f.milestones, [key]: value } }));
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await updateTender(tender.id, formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className={styles.page}>
      <Link href={`/tenders/${tender.id}`} className={shared.cardMeta} style={{ display: "inline-block", marginBottom: 16 }}>
        &larr; Batalkan, kembali ke detail
      </Link>

      <div className={`${shared.card} ${styles.card}`}>
        <div className={styles.fieldColumn}>
          <label className={styles.label}>
            Area
            <select className={styles.input} value={formData.area} onChange={field("area")}>
              <option value="">Pilih area</option>
              {options.areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.label}>
            No. Tender
            <input className={styles.input} value={formData.tenderNo} onChange={field("tenderNo")} placeholder="No. Tender" />
          </label>
          <label className={styles.label}>
            Customer
            <input
              className={styles.input}
              value={formData.customer}
              onChange={field("customer")}
              placeholder="Nama customer"
              list="customerList"
            />
            <datalist id="customerList">
              {options.customers.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className={styles.label}>
            Judul Paket
            <textarea
              className={styles.textarea}
              value={formData.product}
              onChange={field("product")}
              placeholder="Judul paket tender"
              rows={3}
            />
          </label>
          <label className={styles.label}>
            Entitas / Konsorsium
            <input
              className={styles.input}
              value={formData.entitas}
              onChange={field("entitas")}
              placeholder="mis. ZKI atau ZKI-RGA"
              list="entitasList"
            />
            <datalist id="entitasList">
              {options.entitasList.map((e) => (
                <option key={e} value={e} />
              ))}
            </datalist>
          </label>
          <div className={styles.fieldRow2}>
            <label className={styles.label}>
              Qty
              <input className={styles.input} value={formData.qty} onChange={field("qty")} placeholder="mis. 12000" />
            </label>
            <label className={styles.label}>
              OE (Rp)
              <input className={styles.input} value={formData.oe} onChange={field("oe")} placeholder="Nilai OE" />
            </label>
          </div>
          <label className={styles.label}>
            Nilai Penawaran Kita (Rp)
            <input
              className={styles.input}
              value={formData.nilaiPenawaran}
              onChange={field("nilaiPenawaran")}
              placeholder="Nilai penawaran"
            />
          </label>
          <div className={styles.fieldRow2}>
            <label className={styles.label}>
              Result
              <select className={styles.input} value={formData.result} onChange={field("result")}>
                <option value="">(Berjalan / belum ada hasil)</option>
                {RESULT_ENUM.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.label}>
              Carry Over
              <input
                className={styles.input}
                value={formData.carryOver}
                onChange={field("carryOver")}
                placeholder="mis. Lanjutan dari 2024-2025"
              />
            </label>
          </div>
          <label className={styles.label}>
            Remarks
            <textarea
              className={styles.textarea}
              value={formData.remarks}
              onChange={field("remarks")}
              placeholder="Catatan, ranking harga kompetitor, dsb."
              rows={6}
            />
          </label>
        </div>

        <div className={styles.hint} style={{ marginTop: 20 }}>
          Tanggal milestone boleh dikosongkan jika belum diketahui.
        </div>
        <div className={styles.milestoneGrid}>
          {MILESTONE_DEFS.map((d) => (
            <label key={d.key} className={styles.label}>
              {d.label}
              <input
                type="date"
                className={styles.input}
                value={formData.milestones[d.key] || ""}
                onChange={(e) => setMilestone(d.key, e.target.value)}
              />
            </label>
          ))}
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}

        <div className={styles.footer}>
          <Link href={`/tenders/${tender.id}`} className={styles.backButton} style={{ textDecoration: "none" }}>
            Batal
          </Link>
          <button className={styles.nextButton} onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </div>
    </div>
  );
}
