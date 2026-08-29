"use client";

import { useActionState } from "react";
import { setPassword } from "@/lib/auth/actions";
import shared from "./shared.module.css";
import styles from "./AuthForm.module.css";

export function SetPasswordForm({ title, subtitle }: { title: string; subtitle: string }) {
  const [state, formAction, isPending] = useActionState(setPassword, undefined);

  return (
    <div className={styles.page}>
      <div className={`${shared.card} ${styles.card}`}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>
        <form action={formAction} className={styles.fieldColumn}>
          <label className={styles.label}>
            New password
            <input className={styles.input} type="password" name="password" minLength={8} required />
          </label>
          <label className={styles.label}>
            Confirm password
            <input className={styles.input} type="password" name="confirm" minLength={8} required />
          </label>
          <button className={styles.submitButton} type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Set password"}
          </button>
        </form>
        {state?.error && <div className={styles.errorBanner}>{state.error}</div>}
      </div>
    </div>
  );
}
