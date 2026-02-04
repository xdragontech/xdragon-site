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
          return <line key={i} x1="0" y1={y} x2={w} y2={y} stroke="rgba(0,0,0,0.06)" strokeWidth="1" />;
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
function bucketToRegion(country: string): "NA" | "SA" | "EU" | "AF" | "AS" | "OC" | "UN" {
  const c = country.toLowerCase();
  // North America
  if (
    ["canada", "united states", "mexico", "guatemala", "honduras", "el salvador", "nicaragua", "costa rica", "panama", "jamaica", "haiti", "dominican", "cuba", "bahamas"].some((k) => c.includes(k))
  ) return "NA";
  // South America
  if (
    ["brazil", "argentina", "chile", "colombia", "peru", "venezuela", "ecuador", "bolivia", "paraguay", "uruguay", "guyana", "suriname"].some((k) => c.includes(k))
  ) return "SA";
  // Europe
  if (
    ["united kingdom", "ireland", "france", "germany", "spain", "portugal", "italy", "netherlands", "belgium", "switzerland", "austria", "sweden", "norway", "denmark", "finland", "poland", "czech", "slovakia", "hungary", "romania", "bulgaria", "greece", "ukraine", "russia"].some((k) => c.includes(k))
  ) return "EU";
  // Africa
  if (
    ["south africa", "nigeria", "kenya", "egypt", "morocco", "algeria", "tunisia", "ghana", "ethiopia", "uganda", "tanzania", "angola"].some((k) => c.includes(k))
  ) return "AF";
  // Oceania
  if (["australia", "new zealand", "papua", "fiji"].some((k) => c.includes(k))) return "OC";
  // Asia (fallback for common)
  if (
    ["india", "china", "japan", "korea", "singapore", "indonesia", "malaysia", "philippines", "thailand", "vietnam", "pakistan", "bangladesh", "sri lanka", "israel", "saudi", "turkey", "uae", "united arab emirates"].some((k) => c.includes(k))
  ) return "AS";
  return "UN";
}

function sumByRegion(countries: CountryCount[]) {
  const sums = { NA: 0, SA: 0, EU: 0, AF: 0, AS: 0, OC: 0, UN: 0 };
  for (const row of countries) {
    const r = bucketToRegion(row.country);
    sums[r] += row.count;
  }
  return sums;
}

function heatFill(value: number, max: number) {
  // White background with red shading; keep a visible minimum so regions always render.
  if (!max || max <= 0) return "rgba(220, 38, 38, 0.10)";
  const t = Math.max(0, Math.min(1, value / max));
  const a = 0.10 + t * 0.55; // 0.10..0.65
  return `rgba(220, 38, 38, ${a.toFixed(3)})`;
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
  const regions = sumByRegion(countries);
  const maxRegion = Math.max(1, regions.NA, regions.SA, regions.EU, regions.AF, regions.AS, regions.OC, regions.UN);

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
              <svg viewBox="0 0 1000 420" className="h-[240px] w-full rounded-xl border border-neutral-200 bg-white">
                {/* Ocean grid */}
                {Array.from({ length: 10 }).map((_, i) => (
                  <line key={`h${i}`} x1={0} y1={i * 42} x2={1000} y2={i * 42} stroke="rgba(0,0,0,0.06)" />
                ))}
                {Array.from({ length: 10 }).map((_, i) => (
                  <line key={`v${i}`} x1={i * 100} y1={0} x2={i * 100} y2={420} stroke="rgba(0,0,0,0.05)" />
                ))}

                {/* Continents (very simplified shapes) */}
                <path
                  d="M110,110 C140,80 240,70 305,95 C360,115 410,160 380,205 C350,250 280,250 240,235 C200,220 170,250 140,235 C110,220 70,160 110,110 Z"
                  fill={heatFill(regions.NA, maxRegion)}
                  stroke="rgba(0,0,0,0.55)"
                />
                <path
                  d="M300,235 C345,220 380,250 370,295 C360,345 330,370 300,385 C270,400 245,370 255,330 C265,290 265,260 300,235 Z"
                  fill={heatFill(regions.SA, maxRegion)}
                  stroke="rgba(0,0,0,0.55)"
                />
                <path
                  d="M470,105 C510,80 575,80 615,95 C650,110 660,145 630,160 C595,175 545,160 520,175 C495,190 450,155 470,105 Z"
                  fill={heatFill(regions.EU, maxRegion)}
                  stroke="rgba(0,0,0,0.55)"
                />
                <path
                  d="M505,175 C545,165 595,180 625,205 C660,235 665,285 635,315 C600,350 545,340 510,315 C480,295 465,245 485,210 C495,190 490,180 505,175 Z"
                  fill={heatFill(regions.AF, maxRegion)}
                  stroke="rgba(0,0,0,0.55)"
                />
                <path
                  d="M635,150 C680,120 775,115 855,145 C910,165 940,205 900,235 C860,265 800,250 770,270 C735,295 690,285 660,260 C635,235 600,190 635,150 Z"
                  fill={heatFill(regions.AS, maxRegion)}
                  stroke="rgba(0,0,0,0.55)"
                />
                <path
                  d="M820,295 C855,275 910,280 935,300 C960,320 945,355 910,365 C875,375 845,360 825,340 C805,320 800,305 820,295 Z"
                  fill={heatFill(regions.OC, maxRegion)}
                  stroke="rgba(0,0,0,0.55)"
                />

                {/* Stylized country outlines (lightweight borders for visibility) */}
                <g fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="1">
                  {/* North America borders */}
                  <path d="M160,130 C210,120 250,130 295,155" />
                  <path d="M185,190 C230,175 275,180 320,205" />
                  <path d="M245,110 C255,145 260,175 250,210" />
                  {/* South America borders */}
                  <path d="M290,255 C320,270 335,295 330,325" />
                  <path d="M280,310 C305,330 310,355 295,375" />
                  {/* Europe borders */}
                  <path d="M505,125 C535,120 560,125 590,140" />
                  <path d="M530,150 C550,155 570,160 600,155" />
                  {/* Africa borders */}
                  <path d="M520,205 C555,210 585,230 605,255" />
                  <path d="M545,275 C565,290 585,305 610,300" />
                  <path d="M560,215 C555,245 555,275 565,310" />
                  {/* Asia borders */}
                  <path d="M690,165 C735,160 780,170 825,190" />
                  <path d="M705,205 C745,210 790,220 835,210" />
                  <path d="M770,150 C770,185 760,215 740,245" />
                  <path d="M820,220 C800,240 780,255 760,270" />
                  {/* Oceania borders */}
                  <path d="M845,315 C870,305 900,310 925,325" />
                  <path d="M875,340 C895,345 915,350 930,340" />
                </g>

                {/* Legend label */}
                <text x="18" y="28" fill="rgba(0,0,0,0.75)" fontSize="14" fontFamily="ui-sans-serif, system-ui">
                  {mode === "signups" ? "New signups" : "Logins"} by region
                </text>
              </svg>
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

