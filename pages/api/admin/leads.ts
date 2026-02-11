import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

type LeadKind = "chat" | "contact";

type LeadEvent = {
  ts: string;
  kind: LeadKind;
  ip?: string;
  ua?: string;
  referer?: string;
  [k: string]: any;
};

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis<T>(path: string, body?: any): Promise<T> {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    throw new Error("Missing Upstash Redis env vars");
  }

  const hasBody = body !== undefined && body !== null;
  const res = await fetch(`${UPSTASH_REDIS_REST_URL}${path}`, {
    method: hasBody ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
    },
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Upstash error: ${res.status} ${txt}`);
  }
  return (await res.json()) as T;
}

function parseLimit(raw: any, fallback: number) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(1000, Math.floor(n)));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  const role = ((session as any)?.role || (session as any)?.user?.role || null) as string | null;
  if (!session || role !== "ADMIN") {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const kindParam = String(req.query.kind || "all");
  const kinds: LeadKind[] =
    kindParam === "chat" ? ["chat"] : kindParam === "contact" ? ["contact"] : ["chat", "contact"];

  const limit = parseLimit(req.query.limit, 200);

  try {
    // Keep this literal narrow so `kind` stays "chat"|"contact" (LeadKind).
    const baseLists = [
      { kind: "chat", key: "leadlog:chat" },
      { kind: "contact", key: "leadlog:contact" },
    ] as const satisfies ReadonlyArray<{ kind: LeadKind; key: string }>;

    const lists = baseLists.filter((x) => kinds.includes(x.kind));

    const results: LeadEvent[] = [];

    for (const list of lists) {
      const r = await redis<{ result: string[] }>(`/lrange/${encodeURIComponent(list.key)}/0/${limit - 1}`);
      const items = Array.isArray(r?.result) ? r.result : [];
      for (const raw of items) {
        try {
          const obj = JSON.parse(raw);
          results.push({
            kind: list.kind,
            ...(obj || {}),
          });
        } catch {
          // ignore invalid json entries
        }
      }
    }

    results.sort((a, b) => {
      const at = Date.parse(a.ts || "");
      const bt = Date.parse(b.ts || "");
      return (bt || 0) - (at || 0);
    });

    return res.status(200).json({ ok: true, kind: kindParam, limit, items: results.slice(0, limit) });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "Failed to load leads" });
  }
}
