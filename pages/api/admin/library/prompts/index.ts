// pages/api/admin/library/prompts/index.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";
import {
  assertBackofficeBrandAccess,
  requireBackofficeApi,
  resolveBackofficeReadFilter,
  resolveBackofficeWriteBrandId,
} from "../../../../../lib/backofficeAuth";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireBackofficeApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, error: "Unauthorized" });

  try {
    if (req.method === "GET") {
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      const brandWhere = await resolveBackofficeReadFilter(auth.principal, req.query as any);
      const where =
        q.length > 0
          ? {
              AND: [
                brandWhere,
                {
                  OR: [
                    { title: { contains: q, mode: "insensitive" } },
                    { description: { contains: q, mode: "insensitive" } },
                    { content: { contains: q, mode: "insensitive" } },
                    { status: { equals: q as any } },
                  ],
                },
              ],
            }
          : brandWhere;

      const prompts = await (prisma as any).prompt.findMany({
        where,
        include: { category: true },
        orderBy: [{ sortOrder: "desc" }, { updatedAt: "desc" }],
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

      const brandId = await resolveBackofficeWriteBrandId(auth.principal, body, { allowSingleBrandFallback: true });
      if (categoryId) {
        const category = await (prisma as any).category.findUnique({
          where: { id: categoryId },
          select: { id: true, brandId: true },
        });
        if (!category) return res.status(400).json({ ok: false, error: "Category not found" });
        assertBackofficeBrandAccess(auth.principal, category.brandId);
        if (category.brandId !== brandId) {
          return res.status(400).json({ ok: false, error: "Category brand does not match the selected brand" });
        }
      }

      const created = await (prisma as any).prompt.create({
        data: {
          brandId,
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
