"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { archiveTender, updateTender } from "@/lib/actions";
import { findDuplicateTenderNo, findOutOfOrderMilestones } from "@/lib/tender-logic";
import {
  MILESTONE_DEFS,
  RESULT_ENUM,
  type MilestoneKey,
  type SelectOptionsMap,
  type Tender,
  type TenderEditFormValues,
} from "@/lib/types";
import { OptionSelect } from "./OptionSelect";
import { NumberInput } from "./NumberInput";
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
    oeCatatan: tender.oeCatatan || "",
    nilaiPenawaran: tender.nilaiPenawaran != null ? String(tender.nilaiPenawaran) : "",
    milestones,
    result: tender.result || "",
    carryOver: tender.carryOver || "",
    remarks: tender.remarks || "",
    remark: tender.remark || "",
    pnl: tender.pnl,
    catatanInternal: tender.catatanInternal || "",
  };
}

export function EditTenderForm({
  tender,
  selectOptions,
  existingTenders,
}: {
  tender: Tender;
  selectOptions: SelectOptionsMap;
  existingTenders: { id: string; tenderNo: string | null }[];
}) {
  const [formData, setFormData] = useState<TenderEditFormValues>(() => toFormValues(tender));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isDuplicateTenderNo = useMemo(
    () => findDuplicateTenderNo(formData.tenderNo, existingTenders, tender.id),
    [formData.tenderNo, existingTenders, tender.id]
  );
  const milestoneOrderIssues = useMemo(() => findOutOfOrderMilestones(formData.milestones), [formData.milestones]);

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

  function handleArchive() {
    if (!confirm("Archive this tender? It will be hidden from the dashboard and table until restored.")) return;
    setError(null);
    startTransition(async () => {
      const result = await archiveTender(tender.id);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className={styles.page}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Link href={`/tenders/${tender.id}`} className={shared.cardMeta}>
          &larr; Cancel, back to detail
        </Link>
        <button
          onClick={handleArchive}
          disabled={isPending}
          style={{ background: "none", border: "none", color: "var(--zk-error)", fontSize: 12.5, cursor: "pointer" }}
        >
          Archive tender
        </button>
      </div>

      <div className={`${shared.card} ${styles.card}`}>
        <div className={styles.fieldColumn}>
          <label className={styles.label}>
            Area <span className={styles.required}>*</span>
            <OptionSelect
              field="area"
              label="Area"
              className={styles.input}
              value={formData.area}
              options={selectOptions.area}
              onChange={(v) => setFormData((f) => ({ ...f, area: v }))}
              required
            />
          </label>
          <label className={styles.label}>
            Tender No.
            <input className={styles.input} value={formData.tenderNo} onChange={field("tenderNo")} placeholder="Tender number" />
            {isDuplicateTenderNo && (
              <span className={styles.fieldWarning}>Another tender already uses this number.</span>
            )}
          </label>
          <label className={styles.label}>
            Customer <span className={styles.required}>*</span>
            <OptionSelect
              field="customer"
              label="Customer"
              className={styles.input}
              value={formData.customer}
              options={selectOptions.customer}
              onChange={(v) => setFormData((f) => ({ ...f, customer: v }))}
              required
            />
          </label>
          <label className={styles.label}>
            Package Title
            <textarea
              className={styles.textarea}
              value={formData.product}
              onChange={field("product")}
              placeholder="Tender package title"
              rows={3}
            />
          </label>
          <label className={styles.label}>
            Entity / Consortium
            <OptionSelect
              field="entitas"
              label="Entity / Consortium"
              className={styles.input}
              value={formData.entitas}
              options={selectOptions.entitas}
              onChange={(v) => setFormData((f) => ({ ...f, entitas: v }))}
            />
          </label>
          <div className={styles.fieldRow2}>
            <label className={styles.label}>
              Qty
              <NumberInput
                className={styles.input}
                value={formData.qty}
                onChange={(v) => setFormData((f) => ({ ...f, qty: v }))}
                placeholder="e.g. 12,000"
              />
            </label>
            <label className={styles.label}>
              OE (Rp)
              <NumberInput
                className={styles.input}
                value={formData.oe}
                onChange={(v) => setFormData((f) => ({ ...f, oe: v }))}
                placeholder="OE value"
              />
            </label>
          </div>
          <label className={styles.label}>
            OE Note
            <input
              className={styles.input}
              value={formData.oeCatatan}
              onChange={field("oeCatatan")}
              placeholder="e.g. Confidential, or a foreign-currency amount"
            />
          </label>
          <label className={styles.label}>
            Our Bid Value (Rp)
            <NumberInput
              className={styles.input}
              value={formData.nilaiPenawaran}
              onChange={(v) => setFormData((f) => ({ ...f, nilaiPenawaran: v }))}
              placeholder="Bid value"
            />
          </label>
          <div className={styles.fieldRow2}>
            <label className={styles.label}>
              Result
              <select className={styles.input} value={formData.result} onChange={field("result")}>
                <option value="">(Running / no result yet)</option>
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
                placeholder="e.g. Carried over from 2024-2025"
              />
            </label>
          </div>
          <label className={styles.label}>
            Remarks
            <textarea
              className={styles.textarea}
              value={formData.remarks}
              onChange={field("remarks")}
              placeholder="Notes, competitor price ranking, etc."
              rows={6}
            />
          </label>
          <label className={styles.label}>
            Remark
            <input
              className={styles.input}
              value={formData.remark}
              onChange={field("remark")}
              placeholder="Short status note"
            />
          </label>
          <div className={styles.fieldRow2}>
            <label className={styles.label} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={formData.pnl}
                onChange={(e) => setFormData((f) => ({ ...f, pnl: e.target.checked }))}
              />
              P&amp;L
            </label>
          </div>
          <label className={styles.label}>
            Internal Notes <span style={{ color: "var(--color-fg3)", fontWeight: 400 }}>(admin only)</span>
            <textarea
              className={styles.textarea}
              value={formData.catatanInternal}
              onChange={field("catatanInternal")}
              placeholder="Internal working notes"
              rows={3}
            />
          </label>
        </div>

        <div className={styles.hint} style={{ marginTop: 20 }}>
          Milestone dates can be left blank if not yet known.
        </div>
        {milestoneOrderIssues.length > 0 && (
          <div className={styles.orderWarning}>
            {milestoneOrderIssues.map((issue, i) => (
              <div key={i}>
                &ldquo;{issue.laterLabel}&rdquo; is dated before &ldquo;{issue.earlierLabel}&rdquo; — double-check these
                dates.
              </div>
            ))}
          </div>
        )}
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
            Cancel
          </Link>
          <button className={styles.nextButton} onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
