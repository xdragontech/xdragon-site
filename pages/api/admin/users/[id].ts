// pages/api/admin/users/[id].ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { authOptions } from "../../auth/[...nextauth]";
import { prisma } from "../../../../lib/prisma";

/**
 * Admin user management (Pages Router):
 * - PATCH /api/admin/users/[id]  { status: "ACTIVE" | "BLOCKED" }
 * - DELETE /api/admin/users/[id]
 *
 * Guards:
 * - Requires an authenticated ADMIN user (and not BLOCKED)
 * - Prevents an admin from blocking/deleting themselves (avoids lockout)
 */

type ApiOk = { ok: true; user?: any };
type ApiErr = { ok: false; error: string };

function getId(req: NextApiRequest): string | null {
  const { id } = req.query;
  if (typeof id === "string" && id.trim()) return id;
  return null;
}

async function requireAdmin(req: NextApiRequest, res: NextApiResponse): Promise<{ id: string; emailLower: string } | null> {
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email ?? null;

  if (!email) return null;

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, email: true, role: true, status: true },
  });

  // If email is missing in DB (shouldn't happen), fail closed.
  if (!user?.email) return null;
  if (user.role !== "ADMIN") return null;
  if (user.status === "BLOCKED") return null;

  return { id: user.id, emailLower: user.email.toLowerCase() };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiOk | ApiErr>) {
  const admin = await requireAdmin(req, res);
  if (!admin) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const id = getId(req);
  if (!id) return res.status(400).json({ ok: false, error: "Missing user id" });

  try {
    if (req.method === "PATCH") {
      const statusRaw = (req.body?.status ?? "").toString().toUpperCase();
      if (statusRaw !== "ACTIVE" && statusRaw !== "BLOCKED") {
        return res.status(400).json({ ok: false, error: "Invalid status. Use ACTIVE or BLOCKED." });
      }

      if (id === admin.id && statusRaw === "BLOCKED") {
        return res.status(400).json({ ok: false, error: "You cannot block your own admin account." });
      }

      const updated = await prisma.user.update({
        where: { id },
        data: { status: statusRaw as any },
        select: { id: true, email: true, name: true, status: true, role: true, createdAt: true, lastLoginAt: true },
      });

      return res.status(200).json({ ok: true, user: updated });
    }

    if (req.method === "DELETE") {
      if (id === admin.id) {
        return res.status(400).json({ ok: false, error: "You cannot delete your own admin account." });
      }

      await prisma.user.delete({ where: { id } });
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "PATCH, DELETE");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err: any) {
    console.error("Admin user [id] API error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
