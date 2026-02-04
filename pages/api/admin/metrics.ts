// pages/api/admin/metrics.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "../../../lib/prisma";

export type MetricsPeriod = "today" | "7d" | "month";

type IpGroup = { ip: string; country: string | null; count: number };

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

function getSessionRole(session: any): string | null {
  return (session?.role as string) || (session?.user?.role as string) || null;
}

function isPrivateIp(ip: string) {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  );
}

// Cache country lookups within a single serverless instance.
const geoCache: Map<string, string | null> =
  (global as any).__xdragonGeoCache || ((global as any).__xdragonGeoCache = new Map<string, string | null>());

async function countryForIp(ip: string): Promise<string | null> {
  if (!ip) return null;
  if (isPrivateIp(ip)) return "Private";
  if (geoCache.has(ip)) return geoCache.get(ip) ?? null;

  // Best-effort: do NOT fail the endpoint if geo lookup fails.
  try {
    // ipwho.is has a generous free tier for simple lookups.
    const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country_code,country`, {
      method: "GET",
      headers: { "User-Agent": "xdragon-admin-metrics" },
    });
    const j: any = await r.json().catch(() => null);
    const c = j && j.success ? (j.country_code || j.country || null) : null;
    geoCache.set(ip, c);
    return c;
  } catch {
    geoCache.set(ip, null);
    return null;
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

export default async function handler(req: NextApiRequest, res: NextApiResponse<MetricsResponse>) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // Auth: must be signed in AND an ADMIN.
  const session = await getServerSession(req, res, authOptions as any);
  const role = getSessionRole(session);
  if (!session || role !== "ADMIN") return res.status(401).json({ ok: false, error: "Unauthorized" });

  const period = parsePeriod(req.query.period);
  const { start, end } = periodBounds(period);

  const labels = buildLabels(period, start, end);
  const signups = Array(labels.length).fill(0) as number[];
  const logins = Array(labels.length).fill(0) as number[];

  // Fetch counts for signups and logins.
  // NOTE: We only pull the timestamp columns and aggregate in JS to keep the endpoint simple.
  const [users, events] = await Promise.all([
    prisma.user.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { id: true, createdAt: true },
    }),
    prisma.loginEvent.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { createdAt: true, ip: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  for (const u of users) {
    const idx = bucketIndex(period, start, u.createdAt);
    if (idx >= 0 && idx < signups.length) signups[idx] += 1;
  }

  // Aggregate login buckets + ip groups
  const ipCounts = new Map<string, number>();
  for (const ev of events) {
    const idx = bucketIndex(period, start, ev.createdAt);
    if (idx >= 0 && idx < logins.length) logins[idx] += 1;

    const ip = (ev.ip || "").trim();
    if (ip) ipCounts.set(ip, (ipCounts.get(ip) || 0) + 1);
  }

  const totals = {
    signups: users.length,
    logins: events.length,
  };

  // Top IPs by count
  const topIps = Array.from(ipCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50);

  // Resolve countries (best-effort)
  const ipGroups: IpGroup[] = [];
  for (const [ip, count] of topIps) {
    // eslint-disable-next-line no-await-in-loop
    const country = await countryForIp(ip);
    ipGroups.push({ ip, country, count });
  }
  // Countries for signups:
  // User model doesn't store a signup IP. We approximate using the earliest LoginEvent IP
  // for users created within the selected window.
  const signupCountriesMap = new Map<string, number>();
  try {
    const userIds = (users as any[]).map((u) => u?.id).filter(Boolean) as string[];
    const firstIpByUser = new Map<string, string>();

    const chunkSize = 500;
    for (let i = 0; i < userIds.length; i += chunkSize) {
      const chunk = userIds.slice(i, i + chunkSize);

      // eslint-disable-next-line no-await-in-loop
      const loginRows = await prisma.loginEvent.findMany({
        where: { userId: { in: chunk } },
        select: { userId: true, ip: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      });

      for (const r of loginRows) {
        if (!firstIpByUser.has(r.userId)) {
          const ip = (r.ip || "").trim();
          if (ip && !isPrivateIp(ip)) firstIpByUser.set(r.userId, ip);
        }
      }
    }

    for (const ip of Array.from(firstIpByUser.values())) {
      // eslint-disable-next-line no-await-in-loop
      const country = await countryForIp(ip);
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
