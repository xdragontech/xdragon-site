// pages/admin/dashboard.tsx
import type { GetServerSideProps } from "next";
import Head from "next/head";
import { getServerSession } from "next-auth/next";
import { useEffect, useRef, useState } from "react";
import { authOptions } from "../api/auth/[...nextauth]";
import AdminHeader from "../../components/admin/AdminHeader";
import AdminSidebar from "../../components/admin/AdminSidebar";

type DashboardProps = {
  ok: true;
  me: { id: string | null; email: string | null };
};

type MetricsPeriod = "today" | "7d" | "month";
type GeoMode = "signups" | "logins";

type LoginIpGroup = { ip: string; country: string; count: number };

type MetricsOk = {
  ok: true;
  period: MetricsPeriod;
  labels: string[];
  signups: number[];
  logins: number[];
  totals: { signups: number; logins: number };
  ipGroups: LoginIpGroup[];
  signupCountries: Array<{ country: string | null; count: number }>;
};

type MetricsErr = { ok: false; error: string };
type MetricsResponse = MetricsOk | MetricsErr;

type MetricsPoint = { label: string; signups: number; logins: number };
type CountryCount = { country: string; count: number };
type CountryMapDatum = { name: string; count: number };

function emptyMetrics(period: MetricsPeriod): MetricsOk {
  return {
    ok: true,
    period,
    labels: [],
    signups: [],
    logins: [],
    totals: { signups: 0, logins: 0 },
    ipGroups: [],
    signupCountries: [],
  };
}

