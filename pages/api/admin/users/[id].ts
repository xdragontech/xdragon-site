// pages/api/admin/users/[id].ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../lib/prisma";
import { requireAdminApi } from "../../../../lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, error: "Unauthorized" });

  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const id = String(req.query.id || "");
  const { status } = req.body || {};

  if (!id) return res.status(400).json({ ok: false, error: "Missing id" });
  if (status !== "ACTIVE" && status !== "BLOCKED") {
    return res.status(400).json({ ok: false, error: "Invalid status" });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { status },
    select: { id: true, email: true, status: true },
  });

  return res.status(200).json({ ok: true, user: updated });
}
