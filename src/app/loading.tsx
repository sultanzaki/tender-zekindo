import styles from "@/components/Workspace.module.css";
export default function Loading() {
  return (
    <div className={styles.page} role="status" aria-busy="true">
      <span className="muted">Loading workspace…</span>
      <div className="skeleton-heading" aria-hidden="true" />
      <div className={styles.metrics} aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton-card" />
        ))}
      </div>
      <div className="skeleton-panel" aria-hidden="true" />
    </div>
  );
}