function buildLinePath(points: MetricsPoint[], key: "signups" | "logins", w: number, h: number, pad = 12) {
  if (!points.length) return "";
  const maxVal = Math.max(1, ...points.map((p) => p.signups), ...points.map((p) => p.logins));
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

function normalizeKey(name: string) {
  return (name || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .replace(/[’'"]/g, "")
    .replace(/\(.*?\)/g, "")
    .trim();
}

function canonicalCountryKey(name: string) {
  const k = normalizeKey(name);
  const aliases: Record<string, string> = {
    usa: "united states of america",
    us: "united states of america",
    "united states": "united states of america",
    uk: "united kingdom",
    russia: "russian federation",
    vietnam: "viet nam",
    iran: "iran, islamic republic of",
    syria: "syrian arab republic",
    laos: "lao peoples democratic republic",
    bolivia: "bolivia, plurinational state of",
    tanzania: "tanzania, united republic of",
    venezuela: "venezuela, bolivarian republic of",
    "czech republic": "czechia",
    "south korea": "korea, republic of",
    "north korea": "korea, democratic peoples republic of",
    "ivory coast": "côte divoire",
    "cote divoire": "côte divoire",
  };
  return aliases[k] || k;
}

function heatFill(value: number, max: number) {
  // White background with red shading. Gamma curve makes differences visible.
  if (!max || max <= 0) return "rgba(220, 38, 38, 0.00)";
  const raw = Math.max(0, Math.min(1, value / max));
  const t = Math.pow(raw, 0.55);
  const a = value <= 0 ? 0.0 : 0.08 + t * 0.77; // 0.08..0.85
  return `rgba(220, 38, 38, ${a.toFixed(3)})`;
}

function aggregateCountries(rows: Array<{ country?: string | null; count?: number | null }>): CountryCount[] {
  const map = new Map<string, number>();
  for (const r of rows || []) {
    const name = (r?.country || "Unknown").toString();
    const count = Number(r?.count || 0) || 0;
    map.set(name, (map.get(name) || 0) + count);
  }
  return Array.from(map.entries())
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count);
}

function MiniLineChart({ points }: { points: MetricsPoint[] }) {
  const w = 600;
  const h = 170;
  const signupsPath = buildLinePath(points, "signups", w, h);
  const loginsPath = buildLinePath(points, "logins", w, h);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[170px] w-full rounded-xl border border-neutral-200 bg-neutral-900">
      <path d={loginsPath} fill="none" stroke="rgba(255,255,255,0.90)" strokeWidth="3" />
      <path d={signupsPath} fill="none" stroke="rgba(220,38,38,0.95)" strokeWidth="3" />
    </svg>
  );
}

function LoginIpsTable({ loading, error, groups }: { loading: boolean; error: string | null; groups: LoginIpGroup[] }) {
  const top = (groups || []).slice(0, 10);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="text-sm font-semibold text-neutral-900">Logins by IP</div>
      <div className="mt-2">
        {loading ? (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600">Loading…</div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        ) : top.length ? (
          <div className="overflow-hidden rounded-xl border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">IP</th>
                  <th className="px-3 py-2 text-left font-semibold">CTRY</th>
                  <th className="px-3 py-2 text-right font-semibold">Count</th>
                </tr>
              </thead>
              <tbody>
                {top.map((r) => (
                  <tr key={r.ip} className="border-t border-neutral-200">
                    <td className="px-3 py-2 font-mono text-xs text-neutral-800">{r.ip}</td>
                    <td className="px-3 py-2 text-neutral-700">{(r as any).countryIso3 || r.country || "—"}</td>
                    <td className="px-3 py-2 text-right font-semibold text-neutral-900">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-neutral-600">No data yet.</div>
        )}
      </div>
    </div>
  );
}

function CountryWorldMap({ data, title }: { data: CountryMapDatum[]; title: string }) {
  const [paths, setPaths] = useState<Array<{ d: string; name: string; value: number }>>([]);
  const [mapError, setMapError] = useState<string | null>(null);

  // Zoom/pan
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const dragRef = useRef<{ x: number; y: number; dragging: boolean }>({ x: 0, y: 0, dragging: false });

  function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
  }

  function zoomTo(nextScale: number, anchorX: number, anchorY: number) {
    const s = clamp(nextScale, 1, 6);
    const k = s / scale;
    const nextTx = anchorX - k * (anchorX - tx);
    const nextTy = anchorY - k * (anchorY - ty);
    setScale(s);
    setTx(nextTx);
    setTy(nextTy);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setMapError(null);

        const [{ geoNaturalEarth1, geoPath }, topojson] = await Promise.all([
          import("d3-geo"),
          import("topojson-client"),
        ]);

        const topoRes = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json");
        if (!topoRes.ok) throw new Error(`World map fetch failed (${topoRes.status})`);
        const topo = await topoRes.json();

        const countriesObj = (topo as any)?.objects?.countries;
        if (!countriesObj) throw new Error("Invalid world-atlas payload (countries missing)");
        const features = (topojson as any).feature(topo, countriesObj)?.features || [];

        // Build a stable lookup from our data
        const valueByName = new Map<string, number>();
        for (const row of data || []) {
          const key = canonicalCountryKey(row.name);
          if (!key) continue;
          valueByName.set(key, (valueByName.get(key) || 0) + (Number(row.count) || 0));
        }

        const values = Array.from(valueByName.values());
        const maxVal = Math.max(1, ...(values.length ? values : [1]));

        const width = 920;
        const height = 240;
        const projection = geoNaturalEarth1().fitSize([width, height], { type: "FeatureCollection", features });
        const pathGen = geoPath(projection);

        const out: Array<{ d: string; name: string; value: number }> = [];
        for (const f of features) {
          const name = ((f as any)?.properties?.name || "Unknown").toString();
          const key = canonicalCountryKey(name);
          const value = valueByName.get(key) || 0;
          const d = pathGen(f);
          if (d) out.push({ d, name, value });
        }

        if (!cancelled) {
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
    <div className="rounded-xl border border-neutral-200 bg-white">
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <div className="text-xs font-semibold text-neutral-900">{title}</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => zoomTo(scale * 1.25, 460, 120)}
            className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
            title="Zoom in"
          >
            +
          </button>
          <button
            onClick={() => zoomTo(scale / 1.25, 460, 120)}
            className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
            title="Zoom out"
          >
            −
          </button>
          <button
            onClick={() => {
              setScale(1);
              setTx(0);
              setTy(0);
            }}
            className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
            title="Reset"
          >
            Reset
          </button>
        </div>
      </div>

      {mapError ? (
        <div className="border-t border-neutral-200 p-3 text-sm text-red-700">{mapError}</div>
      ) : (
        <svg
          viewBox="0 0 920 240"
          className="h-[240px] w-full bg-white"
          onWheel={(e) => {
            e.preventDefault();
            const rect = (e.currentTarget as any).getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 920;
            const y = ((e.clientY - rect.top) / rect.height) * 240;
            const direction = e.deltaY > 0 ? 1 / 1.15 : 1.15;
            zoomTo(scale * direction, x, y);
          }}
          onPointerDown={(e) => {
            (e.currentTarget as any).setPointerCapture?.(e.pointerId);
            dragRef.current.dragging = true;
            dragRef.current.x = e.clientX;
            dragRef.current.y = e.clientY;
          }}
          onPointerMove={(e) => {
            if (!dragRef.current.dragging) return;
            const dx = e.clientX - dragRef.current.x;
            const dy = e.clientY - dragRef.current.y;
            dragRef.current.x = e.clientX;
            dragRef.current.y = e.clientY;
            const rect = (e.currentTarget as any).getBoundingClientRect();
            setTx((prev) => prev + (dx / rect.width) * 920);
            setTy((prev) => prev + (dy / rect.height) * 240);
          }}
          onPointerUp={(e) => {
            dragRef.current.dragging = false;
            try {
              (e.currentTarget as any).releasePointerCapture?.(e.pointerId);
            } catch {}
          }}
        >
          <g transform={`translate(${tx.toFixed(3)}, ${ty.toFixed(3)}) scale(${scale.toFixed(3)})`}>
            {paths.map((p, i) => (
              <path
                key={`${i}-${p.name}`}
                d={p.d}
                fill={heatFill(p.value, maxVal)}
                stroke="rgba(0,0,0,0.95)"
                strokeWidth="0.55"
                vectorEffect="non-scaling-stroke"
              >
                <title>
                  {p.name}: {p.value}
                </title>
              </path>
            ))}
          </g>
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
  const top = countries.slice(0, 8);
  const counts = countries.map((c) => c.count || 0);
  const legendMin = counts.length ? Math.min(...counts) : 0;
  const legendMax = counts.length ? Math.max(...counts) : 0;
  const legendMid = Math.round((legendMin + legendMax) / 2);

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

      <div className="mt-3 grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-9">
          {loading ? (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">Loading…</div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
          ) : (
            <CountryWorldMap
              title={mode === "signups" ? "New signups by country" : "Logins by country"}
              data={(countries || []).map((c) => ({ name: c.country, count: c.count }))}
            />
          )}
        </div>

        <div className="lg:col-span-3">
          {/* Counts box: keep exact formatting */}
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
          </div>

          {/* Legend box: separate, vertical scale */}
          <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-3">
            <div className="text-xs font-semibold text-neutral-900">Legend</div>
            <div className="mt-3 flex items-start gap-3">
              <div className="relative h-32 w-4 overflow-hidden rounded-full border border-neutral-200 bg-gradient-to-b from-red-600 to-neutral-100" />
              <div className="flex h-32 flex-col justify-between text-xs text-neutral-600">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded bg-red-600/70" />
                  <span className="font-semibold text-neutral-900">{legendMax}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded bg-red-300/60" />
                  <span className="font-semibold text-neutral-900">{legendMid}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded bg-neutral-200" />
                  <span className="font-semibold text-neutral-900">{legendMin}</span>
                </div>
              </div>
            </div>
            <div className="mt-3 text-xs text-neutral-500">
              Darker red = higher {mode === "signups" ? "signups" : "logins"}.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<DashboardProps> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);

  const role = ((session as any)?.role || (session as any)?.user?.role || null) as string | null;
  if (!session || role !== "ADMIN") {
    return {
      redirect: {
        destination: "/admin/signin",
        permanent: false,
      },
    };
  }

  return {
    props: {
      ok: true,
      me: {
        id: ((session as any)?.user?.id as string) || null,
        email: ((session as any)?.user?.email as string) || null,
      },
    },
  };
};

export default function AdminDashboardPage(_props: DashboardProps) {
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
        const ok = data as MetricsOk;

        const labels = Array.isArray(ok.labels) ? ok.labels : [];
        const signups = Array.isArray(ok.signups) ? ok.signups : [];
        const logins = Array.isArray(ok.logins) ? ok.logins : [];
        const totals = {
          signups: signups.reduce((a, b) => a + (Number(b) || 0), 0),
          logins: logins.reduce((a, b) => a + (Number(b) || 0), 0),
        };

        setMetrics({
          ok: true,
          period: nextPeriod,
          labels,
          signups,
          logins,
          totals,
          ipGroups: Array.isArray(ok.ipGroups) ? ok.ipGroups : [],
          signupCountries: Array.isArray(ok.signupCountries) ? ok.signupCountries : [],
        });
      } else {
        setMetricsError((data as any)?.error || "Failed to load metrics");
        setMetrics(emptyMetrics(nextPeriod));
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

  const points = arraysToPoints(metrics);
  const loginCountries = aggregateCountries(metrics.ipGroups as any);
  const signupCountries = aggregateCountries(metrics.signupCountries as any);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <Head>
        <title>Admin • Dashboard</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <AdminHeader sectionLabel="Dashboard" loggedInAs={loggedInAs} />

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-12">
          <AdminSidebar active="dashboard" />

          <section className="lg:col-span-10">
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
                      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">Loading…</div>
                    ) : metricsError ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{metricsError}</div>
                    ) : (
                      <>
                        <MiniLineChart points={points} />
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

                {/* Heatmap below chart */}
                <WorldHeatMapCard
                  mode={geoMode}
                  onModeChange={setGeoMode}
                  periodLabel={period === "today" ? "today" : period === "7d" ? "the last 7 days" : "this month"}
                  countries={geoMode === "logins" ? loginCountries : signupCountries}
                  loading={metricsLoading}
                  error={metricsError}
                />
              </div>

              <div className="lg:col-span-3">
                <LoginIpsTable loading={metricsLoading} error={metricsError} groups={metrics.ok ? metrics.ipGroups : []} />
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
