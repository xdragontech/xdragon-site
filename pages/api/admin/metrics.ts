// pages/api/admin/metrics.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "../../../lib/prisma";

type Period = "today" | "7d" | "month";

type MetricsResponse =
  | {
      ok: true;
      period: Period;
      labels: string[];
      signups: number[];
      logins: number[];
      totals: { signups: number; logins: number };
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

export default async function handler(req: NextApiRequest, res: NextApiResponse<MetricsResponse>) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const user = session?.user as any;
  if (!user || user.role !== "ADMIN" || user.status === "BLOCKED") {
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
      // e.g., Feb 2
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
      select: { createdAt: true },
    }),
  ]);

  const signups = Array.from({ length: bucketCount }, () => 0);
  const logins = Array.from({ length: bucketCount }, () => 0);

  for (const e of signupEvents) {
    const idx = bucketIndex(e.createdAt);
    if (idx >= 0 && idx < bucketCount) signups[idx] += 1;
  }

  for (const e of loginEvents) {
    const idx = bucketIndex(e.createdAt);
    if (idx >= 0 && idx < bucketCount) logins[idx] += 1;
  }

  const totals = {
    signups: signups.reduce((a, b) => a + b, 0),
    logins: logins.reduce((a, b) => a + b, 0),
  };

  return res.status(200).json({ ok: true, period, labels, signups, logins, totals });
}
