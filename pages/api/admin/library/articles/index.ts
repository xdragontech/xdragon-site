// pages/api/admin/library/articles/index.ts
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


function normalizeSlug(input: string) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function parseTags(value: any): string[] {
  if (Array.isArray(value)) return value.map((t) => String(t).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((t) => t.trim()).filter(Boolean);
  return [];
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
                { slug: { contains: q, mode: "insensitive" } },
                { summary: { contains: q, mode: "insensitive" } },
                { content: { contains: q, mode: "insensitive" } },
                { status: { equals: q as any } },
              ],
            }
          : {};

      const articles = await (prisma as any).article.findMany({
        where,
        include: { category: true },
        orderBy: [{ updatedAt: "desc" }],
        take: 500,
      });

      return res.status(200).json({ ok: true, articles });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const summary = typeof body.summary === "string" ? body.summary.trim() : "";
      const content = typeof body.content === "string" ? body.content.trim() : "";
      const status = typeof body.status === "string" ? body.status : "DRAFT";
      const categoryId = typeof body.categoryId === "string" ? body.categoryId : null;
      const slug = normalizeSlug(typeof body.slug === "string" ? body.slug : title);
      const tags = parseTags(body.tags);

      if (!title) return res.status(400).json({ ok: false, error: "Title is required" });
      if (!slug) return res.status(400).json({ ok: false, error: "Slug is required" });
      if (!summary) return res.status(400).json({ ok: false, error: "Summary is required" });
      if (!content) return res.status(400).json({ ok: false, error: "Content is required" });

      const created = await (prisma as any).article.create({
        data: {
          title,
          slug,
          summary,
          content,
          status,
          categoryId,
          tags,
        },
        include: { category: true },
      });

      return res.status(200).json({ ok: true, article: created });
    }

    res.setHeader("Allow", "GET,POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Server error";
    return res.status(500).json({ ok: false, error: msg });
  }
}
