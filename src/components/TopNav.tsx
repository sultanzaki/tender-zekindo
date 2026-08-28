"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./TopNav.module.css";

export function TopNav() {
  const pathname = usePathname();
  const onTableSide = pathname.startsWith("/tenders");
  const onDashboard = pathname === "/";

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
            Tender
          </Link>
        </div>
      </div>
      <Link href="/tenders/new" className={styles.newButton}>
        + Tender Baru
      </Link>
    </div>
  );
}
