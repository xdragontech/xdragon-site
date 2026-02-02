// pages/admin/users.tsx
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import Head from "next/head";
import { getServerSession } from "next-auth/next";
import { signOut } from "next-auth/react";
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

type Period = "today" | "7d" | "month";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function fmtMonthDay(d: Date) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type MetricsSeries = {
  labels: string[];
  signups: number[];
  logins: number[];
};

type ActivityChartProps = {
  labels: string[];
  signups: number[];
  logins: number[];
};

function ActivityLineChart({ labels, signups, logins }: ActivityChartProps) {
  const max = Math.max(1, ...signups, ...logins);
  const w = 720;
  const h = 140;
  const padX = 8;
  const padY = 10;

  const n = labels.length || 1;
  const step = n > 1 ? (w - padX * 2) / (n - 1) : 0;

  const yFor = (v: number) => {
    const t = v / max;
    return padY + (h - padY * 2) * (1 - t);
  };

  const pointsFor = (arr: number[]) =>
    arr
      .map((v, i) => `${padX + i * step},${yFor(v)}`)
      .join(" ");

  const signupsPts = pointsFor(signups);
  const loginsPts = pointsFor(logins);

  return (
    <div className="w-full">
      <div className="flex items-center gap-4 text-xs text-slate-300 mb-2">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          New signups
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-slate-300" />
          Logins
        </span>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/30 p-3">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[140px]">
          {/* grid */}
          <line x1="0" y1={h - 1} x2={w} y2={h - 1} stroke="rgba(255,255,255,0.08)" />
          <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke="rgba(255,255,255,0.06)" />
          <line x1="0" y1={padY} x2={w} y2={padY} stroke="rgba(255,255,255,0.04)" />

          {/* logins line */}
          <polyline
            fill="none"
            stroke="rgba(226,232,240,0.9)"
            strokeWidth="2"
            points={loginsPts}
          />

          {/* signups line */}
          <polyline
            fill="none"
            stroke="rgba(239,68,68,0.95)"
            strokeWidth="2.5"
            points={signupsPts}
          />

          {/* dots */}
          {labels.map((_, i) => (
            <g key={i}>
              <circle cx={padX + i * step} cy={yFor(logins[i] ?? 0)} r="2" fill="rgba(226,232,240,0.9)" />
              <circle cx={padX + i * step} cy={yFor(signups[i] ?? 0)} r="2.5" fill="rgba(239,68,68,0.95)" />
            </g>
          ))}
        </svg>

        {/* x-axis labels */}
        <div className="mt-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${labels.length || 1}, minmax(0, 1fr))` }}>
          {labels.map((l, i) => (
            <div key={i} className="text-[11px] text-slate-400 text-center truncate">
              {l}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
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
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState<Period>("7d");
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

  const [metrics, setMetrics] = useState<MetricsSeries>({ labels: [], signups: [], logins: [] });
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setMetricsLoading(true);
      setMetricsError(null);
      try {
        const res = await fetch(`/api/admin/metrics?period=${period}`);
        const json = await res.json();
        if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
        if (cancelled) return;

        setMetrics({
          labels: json.labels || [],
          signups: json.signups || [],
          logins: json.logins || [],
        });
      } catch (err: any) {
        if (cancelled) return;
        setMetricsError(err?.message || "Failed to load metrics.");
        setMetrics({ labels: [], signups: [], logins: [] });
      } finally {
        if (!cancelled) setMetricsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [period]);

  const totals = useMemo(() => {
    const sum = (arr: number[]) => arr.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
    return { signups: sum(metrics.signups), logins: sum(metrics.logins) };
  }, [metrics]);

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
        {/* New signups chart */}
        <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
                    <div className="text-sm font-semibold text-neutral-900">Activity</div>
                    <div className="mt-1 text-xs text-neutral-500">
                      New signups & logins ({period === "today" ? "today" : period === "7d" ? "last 7 days" : "month-to-date"})
                    </div>

                    <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <div className="text-sm text-neutral-700">
                        <span className="font-semibold text-neutral-900">{totals.signups}</span> signups
                      </div>
                      <div className="text-sm text-neutral-700">
                        <span className="font-semibold text-neutral-900">{totals.logins}</span> logins
                      </div>
                      {metricsLoading && <div className="text-xs text-neutral-500">Loading…</div>}
                      {metricsError && <div className="text-xs text-red-600">{metricsError}</div>}
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
      </main>
    </div>
  );
}