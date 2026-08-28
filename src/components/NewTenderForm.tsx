"use client";

import { useState } from "react";
import Link from "next/link";
import { MILESTONE_DEFS, type FilterOptions, type MilestoneKey } from "@/lib/types";
import shared from "./shared.module.css";
import styles from "./NewTenderForm.module.css";

interface FormData {
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

const EMPTY_FORM: FormData = {
  area: "",
  tenderNo: "",
  customer: "",
  product: "",
  entitas: "",
  qty: "",
  oe: "",
  nilaiPenawaran: "",
  milestones: {},
};

const STEP_LABELS = ["Identitas Tender", "Nilai & Entitas", "Tanggal Milestone"];

export function NewTenderForm({ options }: { options: FilterOptions }) {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);

  function field<K extends keyof FormData>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setFormData((f) => ({ ...f, [key]: e.target.value }));
  }

  function setMilestone(key: MilestoneKey, value: string) {
    setFormData((f) => ({ ...f, milestones: { ...f.milestones, [key]: value } }));
  }

  const summary = `${formData.customer || "(customer belum diisi)"} — ${
    formData.product || "(judul paket belum diisi)"
  }`;

  return (
    <div className={styles.page}>
      <div className={`${shared.card} ${styles.card}`}>
        {submitted ? (
          <div className={styles.successWrap}>
            <div className={styles.successTitle}>Data tender tersimpan</div>
            <div className={styles.successSummary}>{summary}</div>
            <Link href="/tenders" className={styles.primaryButton} style={{ display: "inline-block" }}>
              Lihat Tabel Tender
            </Link>
          </div>
        ) : (
          <div>
            <div className={styles.steps}>
              {STEP_LABELS.map((label, i) => {
                const num = i + 1;
                const active = num <= step;
                return (
                  <div key={label} className={styles.step} style={{ flex: num === 3 ? "0 0 auto" : "1" }}>
                    <div className={`${styles.stepCircle} ${active ? styles.stepCircleActive : ""}`}>{num}</div>
                    <div className={`${styles.stepLabel} ${active ? styles.stepLabelActive : ""}`}>{label}</div>
                    {num !== 3 && <div className={styles.stepLine} />}
                  </div>
                );
              })}
            </div>

            {step === 1 && (
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
                  <input
                    className={styles.input}
                    value={formData.tenderNo}
                    onChange={field("tenderNo")}
                    placeholder="No. Tender"
                  />
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
              </div>
            )}

            {step === 2 && (
              <div className={styles.fieldColumn}>
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
                    Qty (Liter/Barel)
                    <input
                      className={styles.input}
                      value={formData.qty}
                      onChange={field("qty")}
                      placeholder="mis. 12.000 Liter"
                    />
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
              </div>
            )}

            {step === 3 && (
              <div>
                <div className={styles.hint}>Tanggal boleh dikosongkan jika belum diketahui.</div>
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
              </div>
            )}

            <div className={styles.footer}>
              <button
                className={`${styles.backButton} ${step === 1 ? styles.backButtonHidden : ""}`}
                onClick={() => setStep((s) => Math.max(1, s - 1))}
              >
                Kembali
              </button>
              {step === 3 ? (
                <button className={styles.nextButton} onClick={() => setSubmitted(true)}>
                  Simpan Tender
                </button>
              ) : (
                <button className={styles.nextButton} onClick={() => setStep((s) => Math.min(3, s + 1))}>
                  Lanjut
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
