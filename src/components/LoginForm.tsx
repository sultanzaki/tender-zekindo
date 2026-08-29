"use client";

import { useActionState } from "react";
import Image from "next/image";
import { login } from "@/lib/auth/actions";
import shared from "./shared.module.css";
import styles from "./AuthForm.module.css";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, isPending] = useActionState(login, undefined);

  return (
    <div className={styles.page}>
      <div className={`${shared.card} ${styles.card}`}>
        <div className={styles.brand}>
          <Image src="/logo.png" alt="Zekindo" height={24} width={100} style={{ height: 24, width: "auto" }} priority />
          <span className={styles.brandTitle}>Tender Management</span>
        </div>
        <h1 className={styles.title}>Sign in</h1>
        <p className={styles.subtitle}>Ask an admin to create an account for you if you don&apos;t have one yet.</p>
        <form action={formAction} className={styles.fieldColumn}>
          <input type="hidden" name="next" value={next} />
          <label className={styles.label}>
            Email
            <input className={styles.input} type="email" name="email" placeholder="you@zekindo.co.id" required />
          </label>
          <label className={styles.label}>
            Password
            <input className={styles.input} type="password" name="password" required />
          </label>
          <button className={styles.submitButton} type="submit" disabled={isPending}>
            {isPending ? "Signing in..." : "Sign in"}
          </button>
        </form>
        {state?.error && <div className={styles.errorBanner}>{state.error}</div>}
      </div>
    </div>
  );
}
