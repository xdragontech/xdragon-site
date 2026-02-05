// pages/api/admin/library/articles/[id].ts
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

function parseTags(value: any): string[] | undefined {
  if (Array.isArray(value)) return value.map((t) => String(t).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((t) => t.trim()).filter(Boolean);
  return undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions as any);
  if (!isAdminSession(session)) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) return res.status(400).json({ ok: false, error: "Missing id" });

  try {
    if (req.method === "PUT") {
      const body = req.body || {};
      const data: any = {};

      if (typeof body.title === "string") data.title = body.title.trim();
      if (typeof body.slug === "string") data.slug = normalizeSlug(body.slug);
      if (typeof body.summary === "string") data.summary = body.summary.trim();
      if (typeof body.content === "string") data.content = body.content.trim();
      if (typeof body.status === "string") data.status = body.status;
      if (body.categoryId === null) data.categoryId = null;
      if (typeof body.categoryId === "string") data.categoryId = body.categoryId;

      const tags = parseTags(body.tags);
      if (tags) data.tags = tags;

      if ("title" in data && !data.title) return res.status(400).json({ ok: false, error: "Title is required" });
      if ("slug" in data && !data.slug) return res.status(400).json({ ok: false, error: "Slug is required" });
      if ("summary" in data && !data.summary) return res.status(400).json({ ok: false, error: "Summary is required" });
      if ("content" in data && !data.content) return res.status(400).json({ ok: false, error: "Content is required" });

      const updated = await (prisma as any).article.update({
        where: { id },
        data,
        include: { category: true },
      });

      return res.status(200).json({ ok: true, article: updated });
    }

    if (req.method === "DELETE") {
      await (prisma as any).article.delete({ where: { id } });
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "PUT,DELETE");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Server error";
    return res.status(500).json({ ok: false, error: msg });
  }
}
