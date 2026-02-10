// pages/api/admin/leads.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

type LeadKind = "chat" | "contact";

type LeadEvent = {
  kind: LeadKind;
  ts: string;
  ip?: string | null;
  ua?: string | null;
  referer?: string | null;
  payload: any;
};

type LeadsOk = { ok: true; items: LeadEvent[] };
type LeadsErr = { ok: false; error: string };

type LeadsResponse = LeadsOk | LeadsErr;

function getSessionRole(session: any): string | null {
  return (session?.role as string) || (session?.user?.role as string) || null;
}

function getRedisEnv() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

async function redisJson<T>(path: string, body: any): Promise<T> {
  const env = getRedisEnv();
  if (!env) throw new Error("Missing UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN.");
  const res = await fetch(`${env.url}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Upstash error (${res.status}): ${txt}`);
  }
  return (await res.json()) as T;
}

function safeParseJsonLine(line: string): any | null {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<LeadsResponse>) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const role = getSessionRole(session);
  if (role !== "admin") return res.status(403).json({ ok: false, error: "Forbidden" });

  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const kindParam = (req.query.kind as string | undefined) || "all";
  const limitParam = (req.query.limit as string | undefined) || "200";

  const limit = Math.max(1, Math.min(1000, Number(limitParam) || 200));
  const kinds: LeadKind[] =
    kindParam === "chat" ? ["chat"] : kindParam === "contact" ? ["contact"] : ["chat", "contact"];

  // Read the most recent N items from each list and merge-sort by ts.
  const lists: { kind: LeadKind; key: string }[] = [
    { kind: "chat", key: "leadlog:chat" },
    { kind: "contact", key: "leadlog:contact" },
  ].filter((x) => kinds.includes(x.kind));

  try {
    const perList = Math.max(50, Math.ceil(limit / Math.max(1, lists.length)));

    const results = await Promise.all(
      lists.map(async (l) => {
        // LRANGE -perList -1 returns the newest perList items.
        const r = await redisJson<{ result: string[] }>("/lrange", [l.key, -perList, -1]);
        const parsed = (r.result || [])
          .map((s) => safeParseJsonLine(s))
          .filter(Boolean)
          .map((payload) => ({
            kind: l.kind,
            ts: (payload.ts as string) || new Date().toISOString(),
            ip: payload.ip ?? null,
            ua: payload.ua ?? null,
            referer: payload.referer ?? null,
            payload,
          })) as LeadEvent[];
        return parsed;
      })
    );

    const merged = results.flat().sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0)).slice(0, limit);

    res.status(200).json({ ok: true, items: merged });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "Failed to load leads" });
  }
}
