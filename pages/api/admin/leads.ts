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
    const leads = await prisma.lead.findMany({
      where: sourceFilter ? { source: sourceFilter } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const rows: LeadRow[] = (Array.isArray(leads) ? leads : []).map((l: any) => {
      const sourceLower = String(l.source || "").toLowerCase();
      const source: LeadSource = sourceLower === "chat" ? "chat" : "contact";

      const createdAtIso = l.createdAt ? new Date(l.createdAt).toISOString() : new Date().toISOString();

      return {
        ts: createdAtIso,
        source,
        ip: l.ip || undefined,
        name: l.name ?? null,
        email: l.email ?? null,
        raw:
          l.payload ??
          l.raw ??
          {
            id: l.id,
            source: l.source,
            name: l.name ?? null,
            email: l.email ?? null,
            ip: l.ip ?? null,
            createdAt: l.createdAt,
          },
      };
    });

    return res.status(200).json({ ok: true, kind: kindParam, limit, items: rows });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "Failed to load leads" });
  }
}
