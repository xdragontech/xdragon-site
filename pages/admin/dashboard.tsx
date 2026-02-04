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
    <div className="w-full overflow-hidden rounded-xl border border-neutral-200 bg-white/40">
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
          return <line key={i} x1="0" y1={y} x2={w} y2={y} stroke="rgba(220,38,38,0.08)" strokeWidth="1" />;
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


type GeoMode = "signups" | "logins";

type CountryCount = { country: string; count: number };

function normalizeCountryLabel(c: string) {
  const s = (c || "").toString().trim();
  if (!s) return "Unknown";
  // Normalize a few common variants
  const lower = s.toLowerCase();
  if (lower === "united states" || lower === "usa" || lower === "us") return "United States";
  if (lower === "united kingdom" || lower === "uk" || lower === "gb") return "United Kingdom";
  if (lower === "uae") return "United Arab Emirates";
  return s;
}

function aggregateCountries(rows: Array<{ country?: string | null; count?: number | null }>): CountryCount[] {
  const map = new Map<string, number>();
  for (const r of rows || []) {
    const key = normalizeCountryLabel(r?.country || "Unknown");
    const v = Number(r?.count || 0);
    map.set(key, (map.get(key) || 0) + (Number.isFinite(v) ? v : 0));
  }
  return Array.from(map.entries())
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count);
}

// Very lightweight "continent-ish" bucketing (not perfect, but stable and dependency-free).

function heatFill(value: number, max: number) {
  // Neutral -> red scale without specifying custom palettes.
  if (!max || max <= 0) return "rgba(0,0,0,0.05)";
  const t = Math.max(0, Math.min(1, value / max));
  const a = 0.12 + t * 0.68; // 0.12..0.80
  return `rgba(220, 38, 38, ${a.toFixed(3)})`;
}

type CountryMapDatum = { name: string; count: number };

function normalizeKey(name: string) {
  return (name || "").toString().trim().toLowerCase();
}

function parseTsv(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split("\t").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split("\t");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = (cols[i] ?? "").trim()));
    return row;
  });
}

function CountryWorldMap({
  data,
  title,
}: {
  data: CountryMapDatum[];
  title: string;
}) {
  const [paths, setPaths] = useState<Array<{ d: string; name: string; value: number }>>([]);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setMapError(null);

        // Load libs lazily to avoid SSR issues
        const [{ geoMercator, geoPath }, topojson] = await Promise.all([
          import("d3-geo"),
          import("topojson-client"),
        ]);

        // Use world-atlas topojson + country name mapping (TSV)
        const [topoRes, namesRes] = await Promise.all([
          fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"),
          fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/country-names.tsv"),
        ]);

        if (!topoRes.ok) throw new Error(`World map fetch failed (${topoRes.status})`);
        if (!namesRes.ok) throw new Error(`Country names fetch failed (${namesRes.status})`);

        const topo = await topoRes.json();
        const namesTsv = await namesRes.text();
        const namesRows = parseTsv(namesTsv);

        const idToName = new Map<string, string>();
        for (const r of namesRows) {
          const id = (r["id"] || r["ISO_N3"] || "").toString();
          const name = (r["name"] || r["NAME"] || r["country"] || "").toString();
          if (id && name) idToName.set(id, name);
        }

        const countriesObj = (topo as any)?.objects?.countries;
        if (!countriesObj) throw new Error("Invalid world-atlas payload (countries missing)");

        const features = (topojson as any).feature(topo, countriesObj)?.features || [];

        // Map incoming data by normalized country name
        const valueByName = new Map<string, number>();
        for (const row of data || []) {
          const k = normalizeKey(row.name);
          if (!k) continue;
          valueByName.set(k, (valueByName.get(k) || 0) + (Number(row.count) || 0));
        }

        const values = Array.from(valueByName.values());
        const maxVal = Math.max(1, ...(values.length ? values : [1]));

        // Build projection and SVG paths
        const width = 920;
        const height = 240;
        const projection = geoMercator().fitSize([width, height], { type: "FeatureCollection", features });
        const pathGen = geoPath(projection);

        const out: Array<{ d: string; name: string; value: number }> = [];
        for (const f of features) {
          const id = String((f as any)?.id ?? "");
          const name = (f as any)?.properties?.name || idToName.get(id) || "Unknown";
          const key = normalizeKey(name);
          const value = valueByName.get(key) || 0;
          const d = pathGen(f);
          if (d) out.push({ d, name, value });
        }

        if (!cancelled) {
          // Store max in closure by encoding value into fill later
          (out as any).__maxVal = maxVal;
          setPaths(out);
        }
      } catch (e: any) {
        if (!cancelled) setMapError(e?.message || "Failed to load world map");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [data]);

  const maxVal = (paths as any).__maxVal ? Number((paths as any).__maxVal) : Math.max(1, ...paths.map((p) => p.value));

  return (
    <div className="w-full">
      {mapError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{mapError}</div>
      ) : (
        <svg viewBox="0 0 920 240" className="h-[240px] w-full rounded-xl border border-neutral-200 bg-white">
          <text x="14" y="22" fill="rgba(0,0,0,0.65)" fontSize="12" fontFamily="ui-sans-serif, system-ui">
            {title}
          </text>

          {paths.map((p) => (
            <path
              key={`${p.name}-${p.d.slice(0, 12)}`}
              d={p.d}
              fill={heatFill(p.value, maxVal)}
              stroke="rgba(0,0,0,0.80)"
              strokeWidth="0.6"
            >
              <title>
                {p.name}: {p.value}
              </title>
            </path>
          ))}
        </svg>
      )}
    </div>
  );
}

