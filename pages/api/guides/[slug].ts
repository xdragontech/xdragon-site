// pages/api/guides/[slug].ts
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

  const slug = typeof req.query.slug === "string" ? req.query.slug : "";
  if (!slug) return res.status(400).json({ ok: false, error: "Missing slug" });

  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const guide = await (prisma as any).guide.findUnique({
      where: { slug },
      include: { category: true },
    });

    if (!guide || guide.status !== "PUBLISHED") return res.status(404).json({ ok: false, error: "Not found" });

    return res.status(200).json({ ok: true, item: guide });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Server error";
    return res.status(500).json({ ok: false, error: msg });
  }
}
