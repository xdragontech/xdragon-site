import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "../../../lib/prisma";

/**
 * DB-backed Leads API (source of truth).
 *
 * Returns rows shaped for the admin Leads table:
 * - Name, Email, Source, IP, Date/Time, Copy JSON
 */

type LeadSource = "chat" | "contact";

type LeadRow = {
  ts: string;
  source: LeadSource;
  ip?: string;
  name?: string | null;
  email?: string | null;
  raw: any;
};

function parseLimit(raw: any, fallback: number) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(1000, Math.floor(n)));
}

function getSessionRole(session: any): string | null {
  return (session?.role as string) || (session?.user?.role as string) || null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions as any);
  const role = getSessionRole(session);
  if (!session || role !== "ADMIN") {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const kindParam = String(req.query.kind || "all");
  const limit = parseLimit(req.query.limit, 200);

  const sourceFilter: any =
    kindParam === "chat" ? "CHAT" : kindParam === "contact" ? "CONTACT" : null;

  try {
    // LeadEvent is the source of truth.
    const events = await prisma.leadEvent.findMany({
      where: sourceFilter ? { source: sourceFilter } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { lead: true },
    });

    const rows: LeadRow[] = (Array.isArray(events) ? events : []).map((ev: any) => {
      const sourceLower = String(ev.source || "").toLowerCase();
      const source: LeadSource = sourceLower === "chat" ? "chat" : "contact";

      const createdAtIso = ev.createdAt ? new Date(ev.createdAt).toISOString() : new Date().toISOString();

      // Prefer linked Lead summary when present (CONTACT), else fall back to raw.lead (CHAT)
      const raw = ev.raw ?? {};
      const rawLead = (raw as any)?.lead ?? raw;

      const name = ev.lead?.name ?? rawLead?.name ?? null;
      const email = ev.lead?.email ?? rawLead?.email ?? null;

      return {
        ts: createdAtIso,
        source,
        ip: ev.ip || undefined,
        name,
        email,
        raw: ev.raw ?? {
          id: ev.id,
          source: ev.source,
          leadId: ev.leadId ?? null,
          conversationId: ev.conversationId ?? null,
          name,
          email,
          ip: ev.ip ?? null,
          createdAt: ev.createdAt,
        },
      };
    });

    return res.status(200).json({ ok: true, kind: kindParam, limit, items: rows });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "Failed to load leads" });
  }
}
