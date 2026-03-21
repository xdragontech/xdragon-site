// pages/api/admin/metrics.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { requireBackofficeApi } from "../../../lib/backofficeAuth";
import { prisma } from "../../../lib/prisma";

export type MetricsPeriod = "today" | "7d" | "month";

type IpGroup = { ip: string; country: string | null; countryIso3: string | null; count: number };

type MetricsOk = {
  ok: true;
  period: MetricsPeriod;
  from: string;
  to: string;
  labels: string[];
  signups: number[];
  logins: number[];
  totals: { signups: number; logins: number };
  ipGroups: IpGroup[];
  signupCountries: { country: string | null; count: number }[];
};

type MetricsErr = { ok: false; error: string };

type MetricsResponse = MetricsOk | MetricsErr;

type SignupRow = {
  id: string;
  createdAt: Date;
  kind: "legacy" | "external";
  legacyUserId?: string | null;
};

type LoginMetricEvent = {
  source: "legacy" | "external";
  principalId: string;
  createdAt: Date;
  ip: string;
  countryIso2: string | null;
  countryName: string | null;
};

function isPrivateIp(ip: string) {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  );
}

// Normalize IP strings coming from proxies / logs.
// Handles: "ip, proxy", "ip:port", "[ipv6]:port", "::ffff:ipv4".
function normalizeIp(input: string): string {
  let ip = (input || "").trim();
  if (!ip) return "";

  // If we got an X-Forwarded-For style list, take the first hop.
  if (ip.includes(",")) {
    ip =
      ip
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)[0] || "";
  }

  // IPv4-mapped IPv6
  if (ip.toLowerCase().startsWith("::ffff:")) ip = ip.slice(7);

  // Bracketed IPv6 with port
  const m6 = ip.match(/^\[([^\]]+)\]:(\d+)$/);
  if (m6) return m6[1];

  // IPv4 with port
  const m4 = ip.match(/^(\d{1,3}(?:\.\d{1,3}){3}):(\d+)$/);
  if (m4) return m4[1];

  return ip;
}

// Cache geo lookups within a single serverless instance.
type Geo = { name: string | null; iso2: string | null; iso3: string | null };

// ISO-3166 alpha-2 → alpha-3 (used for Logins-by-IP CTRY display)
const ISO2_TO_ISO3: Record<string, string> = {
  US: "USA", CA: "CAN", MX: "MEX", GB: "GBR", FR: "FRA", DE: "DEU", ES: "ESP", IT: "ITA", NL: "NLD", BE: "BEL",
  CH: "CHE", AT: "AUT", SE: "SWE", NO: "NOR", DK: "DNK", FI: "FIN", IE: "IRL", PT: "PRT", PL: "POL", CZ: "CZE",
  SK: "SVK", HU: "HUN", RO: "ROU", BG: "BGR", GR: "GRC", TR: "TUR", UA: "UKR", RU: "RUS",
  AU: "AUS", NZ: "NZL", JP: "JPN", KR: "KOR", CN: "CHN", TW: "TWN", HK: "HKG", SG: "SGP", IN: "IND",
  BR: "BRA", AR: "ARG", CL: "CHL", CO: "COL", PE: "PER",
  ZA: "ZAF", EG: "EGY", MA: "MAR", NG: "NGA", KE: "KEN",
};
const iso2ToIso3 = (iso2: string | null): string | null => {
  if (!iso2) return null;
  const k = iso2.trim().toUpperCase();
  return ISO2_TO_ISO3[k] ?? null;
};

const iso2ToCountryName = (iso2: string | null): string | null => {
  if (!iso2) return null;
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "region" });
    return (dn.of(iso2.trim().toUpperCase()) as string) || null;
  } catch {
    return null;
  }
};

const geoCache: Map<string, Geo> =
  (global as any).__xdragonGeoCache || ((global as any).__xdragonGeoCache = new Map<string, Geo>());

