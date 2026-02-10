import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "../../../auth/[...nextauth]";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

function toCsv(rows: any[]) {
  const esc = (v: any) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const header = ["id", "title", "description", "content", "status", "categoryId", "tags", "sortOrder", "createdAt", "updatedAt"];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        esc(r.id),
        esc(r.title),
        esc(r.description),
        esc(r.content),
        esc(r.status),
        esc(r.categoryId),
        esc((r.tags || []).join(",")),
        esc(r.sortOrder),
        esc(r.createdAt),
        esc(r.updatedAt),
      ].join(",")
    ),
  ];
  return lines.join("\n");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const format = String(req.query.format || "csv").toLowerCase();

  const prompts = await prisma.prompt.findMany({
    orderBy: [{ sortOrder: "desc" }, { updatedAt: "desc" }],
  });

  if (format === "json") {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="prompts.json"');
    return res.status(200).send(JSON.stringify(prompts, null, 2));
  }

  const csv = toCsv(prompts);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="prompts.csv"');
  return res.status(200).send(csv);
}
