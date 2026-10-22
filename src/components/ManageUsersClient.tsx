"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUser, removeUser, resetUserPassword, updateUserRole } from "@/lib/auth/actions";
import type { Profile, UserRole } from "@/lib/types";
import shared from "./shared.module.css";
import styles from "./ManageUsers.module.css";

export function ManageUsersClient({ users, currentUserId }: { users: Profile[]; currentUserId: string }) {
  const router = useRouter();
  const list = users;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("viewer");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await createUser({ name, email, role, password });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setName("");
      setEmail("");
      setPassword("");
      setRole("viewer");
      router.refresh();
      setNotice("Account created. Tell them the password directly — there's no invite email.");
    });
  }

  function handleRoleChange(userId: string, newRole: UserRole) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await updateUserRole(userId, newRole);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  function handleResetPassword(userId: string, name: string) {
    const newPassword = window.prompt(`New password for ${name} (at least 8 characters):`);
    if (!newPassword) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await resetUserPassword(userId, newPassword);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setNotice(`Password reset for ${name}. Tell them the new password directly — they're signed out everywhere.`);
    });
  }

  function handleRemove(userId: string) {
    if (!confirm("Remove this user? They'll lose access immediately.")) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await removeUser(userId);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Manage users</h1>

      <div className={shared.card} style={{ marginBottom: 24 }}>
        <div className={shared.cardHeader}>
          <h2 className={shared.cardTitle}>Create a user</h2>
          <span className={shared.cardMeta}>You set their password directly — there&apos;s no invite email</span>
        </div>
        <form className={styles.inviteForm} onSubmit={(e) => { e.preventDefault(); handleCreate(); }}>
          <label className={styles.label}>
            Name
            <input className={styles.input} required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          </label>
          <label className={styles.label}>
            Email
            <input
              className={styles.input}
              type="email" required autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@zekindo.co.id"
            />
          </label>
          <label className={styles.label}>
            Password
            <input
              className={styles.input}
              type="password" required autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
            />
          </label>
          <label className={styles.label}>
            Role
            <select className={styles.input} value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button
            className={styles.inviteButton}
            type="submit"
            disabled={isPending || !name || !email || password.length < 8}
          >
            {isPending ? "Creating..." : "Create user"}
          </button>
        </form>
        {error && <div role="alert" className={styles.errorBanner}>{error}</div>}
        {notice && (
          <div role="status" className={styles.errorBanner} style={{ background: "var(--zk-success-light)", color: "var(--zk-success)" }}>
            {notice}
          </div>
        )}
      </div>

      <div className={shared.card}>
        <div className={shared.cardHeader}>
          <h2 className={shared.cardTitle}>All users</h2>
          <span className={shared.cardMeta}>{list.length} total</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Name</th>
                <th className={styles.th}>Role</th>
                <th className={styles.th}></th>
                <th className={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id}>
                  <td className={styles.td}>
                    {u.name}
                    <div className={styles.email}>{u.email}</div>
                  </td>
                  <td className={styles.td}>
                    <select
                      className={styles.roleSelect}
                      aria-label={`Role for ${u.name}`}
                      value={u.role}
                      disabled={isPending || u.id === currentUserId}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className={styles.td} style={{ textAlign: "right" }}>
                    <button className={styles.resetButton} disabled={isPending} onClick={() => handleResetPassword(u.id, u.name)}>
                      Reset password
                    </button>
                  </td>
                  <td className={styles.td} style={{ textAlign: "right" }}>
                    <button
                      className={styles.removeButton}
                      disabled={isPending || u.id === currentUserId}
                      onClick={() => handleRemove(u.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
