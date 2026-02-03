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


type MetricsPeriod = "today" | "7d" | "month";

type LoginIpGroup = { ip: string; country: string; count: number };

type MetricsPoint = {
  label: string;
  signups: number;
  logins: number;
};

type MetricsOk = {
  ok: true;
  period: MetricsPeriod;
  labels: string[];
  signups: number[];
  logins: number[];
  totals: { signups: number; logins: number };
  ipGroups: LoginIpGroup[];
};

type MetricsErr = {
  ok: false;
  error: string;
};


type MetricsResponse = MetricsOk | MetricsErr;

function emptyMetrics(period: MetricsPeriod): MetricsOk {
  return { ok: true, period, labels: [], signups: [], logins: [], totals: { signups: 0, logins: 0 }, ipGroups: [] };
}

function buildLinePath(points: MetricsPoint[], key: "signups" | "logins", w: number, h: number, pad = 12) {
  if (!points.length) return "";
  const maxVal = Math.max(1, ...points.map((p) => p.signups, ...points.map((p) => p.logins)));
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;

  const xFor = (i: number) => pad + (points.length === 1 ? innerW / 2 : (innerW * i) / (points.length - 1));
  const yFor = (v: number) => pad + innerH - (innerH * v) / maxVal;

  return points
    .map((p, i) => {
      const x = xFor(i);
      const y = yFor(p[key]);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function arraysToPoints(m: MetricsOk): MetricsPoint[] {
  return m.labels.map((label, i) => ({
    label,
    signups: Number(m.signups[i] ?? 0),
    logins: Number(m.logins[i] ?? 0),
  }));
}

function computeTotals(m: Pick<MetricsOk, "signups" | "logins">): { signups: number; logins: number } {
  const signups = (m.signups || []).reduce((a, b) => a + (Number(b) || 0), 0);
  const logins = (m.logins || []).reduce((a, b) => a + (Number(b) || 0), 0);
  return { signups, logins };
}

function MiniLineChart({ points }: { points: MetricsPoint[] }) {
  const w = 720;
  const h = 180;
  const hasData = points.length > 0;

  const signupsPath = hasData ? buildLinePath(points, "signups", w, h) : "";
  const loginsPath = hasData ? buildLinePath(points, "logins", w, h) : "";

  return (
    <div className="w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-950/40">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-[180px] w-full">
        <defs>
          <linearGradient id="xdragonGrid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={w} height={h} fill="url(#xdragonGrid)" />

        {/* subtle grid */}
        {[...Array(5)].map((_, i) => {
          const y = (h * (i + 1)) / 6;
          return <line key={i} x1="0" y1={y} x2={w} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />;
        })}

        {hasData ? (
          <>
            <path d={loginsPath} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2" />
            <path d={signupsPath} fill="none" stroke="rgba(239,68,68,0.9)" strokeWidth="2.5" />
          </>
        ) : (
          <text x={w / 2} y={h / 2} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="14">
            No data
          </text>
        )}
      </svg>
    </div>
  );
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

type ExportField<T> = { header: string; get: (row: T) => any };

function stamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function buildExportFields(rows: any[]): ExportField<any>[] {
  // Base fields we care about now (easy to reorder/extend later)
  const base: ExportField<any>[] = [
    { header: "id", get: (u) => u.id },
    { header: "name", get: (u) => u.name ?? "" },
    { header: "email", get: (u) => u.email ?? "" },
    { header: "role", get: (u) => u.role ?? "" },
    { header: "status", get: (u) => u.status ?? "" },
    { header: "createdAt", get: (u) => u.createdAt ?? "" },
    { header: "lastLoginAt", get: (u) => u.lastLoginAt ?? "" },
  ];

  // Future-proof: include any additional primitive fields present on the row objects
  const seen = new Set(base.map((f) => f.header));
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    for (const k of Object.keys(r)) {
      if (seen.has(k)) continue;
      const v = (r as any)[k];
      const isPrimitive =
        v == null || typeof v === "string" || typeof v === "number" || typeof v === "boolean";
      if (!isPrimitive) continue;
      base.push({ header: k, get: (u) => (u as any)[k] ?? "" });
      seen.add(k);
    }
  }

  return base;
}

function toCsv(rows: any[], fields: ExportField<any>[]) {
  const esc = (v: any) => {
    const s = String(v ?? "");
    // Wrap in quotes and escape quotes by doubling
    return `"${s.replace(/"/g, '""')}"`;
  };

  const header = fields.map((f) => esc(f.header)).join(",");
  const lines = rows.map((r) => fields.map((f) => esc(f.get(r))).join(","));
  return [header, ...lines].join("
");
}

function exportUsersCsv(rows: any[]) {
  const fields = buildExportFields(rows);
  const csv = toCsv(rows, fields);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `customers-${stamp()}.csv`);
}

function exportUsersXls(rows: any[]) {
  // No external deps: generate an Excel-readable HTML table and download as .xls
  const fields = buildExportFields(rows);

  const escape = (v: any) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const header = fields.map((f) => `<th>${escape(f.header)}</th>`).join("");
  const body = rows
    .map((u) => {
      const tds = fields.map((f) => `<td>${escape(f.get(u))}</td>`).join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");

  const htmlDoc = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
</head>
<body>
<table border="1">
<thead><tr>${header}</tr></thead>
<tbody>${body}</tbody>
</table>
</body>
</html>`;

  const blob = new Blob([htmlDoc], { type: "application/vnd.ms-excel;charset=utf-8" });
  downloadBlob(blob, `customers-${stamp()}.xls`);
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
  return { props: { ok: true, me: { id: (session as any).user?.id ?? null, email: (session as any).user?.email ?? null } } };
};


function LoginIpsTable({
  loading,
  error,
  groups,
}: {
  loading: boolean;
  error: string | null;
  groups: LoginIpGroup[];
}) {
  const PAGE_SIZE = 8;
  const [page, setPage] = useState(0);

  // Reset pagination whenever the dataset changes (period switch, refresh, etc.)
  useEffect(() => {
    setPage(0);
  }, [loading, error, groups]);

  const total = groups.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, total);
  const pageGroups = groups.slice(start, end);

  const canPrev = safePage > 0;
  const canNext = safePage < totalPages - 1;

  return (
    <div className="h-full rounded-2xl border border-neutral-200 bg-white p-4 flex flex-col">
      <div>
        <div className="text-sm font-semibold text-neutral-900">Logins by IP</div>
        <div className="mt-1 text-xs text-neutral-500">Top IPs for the selected period.</div>
      </div>

      <div className="mt-3 flex-1 min-h-0">
        {loading ? (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">Loading…</div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : !groups.length ? (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">No login events yet.</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-neutral-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs text-neutral-500">
                <tr>
                  <th className="px-3 py-2 font-medium">IP</th>
                  <th className="px-3 py-2 font-medium">Country</th>
                  <th className="px-3 py-2 text-right font-medium">Logins</th>
                </tr>
              </thead>
              <tbody>
                {pageGroups.map((g) => (
                  <tr key={g.ip} className="border-t border-neutral-200">
                    <td className="px-3 py-2 font-mono text-xs text-neutral-900">{g.ip}</td>
                    <td className="px-3 py-2 text-neutral-700">{g.country || "Unknown"}</td>
                    <td className="px-3 py-2 text-right font-semibold text-neutral-900">{g.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && !error && total > 0 && (
        <div className="mt-3 flex items-center justify-between text-xs text-neutral-600">
          <div>
            Showing <span className="font-medium text-neutral-900">{start + 1}</span>–
            <span className="font-medium text-neutral-900">{end}</span> of{" "}
            <span className="font-medium text-neutral-900">{total}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={!canPrev}
              className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-neutral-700 disabled:opacity-50"
            >
              Prev
            </button>
            <div className="tabular-nums">
              {safePage + 1}/{totalPages}
            </div>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={!canNext}
              className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-neutral-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminUsersPage(props: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const isDashboard = router.pathname === "/admin/users";
  const isLibrary = router.pathname === "/admin/library";

  const me = (props as any).me as { id?: string | null; email?: string | null } | undefined;
  const myId = (me?.id || null) as string | null;
  const myEmailLower = (me?.email ? String(me.email).toLowerCase() : null) as string | null;
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [period, setPeriod] = useState<MetricsPeriod>("7d");
  const [metrics, setMetrics] = useState<MetricsOk>(() => emptyMetrics("today"));
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);


  const protectedAdmins = useMemo(() => parseProtectedAdmins(), []);

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


  async function loadMetrics(nextPeriod: MetricsPeriod) {
    setMetricsLoading(true);
    setMetrics(emptyMetrics(nextPeriod));
    setMetricsError(null);
    try {
      const res = await fetch(`/api/admin/metrics?period=${encodeURIComponent(nextPeriod)}`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as MetricsResponse;

      if (data && (data as any).ok === true) {
        const ok = data as any as { ok: true; period: MetricsPeriod; labels?: unknown; signups?: unknown; logins?: unknown; ipGroups?: unknown };
        const labels = Array.isArray(ok.labels) ? (ok.labels as string[]) : [];
        const signups = Array.isArray(ok.signups) ? (ok.signups as number[]) : [];
        const logins = Array.isArray(ok.logins) ? (ok.logins as number[]) : [];
        const totals = {
          signups: signups.reduce((a, b) => a + (Number(b) || 0), 0),
          logins: logins.reduce((a, b) => a + (Number(b) || 0), 0),
        };

        const ipGroups: LoginIpGroup[] = Array.isArray(ok.ipGroups)
          ? (ok.ipGroups as any[])
              .map((g) => {
                const ip = typeof (g as any)?.ip === "string" ? (g as any).ip : "";
                if (!ip) return null;
                const country = typeof (g as any)?.country === "string" ? (g as any).country : "—";
                const count = typeof (g as any)?.count === "number" ? (g as any).count : Number((g as any)?.count || 0);
                return { ip, country, count };
              })
              .filter(Boolean) as LoginIpGroup[]
          : [];

        setMetrics({ ok: true, period: nextPeriod, labels, signups, logins, totals, ipGroups });
        setMetricsError(null);
      } else {
        setMetrics(emptyMetrics(nextPeriod));
        setMetricsError((data as any)?.error || "Failed to load metrics");
      }
    } catch (e: any) {
      setMetricsError(e?.message || "Failed to load metrics");
      setMetrics(emptyMetrics(nextPeriod));
    } finally {
      setMetricsLoading(false);
    }
  }

  useEffect(() => {
    void loadMetrics(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

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
              className="rounded-lg border border-neutral-900 bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
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
            {/* Activity chart (signups + logins) */}
            <div className="mb-4 grid gap-4 lg:grid-cols-10">
            <div className="lg:col-span-7">
            <div className="mb-4 rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
            <div className="text-sm font-semibold text-neutral-900">New signups & logins</div>
            <div className="mt-1 text-xs text-neutral-500">
            Signups in <span className="font-medium text-red-600">red</span>, logins in <span className="font-medium text-neutral-700">white</span>
            </div>
            </div>
            <div className="flex items-center gap-2">
            {([
            { key: "today" as const, label: "Today" },
            { key: "7d" as const, label: "Last 7 days" },
            { key: "month" as const, label: "This month" },
            ] as const).map((p) => {
            const active = period === p.key;
            return (
            <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={
            active
            ? "rounded-xl bg-neutral-900 px-3 py-2 text-xs font-semibold text-white"
            : "rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
            }
            >
            {p.label}
            </button>
            );
            })}
            <button
            onClick={() => void loadMetrics(period)}
            className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
            disabled={metricsLoading}
            title="Refresh chart & table"
            >
            Refresh
            </button>
            </div>
            </div>
            
            <div className="mt-3">
            {metricsLoading ? (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">Loading…</div>
            ) : metricsError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{metricsError}</div>
            ) : (
            <>
            <MiniLineChart points={metrics ? metrics.labels.map((label, i) => ({ label, signups: metrics.signups[i] ?? 0, logins: metrics.logins[i] ?? 0 })) : []} />
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <div className="rounded-xl bg-neutral-50 px-3 py-2 text-neutral-900">
            <span className="text-neutral-500">Signups:</span> <span className="font-semibold">{metrics?.totals.signups ?? 0}</span>
            </div>
            <div className="rounded-xl bg-neutral-50 px-3 py-2 text-neutral-900">
            <span className="text-neutral-500">Logins:</span> <span className="font-semibold">{metrics?.totals.logins ?? 0}</span>
            </div>
            </div>
            </>
            )}
            </div>
            </div>
            </div>
            <div className="lg:col-span-3">
            <LoginIpsTable
            loading={metricsLoading}
            error={metricsError}
            groups={metrics?.ok ? metrics.ipGroups : []}
            />
            </div>
            </div>
            
            
            
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
            <button
              onClick={() => exportUsersCsv(filtered)}
              className="shrink-0 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Export CSV
            </button>
            <button
              onClick={() => exportUsersXls(filtered)}
              className="shrink-0 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              title="Downloads an Excel-readable .xls file"
            >
              Export XLS
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
            const email = u.email || "(no email)";
            // Use the real email for comparisons; keep a separate display fallback.
            const emailLower = (u.email || "").toLowerCase();
            const isProtected = !!emailLower && protectedAdmins.includes(emailLower);
            const isAdmin = u.role === "ADMIN";
            const isBlocked = u.status === "BLOCKED";
            const busy = busyId === u.id;
            const isSelf = (!!myId && u.id === myId) || (!!myEmailLower && emailLower === myEmailLower);
            
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
            {isSelf && (
            <div className="mt-1 text-xs text-neutral-500">This is you</div>
            )}
            </td>
            
            <td className="px-4 py-3 text-neutral-700">{fmtDate(u.createdAt)}</td>
            <td className="px-4 py-3 text-neutral-700">{fmtDate(u.lastLoginAt)}</td>
            
            <td className="px-4 py-3">
            <div className="flex justify-end gap-2">
            <button
            disabled={busy || isProtected || isSelf}
            onClick={() => void act(u.id, isBlocked ? "unblock" : "block")}
            className={cn(
            "rounded-xl px-3 py-1.5 text-xs border transition-colors",
            busy || isProtected || isSelf
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
            disabled={busy || isProtected || isSelf}
            onClick={() => {
            if (!confirm("Delete this user? This cannot be undone.")) return;
            void act(u.id, "delete");
            }}
            className={cn(
            "rounded-xl px-3 py-1.5 text-xs border transition-colors",
            busy || isProtected || isSelf
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
            const emailLower = (u.email || "").toLowerCase();
            const emailDisplay = (u.email || "(no email)").toLowerCase();
            const isProtected = !!emailLower && protectedAdmins.includes(emailLower);
            const isAdmin = u.role === "ADMIN";
            const isBlocked = u.status === "BLOCKED";
            const busy = busyId === u.id;
            const isSelf = Boolean((myId && u.id === myId) || (myEmailLower && emailLower === myEmailLower));
            
            return (
            <div key={u.id} className="rounded-2xl border border-neutral-200 bg-white shadow-sm px-4 py-4">
            <div className="flex items-start justify-between gap-3">
            <div>
            <div className="font-medium">{u.name || "—"}</div>
            <div className="text-sm text-neutral-500">{emailDisplay}</div>
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
            disabled={busy || isProtected || isSelf}
            onClick={() => void act(u.id, isBlocked ? "unblock" : "block")}
            className={cn(
            "flex-1 rounded-xl px-3 py-2 text-xs border",
            busy || isProtected || isSelf
            ? "border-neutral-200 bg-neutral-100 text-neutral-400 cursor-not-allowed"
            : isBlocked
            ? "border-emerald-900/60 bg-emerald-950/30 text-emerald-200"
            : "border-red-200 bg-red-50 text-red-800"
            )}
            >
            {isBlocked ? "Unblock" : "Block"}
            </button>
            <button
            disabled={busy || isProtected || isSelf}
            onClick={() => {
            if (!confirm("Delete this user? This cannot be undone.")) return;
            void act(u.id, "delete");
            }}
            className={cn(
            "flex-1 rounded-xl px-3 py-2 text-xs border",
            busy || isProtected || isSelf
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