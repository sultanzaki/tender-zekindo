"use client";
import { useActionState, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { login } from "@/lib/auth/actions";
import styles from "./AuthForm.module.css";
export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  return (
    <main className={styles.page}>
      <div className={styles.brand}>
        <Link href="/">
          <Image
            src="/logo.png"
            alt="Zekindo"
            width={110}
            height={37}
            priority
          />
        </Link>
        <span>Tender workspace</span>
      </div>
      <section className={styles.card}>
        <p className="eyebrow">ACCOUNT ACCESS</p>
        <h1 className={styles.title}>Welcome back.</h1>
        <p className={styles.subtitle}>
          Sign in to manage tenders, schedules, documents, and workspace access.
        </p>
        <form action={action} className={styles.fieldColumn}>
          <input type="hidden" name="next" value={next} />
          <label className="field">
            Email address
            <input
              className="control"
              type="email"
              name="email"
              autoComplete="username"
              autoCapitalize="none"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
              placeholder="you@zekindo.co.id"
            />
          </label>
          <div className="field">
            <label htmlFor="login-password">Password</label>
            <div className={styles.passwordField}>
              <input
                className="control"
                type={show ? "text" : "password"}
                name="password"
                id="login-password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={pending}
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          {state?.error && (
            <p role="alert" className="feedback feedback-error">
              {state.error}
            </p>
          )}
          <button
            type="submit"
            className="button button-primary"
            disabled={pending}
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className={styles.help}>
          Need an account or a password reset? Contact your workspace
          administrator.
        </p>
        <Link href="/" className={styles.back}>
          ← Continue to public workspace
        </Link>
      </section>
      <footer className={styles.footer}>PT Zeus Kimiatama Indonesia</footer>
    </main>
  );
}
