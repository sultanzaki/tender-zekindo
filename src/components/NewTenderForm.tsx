"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { createTender } from "@/lib/actions";
import { ensureMilestoneTypeByName } from "@/lib/milestone-actions";
import { findDuplicateTenderNo, findOutOfOrderMilestones } from "@/lib/tender-logic";
import {
  TRACKS,
  TRACK_LABELS,
  type MilestoneType,
  type SelectOptionsMap,
  type TenderFormValues,
  type Track,
} from "@/lib/types";
import { OptionSelect } from "./OptionSelect";
import { NumberInput } from "./NumberInput";
import shared from "./shared.module.css";
import styles from "./NewTenderForm.module.css";

const EMPTY_FORM: TenderFormValues = {
  // Replaced by initialTrack below. The form only ever CREATES a tender inside a
  // track; once created, a tender's track can never change (its milestone dates
  // live in a jsonb keyed by milestone key, and the two tracks use different keys).
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
  initialTrack,
  selectOptions,
  catalogs,
  existingTenders,
}: {
  /** The track the form opens on, carried from the list page's URL. Changeable
   * here, because creating is the only moment a track is picked. */
  initialTrack: Track;
  selectOptions: SelectOptionsMap;
  /** BOTH catalogs, so switching the picker swaps the milestone list instantly.
   * Milestone keys never overlap between tracks (`ds…` prefix), so dates already
   * typed for one track survive a round trip to the other. */
  catalogs: Record<Track, MilestoneType[]>;
  existingTenders: { id: string; tenderNo: string | null }[];
}) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<TenderFormValues>({ ...EMPTY_FORM, track: initialTrack });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // The chosen track lives in formData rather than in its own useState: one
  // source of truth, and createTender receives exactly the same value the
  // milestone list below is showing.
  const track = formData.track;
  const milestoneTypes = catalogs[track];

  // Milestone order/subset for the tender being created. Starts as the catalog
  // order; anything the user changes here is saved into tenders.milestone_order
  // on submit, so the choice is made before the tender exists rather than only
  // afterwards in the edit form.
  //
  // Kept PER TRACK: the two catalogs are independent, so reordering milestones
  // while looking at downstream must not disturb the upstream list.
  const [orders, setOrders] = useState<Record<Track, string[]>>(() => ({
    upstream: catalogs.upstream.map((m) => m.key),
    downstream: catalogs.downstream.map((m) => m.key),
  }));
  const order = orders[track];
  const setOrder = (update: (prev: string[]) => string[]) =>
    setOrders((prev) => ({ ...prev, [track]: update(prev[track]) }));

  const addSelectRef = useRef<HTMLSelectElement>(null);

  // Milestones created from this form, kept locally because the catalog prop was
  // read on the server before they existed. Without this the new milestone would
  // be in the order array but have no label to render. Per track as well: a
  // milestone created for a downstream tender has no business appearing in the
  // upstream list.
  const [extraTypes, setExtraTypes] = useState<Record<Track, MilestoneType[]>>({
    upstream: [],
    downstream: [],
  });
  const extra = extraTypes[track];
  const [newMilestoneLabel, setNewMilestoneLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const allTypes = useMemo(() => [...milestoneTypes, ...extra], [milestoneTypes, extra]);

  const catalogByKey = useMemo(() => new Map(allTypes.map((m) => [m.key, m])), [allTypes]);
  const orderedDefs = useMemo(
    () => order.map((k) => catalogByKey.get(k)).filter((m): m is MilestoneType => !!m),
    [order, catalogByKey]
  );
  const hiddenDefs = useMemo(
    () => allTypes.filter((m) => !order.includes(m.key)),
    [allTypes, order]
  );

  function chooseTrack(next: Track) {
    if (next === track) return;
    setFormData((f) => ({ ...f, track: next }));
  }

  /** Creates the milestone (or reuses it if the name exists) and puts it at the
   * end of this tender's order. */
  function createMilestone() {
    const label = newMilestoneLabel.trim();
    if (!label) return;
    // Captured: if the track is switched while the request is in flight, the
    // milestone still lands in the catalog it was created for.
    const targetTrack = track;
    setError(null);
    setCreating(true);
    startTransition(async () => {
      const result = await ensureMilestoneTypeByName(label, targetTrack);
      setCreating(false);
      const key = result.key;
      if (result.error || !key) {
        setError(result.error ?? "Gagal membuat milestone.");
        return;
      }
      setExtraTypes((prev) =>
        prev[targetTrack].some((t) => t.key === key)
          ? prev
          : {
              ...prev,
              [targetTrack]: [
                ...prev[targetTrack],
                { id: key, key, track: targetTrack, label, sortOrder: 0, showInTable: false },
              ],
            }
      );
      setOrders((prev) =>
        prev[targetTrack].includes(key) ? prev : { ...prev, [targetTrack]: [...prev[targetTrack], key] }
      );
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

  /** Upstream | Downstream. Shown on step 1 (where the tender's identity is
   * decided) and again on step 3, because that is where its effect is visible:
   * the milestone list and the date inputs below it come from this choice. */
  const trackPicker = (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 500 }}>Track</span>
      <div style={{ display: "flex", gap: 8 }}>
        {TRACKS.map((t) => {
          const active = t === track;
          return (
            <button
              key={t}
              type="button"
              onClick={() => chooseTrack(t)}
              disabled={isPending}
              aria-pressed={active}
              style={{
                padding: "6px 14px",
                fontSize: 13,
                borderRadius: 6,
                border: `1px solid ${active ? "var(--color-accent, #2563eb)" : "rgba(0,0,0,0.15)"}`,
                background: active ? "var(--color-accent, #2563eb)" : "transparent",
                color: active ? "#fff" : "inherit",
                fontWeight: active ? 600 : 400,
                cursor: "pointer",
              }}
            >
              {TRACK_LABELS[t]}
            </button>
          );
        })}
      </div>
      <span className={styles.hint}>
        {milestoneTypes.length} milestones for this track. A tender&apos;s track cannot be changed after it is
        created.
      </span>
    </div>
  );

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
            {trackPicker}
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
            <div style={{ marginBottom: 14 }}>{trackPicker}</div>

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
