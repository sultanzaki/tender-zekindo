"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { logout } from "@/lib/auth/actions";
import type { Profile } from "@/lib/types";
import styles from "./TopNav.module.css";

/** "+ New Tender", aware of which track you are looking at.
 *
 * Reads the query string rather than taking a prop because the nav sits in the
 * root layout, which cannot see a page's searchParams. Suspense-wrapped at the
 * call site because useSearchParams suspends while the URL is resolved. */
function NewTenderLink() {
  const params = useSearchParams();
  const href = params.get("track") === "downstream" ? "/tenders/new?track=downstream" : "/tenders/new";
  return (
    <Link href={href} className={styles.newButton}>
      <span className={styles.newButtonFull}>+ New Tender</span>
      <span className={styles.newButtonShort}>+ New</span>
    </Link>
  );
}

const NAV_ITEMS = [
  { href: "/", label: "Analytics" },
  { href: "/tenders", label: "Tenders" },
] as const;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function TopNav({ profile, notificationCount = 0 }: { profile: Profile | null; notificationCount?: number }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  // Navigating away should never leave the menu hanging open. Handled on the
  // links' own onClick rather than an effect on `pathname`: calling setState
  // synchronously in an effect body causes a cascading render (react-hooks/
  // set-state-in-effect), and closing on click is the actual user intent.

  if (pathname === "/login") {
    return null;
  }

  const isAdmin = profile?.role === "admin";

  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        <Link href="/" className={styles.brand}>
          <Image src="/logo.png" alt="Zekindo" height={24} width={100} style={{ height: 24, width: "auto" }} priority />
          <span className={styles.brandTitle}>Tender Management</span>
        </Link>
        <nav className={styles.tabs} aria-label="Main">
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.tab} ${active ? styles.tabActive : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className={styles.right}>
        {profile && isAdmin && (
          <Suspense
            fallback={
              <Link href="/tenders/new" className={styles.newButton}>
                <span className={styles.newButtonFull}>+ New Tender</span>
                <span className={styles.newButtonShort}>+ New</span>
              </Link>
            }
          >
            <NewTenderLink />
          </Suspense>
        )}

        <Link href="/notifications" className={styles.iconButton} aria-label="Notifications">
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {notificationCount > 0 && (
            <span className={styles.bellBadge}>{notificationCount > 9 ? "9+" : notificationCount}</span>
          )}
        </Link>

        {profile ? (
          <div className={styles.userWrap} ref={menuRef}>
          <button
            type="button"
            className={`${styles.userButton} ${menuOpen ? styles.userButtonOpen : ""}`}
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className={styles.avatar}>{initials(profile.name) || "?"}</span>
            <span className={styles.userMeta}>
              <span className={styles.userName}>{profile.name}</span>
              <span className={styles.userRole}>{profile.role}</span>
            </span>
            <svg
              className={styles.chevron}
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {menuOpen && (
            <div className={styles.menu} role="menu">
              <div className={styles.menuHeader}>
                <div className={styles.menuAvatar}>{initials(profile.name) || "?"}</div>
                <div style={{ minWidth: 0 }}>
                  <div className={styles.menuName}>{profile.name}</div>
                  <div className={styles.menuEmail}>{profile.email}</div>
                </div>
              </div>

              {isAdmin ? (
                <>
                  <Link
                    href="/tenders/archive"
                    className={styles.menuItem}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                  >
                    Archived tenders
                  </Link>
                  <Link
                    href="/admin/users"
                    className={styles.menuItem}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                  >
                    Manage users
                  </Link>
                  <Link
                    href="/admin/milestones"
                    className={styles.menuItem}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                  >
                    Manage milestones
                  </Link>
                </>
              ) : (
                <div className={styles.menuNote}>Read-only access — ask an admin for changes.</div>
              )}

              <div className={styles.menuDivider} />
              <form action={logout} onSubmit={() => setMenuOpen(false)}>
                <button type="submit" className={styles.menuItemDanger} role="menuitem">
                  Sign out
                </button>
              </form>
            </div>
          )}
        </div>
      ) : (
        <Link
          href="/login"
          className={styles.userButton}
          style={{ textDecoration: "none", fontSize: 13 }}
        >
          Sign in
        </Link>
      )}
      </div>
    </header>
  );
}
