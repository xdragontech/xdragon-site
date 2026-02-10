import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "../../../auth/[...nextauth]";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

type PromptStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ ok: false, error: "Unauthorized" });

  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const { action } = (req.body ?? {}) as any;

  try {
    if (action === "status") {
      const { ids, status } = (req.body ?? {}) as { ids: string[]; status: PromptStatus };
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ ok: false, error: "No ids" });
      if (!status) return res.status(400).json({ ok: false, error: "No status" });

      await prisma.prompt.updateMany({
        where: { id: { in: ids } },
        data: { status },
      });

      return res.status(200).json({ ok: true });
    }

    if (action === "reorder") {
      const { items } = (req.body ?? {}) as { items: Array<{ id: string; sortOrder: number }> };
      if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ ok: false, error: "No items" });

      await prisma.$transaction(
        items.map((it) =>
          prisma.prompt.update({
            where: { id: String(it.id) },
            data: { sortOrder: Number.isFinite(Number(it.sortOrder)) ? Number(it.sortOrder) : 0 },
          })
        )
      );

      return res.status(200).json({ ok: true });
    }

    if (action === "import") {
      const { rows, defaultStatus } = (req.body ?? {}) as { rows: any[]; defaultStatus?: PromptStatus };
      if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ ok: false, error: "No rows" });

      const status = (defaultStatus || "DRAFT") as PromptStatus;

      const created = await prisma.$transaction(
        rows.map((r) =>
          prisma.prompt.create({
            data: {
              title: String(r.title || r.name || "").trim(),
              description: r.description ? String(r.description) : null,
              content: String(r.content || r.prompt || "").trim(),
              status: (r.status || status) as PromptStatus,
              categoryId: r.categoryId || null,
              tags: Array.isArray(r.tags)
                ? r.tags
                : typeof r.tags === "string"
                  ? r.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
                  : [],
              sortOrder: Number.isFinite(Number(r.sortOrder)) ? Number(r.sortOrder) : 0,
            },
          })
        )
      );

      return res.status(200).json({ ok: true, count: created.length });
    }

    return res.status(400).json({ ok: false, error: "Unknown action" });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
