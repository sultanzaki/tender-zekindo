"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { createTender } from "@/lib/actions";
import { ensureMilestoneTypeByName } from "@/lib/milestone-actions";
import { findDuplicateTenderNo, findOutOfOrderMilestones } from "@/lib/tender-logic";
import { type MilestoneType, type SelectOptionsMap, type TenderFormValues, type Track } from "@/lib/types";
import { OptionSelect } from "./OptionSelect";
import { NumberInput } from "./NumberInput";
import shared from "./shared.module.css";
import styles from "./NewTenderForm.module.css";

const EMPTY_FORM: TenderFormValues = {
  // Replaced with the real track by the page — see the useState below. The form
  // only ever CREATES a tender inside a track; a tender's track can never change.
  track: "upstream",
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
  track,
  selectOptions,
  milestoneTypes,
  existingTenders,
}: {
  /** The track this tender is being created in, from the list page's URL. It
   * decides which milestone catalog the form offers, and is stored on the row. */
  track: Track;
  selectOptions: SelectOptionsMap;
  milestoneTypes: MilestoneType[];
  existingTenders: { id: string; tenderNo: string | null }[];
}) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<TenderFormValues>({ ...EMPTY_FORM, track });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Milestone order/subset for the tender being created. Starts as the catalog
  // order; anything the user changes here is saved into tenders.milestone_order
  // on submit, so the choice is made before the tender exists rather than only
  // afterwards in the edit form.
  const [order, setOrder] = useState<string[]>(() => milestoneTypes.map((m) => m.key));
  const addSelectRef = useRef<HTMLSelectElement>(null);

  // Milestones created from this form, kept locally because the catalog prop was
  // read on the server before they existed. Without this the new milestone would
  // be in the order array but have no label to render.
  const [extraTypes, setExtraTypes] = useState<MilestoneType[]>([]);
  const [newMilestoneLabel, setNewMilestoneLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const allTypes = useMemo(() => [...milestoneTypes, ...extraTypes], [milestoneTypes, extraTypes]);

  const catalogByKey = useMemo(() => new Map(allTypes.map((m) => [m.key, m])), [allTypes]);
  const orderedDefs = useMemo(
    () => order.map((k) => catalogByKey.get(k)).filter((m): m is MilestoneType => !!m),
    [order, catalogByKey]
  );
  const hiddenDefs = useMemo(
    () => allTypes.filter((m) => !order.includes(m.key)),
    [allTypes, order]
  );

  /** Creates the milestone (or reuses it if the name exists) and puts it at the
   * end of this tender's order. */
  function createMilestone() {
    const label = newMilestoneLabel.trim();
    if (!label) return;
    setError(null);
    setCreating(true);
    startTransition(async () => {
      const result = await ensureMilestoneTypeByName(label, track);
      setCreating(false);
      const key = result.key;
      if (result.error || !key) {
        setError(result.error ?? "Gagal membuat milestone.");
        return;
      }
      setExtraTypes((types) =>
        types.some((t) => t.key === key)
          ? types
          : [...types, { id: key, key, track, label, sortOrder: 0, showInTable: false }]
      );
      setOrder((o) => (o.includes(key) ? o : [...o, key]));
      setNewMilestoneLabel("");
    });
  }

  // ── Milestone order ─────────────────────────────────────────────────────
  function moveInOrder(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    setOrder((o) => {
      const next = [...o];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeFromOrder(key: string) {
    setOrder((o) => o.filter((k) => k !== key));
  }

  function addFromSelect() {
    const key = addSelectRef.current?.value;
    if (!key) return;
    setOrder((o) => (o.includes(key) ? o : [...o, key]));
    if (addSelectRef.current) addSelectRef.current.value = "";
  }

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
      const result = await createTender({ ...formData, milestoneOrder: order });
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
            {/* Milestone order & selection for the tender being created. Saved
                into tenders.milestone_order when the tender is created; the date
                inputs below follow the order. */}
            <div className={styles.hint} style={{ marginBottom: 10 }}>
              Milestones for this tender. Use ↑ ↓ to reorder, Remove to leave one out — you can add it back from the
              dropdown. Removing only hides it for this tender; nothing is deleted from the catalog.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              {orderedDefs.map((m, i) => (
                <div key={m.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 13 }}>
                    {i + 1}. {m.label}
                  </span>
                  <button
                    type="button"
                    className={styles.backButton}
                    onClick={() => moveInOrder(i, -1)}
                    disabled={i === 0 || isPending}
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={styles.backButton}
                    onClick={() => moveInOrder(i, 1)}
                    disabled={i === orderedDefs.length - 1 || isPending}
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={styles.backButton}
                    onClick={() => removeFromOrder(m.key)}
                    disabled={isPending}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              {hiddenDefs.length > 0 && (
                <select ref={addSelectRef} className={styles.input} defaultValue="">
                  <option value="" disabled>
                    Add a milestone…
                  </option>
                  {hiddenDefs.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              )}
              {hiddenDefs.length > 0 && (
                <button type="button" className={styles.backButton} onClick={addFromSelect} disabled={isPending}>
                  Add
                </button>
              )}
            </div>

            {/* Milesone baru: namanya bebas, tidak terpatok daftar di atas. */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <input
                className={styles.input}
                value={newMilestoneLabel}
                onChange={(e) => setNewMilestoneLabel(e.target.value)}
                placeholder="Tulis nama milestone baru…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    createMilestone();
                  }
                }}
              />
              <button
                type="button"
                className={styles.backButton}
                onClick={createMilestone}
                disabled={isPending || creating || !newMilestoneLabel.trim()}
              >
                {creating ? "Membuat…" : "Buat milestone"}
              </button>
            </div>

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
              {orderedDefs.map((m) => (
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
