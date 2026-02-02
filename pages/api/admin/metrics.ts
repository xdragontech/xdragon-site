// pages/api/admin/metrics.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "../../../lib/prisma";

type Period = "today" | "7d" | "month";

type IpGroup = {
  ip: string;
  country: string | null;
  count: number;
};

type MetricsResponse =
  | {
      ok: true;
      period: Period;
      labels: string[];
      signups: number[];
      logins: number[];
      totals: { signups: number; logins: number };
      ipGroups: IpGroup[];
    }
  | { ok: false; error: string };

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d: Date) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function safePeriod(value: unknown): Period {
  if (value === "today" || value === "7d" || value === "month") return value;
  return "7d";
}

function normalizeIp(raw: string | null | undefined): string {
  if (!raw) return "";
  // Strip IPv6 prefix for IPv4-mapped addresses (e.g. ::ffff:1.2.3.4)
  const cleaned = raw.trim();
  if (cleaned.startsWith("::ffff:")) return cleaned.slice("::ffff:".length);
  return cleaned;
}

function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  if (ip === "127.0.0.1" || ip === "::1") return true;
  // RFC1918 + link-local
  return (
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
    ip.startsWith("169.254.")
  );
}

function getGeoCache(): Map<string, string | null> {
  const g = global as any;
  if (!g.__xdragonGeoCache) g.__xdragonGeoCache = new Map<string, string | null>();
  return g.__xdragonGeoCache;
}

async function countryForIp(ipRaw: string): Promise<string | null> {
  const ip = normalizeIp(ipRaw);
  if (!ip) return null;
  if (isPrivateIp(ip)) return "Private";

  const cache = getGeoCache();
  if (cache.has(ip)) return cache.get(ip) ?? null;

  // Best-effort: use a free endpoint. Do not fail the API if lookup fails.
  try {
    const resp = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/country_name/`, {
      headers: { "User-Agent": "xdragon-tech-admin-metrics" },
    });

    if (!resp.ok) {
      cache.set(ip, null);
      return null;
    }

    const text = (await resp.text()).trim();
    const val = text && text.length <= 80 ? text : null;
    cache.set(ip, val);
    return val;
  } catch {
    cache.set(ip, null);
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<MetricsResponse>) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const me = session?.user as any;
  if (!me || me.role !== "ADMIN" || me.status === "BLOCKED") {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const period = safePeriod(req.query.period);
  const now = new Date();

  let start: Date;
  let end: Date;
  let labels: string[] = [];
  let bucketIndex: (d: Date) => number;
  let bucketCount = 0;

  if (period === "today") {
    start = startOfDay(now);
    end = addDays(start, 1);
    bucketCount = 24;
    labels = Array.from({ length: 24 }, (_, i) => `${i}`);
    bucketIndex = (d) => d.getHours();
  } else if (period === "month") {
    start = startOfMonth(now);
    end = addDays(startOfDay(now), 1); // include today
    bucketCount = now.getDate();
    labels = Array.from({ length: bucketCount }, (_, i) => `${i + 1}`);
    bucketIndex = (d) => d.getDate() - 1;
  } else {
    // 7d (includes today)
    start = startOfDay(addDays(now, -6));
    end = addDays(startOfDay(now), 1);
    bucketCount = 7;
    labels = Array.from({ length: 7 }, (_, i) => {
      const day = addDays(start, i);
      return day.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    });
    bucketIndex = (d) => Math.floor((startOfDay(d).getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  }

  const [signupEvents, loginEvents] = await Promise.all([
    prisma.user.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { createdAt: true },
    }),
    prisma.loginEvent.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { createdAt: true, ip: true },
    }),
  ]);

  const signups = Array.from({ length: bucketCount }, () => 0);
  const logins = Array.from({ length: bucketCount }, () => 0);

  for (const e of signupEvents) {
    const idx = bucketIndex(e.createdAt);
    if (idx >= 0 && idx < bucketCount) signups[idx] += 1;
  }

  // group ip counts + bucketed logins
  const ipCount = new Map<string, number>();
  for (const e of loginEvents) {
    const idx = bucketIndex(e.createdAt);
    if (idx >= 0 && idx < bucketCount) logins[idx] += 1;

    const ip = normalizeIp(e.ip);
    if (!ip) continue;
    ipCount.set(ip, (ipCount.get(ip) || 0) + 1);
  }

  const totals = {
    signups: signups.reduce((a, b) => a + b, 0),
    logins: logins.reduce((a, b) => a + b, 0),
  };

  const ipEntries = Array.from(ipCount.entries())
    .map(([ip, count]) => ({ ip, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50); // keep response small

  const ipGroups: IpGroup[] = await Promise.all(
    ipEntries.map(async ({ ip, count }) => {
      const country = await countryForIp(ip);
      return { ip, country, count };
    })
  );

  return res.status(200).json({ ok: true, period, labels, signups, logins, totals, ipGroups });
}
