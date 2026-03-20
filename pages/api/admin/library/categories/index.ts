// pages/api/admin/library/categories/index.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";
import {
  requireBackofficeApi,
  resolveBackofficeReadFilter,
  resolveBackofficeWriteBrandId,
} from "../../../../../lib/backofficeAuth";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

function slugify(input: string) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireBackofficeApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, error: "Unauthorized" });

  try {
    if (req.method === "GET") {
      const where = await resolveBackofficeReadFilter(auth.principal, req.query as any);
      const categories = await (prisma as any).category.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        take: 500,
      });
      return res.status(200).json({ ok: true, categories });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) return res.status(400).json({ ok: false, error: "Name is required" });

      // Generate a unique-ish slug; if collision, suffix with -2, -3...
      const base = slugify(name) || "category";
      let slug = base;
      for (let i = 2; i < 100; i++) {
        const exists = await (prisma as any).category.findUnique({ where: { slug } });
        if (!exists) break;
        slug = `${base}-${i}`;
      }

      const created = await (prisma as any).category.create({
        data: {
          brandId: await resolveBackofficeWriteBrandId(auth.principal, body, { allowSingleBrandFallback: true }),
          name,
          slug,
          sortOrder: 0,
        },
      });

      return res.status(200).json({ ok: true, category: created });
    }

    res.setHeader("Allow", "GET,POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Server error";
    return res.status(500).json({ ok: false, error: msg });
  }
}
