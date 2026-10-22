"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { logout } from "@/lib/auth/actions";
import type { Profile } from "@/lib/types";
import { Icon } from "./Icon";
import styles from "./TopNav.module.css";
const pages = [
  { href: "/", label: "Overview", icon: "overview" },
  { href: "/tenders", label: "Tenders", icon: "tenders" },
  { href: "/analytics", label: "Analytics", icon: "analytics" },
  { href: "/notifications", label: "Deadlines", icon: "notifications" },
] as const;
const adminPages = [
  { href: "/tenders/archive", label: "Archive", icon: "archive" },
  { href: "/admin/users", label: "Manage users", icon: "users" },
  { href: "/admin/milestones", label: "Manage milestones", icon: "milestones" },
] as const;
function CreateLink() {
  const params = useSearchParams();
  return (
    <Link
      className="button button-primary"
      href={
        params.get("track") === "downstream"
          ? "/tenders/new?track=downstream"
          : "/tenders/new"
      }
    >
      <Icon name="plus" />
      New tender
    </Link>
  );
}
export function TopNav({
  profile,
  notificationCount = 0,
  children,
}: {
  profile: Profile | null;
  notificationCount?: number;
  children?: React.ReactNode;
}) {
  const path = usePathname();
  const account = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (
        event.key !== "/" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        account.current?.open
      )
        return;
      if (
        (event.target as HTMLElement)?.closest(
          "input, textarea, select, [contenteditable=true]",
        )
      )
        return;
      event.preventDefault();
      search.current?.focus();
    }
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);
  if (path === "/login") return <>{children}</>;
  const isAdmin = profile?.role === "admin";
  function active(href: string) {
    if (href === "/") return path === "/";
    if (href === "/tenders")
      return (
        path.startsWith("/tenders") && !path.startsWith("/tenders/archive")
      );
    return path.startsWith(href);
  }
  const current = [...adminPages, ...pages].find((p) => active(p.href));
  return (
    <div className={styles.shell}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/">
          <Image
            src="/logo.png"
            alt="Zekindo"
            width={94}
            height={32}
            priority
          />
          <span>Tender workspace</span>
        </Link>
        <div className={styles.navLabel}>WORKSPACE</div>
        <nav aria-label="Main navigation" className={styles.navigation}>
          {pages.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className={`${styles.navLink} ${active(p.href) ? styles.active : ""}`}
              aria-current={active(p.href) ? "page" : undefined}
            >
              <Icon name={p.icon} />
              {p.label}
              {p.href === "/notifications" && notificationCount > 0 && (
                <span className={styles.count}>
                  {notificationCount > 99 ? "99+" : notificationCount}
                </span>
              )}
            </Link>
          ))}
        </nav>
        {isAdmin && (
          <>
            <div className={styles.navLabel}>ADMINISTRATION</div>
            <nav aria-label="Administration" className={styles.navigation}>
              {adminPages.map((p) => (
                <Link
                  key={p.href}
                  href={p.href}
                  className={`${styles.navLink} ${active(p.href) ? styles.active : ""}`}
                  aria-current={active(p.href) ? "page" : undefined}
                >
                  <Icon name={p.icon} />
                  {p.label}
                </Link>
              ))}
            </nav>
          </>
        )}
        <div className={styles.sidebarFooter}>
          <span className={styles.access}>
            {profile
              ? isAdmin
                ? "Administrator"
                : "Read-only access"
              : "Public workspace"}
          </span>
          <button
            className={styles.accountButton}
            onClick={() => account.current?.showModal()}
          >
            <span className={styles.avatar}>
              {profile?.name.slice(0, 1).toUpperCase() || "Z"}
            </span>
            <span>
              {profile?.name || "Guest"}
              <small>
                {profile ? "Account & access" : "Sign in for admin tools"}
              </small>
            </span>
            <Icon name="account" />
          </button>
        </div>
      </aside>
      <div className={styles.workspace}>
        <header className={styles.header}>
          <div className={styles.breadcrumb}>
            <span>Zekindo</span>
            <span aria-hidden="true">/</span>
            <strong>{current?.label || "Tender workspace"}</strong>
          </div>
          <form action="/tenders" className={styles.search} role="search">
            <Icon name="search" />
            <input type="hidden" name="track" value="all" />
            <input
              ref={search}
              name="search"
              aria-label="Search workspace"
              placeholder="Search tenders, customers…"
            />
            <kbd>/</kbd>
          </form>
          {isAdmin ? (
            <Suspense
              fallback={
                <Link className="button button-primary" href="/tenders/new">
                  New tender
                </Link>
              }
            >
              <CreateLink />
            </Suspense>
          ) : (
            <Link className="button button-secondary" href="/login">
              Sign in
            </Link>
          )}
        </header>
        <main id="main-content" className={styles.content} tabIndex={-1}>
          {children}
        </main>
        <footer className={styles.footer}>
          PT Zeus Kimiatama Indonesia<span>Tender Management</span>
        </footer>
      </div>
      <nav className={styles.mobileNav} aria-label="Mobile navigation">
        {pages.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className={active(p.href) ? styles.mobileActive : ""}
            aria-current={active(p.href) ? "page" : undefined}
          >
            <Icon name={p.icon} />
            <span>{p.label}</span>
          </Link>
        ))}
        <button onClick={() => account.current?.showModal()}>
          <Icon name="account" />
          <span>Account</span>
        </button>
      </nav>
      <dialog
        ref={account}
        className="dialog"
        aria-labelledby="account-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) account.current?.close();
        }}
      >
        <div className="dialog-heading">
          <h2 id="account-title">{profile?.name || "Workspace access"}</h2>
          <button
            className="icon-button"
            aria-label="Close account"
            onClick={() => account.current?.close()}
          >
            <Icon name="close" />
          </button>
        </div>
        <p className="muted">
          {profile?.email ||
            "Explore tender data and download Excel without signing in."}
        </p>
        <nav className={styles.navigation} aria-label="Account actions">
          {isAdmin && (
            <>
              <Suspense>
                <div onClick={() => account.current?.close()}>
                  <CreateLink />
                </div>
              </Suspense>
              {adminPages.map((p) => (
                <Link
                  key={p.href}
                  className={styles.navLink}
                  href={p.href}
                  onClick={() => account.current?.close()}
                >
                  <Icon name={p.icon} />
                  {p.label}
                </Link>
              ))}
            </>
          )}
          {profile ? (
            <form action={logout}>
              <button className="button button-danger" type="submit">
                Sign out
              </button>
            </form>
          ) : (
            <Link
              className="button button-primary"
              href="/login"
              onClick={() => account.current?.close()}
            >
              Sign in
            </Link>
          )}
        </nav>
      </dialog>
    </div>
  );
}
