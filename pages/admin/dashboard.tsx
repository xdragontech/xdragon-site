// pages/admin/dashboard.tsx
import type { GetServerSideProps } from "next";
import Head from "next/head";
import { getServerSession } from "next-auth/next";
import { useEffect, useState } from "react";
import { authOptions } from "../api/auth/[...nextauth]";
import AdminHeader from "../../components/admin/AdminHeader";
import AdminSidebar from "../../components/admin/AdminSidebar";



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
  return [header, ...lines].join("\n");
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



type DashboardProps = {
  ok: true;
  me: { id: string | null; email: string | null };
};

export const getServerSideProps: GetServerSideProps<DashboardProps> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions as any);
  const role = (session as any)?.role || (session as any)?.user?.role;
  if (!session || role !== "ADMIN") {
    return {
      redirect: { destination: "/admin/signin?callbackUrl=/admin/dashboard", permanent: false },
    };
  }
  return {
    props: {
      ok: true,
      me: {
        id: (session as any).user?.id ?? null,
        email: (session as any).user?.email ?? null,
      },
    },
  };
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
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
            No login events yet.
          </div>
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

export default function AdminDashboardPage(props: DashboardProps) {
  const [loggedInAs, setLoggedInAs] = useState<string>("");

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => {
        const email = (s?.user?.email || "").toString();
        const username = email ? email.split("@")[0] : "";
        setLoggedInAs(username);
      })
      .catch(() => {});
  }, []);

  const [period, setPeriod] = useState<MetricsPeriod>("7d");
  const [metrics, setMetrics] = useState<MetricsOk>(() => emptyMetrics("today"));
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);

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
        const ok = data as any as {
          ok: true;
          period: MetricsPeriod;
          labels?: unknown;
          signups?: unknown;
          logins?: unknown;
          ipGroups?: unknown;
        };

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

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <Head>
        <title>Admin • Dashboard</title>
        {/* Orbitron for the "Command" mark */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <AdminHeader sectionLabel="Dashboard" loggedInAs={loggedInAs} />

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-12">
          <AdminSidebar active="dashboard" />

          <section className="lg:col-span-10">
            {/* Activity chart (signups + logins) */}
            <div className="mb-4 grid gap-4 lg:grid-cols-10">
              <div className="lg:col-span-7">
                <div className="mb-4 rounded-2xl border border-neutral-200 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-neutral-900">New signups & logins</div>
                      <div className="mt-1 text-xs text-neutral-500">
                        Signups in <span className="font-medium text-red-600">red</span>, logins in{" "}
                        <span className="font-medium text-neutral-700">white</span>
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
                      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
                        Loading…
                      </div>
                    ) : metricsError ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        {metricsError}
                      </div>
                    ) : (
                      <>
                        <MiniLineChart
                          points={
                            metrics
                              ? metrics.labels.map((label, i) => ({
                                  label,
                                  signups: metrics.signups[i] ?? 0,
                                  logins: metrics.logins[i] ?? 0,
                                }))
                              : []
                          }
                        />
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                          <div className="rounded-xl bg-neutral-50 px-3 py-2 text-neutral-900">
                            <span className="text-neutral-500">Signups:</span>{" "}
                            <span className="font-semibold">{metrics?.totals.signups ?? 0}</span>
                          </div>
                          <div className="rounded-xl bg-neutral-50 px-3 py-2 text-neutral-900">
                            <span className="text-neutral-500">Logins:</span>{" "}
                            <span className="font-semibold">{metrics?.totals.logins ?? 0}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-3">
                <LoginIpsTable loading={metricsLoading} error={metricsError} groups={metrics?.ok ? metrics.ipGroups : []} />
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

