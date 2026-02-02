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

export default function AdminUsersPage() {
  const router = useRouter();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users");
      if (res.status === 401 || res.status === 403) {
        router.push("/auth/signin");
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load users");
      setRows(json.users || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function deleteUser(id: string, email?: string | null) {
    const label = email ? ` (${email})` : "";
    const ok = confirm(
      `Delete this user${label}?\n\nThis permanently removes the account and related sessions/accounts.`
    );
    if (!ok) return;

    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Delete failed");

      // Optimistic remove
      setRows((prev) => prev.filter((u) => u.id !== id));
    } catch (e: any) {
      setError(e?.message || "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleBlock(user: UserRow) {
    const nextStatus = user.status === "BLOCKED" ? "ACTIVE" : "BLOCKED";
    const label = user.email ? ` (${user.email})` : "";
    const ok = confirm(`${nextStatus === "BLOCKED" ? "Block" : "Unblock"} this user${label}?`);
    if (!ok) return;

    setBusyId(user.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Update failed");

      // Optimistic update
      setRows((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u)));
    } catch (e: any) {
      setError(e?.message || "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => (a.email || "").localeCompare(b.email || ""));
  }, [rows]);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold">Admin — Users</h1>
            <p className="mt-1 text-sm text-neutral-600">Manage access, block, and delete accounts.</p>
          </div>
          <Link className="underline text-sm" href="/">
            Back to site
          </Link>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        )}

        <div className="mt-8 rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
            <div className="text-sm font-semibold">
              {loading ? "Loading…" : `${sorted.length} user${sorted.length === 1 ? "" : "s"}`}
            </div>
            <button
              onClick={load}
              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-neutral-50"
            >
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold">User</th>
                  <th className="text-left px-5 py-3 font-semibold">Role</th>
                  <th className="text-left px-5 py-3 font-semibold">Status</th>
                  <th className="text-right px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!loading && sorted.length === 0 && (
                  <tr>
                    <td className="px-5 py-6 text-neutral-600" colSpan={4}>
                      No users found.
                    </td>
                  </tr>
                )}

                {sorted.map((u) => (
                  <tr key={u.id} className="border-b border-neutral-100">
                    <td className="px-5 py-4">
                      <div className="font-semibold">{u.email || "(no email)"}</div>
                      <div className="text-neutral-600">{u.name || ""}</div>
                    </td>
                    <td className="px-5 py-4">{u.role}</td>
                    <td className="px-5 py-4">
                      <span
                        className={
                          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold " +
                          (u.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-red-50 text-red-800 border border-red-200")
                        }
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => toggleBlock(u)}
                        disabled={busyId === u.id}
                        className={
                          "mr-2 rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-60 " +
                          (u.status === "BLOCKED"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                            : "border-red-300 bg-red-50 text-red-900 hover:bg-red-100")
                        }
                        title={u.status === "BLOCKED" ? "Unblock user" : "Block user"}
                      >
                        {u.status === "BLOCKED" ? "Unblock" : "Block"}
                      </button>
                      <button
                        onClick={() => deleteUser(u.id, u.email)}
                        disabled={busyId === u.id}
                        className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-neutral-50 disabled:opacity-60"
                      >
                        {busyId === u.id ? "Deleting…" : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-4 text-xs text-neutral-500">
            Deleting a user removes their account and associated sessions/accounts. Use carefully.
          </div>
        </div>
      </div>
    </div>
  );
}
