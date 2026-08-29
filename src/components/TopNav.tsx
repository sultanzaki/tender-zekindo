"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/auth/actions";
import type { Profile } from "@/lib/types";
import styles from "./TopNav.module.css";

export function TopNav({ profile, notificationCount = 0 }: { profile: Profile | null; notificationCount?: number }) {
  const pathname = usePathname();

  if (pathname === "/login") return null;
  if (!profile) return null;

  const onTableSide = pathname.startsWith("/tenders");
  const onDashboard = pathname === "/";
  const onAnalytics = pathname.startsWith("/analytics");
  const isAdmin = profile.role === "admin";

  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <div className={styles.brand}>
          <Image src="/logo.png" alt="Zekindo" height={24} width={100} style={{ height: 24, width: "auto" }} priority />
          <span className={styles.brandTitle}>Tender Management</span>
        </div>
        <div className={styles.tabs}>
          <Link href="/" className={`${styles.tab} ${onDashboard ? styles.tabActive : ""}`}>
            Dashboard
          </Link>
          <Link href="/tenders" className={`${styles.tab} ${onTableSide ? styles.tabActive : ""}`}>
            Tenders
          </Link>
          <Link href="/analytics" className={`${styles.tab} ${onAnalytics ? styles.tabActive : ""}`}>
            Analytics
          </Link>
        </div>
      </div>
      <div className={styles.right}>
        {isAdmin && (
          <Link href="/tenders/new" className={styles.newButton}>
            <span className={styles.newButtonFull}>+ New Tender</span>
            <span className={styles.newButtonShort}>+ New</span>
          </Link>
        )}
        <Link href="/notifications" className={styles.bellLink} aria-label="Notifications">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {notificationCount > 0 && (
            <span className={styles.bellBadge}>{notificationCount > 9 ? "9+" : notificationCount}</span>
          )}
        </Link>
        <div className={styles.userMenu}>
          <span className={styles.userName}>{profile.name}</span>
          <span className={styles.roleBadge}>{profile.role}</span>
          {isAdmin && (
            <Link href="/admin/users" className={styles.userMenuLink}>
              Users
            </Link>
          )}
          <form action={logout}>
            <button type="submit" className={styles.userMenuLink}>
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
