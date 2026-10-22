"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveTender, updateTender } from "@/lib/actions";
import { findDuplicateTenderNo } from "@/lib/tender-logic";
import { validateTender } from "@/lib/validation";
import type {
  Tender,
  TenderEditFormValues,
  MilestoneType,
  SelectOptionsMap,
} from "@/lib/types";
import { PageHeading } from "./PageHeading";
import { TenderFields } from "./TenderFields";
import { MilestoneEditor } from "./MilestoneEditor";
import { Modal } from "./Modal";
import { useUnsavedChanges } from "./useUnsavedChanges";
import styles from "./NewTenderForm.module.css";
const SECTIONS = ["Details", "Value & entity", "Milestones", "Outcome & notes"];
function fromTender(t: Tender): TenderEditFormValues {
  return {
    track: t.track,
    area: t.area,
    tenderNo: t.tenderNo || "",
    customer: t.customer,
    product: t.product || "",
    entitas: t.entitas || "",
    qty: t.qty === null ? "" : String(t.qty),
    oe: t.oe === null ? "" : String(t.oe),
    oeCatatan: t.oeCatatan || "",
    nilaiPenawaran: t.nilaiPenawaran === null ? "" : String(t.nilaiPenawaran),
    milestones: Object.fromEntries(
      Object.entries(t.milestones).map(([key, value]) => [key, value || ""]),
    ),
    result: t.result || "",
    carryOver: t.carryOver || "",
    remarks: t.remarks || "",
    remark: t.remark || "",
    pnl: t.pnl,
    catatanInternal: t.catatanInternal || "",
  };
}
export function EditTenderForm({
  tender,
  selectOptions,
  milestoneTypes,
  existingTenders,
}: {
  tender: Tender;
  selectOptions: SelectOptionsMap;
  milestoneTypes: MilestoneType[];
  existingTenders: { id: string; tenderNo: string | null }[];
}) {
  const initial = fromTender(tender);
  const initialOrder =
    tender.milestoneOrder ?? milestoneTypes.map((m) => m.key);
  const [extra, setExtra] = useState<MilestoneType[]>([]);
  const [values, setValues] = useState(initial);
  const [order, setOrder] = useState(initialOrder);
  const [section, setSection] = useState(0);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<"discard" | "archive" | null>(null);
  const router = useRouter();
  const dirty =
    JSON.stringify(values) !== JSON.stringify(initial) ||
    JSON.stringify(order) !== JSON.stringify(initialOrder);
  const leave = useUnsavedChanges(dirty && !pending);
  function save() {
    const issue = validateTender(values);
    if (issue) {
      setError(issue);
      return;
    }
    setError("");
    start(async () => {
      const result = await updateTender(tender.id, {
        ...values,
        milestoneOrder: order,
      });
      if (result?.error) setError(result.error);
    });
  }
  return (
    <div className={styles.page}>
      <PageHeading
        eyebrow={`${tender.track.toUpperCase()} · ${tender.tenderNo || `TENDER #${tender.rowNo}`}`}
        title="Edit tender"
        description="All sections, including milestone order, save together."
        actions={
          <>
            <button
              className="button button-secondary"
              onClick={() =>
                dirty
                  ? setConfirm("discard")
                  : router.push(`/tenders/${tender.id}`)
              }
            >
              Cancel
            </button>
            <button
              className="button button-danger"
              disabled={pending}
              onClick={() => setConfirm("archive")}
            >
              Archive tender
            </button>
          </>
        }
      />
      <div className={styles.steps} aria-label="Edit sections">
        {SECTIONS.map((label, i) => (
          <button
            key={label}
            type="button"
            className={`${styles.step} ${i === section ? styles.stepActive : ""}`}
            disabled={pending}
            aria-pressed={i === section}
            onClick={() => {
              setError("");
              setSection(i);
            }}
          >
            <span className={styles.stepNumber}>{i + 1}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>
      <form
        className={styles.card}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className={styles.sectionHeading}>
          <h2>{SECTIONS[section]}</h2>
          <span>{dirty ? "Unsaved changes" : "Up to date"}</span>
        </div>
        <fieldset className={styles.fieldset} disabled={pending}>
          {section === 0 && (
            <TenderFields
              section="details"
              values={values}
              onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
              options={selectOptions}
              duplicate={findDuplicateTenderNo(
                values.tenderNo,
                existingTenders,
                tender.id,
              )}
            />
          )}
          {section === 1 && (
            <TenderFields
              section="value"
              values={values}
              onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
              options={selectOptions}
            />
          )}
          {section === 2 && (
            <MilestoneEditor
              track={tender.track}
              catalog={[...milestoneTypes, ...extra]}
              onCreated={(created) => setExtra((prev) => [...prev, created])}
              order={order}
              dates={values.milestones}
              onOrder={setOrder}
              onDates={(milestones) => setValues((v) => ({ ...v, milestones }))}
            />
          )}
          {section === 3 && (
            <TenderFields
              section="outcome"
              values={values}
              onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
              options={selectOptions}
            />
          )}
        </fieldset>
        {error && (
          <p role="alert" className="feedback feedback-error">
            {error}
          </p>
        )}
        <div className={styles.footer}>
          <span className="muted">
            {dirty
              ? "Changes are not saved yet."
              : "Edit any section, then save once."}
          </span>
          <button
            type="submit"
            className="button button-primary"
            disabled={pending || !dirty}
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
      <Modal
        open={confirm !== null}
        title={
          confirm === "archive"
            ? "Archive this tender?"
            : "Discard unsaved changes?"
        }
        onClose={() => {
          if (!pending) setConfirm(null);
        }}
      >
        <p className="muted">
          {confirm === "archive"
            ? "The tender will leave active lists. You can restore it from Archive. Unsaved edits will not be applied."
            : "Your edits have not been saved."}
        </p>
        <div className="dialog-actions">
          <button
            className="button button-secondary"
            disabled={pending}
            onClick={() => setConfirm(null)}
          >
            Keep editing
          </button>
          <button
            className="button button-danger"
            disabled={pending}
            onClick={() => {
              if (confirm === "discard") {
                setConfirm(null);
                router.push(`/tenders/${tender.id}`);
              } else {
                start(async () => {
                  const result = await archiveTender(tender.id);
                  if (result?.error) {
                    setError(result.error);
                    setConfirm(null);
                  }
                });
              }
            }}
          >
            {pending
              ? "Working…"
              : confirm === "archive"
                ? "Confirm archive"
                : "Discard changes"}
          </button>
        </div>
      </Modal>
      <Modal
        open={leave.href !== null}
        title="Leave without saving?"
        onClose={leave.cancel}
      >
        <p className="muted">
          Your changes have not been saved. Keep editing to avoid losing them.
        </p>
        <div className="dialog-actions">
          <button className="button button-secondary" onClick={leave.cancel}>
            Keep editing
          </button>
          <button className="button button-danger" onClick={leave.confirm}>
            Discard and leave
          </button>
        </div>
      </Modal>
    </div>
  );
}
