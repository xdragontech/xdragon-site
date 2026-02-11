import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

type LeadSource = "chat" | "contact";

type LeadEvent = {
  ts: string;
  kind: LeadSource;
  ip?: string;
  ua?: string;
  referer?: string;
  conversationId?: string | null;
  returnId?: string | null;
  lead?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    website?: string | null;
    preferred_contact?: "email" | "phone" | "text" | null;
  } | null;
  name?: string | null; // contact
  email?: string | null; // contact
  [k: string]: any;
};

type LeadRow = {
  ts: string; // most recent activity
  source: LeadSource;
  ip?: string;
  name?: string | null;
  email?: string | null;
  raw: any;
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

function parseTs(ts?: string) {
  const t = Date.parse(ts || "");
  return Number.isFinite(t) ? t : 0;
}

function pickFirstNonEmpty(...vals: Array<string | null | undefined>): string | null {
  for (const v of vals) {
    const s = typeof v === "string" ? v.trim() : "";
    if (s) return s;
  }
  return null;
}

/**
 * Best-effort grouping key so one chat = one lead row.
 * Priority:
 *  1) conversationId (ideal)
 *  2) lead.email (if present)
 *  3) IP + 10-minute bucket (fallback)
 */
function groupKeyForChat(ev: LeadEvent): string {
  const cid = typeof ev.conversationId === "string" ? ev.conversationId.trim() : "";
  if (cid) return `cid:${cid}`;

  const email = typeof ev?.lead?.email === "string" ? ev.lead.email.trim().toLowerCase() : "";
  if (email) return `email:${email}`;

  const ip = (ev.ip || "unknown").trim();
  const bucket = Math.floor(parseTs(ev.ts) / 600_000); // 10 min
  return `ip:${ip}:b:${bucket}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  const role = ((session as any)?.role || (session as any)?.user?.role || null) as string | null;
  if (!session || role !== "ADMIN") {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const kindParam = String(req.query.kind || "all");
  const kinds: LeadSource[] =
    kindParam === "chat" ? ["chat"] : kindParam === "contact" ? ["contact"] : ["chat", "contact"];

  const limit = parseLimit(req.query.limit, 200);

  try {
    // Keep this literal narrow so `kind` stays "chat"|"contact" (LeadKind).
    const baseLists = [
      { kind: "chat", key: "leadlog:chat" },
      { kind: "contact", key: "leadlog:contact" },
    ] as const satisfies ReadonlyArray<{ kind: LeadSource; key: string }>;

    const lists = baseLists.filter((x) => kinds.includes(x.kind));

    const events: LeadEvent[] = [];

    for (const list of lists) {
      const r = await redis<{ result: string[] }>(`/lrange/${encodeURIComponent(list.key)}/0/${limit - 1}`);
      const items = Array.isArray(r?.result) ? r.result : [];
      for (const raw of items) {
        try {
          const obj = JSON.parse(raw);
          events.push({
            kind: list.kind,
            ...(obj || {}),
          });
        } catch {
          // ignore invalid json entries
        }
      }
    }

    const rows: LeadRow[] = [];

    // Contact rows (1 event = 1 lead)
    for (const ev of events.filter((e) => e.kind === "contact")) {
      rows.push({
        ts: ev.ts,
        source: "contact",
        ip: ev.ip,
        name: pickFirstNonEmpty(ev.name ?? null, ev.lead?.name ?? null),
        email: pickFirstNonEmpty(ev.email ?? null, ev.lead?.email ?? null),
        raw: { ...ev, source: "contact" },
      });
    }

    // Chat rows (group multiple events into 1 lead)
    const chatEvents = events.filter((e) => e.kind === "chat");
    const map = new Map<string, LeadEvent[]>();
    for (const ev of chatEvents) {
      const k = groupKeyForChat(ev);
      const arr = map.get(k) || [];
      arr.push(ev);
      map.set(k, arr);
    }

    for (const [groupKey, evs] of map.entries()) {
      evs.sort((a, b) => parseTs(a.ts) - parseTs(b.ts));
      const first = evs[0];
      const last = evs[evs.length - 1];

      let name: string | null = null;
      let email: string | null = null;

      for (const ev of evs) {
        name = pickFirstNonEmpty(ev.lead?.name ?? null, name);
        email = pickFirstNonEmpty(ev.lead?.email ?? null, email);
      }

      rows.push({
        ts: last.ts || first.ts,
        source: "chat",
        ip: last.ip || first.ip,
        name,
        email,
        raw: {
          source: "chat",
          groupKey,
          conversationId: pickFirstNonEmpty(
            ...evs.map((x) => (typeof x.conversationId === "string" ? x.conversationId : null))
          ),
          createdAt: first.ts,
          lastSeenAt: last.ts,
          ip: last.ip || first.ip || null,
          ua: last.ua || first.ua || null,
          referer: last.referer || first.referer || null,
          lead: {
            name,
            email,
            phone: pickFirstNonEmpty(...evs.map((x) => x.lead?.phone ?? null)),
            company: pickFirstNonEmpty(...evs.map((x) => x.lead?.company ?? null)),
            website: pickFirstNonEmpty(...evs.map((x) => x.lead?.website ?? null)),
            preferred_contact: pickFirstNonEmpty(
              ...evs.map((x) => (x.lead?.preferred_contact as any) ?? null)
            ),
          },
          events: evs.map((x) => ({
            ts: x.ts,
            returnId: x.returnId || null,
            lastUserMessage: x.lastUserMessage || null,
            wants_follow_up: Boolean(x.wants_follow_up),
          })),
        },
      });
    }

    rows.sort((a, b) => parseTs(b.ts) - parseTs(a.ts));

    return res.status(200).json({ ok: true, kind: kindParam, limit, items: rows.slice(0, limit) });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "Failed to load leads" });
  }
}
