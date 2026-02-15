import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "../../../lib/prisma";

type Ok = {
  ok: true;
  totals: { total: number; contact: number; chat: number };
  last7d: { contact: number; chat: number };
  updatedAt: string;
};

type Err = { ok: false; error: string };

type Resp = Ok | Err;

function getSessionRole(session: any): string | null {
  return (session?.role as string) || (session?.user?.role as string) || null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions as any);
  const role = getSessionRole(session);
  if (!session || role !== "ADMIN") return res.status(401).json({ ok: false, error: "Unauthorized" });

  const since = new Date();
  since.setDate(since.getDate() - 7);

  try {
    const [total, contact, chat, last7Contact, last7Chat] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { source: "CONTACT" } }),
      prisma.lead.count({ where: { source: "CHAT" } }),
      prisma.lead.count({ where: { source: "CONTACT", createdAt: { gte: since } } }),
      prisma.lead.count({ where: { source: "CHAT", createdAt: { gte: since } } }),
    ]);

    return res.status(200).json({
      ok: true,
      totals: { total, contact, chat },
      last7d: { contact: last7Contact, chat: last7Chat },
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("/api/admin/analytics failed", e);
    return res.status(500).json({ ok: false, error: "Failed to load analytics" });
  }
}
