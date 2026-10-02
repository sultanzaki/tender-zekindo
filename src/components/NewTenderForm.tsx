"use client";

import { useMemo, useState, useTransition } from "react";
import { createTender } from "@/lib/actions";
import { findDuplicateTenderNo, findOutOfOrderMilestones } from "@/lib/tender-logic";
import { type MilestoneType, type SelectOptionsMap, type TenderFormValues } from "@/lib/types";
import { OptionSelect } from "./OptionSelect";
import { NumberInput } from "./NumberInput";
import shared from "./shared.module.css";
import styles from "./NewTenderForm.module.css";

const EMPTY_FORM: TenderFormValues = {
  area: "",
  tenderNo: "",
  customer: "",
  product: "",
  entitas: "",
  qty: "",
  oe: "",
  oeCatatan: "",
  nilaiPenawaran: "",
  milestones: {},
};

const STEP_LABELS = ["Tender Details", "Value & Entity", "Milestone Dates"];

export function NewTenderForm({
  selectOptions,
  milestoneTypes,
  existingTenders,
}: {
  selectOptions: SelectOptionsMap;
  milestoneTypes: MilestoneType[];
  existingTenders: { id: string; tenderNo: string | null }[];
}) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<TenderFormValues>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function field<K extends keyof TenderFormValues>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setFormData((f) => ({ ...f, [key]: e.target.value }));
  }

  function setMilestone(key: string, value: string) {
    setFormData((f) => ({ ...f, milestones: { ...f.milestones, [key]: value } }));
  }

  const isDuplicateTenderNo = useMemo(
    () => findDuplicateTenderNo(formData.tenderNo, existingTenders),
    [formData.tenderNo, existingTenders]
  );
  const milestoneOrderIssues = useMemo(
    () => findOutOfOrderMilestones(formData.milestones, milestoneTypes),
    [formData.milestones, milestoneTypes]
  );

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await createTender(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className={styles.page}>
      <div className={`${shared.card} ${styles.card}`}>
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
              <input
                className={styles.input}
                value={formData.tenderNo}
                onChange={field("tenderNo")}
                placeholder="Tender number"
              />
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
          </div>
        )}

        {step === 2 && (
          <div className={styles.fieldColumn}>
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
          </div>
        )}

        {step === 3 && (
          <div>
            <div className={styles.hint}>Dates can be left blank if not yet known.</div>
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
              {milestoneTypes.map((m) => (
                <label key={m.key} className={styles.label}>
                  {m.label}
                  <input
                    type="date"
                    className={styles.input}
                    value={formData.milestones[m.key] || ""}
                    onChange={(e) => setMilestone(m.key, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        {error && <div className={styles.errorBanner}>{error}</div>}

        <div className={styles.footer}>
          <button
            className={`${styles.backButton} ${step === 1 ? styles.backButtonHidden : ""}`}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={isPending}
          >
            Back
          </button>
          {step === 3 ? (
            <button className={styles.nextButton} onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Saving..." : "Save Tender"}
            </button>
          ) : (
            <button className={styles.nextButton} onClick={() => setStep((s) => Math.min(3, s + 1))}>
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
