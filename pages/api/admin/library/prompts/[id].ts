// pages/api/admin/library/prompts/[id].ts
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

  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) return res.status(400).json({ ok: false, error: "Missing id" });

  try {
    if (req.method === "PUT") {
      const body = req.body || {};
      const data: any = {};

      if (typeof body.title === "string") data.title = body.title.trim();
      if (typeof body.content === "string") data.content = body.content.trim();
      if (typeof body.description === "string") data.description = body.description.trim();
      if (body.description === null) data.description = null;
      if (typeof body.status === "string") data.status = body.status;

      if ("title" in data && !data.title) return res.status(400).json({ ok: false, error: "Title is required" });
      if ("content" in data && !data.content) return res.status(400).json({ ok: false, error: "Content is required" });

      const updated = await (prisma as any).prompt.update({
        where: { id },
        data,
      });

      return res.status(200).json({ ok: true, prompt: updated });
    }

    if (req.method === "DELETE") {
      await (prisma as any).prompt.delete({ where: { id } });
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "PUT,DELETE");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Server error";
    return res.status(500).json({ ok: false, error: msg });
  }
}
