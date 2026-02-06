// pages/api/guides/index.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "../auth/[...nextauth]";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

function isUserSession(session: any) {
  const status = session?.status ?? session?.user?.status;
  return Boolean(session?.user && status !== "BLOCKED");
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions as any);
  if (!isUserSession(session)) return res.status(401).json({ ok: false, error: "Unauthorized" });

  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const where =
      q.length > 0
        ? {
            status: "PUBLISHED",
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
              { summary: { contains: q, mode: "insensitive" } },
              { content: { contains: q, mode: "insensitive" } },
              { tags: { has: q } },
            ],
          }
        : { status: "PUBLISHED" };

    const guides = await (prisma as any).guide.findMany({
      where,
      include: { category: true },
      orderBy: [{ updatedAt: "desc" }],
      take: 200,
    });

    return res.status(200).json({ ok: true, guides });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Server error";
    return res.status(500).json({ ok: false, error: msg });
  }
}
