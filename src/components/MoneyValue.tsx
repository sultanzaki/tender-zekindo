import Link from "next/link";
import { formatRupiah } from "@/lib/tender-logic";
import { formatCompactRupiah } from "@/lib/analytics";
import styles from "./MoneyValue.module.css";

export function MoneyValue({
  value,
  canView,
  compact = false,
}: {
  value?: number | null;
  canView: boolean;
  compact?: boolean;
}) {
  if (canView)
    return (
      <>
        {compact && value != null
          ? formatCompactRupiah(value)
          : formatRupiah(value)}
      </>
    );
  return (
    <span
      className={styles.locked}
      role="img"
      aria-label="Sign in to view monetary values"
      title="Sign in to view monetary values"
    >
      <span aria-hidden="true" className={styles.blur}>
        Rp ••••••••
      </span>
    </span>
  );
}

export function MoneyAccessNotice({ returnTo }: { returnTo: string }) {
  return (
    <p className={styles.notice}>
      Monetary values are hidden.{" "}
      <Link href={`/login?${new URLSearchParams({ next: returnTo })}`}>
        Sign in to view amounts
      </Link>
      .
    </p>
  );
}
