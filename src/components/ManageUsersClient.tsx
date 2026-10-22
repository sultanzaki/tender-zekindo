"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createUser,
  removeUser,
  resetUserPassword,
  updateUserRole,
} from "@/lib/auth/actions";
import type { Profile, UserRole } from "@/lib/types";
import { PageHeading } from "./PageHeading";
import { Modal } from "./Modal";
import styles from "./Workspace.module.css";
export function ManageUsersClient({
  users,
  currentUserId,
}: {
  users: Profile[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, start] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [target, setTarget] = useState<{
    user: Profile;
    action: "reset" | "remove";
  } | null>(null);
  const [password, setPassword] = useState("");
  const [draft, setDraft] = useState({
    name: "",
    email: "",
    password: "",
    role: "viewer" as UserRole,
  });
  const filtered = users.filter((u) =>
    `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()),
  );
  function run(
    fn: () => Promise<{ error?: string } | undefined>,
    success: string,
    done?: () => void,
  ) {
    setError("");
    setNotice("");
    start(async () => {
      try {
        const result = await fn();
        if (result?.error) {
          setError(result.error);
          return;
        }
        setNotice(success);
        done?.();
        router.refresh();
      } catch {
        setError(
          "The change could not be saved. Please check your connection and try again.",
        );
      }
    });
  }
  return (
    <div className={styles.page}>
      <PageHeading
        eyebrow="ADMINISTRATION"
        title="People & access"
        description="Manage accounts, permissions, and password resets."
        actions={
          <button
            className="button button-primary"
            onClick={() => {
              setError("");
              setCreateOpen(true);
            }}
          >
            Create user
          </button>
        }
      />
      <div className={styles.metrics}>
        {[
          ["Total accounts", users.length],
          ["Administrators", users.filter((u) => u.role === "admin").length],
          ["Viewers", users.filter((u) => u.role === "viewer").length],
        ].map(([label, value]) => (
          <div key={label} className={styles.metric}>
            <span className={styles.metricLabel}>{label}</span>
            <strong className={styles.metricValue}>{value}</strong>
          </div>
        ))}
      </div>
      {notice && (
        <p className="feedback feedback-success" role="status">
          {notice}
        </p>
      )}
      {error && !createOpen && !target && (
        <p className="feedback feedback-error" role="alert">
          {error}
        </p>
      )}
      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>Workspace members</h2>
          <input
            type="search"
            aria-label="Search users"
            className="control"
            style={{ maxWidth: 280 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email"
          />
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name & email</th>
                <th>Access</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.name}</strong>
                    {u.id === currentUserId && (
                      <span className="muted"> · You</span>
                    )}
                    <div className="muted">{u.email}</div>
                  </td>
                  <td>
                    <select
                      className="control"
                      aria-label={`Role for ${u.name}`}
                      value={u.role}
                      disabled={pending || u.id === currentUserId}
                      onChange={(e) =>
                        run(
                          () =>
                            updateUserRole(u.id, e.target.value as UserRole),
                          `Access updated for ${u.name}.`,
                        )
                      }
                    >
                      <option value="viewer">Viewer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>
                    <div className="heading-actions">
                      <button
                        className="button button-secondary"
                        disabled={pending}
                        onClick={() => {
                          setError("");
                          setPassword("");
                          setTarget({ user: u, action: "reset" });
                        }}
                      >
                        Reset password
                      </button>
                      <button
                        className="button button-danger"
                        disabled={pending || u.id === currentUserId}
                        onClick={() => {
                          setError("");
                          setTarget({ user: u, action: "remove" });
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <p className={styles.empty}>No accounts match this search.</p>
        )}
      </section>
      <Modal
        open={createOpen}
        title="Create workspace account"
        onClose={() => {
          if (!pending) {
            setCreateOpen(false);
            setDraft({ ...draft, password: "" });
          }
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => createUser(draft),
              "Account created. Share the initial password securely with the user.",
              () => {
                setCreateOpen(false);
                setDraft({ name: "", email: "", password: "", role: "viewer" });
              },
            );
          }}
        >
          <div className="form-stack">
            <label className="field">
              Name
              <input
                className="control"
                autoComplete="name"
                required
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label className="field">
              Email
              <input
                className="control"
                autoComplete="email"
                type="email"
                required
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
            </label>
            <label className="field">
              Initial password
              <input
                className="control"
                autoComplete="new-password"
                type="password"
                minLength={8}
                required
                value={draft.password}
                onChange={(e) =>
                  setDraft({ ...draft, password: e.target.value })
                }
              />
            </label>
            <label className="field">
              Role
              <select
                className="control"
                value={draft.role}
                onChange={(e) =>
                  setDraft({ ...draft, role: e.target.value as UserRole })
                }
              >
                <option value="viewer">Viewer · read-only</option>
                <option value="admin">
                  Admin · manage all tenders and users
                </option>
              </select>
            </label>
          </div>
          {error && (
            <p role="alert" className="feedback feedback-error">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button
              type="submit"
              className="button button-primary"
              disabled={pending}
            >
              {pending ? "Creating…" : "Create user"}
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        open={target !== null}
        title={
          target?.action === "reset"
            ? `Reset password for ${target.user.name}`
            : `Remove ${target?.user.name}?`
        }
        onClose={() => {
          if (!pending) {
            setTarget(null);
            setPassword("");
          }
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!target) return;
            const selected = target;
            run(
              () =>
                selected.action === "reset"
                  ? resetUserPassword(selected.user.id, password)
                  : removeUser(selected.user.id),
              selected.action === "reset"
                ? "Password updated. Existing sessions were revoked."
                : "Account removed.",
              () => {
                setTarget(null);
                setPassword("");
              },
            );
          }}
        >
          <p className="muted">
            {target?.action === "reset"
              ? "The user will be signed out on all devices. Share the new password securely."
              : "This account will lose access immediately. Existing tender records are retained."}
          </p>
          {target?.action === "reset" && (
            <label className="field">
              New password
              <input
                type="password"
                className="control"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          {error && (
            <p role="alert" className="feedback feedback-error">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button
              className="button button-secondary"
              type="button"
              disabled={pending}
              onClick={() => setTarget(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`button ${target?.action === "remove" ? "button-danger" : "button-primary"}`}
              disabled={pending}
            >
              {pending
                ? "Saving…"
                : target?.action === "remove"
                  ? "Confirm removal"
                  : "Set new password"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
