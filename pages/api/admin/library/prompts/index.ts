// pages/api/admin/library/prompts/index.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "../../../auth/[...nextauth]";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

function isAdminSession(session: any) {
  const role = session?.role ?? session?.user?.role;
  const status = session?.status ?? session?.user?.status;
  return Boolean(session?.user && role === "ADMIN" && status !== "BLOCKED");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions as any);
  if (!isAdminSession(session)) return res.status(401).json({ ok: false, error: "Unauthorized" });

  try {
    if (req.method === "GET") {
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      const where =
        q.length > 0
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
                { content: { contains: q, mode: "insensitive" } },
                { status: { equals: q as any } },
              ],
            }
          : {};

      const prompts = await (prisma as any).prompt.findMany({
        where,
        include: { category: true },
        orderBy: [{ updatedAt: "desc" }],
        take: 500,
      });

      return res.status(200).json({ ok: true, prompts });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const content = typeof body.content === "string" ? body.content.trim() : "";
      const description = typeof body.description === "string" ? body.description.trim() : null;
      const status = typeof body.status === "string" ? body.status : "DRAFT";
      const categoryId = typeof body.categoryId === "string" ? body.categoryId : null;

      if (!title) return res.status(400).json({ ok: false, error: "Title is required" });
      if (!content) return res.status(400).json({ ok: false, error: "Content is required" });

      const created = await (prisma as any).prompt.create({
        data: {
          title,
          content,
          description,
          status,
          categoryId,
        },
        include: { category: true },
      });

      return res.status(200).json({ ok: true, prompt: created });
    }

    res.setHeader("Allow", "GET,POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Server error";
    return res.status(500).json({ ok: false, error: msg });
  }
}
