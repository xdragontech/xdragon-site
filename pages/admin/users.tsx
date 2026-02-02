// pages/admin/users.tsx
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import Head from "next/head";
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { useEffect, useMemo, useState } from "react";
import { authOptions } from "../api/auth/[...nextauth]";

type UserRow = {
  id: string;
  email: string | null;
  name: string | null;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "BLOCKED";
  createdAt?: string | null;
  lastLoginAt?: string | null;
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function parseProtectedAdmins(): string[] {
  return (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export const getServerSideProps: GetServerSideProps<{ ok: true }> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions as any);
  const role = (session as any)?.role || (session as any)?.user?.role;
  if (!session || role !== "ADMIN") {
    return {
      redirect: { destination: "/auth/signin?callbackUrl=/admin/users", permanent: false },
    };
  }
  return { props: { ok: true } };
};

export default function AdminUsersPage(_props: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const protectedAdmins = useMemo(() => parseProtectedAdmins(), []);
  const myEmail =
    typeof window !== "undefined"
      ? (document.cookie.match(/next-auth\.session-token/) ? null : null) // placeholder; server guards do the real protection
      : null;

  async function load() {
    setErr(null);
    setMsg(null);
    setLoading(true);
    try {
      const r = await fetch("/api/admin/users");
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Failed to load users");
      setUsers(j.users || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) => {
      const hay = `${u.email || ""} ${u.name || ""} ${u.role} ${u.status}`.toLowerCase();
      return hay.includes(s);
    });
  }, [q, users]);

  async function act(userId: string, action: "block" | "unblock" | "delete") {
    setErr(null);
    setMsg(null);
    setBusyId(userId);
    try {
      const url = `/api/admin/users/${encodeURIComponent(userId)}`;
      const r =
        action === "delete"
          ? await fetch(url, { method: "DELETE" })
          : await fetch(url, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action }),
            });

      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Request failed");

      setMsg(action === "delete" ? "User deleted." : "User updated.");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Request failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Head>
        <title>Admin • Users</title>
      </Head>

      <header className="border-b border-slate-800">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-slate-900 border border-slate-800 grid place-items-center">
              <span className="text-sm font-semibold">XD</span>
            </div>
            <div>
              <div className="text-sm text-slate-400">Admin</div>
              <h1 className="text-lg font-semibold leading-tight">User Management</h1>
            </div>
          </div>

          <nav className="flex items-center gap-3">
            <Link href="/tools" className="text-sm text-slate-300 hover:text-white">
              Tools
            </Link>
            <Link href="/" className="text-sm text-slate-300 hover:text-white">
              Website
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by email, name, role, status…"
              className="w-full sm:w-[420px] rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-600"
            />
            <button
              onClick={() => void load()}
              className="shrink-0 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm hover:border-slate-600"
            >
              Refresh
            </button>
          </div>

          <div className="text-sm text-slate-400">
            {loading ? "Loading…" : `${filtered.length} user${filtered.length === 1 ? "" : "s"}`}
          </div>
        </div>

        {(err || msg) && (
          <div className="mt-4 space-y-2">
            {err && (
              <div className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                {err}
              </div>
            )}
            {msg && (
              <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
                {msg}
              </div>
            )}
          </div>
        )}

        {/* Desktop table */}
        <div className="mt-6 hidden md:block overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/70 text-slate-300">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Last login</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-slate-400" colSpan={6}>
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-400" colSpan={6}>
                    No users found.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => {
                  const email = (u.email || "(no email)").toLowerCase();
                  const isProtected = protectedAdmins.includes(email);
                  const isAdmin = u.role === "ADMIN";
                  const isBlocked = u.status === "BLOCKED";
                  const busy = busyId === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-slate-900/60">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-100">{u.name || "—"}</div>
                        <div className="text-slate-400">{email}</div>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-xs",
                            isAdmin ? "border-amber-800/60 bg-amber-900/20 text-amber-200" : "border-slate-700 bg-slate-900 text-slate-200"
                          )}
                        >
                          {u.role}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-xs",
                            isBlocked ? "border-red-900/60 bg-red-950/30 text-red-200" : "border-emerald-900/60 bg-emerald-950/20 text-emerald-200"
                          )}
                        >
                          {u.status}
                        </span>
                        {isProtected && (
                          <div className="mt-1 text-xs text-slate-400">Protected admin</div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-slate-300">{fmtDate(u.createdAt)}</td>
                      <td className="px-4 py-3 text-slate-300">{fmtDate(u.lastLoginAt)}</td>

                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            disabled={busy || isProtected || isAdmin}
                            onClick={() => void act(u.id, isBlocked ? "unblock" : "block")}
                            className={cn(
                              "rounded-xl px-3 py-1.5 text-xs border",
                              busy || isProtected || isAdmin
                                ? "border-slate-800 bg-slate-900/40 text-slate-500 cursor-not-allowed"
                                : isBlocked
                                  ? "border-emerald-900/60 bg-emerald-950/30 text-emerald-200 hover:border-emerald-700"
                                  : "border-red-900/60 bg-red-950/30 text-red-200 hover:border-red-700"
                            )}
                            title={isAdmin ? "Blocking admins is disabled" : isProtected ? "Protected admin" : undefined}
                          >
                            {isBlocked ? "Unblock" : "Block"}
                          </button>

                          <button
                            disabled={busy || isProtected || isAdmin}
                            onClick={() => {
                              if (!confirm("Delete this user? This cannot be undone.")) return;
                              void act(u.id, "delete");
                            }}
                            className={cn(
                              "rounded-xl px-3 py-1.5 text-xs border",
                              busy || isProtected || isAdmin
                                ? "border-slate-800 bg-slate-900/40 text-slate-500 cursor-not-allowed"
                                : "border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500"
                            )}
                            title={isAdmin ? "Deleting admins is disabled" : isProtected ? "Protected admin" : undefined}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="mt-6 grid gap-3 md:hidden">
          {loading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-4 text-slate-400">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-4 text-slate-400">No users found.</div>
          ) : (
            filtered.map((u) => {
              const email = (u.email || "(no email)").toLowerCase();
              const isProtected = protectedAdmins.includes(email);
              const isAdmin = u.role === "ADMIN";
              const isBlocked = u.status === "BLOCKED";
              const busy = busyId === u.id;

              return (
                <div key={u.id} className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{u.name || "—"}</div>
                      <div className="text-sm text-slate-400">{email}</div>
                    </div>
                    <div className="flex gap-2">
                      <span className={cn("rounded-full border px-2 py-0.5 text-xs", isAdmin ? "border-amber-800/60 bg-amber-900/20 text-amber-200" : "border-slate-700 bg-slate-900 text-slate-200")}>
                        {u.role}
                      </span>
                      <span className={cn("rounded-full border px-2 py-0.5 text-xs", isBlocked ? "border-red-900/60 bg-red-950/30 text-red-200" : "border-emerald-900/60 bg-emerald-950/20 text-emerald-200")}>
                        {u.status}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
                    <div>
                      <div className="text-slate-500">Created</div>
                      <div>{fmtDate(u.createdAt)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Last login</div>
                      <div>{fmtDate(u.lastLoginAt)}</div>
                    </div>
                  </div>

                  {isProtected && <div className="mt-2 text-xs text-slate-400">Protected admin</div>}

                  <div className="mt-4 flex gap-2">
                    <button
                      disabled={busy || isProtected || isAdmin}
                      onClick={() => void act(u.id, isBlocked ? "unblock" : "block")}
                      className={cn(
                        "flex-1 rounded-xl px-3 py-2 text-xs border",
                        busy || isProtected || isAdmin
                          ? "border-slate-800 bg-slate-900/40 text-slate-500 cursor-not-allowed"
                          : isBlocked
                            ? "border-emerald-900/60 bg-emerald-950/30 text-emerald-200"
                            : "border-red-900/60 bg-red-950/30 text-red-200"
                      )}
                    >
                      {isBlocked ? "Unblock" : "Block"}
                    </button>
                    <button
                      disabled={busy || isProtected || isAdmin}
                      onClick={() => {
                        if (!confirm("Delete this user? This cannot be undone.")) return;
                        void act(u.id, "delete");
                      }}
                      className={cn(
                        "flex-1 rounded-xl px-3 py-2 text-xs border",
                        busy || isProtected || isAdmin
                          ? "border-slate-800 bg-slate-900/40 text-slate-500 cursor-not-allowed"
                          : "border-slate-700 bg-slate-900 text-slate-200"
                      )}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-8 text-xs text-slate-500">
          Tip: set <code className="rounded bg-slate-900 px-1 py-0.5 border border-slate-800">NEXT_PUBLIC_ADMIN_EMAILS</code> (comma-separated) to label “protected”
          admin accounts in the UI. Server-side protection still uses <code className="rounded bg-slate-900 px-1 py-0.5 border border-slate-800">ADMIN_EMAILS</code>.
        </div>
      </main>
    </div>
  );
}
