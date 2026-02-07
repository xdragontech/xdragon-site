// pages/api/admin/library/guide-categories/[id].ts
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

function slugify(input: string) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions as any);
  if (!isAdminSession(session)) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) return res.status(400).json({ ok: false, error: "Missing id" });

  // Backing model for Guide Categories is currently ArticleCategory. Fall back to GuideCategory if you rename later.
  const model: any = (prisma as any).articleCategory ?? (prisma as any).guideCategory;
  if (!model?.update) return res.status(500).json({ ok: false, error: "Guide category model not found" });

  try {
    if (req.method === "PUT") {
      const body = req.body || {};
      const data: any = {};

      if (typeof body.name === "string") {
        const name = body.name.trim();
        if (!name) return res.status(400).json({ ok: false, error: "Name is required" });
        data.name = name;
        // if slug not provided, keep existing slug; if provided, normalize
        if (typeof body.slug === "string") data.slug = slugify(body.slug);
      }

      if (typeof body.slug === "string") {
        const slug = slugify(body.slug);
        if (!slug) return res.status(400).json({ ok: false, error: "Slug is required" });
        // Ensure uniqueness
        const exists = await model.findUnique({ where: { slug } });
        if (exists && exists.id !== id) return res.status(400).json({ ok: false, error: "Slug already exists" });
        data.slug = slug;
      }

      if (typeof body.sortOrder === "number") data.sortOrder = body.sortOrder;

      const updated = await model.update({ where: { id }, data });
      return res.status(200).json({ ok: true, category: updated });
    }

    if (req.method === "DELETE") {
      await model.delete({ where: { id } });
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "PUT,DELETE");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Server error";
    return res.status(500).json({ ok: false, error: msg });
  }
}