function WorldHeatMapCard({
  mode,
  onModeChange,
  periodLabel,
  countries,
  loading,
  error,
}: {
  mode: GeoMode;
  onModeChange: (m: GeoMode) => void;
  periodLabel: string;
  countries: CountryCount[];
  loading: boolean;
  error: string | null;
}) {
  const top = countries.slice(0, 6);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-neutral-900">Global activity heatmap</div>
          <div className="mt-1 text-xs text-neutral-500">
            Based on {periodLabel}. Toggle between signups and logins.
          </div>
        </div>

        <div className="flex items-center gap-2">
          {([
            { key: "signups" as const, label: "New signups" },
            { key: "logins" as const, label: "Logins" },
          ] as const).map((opt) => {
            const active = mode === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => onModeChange(opt.key)}
                className={
                  active
                    ? "rounded-xl bg-neutral-900 px-3 py-2 text-xs font-semibold text-white"
                    : "rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3">
        {loading ? (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">Loading…</div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : mode === "signups" && countries.length === 0 ? (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
            Signups geo breakdown isn’t available yet from the metrics API. (Logins works immediately via IP geo.)
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-9">
              {/* Stylized world map (continent regions) */}
              <CountryWorldMap
                  title={mode === "signups" ? "New signups by country" : "Logins by country"}
                  data={(countries || []).map((c) => ({ name: c.country, count: c.count }))}
                />
            </div>

            <div className="lg:col-span-3">
              <div className="rounded-xl border border-neutral-200 bg-white p-3">
                <div className="text-xs font-semibold text-neutral-900">Top countries</div>
                <div className="mt-2 space-y-2">
                  {top.length ? (
                    top.map((r) => (
                      <div key={r.country} className="flex items-center justify-between gap-2 text-sm">
                        <div className="truncate text-neutral-700">{r.country}</div>
                        <div className="rounded-lg bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-900">
                          {r.count}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-neutral-600">No geo data yet.</div>
                  )}
                </div>
                <div className="mt-3 text-xs text-neutral-500">
                  This is a lightweight heatmap. For country-level shading, we can add a topojson map dependency and use the same data.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
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


  const [geoMode, setGeoMode] = useState<GeoMode>("logins");

  // Geo breakdown:
  // - logins: derived from ipGroups immediately
  // - signups: supported if the metrics API returns `signupCountries` (optional), otherwise empty
  const loginCountries = aggregateCountries((metrics?.ok ? metrics.ipGroups : []) as any);
  const signupCountries = aggregateCountries(((metrics as any)?.signupCountries || []) as any);

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
                
                {/* World heatmap (uses same period as chart) */}
                <div className="mt-4">
                  <WorldHeatMapCard
                    mode={geoMode}
                    onModeChange={setGeoMode}
                    periodLabel={
                      period === "today" ? "today" : period === "7d" ? "the last 7 days" : "this month"
                    }
                    countries={geoMode === "logins" ? loginCountries : signupCountries}
                    loading={metricsLoading}
                    error={metricsError}
                  />
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