async function geoForIp(ip: string): Promise<Geo> {
  const empty: Geo = { name: null, iso2: null, iso3: null };
  if (!ip) return empty;
  const norm = normalizeIp(ip);
  if (!norm) return empty;
  if (isPrivateIp(norm)) return { name: "Private", iso2: null, iso3: null };
  if (geoCache.has(norm)) return geoCache.get(norm) ?? empty;

  // Best-effort: do NOT fail the endpoint if geo lookup fails.
  try {
    // ipwho.is has a generous free tier for simple lookups.
    const r = await fetch(`https://ipwho.is/${encodeURIComponent(norm)}?fields=success,country_code,country`, {
      method: "GET",
      headers: { "User-Agent": "xdragon-admin-metrics" },
    });
    const j: any = await r.json().catch(() => null);
    const name = j && j.success ? (j.country || null) : null;
    const iso2 = j && j.success ? ((j.country_code || null) as string | null) : null;
    const iso3 = iso2ToIso3(iso2);

    const geo: Geo = { name, iso2, iso3 };
    geoCache.set(norm, geo);
    return geo;
  } catch {
    geoCache.set(norm, empty);
    return empty;
  }
}

function parsePeriod(p: unknown): MetricsPeriod {
  if (p === "today" || p === "7d" || p === "month") return p;
  return "7d";
}

