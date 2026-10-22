"use client";
import type {
  SelectOptionsMap,
  TenderFormValues,
  TenderEditFormValues,
} from "@/lib/types";
import { RESULT_ENUM, TRACK_LABELS, TRACKS } from "@/lib/types";
import { OptionSelect } from "./OptionSelect";
import { NumberInput } from "./NumberInput";
import styles from "./NewTenderForm.module.css";
export function TenderFields({
  section,
  values,
  onChange,
  options,
  allowTrack = false,
  duplicate = false,
}: {
  section: "details" | "value" | "outcome";
  values: TenderFormValues | TenderEditFormValues;
  onChange: (patch: Partial<TenderEditFormValues>) => void;
  options: SelectOptionsMap;
  allowTrack?: boolean;
  duplicate?: boolean;
}) {
  if (section === "details")
    return (
      <div className={styles.fieldColumn}>
        {allowTrack && (
          <fieldset className={styles.trackPicker}>
            <legend>Business track</legend>
            {TRACKS.map((track) => (
              <button
                key={track}
                type="button"
                aria-pressed={values.track === track}
                onClick={() => onChange({ track })}
              >
                {TRACK_LABELS[track]}
              </button>
            ))}
            <p className="muted">
              Track determines the milestone catalog and cannot change after
              creation.
            </p>
          </fieldset>
        )}
        <div className={styles.fieldRow2}>
          <label className={styles.label}>
            Area *
            <OptionSelect
              field="area"
              label="Area"
              className={styles.input}
              value={values.area}
              options={options.area}
              required
              onChange={(area) => onChange({ area })}
            />
          </label>
          <label className={styles.label}>
            Customer *
            <OptionSelect
              field="customer"
              label="Customer"
              className={styles.input}
              value={values.customer}
              options={options.customer}
              required
              onChange={(customer) => onChange({ customer })}
            />
          </label>
        </div>
        <label className={styles.label}>
          Tender number
          <input
            className={styles.input}
            value={values.tenderNo}
            onChange={(e) => onChange({ tenderNo: e.target.value })}
            placeholder="Tender reference number"
          />
          {duplicate && (
            <span className={styles.fieldWarning}>
              This reference is already used by another tender. Check before
              saving.
            </span>
          )}
        </label>
        <label className={styles.label}>
          Package title
          <textarea
            className={styles.textarea}
            rows={4}
            value={values.product}
            onChange={(e) => onChange({ product: e.target.value })}
            placeholder="Full scope or package title"
          />
        </label>
      </div>
    );
  if (section === "value")
    return (
      <div className={styles.fieldColumn}>
        <label className={styles.label}>
          Entity / Consortium
          <OptionSelect
            field="entitas"
            label="Entity / Consortium"
            className={styles.input}
            value={values.entitas}
            options={options.entitas}
            onChange={(entitas) => onChange({ entitas })}
          />
        </label>
        <div className={styles.fieldRow2}>
          {(
            [
              ["qty", "Quantity"],
              ["oe", "OE (Rp)"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className={styles.label}>
              {label}
              <NumberInput
                className={styles.input}
                value={values[key]}
                onChange={(value) => onChange({ [key]: value })}
                placeholder="Leave blank if unknown"
              />
            </label>
          ))}
        </div>
        <label className={styles.label}>
          OE note
          <input
            className={styles.input}
            value={values.oeCatatan}
            onChange={(e) => onChange({ oeCatatan: e.target.value })}
            placeholder="Currency or valuation context"
          />
        </label>
        <label className={styles.label}>
          Our bid value (Rp)
          <NumberInput
            className={styles.input}
            value={values.nilaiPenawaran}
            onChange={(nilaiPenawaran) => onChange({ nilaiPenawaran })}
            placeholder="Leave blank if unknown"
          />
        </label>
        <p className={styles.hint}>
          Values are in rupiah. Decimal quantities are supported. Unknown values
          stay blank and are excluded from known-value analytics.
        </p>
      </div>
    );
  const edit = values as TenderEditFormValues;
  return (
    <div className={styles.fieldColumn}>
      <div className={styles.fieldRow2}>
        <label className={styles.label}>
          Result
          <select
            className={styles.input}
            value={edit.result}
            onChange={(e) => onChange({ result: e.target.value })}
          >
            <option value="">Active / no result</option>
            {RESULT_ENUM.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label className={styles.label}>
          Carry over
          <input
            className={styles.input}
            value={edit.carryOver}
            onChange={(e) => onChange({ carryOver: e.target.value })}
          />
        </label>
      </div>
      <label className={styles.label}>
        Remarks
        <textarea
          className={styles.textarea}
          rows={6}
          value={edit.remarks}
          onChange={(e) => onChange({ remarks: e.target.value })}
          placeholder="Working notes, competitor rankings, and next actions"
        />
      </label>
      <label className={styles.label}>
        Short status note
        <input
          className={styles.input}
          value={edit.remark}
          onChange={(e) => onChange({ remark: e.target.value })}
        />
      </label>
      <label className={styles.checkLabel}>
        <input
          type="checkbox"
          checked={edit.pnl}
          onChange={(e) => onChange({ pnl: e.target.checked })}
        />
        P&L flagged
      </label>
      <label className={styles.label}>
        Internal notes · admin only
        <textarea
          className={styles.textarea}
          rows={4}
          value={edit.catatanInternal}
          onChange={(e) => onChange({ catatanInternal: e.target.value })}
        />
      </label>
    </div>
  );
}
