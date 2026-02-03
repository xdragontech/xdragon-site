// pages/api/admin/library/categories/index.ts
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

  try {
    if (req.method === "GET") {
      const categories = await (prisma as any).category.findMany({
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
