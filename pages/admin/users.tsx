// pages/admin/users.tsx
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import Head from "next/head";
import { getServerSession } from "next-auth/next";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
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
      redirect: { destination: "/admin/signin?callbackUrl=/admin/users", permanent: false },
    };
  }
  return { props: { ok: true } };
};

export default function AdminUsersPage(_props: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const isDashboard = router.pathname === "/admin/users";
  const isLibrary = router.pathname === "/admin/library";

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
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <Head>
        <title>Admin • Users</title>
        {/* Orbitron for the "Command" mark */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <header className="border-b border-neutral-200 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-start">
              <img src="/logo.png" alt="X Dragon logo" className="h-11 w-auto" />
              <div
                className="mt-1 font-semibold leading-none text-neutral-900"
                style={{ fontFamily: "Orbitron, ui-sans-serif, system-ui", fontSize: "1.6875rem" }}
              >
                Command
              </div>
            </div>
            <div className="flex h-11 items-center">
              <div className="text-sm text-neutral-600">User management</div>
            </div>
          </div>

            <div className="flex items-center gap-2">
            <button
              onClick={() => signOut({ callbackUrl: "/admin/signin" })}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-12">
          <aside className="lg:col-span-2">
            <div className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
              <nav className="space-y-2">
                <Link
                  href="/admin/users"
                  className={
                    "block w-full rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-neutral-800" +
                    (isDashboard ? " ring-2 ring-neutral-900/20" : "")
                  }
                >
                  Dashboard
                </Link>
                <Link
                  href="/admin/library"
                  className={
                    "block w-full rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-neutral-800" +
                    (isLibrary ? " ring-2 ring-neutral-900/20" : "")
                  }
                >
                  Library
                </Link>
              </nav>
            </div>
          </aside>

          <section className="lg:col-span-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by email, name, role, status…"
              className="w-full sm:w-[420px] rounded-xl bg-white border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
            />
            <button
              onClick={() => void load()}
              className="shrink-0 rounded-xl border border-neutral-900 bg-neutral-900 text-white px-3 py-2 text-sm hover:bg-neutral-800"
            >
              Refresh
            </button>
          </div>

          <div className="text-sm text-neutral-500">
            {loading ? "Loading…" : `${filtered.length} user${filtered.length === 1 ? "" : "s"}`}
          </div>
        </div>

        {(err || msg) && (
          <div className="mt-4 space-y-2">
            {err && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {err}
              </div>
            )}
            {msg && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {msg}
              </div>
            )}
          </div>
        )}

        {/* Desktop table */}
        <div className="mt-6 hidden md:block overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Last login</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-neutral-500" colSpan={6}>
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-neutral-500" colSpan={6}>
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
                    <tr key={u.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-neutral-900">{u.name || "—"}</div>
                        <div className="text-neutral-500">{email}</div>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-xs",
                            isAdmin ? "border-amber-200 bg-amber-50 text-amber-800" : "border-neutral-200 bg-white text-neutral-700"
                          )}
                        >
                          {u.role}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-xs",
                            isBlocked ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"
                          )}
                        >
                          {u.status}
                        </span>
                        {isProtected && (
                          <div className="mt-1 text-xs text-neutral-500">Protected admin</div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-neutral-700">{fmtDate(u.createdAt)}</td>
                      <td className="px-4 py-3 text-neutral-700">{fmtDate(u.lastLoginAt)}</td>

                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            disabled={busy || isProtected || isAdmin}
                            onClick={() => void act(u.id, isBlocked ? "unblock" : "block")}
                            className={cn(
                              "rounded-xl px-3 py-1.5 text-xs border transition-colors",
                              busy || isProtected || isAdmin
                                ? "border-neutral-200 bg-neutral-100 text-neutral-400 cursor-not-allowed"
                                : isBlocked
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                                  : "border-red-200 bg-red-50 text-red-800 hover:border-red-700"
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
                              "rounded-xl px-3 py-1.5 text-xs border transition-colors",
                              busy || isProtected || isAdmin
                                ? "border-neutral-200 bg-neutral-100 text-neutral-400 cursor-not-allowed"
                                : "border-neutral-200 bg-white text-neutral-700 hover:border-red-300"
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
            <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm px-4 py-4 text-neutral-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm px-4 py-4 text-neutral-500">No users found.</div>
          ) : (
            filtered.map((u) => {
              const email = (u.email || "(no email)").toLowerCase();
              const isProtected = protectedAdmins.includes(email);
              const isAdmin = u.role === "ADMIN";
              const isBlocked = u.status === "BLOCKED";
              const busy = busyId === u.id;

              return (
                <div key={u.id} className="rounded-2xl border border-neutral-200 bg-white shadow-sm px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{u.name || "—"}</div>
                      <div className="text-sm text-neutral-500">{email}</div>
                    </div>
                    <div className="flex gap-2">
                      <span className={cn("rounded-full border px-2 py-0.5 text-xs", isAdmin ? "border-amber-200 bg-amber-50 text-amber-800" : "border-neutral-200 bg-white text-neutral-700")}>
                        {u.role}
                      </span>
                      <span className={cn("rounded-full border px-2 py-0.5 text-xs", isBlocked ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800")}>
                        {u.status}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-neutral-700">
                    <div>
                      <div className="text-neutral-500">Created</div>
                      <div>{fmtDate(u.createdAt)}</div>
                    </div>
                    <div>
                      <div className="text-neutral-500">Last login</div>
                      <div>{fmtDate(u.lastLoginAt)}</div>
                    </div>
                  </div>

                  {isProtected && <div className="mt-2 text-xs text-neutral-500">Protected admin</div>}

                  <div className="mt-4 flex gap-2">
                    <button
                      disabled={busy || isProtected || isAdmin}
                      onClick={() => void act(u.id, isBlocked ? "unblock" : "block")}
                      className={cn(
                        "flex-1 rounded-xl px-3 py-2 text-xs border",
                        busy || isProtected || isAdmin
                          ? "border-neutral-200 bg-neutral-100 text-neutral-400 cursor-not-allowed"
                          : isBlocked
                            ? "border-emerald-900/60 bg-emerald-950/30 text-emerald-200"
                            : "border-red-200 bg-red-50 text-red-800"
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
                          ? "border-neutral-200 bg-neutral-100 text-neutral-400 cursor-not-allowed"
                          : "border-neutral-200 bg-white text-neutral-700"
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

        <div className="mt-8 text-xs text-neutral-500">
          Tip: set <code className="rounded bg-neutral-100 px-1 py-0.5 border border-neutral-200">NEXT_PUBLIC_ADMIN_EMAILS</code> (comma-separated) to label “protected”
          admin accounts in the UI. Server-side protection still uses <code className="rounded bg-neutral-100 px-1 py-0.5 border border-neutral-200">ADMIN_EMAILS</code>.
        </div>
      </section>
    </div>
      </main>
    </div>
  );
}