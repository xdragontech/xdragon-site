// pages/admin/users.tsx
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

type UserRow = {
  id: string;
  email: string | null;
  name: string | null;
  role: "USER" | "ADMIN" | string;
  status: "ACTIVE" | "BLOCKED" | string;
  createdAt?: string;
  lastLoginAt?: string | null;
};

type SessionShape = {
  user?: { id?: string; email?: string | null; name?: string | null };
  role?: string;
  status?: string;
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [meId, setMeId] = useState<string | null>(null);
  const [meEmail, setMeEmail] = useState<string | null>(null);

  async function loadSession() {
    try {
      const r = await fetch("/api/auth/session");
      const j = (await r.json()) as SessionShape;
      const id = j?.user?.id ?? null;
      const email = (j?.user?.email ?? null)?.toLowerCase?.() ?? null;
      setMeId(id);
      setMeEmail(email);
    } catch {
      // ignore
    }
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/users");
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || "Failed to load users");
      setUsers(j.users || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSession();
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeAdminCount = useMemo(
    () => users.filter((u) => u.role === "ADMIN" && u.status === "ACTIVE").length,
    [users]
  );

  function isSelf(u: UserRow) {
    if (meId && u.id === meId) return true;
    const e = (u.email || "").toLowerCase();
    return !!meEmail && e === meEmail;
  }

  function isLastActiveAdmin(u: UserRow) {
    return u.role === "ADMIN" && u.status === "ACTIVE" && activeAdminCount <= 1;
  }

  async function toggleBlock(u: UserRow) {
    setError(null);
    setBusyId(u.id);

    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: u.status === "BLOCKED" ? "ACTIVE" : "BLOCKED" }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "Update failed");

      // Update locally
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, status: j.user.status } : x)));
    } catch (e: any) {
      setError(e?.message || "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteUser(u: UserRow) {
    setError(null);
    const label = u.email || u.name || "this user";
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;

    setBusyId(u.id);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "Delete failed");
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } catch (e: any) {
      setError(e?.message || "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Admin • Users</h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link href="/tools">Back to Tools</Link>
          <button onClick={load} disabled={loading} style={{ padding: "6px 10px" }}>
            Refresh
          </button>
        </div>
      </div>

      <p style={{ color: "#666", marginTop: 8 }}>
        Manage tool access. You can block/unblock or delete users. Guardrails prevent you from locking yourself out or removing the last active admin.
      </p>

      {error && (
        <div style={{ background: "#ffe9e9", border: "1px solid #ffbdbd", padding: 12, borderRadius: 8, marginBottom: 16 }}>
          <strong>Action failed:</strong> {error}
        </div>
      )}

      {loading ? (
        <div>Loading…</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Email</th>
                <th style={th}>Name</th>
                <th style={th}>Role</th>
                <th style={th}>Status</th>
                <th style={th}>Last login</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const self = isSelf(u);
                const lastAdmin = isLastActiveAdmin(u);
                const disabledReason = self
                  ? "You can't change your own role/status here."
                  : lastAdmin
                  ? "You can't block/delete the last active admin."
                  : "";

                const disableBlock = busyId === u.id || self || lastAdmin;
                const disableDelete = busyId === u.id || self || lastAdmin;

                return (
                  <tr key={u.id}>
                    <td style={td}>
                      {u.email || <span style={{ color: "#999" }}>—</span>}
                      {self && <span style={{ marginLeft: 8, fontSize: 12, color: "#888" }}>(you)</span>}
                    </td>
                    <td style={td}>{u.name || <span style={{ color: "#999" }}>—</span>}</td>
                    <td style={td}>{u.role}</td>
                    <td style={td}>{u.status}</td>
                    <td style={td}>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : <span style={{ color: "#999" }}>—</span>}</td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          title={disabledReason || (u.status === "BLOCKED" ? "Unblock this user" : "Block this user")}
                          disabled={disableBlock}
                          onClick={() => toggleBlock(u)}
                          style={{ padding: "6px 10px" }}
                        >
                          {u.status === "BLOCKED" ? "Unblock" : "Block"}
                        </button>

                        <button
                          title={disabledReason || "Delete this user"}
                          disabled={disableDelete}
                          onClick={() => deleteUser(u)}
                          style={{ padding: "6px 10px" }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!users.length && (
                <tr>
                  <td style={td} colSpan={6}>
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #eee",
  padding: "10px 8px",
  fontSize: 13,
  color: "#555",
};

const td: React.CSSProperties = {
  borderBottom: "1px solid #f2f2f2",
  padding: "10px 8px",
  fontSize: 14,
};