function periodBounds(period: MetricsPeriod) {
  const now = new Date();
  const end = new Date(now);

  const start = new Date(now);
  if (period === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (period === "7d") {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else {
    // month
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }

  return { start, end };
}

function buildLabels(period: MetricsPeriod, start: Date, end: Date): string[] {
  const labels: string[] = [];

  if (period === "today") {
    // Hour buckets
    for (let h = 0; h < 24; h++) labels.push(`${h.toString().padStart(2, "0")}:00`);
    return labels;
  }

  // Day buckets (inclusive)
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  while (cur <= end) {
    labels.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return labels;
}

function bucketIndex(period: MetricsPeriod, start: Date, when: Date): number {
  if (period === "today") return when.getHours();

  const d0 = new Date(start);
  d0.setHours(0, 0, 0, 0);
  const d1 = new Date(when);
  d1.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((d1.getTime() - d0.getTime()) / (24 * 60 * 60 * 1000));
  return diffDays;
}

function rememberFirstLogin(
  firstIpByPrincipal: Map<string, string>,
  firstGeoByPrincipal: Map<string, { iso2: string | null; name: string | null }>,
  principalId: string,
  ipRaw: string | null | undefined,
  countryIso2: string | null | undefined,
  countryName: string | null | undefined
) {
  if (firstIpByPrincipal.has(principalId)) return;

  const ip = normalizeIp((ipRaw || "").trim());
  if (!ip || isPrivateIp(ip)) return;

  firstIpByPrincipal.set(principalId, ip);
  firstGeoByPrincipal.set(principalId, {
    iso2: countryIso2 || null,
    name: countryName || null,
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<MetricsResponse>) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const auth = await requireBackofficeApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const period = parsePeriod(req.query.period);
  const { start, end } = periodBounds(period);

  const labels = buildLabels(period, start, end);
  const signups = Array(labels.length).fill(0) as number[];
  const logins = Array(labels.length).fill(0) as number[];

  const isSuperadmin = auth.principal.role === "SUPERADMIN";

  // Superadmins retain the full historical dashboard view.
  // Staff are intentionally scoped to brand-aware external identity data only because legacy auth rows are not safely tenant-scoped.
  let signupRows: SignupRow[] = [];
  let events: LoginMetricEvent[] = [];

  if (isSuperadmin) {
    const [legacyUsers, externalUsers, legacyEvents, externalEvents] = await Promise.all([
      prisma.user.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { id: true, createdAt: true },
      }),
      prisma.externalUser.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { id: true, legacyUserId: true, createdAt: true },
      }),
      prisma.loginEvent.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { userId: true, createdAt: true, ip: true, countryIso2: true, countryName: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.externalLoginEvent.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { externalUserId: true, createdAt: true, ip: true, countryIso2: true, countryName: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const migratedLegacyIds = new Set(
      externalUsers
        .map((user) => user.legacyUserId)
        .filter((value): value is string => Boolean(value))
    );

    signupRows = [
      ...legacyUsers
        .filter((user) => !migratedLegacyIds.has(user.id))
        .map((user) => ({
          id: user.id,
          createdAt: user.createdAt,
          kind: "legacy" as const,
        })),
      ...externalUsers.map((user) => ({
        id: user.id,
        createdAt: user.createdAt,
        kind: "external" as const,
        legacyUserId: user.legacyUserId || null,
      })),
    ];

    events = [
      ...legacyEvents.map((event) => ({
        source: "legacy" as const,
        principalId: event.userId,
        createdAt: event.createdAt,
        ip: event.ip,
        countryIso2: event.countryIso2 || null,
        countryName: event.countryName || null,
      })),
      ...externalEvents.map((event) => ({
        source: "external" as const,
        principalId: event.externalUserId,
        createdAt: event.createdAt,
        ip: event.ip,
        countryIso2: event.countryIso2 || null,
        countryName: event.countryName || null,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } else {
    const [externalUsers, externalEvents] = await Promise.all([
      prisma.externalUser.findMany({
        where: {
          brandId: { in: auth.principal.allowedBrandIds },
          createdAt: { gte: start, lte: end },
        },
        select: { id: true, legacyUserId: true, createdAt: true },
      }),
      prisma.externalLoginEvent.findMany({
        where: {
          brandId: { in: auth.principal.allowedBrandIds },
          createdAt: { gte: start, lte: end },
        },
        select: { externalUserId: true, createdAt: true, ip: true, countryIso2: true, countryName: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    signupRows = externalUsers.map((user) => ({
      id: user.id,
      createdAt: user.createdAt,
      kind: "external" as const,
      legacyUserId: user.legacyUserId || null,
    }));

    events = externalEvents
      .map((event) => ({
        source: "external" as const,
        principalId: event.externalUserId,
        createdAt: event.createdAt,
        ip: event.ip,
        countryIso2: event.countryIso2 || null,
        countryName: event.countryName || null,
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  for (const u of signupRows) {
    const idx = bucketIndex(period, start, u.createdAt);
    if (idx >= 0 && idx < signups.length) signups[idx] += 1;
  }

  // Aggregate login buckets + ip groups
  const ipCounts = new Map<string, number>();
  // Prefer the most recent non-null geo for each IP from stored LoginEvent fields.
  const ipGeo = new Map<string, { iso2: string | null; name: string | null }>();
  // Track raw IP strings for IPs missing stored geo so we can progressively backfill.
  const ipMissingGeoRaw = new Map<string, Set<string>>();
  for (const ev of events) {
    const idx = bucketIndex(period, start, ev.createdAt);
    if (idx >= 0 && idx < logins.length) logins[idx] += 1;

    const rawIp = (ev.ip || "").trim();
    const ip = normalizeIp(rawIp);
    if (ip) {
      ipCounts.set(ip, (ipCounts.get(ip) || 0) + 1);
      // Because `events` are ordered DESC, the first geo we see per IP is the most recent.
      if (!ipGeo.has(ip)) {
        const iso2 = ((ev as any).countryIso2 || null) as string | null;
        const name = ((ev as any).countryName || null) as string | null;
        if (iso2 || name) {
          ipGeo.set(ip, { iso2, name });
        } else if (rawIp) {
          const set = ipMissingGeoRaw.get(ip) || new Set<string>();
          set.add(rawIp);
          ipMissingGeoRaw.set(ip, set);
        }
      }
    }
  }

  const totals = {
    signups: signupRows.length,
    logins: events.length,
  };

  // Top IPs by count
  const topIps = Array.from(ipCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50);

  // Resolve countries (best-effort)
  const ipGroups: IpGroup[] = [];
  for (const [ip, count] of topIps) {
    const stored = ipGeo.get(ip) || { iso2: null, name: null };
    const storedIso3 = iso2ToIso3(stored.iso2);
    const storedCountry = (stored.name || iso2ToCountryName(stored.iso2) || null) as string | null;

    // Use stored geo first; fall back to third-party geo lookup for older records.
    if (storedCountry || storedIso3) {
      ipGroups.push({ ip, country: storedCountry, countryIso3: storedIso3, count });
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const geo = await geoForIp(ip);
    const country = (geo.name || iso2ToCountryName(geo.iso2) || null) as string | null;
    ipGroups.push({ ip, country, countryIso3: geo.iso3, count });

    // Progressive backfill: if this IP had missing stored geo historically,
    // and we successfully resolved it now, update those older rows so future loads don't depend on ipwho.
    try {
      const rawSet = ipMissingGeoRaw.get(ip);
      if (rawSet && (geo.iso2 || country)) {
        const rawIps = Array.from(rawSet.values()).slice(0, 50); // guardrail
        const iso2 = geo.iso2 ? geo.iso2.trim().toUpperCase() : null;
        const name = country;
        if (isSuperadmin && rawIps.length && (iso2 || name)) {
          // eslint-disable-next-line no-await-in-loop
          await Promise.all([
            prisma.loginEvent.updateMany({
              where: {
                ip: { in: rawIps },
                OR: [{ countryIso2: null }, { countryName: null }],
              } as any,
              data: {
                countryIso2: iso2,
                countryName: name,
              } as any,
            }),
            prisma.externalLoginEvent.updateMany({
              where: {
                ip: { in: rawIps },
                OR: [{ countryIso2: null }, { countryName: null }],
              } as any,
              data: {
                countryIso2: iso2,
                countryName: name,
              } as any,
            }),
          ]);
        }
      }
    } catch {
      // ignore backfill failures
    }
  }
  // Countries for signups:
  // User models don't store a signup IP. We approximate using the earliest login IP
  // for identities created within the selected window.
  const signupCountriesMap = new Map<string, number>();
  try {
    const legacySignupRows = signupRows.filter((row) => row.kind === "legacy");
    const externalSignupRows = signupRows.filter((row) => row.kind === "external");
    const firstLegacyIpByUser = new Map<string, string>();
    const firstLegacyGeoByUser = new Map<string, { iso2: string | null; name: string | null }>();
    const firstExternalIpByUser = new Map<string, string>();
    const firstExternalGeoByUser = new Map<string, { iso2: string | null; name: string | null }>();

    const chunkSize = 500;

    for (let i = 0; i < legacySignupRows.length; i += chunkSize) {
      const chunk = legacySignupRows.slice(i, i + chunkSize).map((row) => row.id);

      // eslint-disable-next-line no-await-in-loop
      const loginRows = await prisma.loginEvent.findMany({
        where: { userId: { in: chunk } },
        select: { userId: true, ip: true, createdAt: true, countryIso2: true, countryName: true },
        orderBy: { createdAt: "asc" },
      });

      for (const row of loginRows) {
        rememberFirstLogin(firstLegacyIpByUser, firstLegacyGeoByUser, row.userId, row.ip, row.countryIso2, row.countryName);
      }
    }

    for (let i = 0; i < externalSignupRows.length; i += chunkSize) {
      const chunk = externalSignupRows.slice(i, i + chunkSize).map((row) => row.id);

      // eslint-disable-next-line no-await-in-loop
      const loginRows = await prisma.externalLoginEvent.findMany({
        where: { externalUserId: { in: chunk } },
        select: { externalUserId: true, ip: true, createdAt: true, countryIso2: true, countryName: true },
        orderBy: { createdAt: "asc" },
      });

      for (const row of loginRows) {
        rememberFirstLogin(
          firstExternalIpByUser,
          firstExternalGeoByUser,
          row.externalUserId,
          row.ip,
          row.countryIso2,
          row.countryName
        );
      }
    }

    for (const signup of signupRows) {
      const externalStored = signup.kind === "external" ? firstExternalGeoByUser.get(signup.id) : null;
      const externalIp = signup.kind === "external" ? firstExternalIpByUser.get(signup.id) || null : null;
      const legacyStored = signup.kind === "legacy"
        ? firstLegacyGeoByUser.get(signup.id)
        : signup.legacyUserId
          ? firstLegacyGeoByUser.get(signup.legacyUserId)
          : null;
      const legacyIp = signup.kind === "legacy"
        ? firstLegacyIpByUser.get(signup.id) || null
        : signup.legacyUserId
          ? firstLegacyIpByUser.get(signup.legacyUserId) || null
          : null;

      const stored = externalStored || legacyStored || { iso2: null, name: null };
      const ip = externalIp || legacyIp;
      if (!ip) continue;

      let country = stored.name || iso2ToCountryName(stored.iso2) || null;
      if (!country) {
        // eslint-disable-next-line no-await-in-loop
        const geo = await geoForIp(ip);
        country = geo.name || iso2ToCountryName(geo.iso2) || null;
      }
      const key = (country || "Unknown").toString();
      signupCountriesMap.set(key, (signupCountriesMap.get(key) || 0) + 1);
    }
  } catch {
    // ignore; returns empty
  }

  const signupCountries: { country: string | null; count: number }[] = Array.from(signupCountriesMap.entries())
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count);



  return res.status(200).json({
    ok: true,
    period,
    from: start.toISOString(),
    to: end.toISOString(),
    labels,
    signups,
    logins,
    totals,
    ipGroups,
    signupCountries,
  });
}
