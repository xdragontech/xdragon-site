// pages/api/admin/metrics.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "../../../lib/prisma";

type Period = "today" | "7d" | "month";

type MetricsOk = {
  ok: true;
  period: Period;
  labels: string[];
  signups: number[];
  logins: number[];
};

type MetricsErr = { ok: false; error: string };

type MetricsResponse = MetricsOk | MetricsErr;

function safePeriod(p: unknown): Period {
  const v = Array.isArray(p) ? p[0] : p;
  if (v === "today" || v === "7d" || v === "month") return v;
  return "7d";
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function startOfMonth(d: Date) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endExclusive(d: Date) {
  // For date-range queries: [start, end)
  const x = new Date(d);
  x.setMilliseconds(x.getMilliseconds() + 1);
  return x;
}

function labelForDate(d: Date) {
  return d.toISOString().slice(5, 10); // MM-DD (simple + stable)
}

async function requireAdmin(req: NextApiRequest, res: NextApiResponse): Promise<{ userId: string } | null> {
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email) return null;

  const u = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, status: true },
  });

  if (!u) return null;
  if (u.status === "BLOCKED") return null;
  if (u.role !== "ADMIN") return null;

  return { userId: u.id };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<MetricsResponse>) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const admin = await requireAdmin(req, res);
    if (!admin) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const period = safePeriod(req.query.period);
    const now = new Date();

    let start: Date;
    let buckets: number;
    let bucketKind: "hour" | "day";

    if (period === "today") {
      start = startOfDay(now);
      buckets = 24;
      bucketKind = "hour";
    } else if (period === "month") {
      start = startOfMonth(now);
      const tomorrow = startOfDay(addDays(now, 1));
      // day of month up to today
      buckets = Math.max(1, Math.round((tomorrow.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
      bucketKind = "day";
    } else {
      // last 7 days incl today
      start = startOfDay(addDays(now, -6));
      buckets = 7;
      bucketKind = "day";
    }

    const labels: string[] = [];
    const signups: number[] = [];
    const logins: number[] = [];

    if (bucketKind === "hour") {
      // Today: 24 hourly buckets in local server time
      const base = start;
      for (let h = 0; h < 24; h++) {
        const bStart = new Date(base);
        bStart.setHours(h, 0, 0, 0);
        const bEnd = new Date(base);
        bEnd.setHours(h + 1, 0, 0, 0);

        labels.push(`${String(h).padStart(2, "0")}:00`);

        const [sCount, lCount] = await Promise.all([
          prisma.user.count({
            where: { createdAt: { gte: bStart, lt: bEnd } },
          }),
          prisma.loginEvent.count({
            where: { createdAt: { gte: bStart, lt: bEnd } },
          }),
        ]);

        signups.push(sCount);
        logins.push(lCount);
      }
    } else {
      // Day buckets: [start, start+1d), ...
      for (let i = 0; i < buckets; i++) {
        const bStart = startOfDay(addDays(start, i));
        const bEnd = startOfDay(addDays(start, i + 1));

        labels.push(labelForDate(bStart));

        const [sCount, lCount] = await Promise.all([
          prisma.user.count({
            where: { createdAt: { gte: bStart, lt: bEnd } },
          }),
          prisma.loginEvent.count({
            where: { createdAt: { gte: bStart, lt: bEnd } },
          }),
        ]);

        signups.push(sCount);
        logins.push(lCount);
      }
    }

    return res.status(200).json({ ok: true, period, labels, signups, logins });
  } catch (err: any) {
    console.error("admin metrics error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
