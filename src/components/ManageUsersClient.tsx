"use client";

import { useState, useTransition } from "react";
import { createUser, removeUser, resetUserPassword, updateUserRole } from "@/lib/auth/actions";
import type { Profile, UserRole } from "@/lib/types";
import shared from "./shared.module.css";
import styles from "./ManageUsers.module.css";

export function ManageUsersClient({ users, currentUserId }: { users: Profile[]; currentUserId: string }) {
  const [list, setList] = useState(users);
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
      setNotice("Account created. Tell them the password directly — there's no invite email.");
    });
  }

  function handleRoleChange(userId: string, newRole: UserRole) {
    setList((l) => l.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
    startTransition(async () => {
      const result = await updateUserRole(userId, newRole);
      if (result?.error) setError(result.error);
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
    setList((l) => l.filter((u) => u.id !== userId));
    startTransition(async () => {
      const result = await removeUser(userId);
      if (result?.error) setError(result.error);
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
        <div className={styles.inviteForm}>
          <label className={styles.label}>
            Name
            <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          </label>
          <label className={styles.label}>
            Email
            <input
              className={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@zekindo.co.id"
            />
          </label>
          <label className={styles.label}>
            Password
            <input
              className={styles.input}
              type="password"
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
            onClick={handleCreate}
            disabled={isPending || !name || !email || password.length < 8}
          >
            {isPending ? "Creating..." : "Create user"}
          </button>
        </div>
        {error && <div className={styles.errorBanner}>{error}</div>}
        {notice && (
          <div className={styles.errorBanner} style={{ background: "var(--zk-success-light)", color: "var(--zk-success)" }}>
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
                      value={u.role}
                      disabled={u.id === currentUserId}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className={styles.td} style={{ textAlign: "right" }}>
                    <button className={styles.resetButton} onClick={() => handleResetPassword(u.id, u.name)}>
                      Reset password
                    </button>
                  </td>
                  <td className={styles.td} style={{ textAlign: "right" }}>
                    <button
                      className={styles.removeButton}
                      disabled={u.id === currentUserId}
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
