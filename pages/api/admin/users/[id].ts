// pages/api/admin/users/[id].ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getToken } from "next-auth/jwt";
import { prisma } from "../../../../lib/prisma";

/**
 * Admin Users API (Pages Router)
 * - GET    /api/admin/users/:id     -> fetch one user
 * - PATCH  /api/admin/users/:id     -> update role/status (optional)
 * - DELETE /api/admin/users/:id     -> delete user (and related records)
 *
 * Protects all routes to ADMIN users only.
 */

async function requireAdmin(req: NextApiRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  const email = typeof token?.email === "string" ? token.email.toLowerCase() : null;
  if (!email) return null;

  // Rely on DB truth for role (don't trust token blindly).
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role !== "ADMIN" || user.status === "BLOCKED") return null;

  return { email };
}

function getId(req: NextApiRequest): string | null {
  const raw = req.query.id;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return typeof raw === "string" ? raw : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req);
  if (!admin) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const id = getId(req);
  if (!id) return res.status(400).json({ ok: false, error: "Missing user id" });

  try {
    if (req.method === "GET") {
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          role: true,
          createdAt: true,
          lastLoginAt: true,
          emailVerified: true,
        },
      });

      if (!user) return res.status(404).json({ ok: false, error: "Not found" });
      return res.status(200).json({ ok: true, user });
    }

    if (req.method === "PATCH") {
      const body = (req.body ?? {}) as Partial<{ status: "ACTIVE" | "BLOCKED"; role: "USER" | "ADMIN" }>;

      const data: Record<string, any> = {};
      if (body.status === "ACTIVE" || body.status === "BLOCKED") data.status = body.status;
      if (body.role === "USER" || body.role === "ADMIN") data.role = body.role;

      if (!Object.keys(data).length) {
        return res.status(400).json({ ok: false, error: "No valid fields to update" });
      }

      const updated = await prisma.user.update({
        where: { id },
        data,
        select: { id: true, email: true, status: true, role: true },
      });

      return res.status(200).json({ ok: true, user: updated });
    }

    if (req.method === "DELETE") {
      // Safety: don't allow deleting yourself accidentally
      const meEmail = admin.email;
      const target = await prisma.user.findUnique({ where: { id }, select: { email: true } });
      if (!target) return res.status(404).json({ ok: false, error: "Not found" });
      if (target.email && target.email.toLowerCase() === meEmail) {
        return res.status(400).json({ ok: false, error: "You can't delete your own admin account." });
      }

      // Clean delete: remove dependent records (safe even if none). Your schema also has onDelete: Cascade.
      await prisma.$transaction([
        prisma.account.deleteMany({ where: { userId: id } }),
        prisma.session.deleteMany({ where: { userId: id } }),
        prisma.user.delete({ where: { id } }),
      ]);

      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", ["GET", "PATCH", "DELETE"]);
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err: any) {
    console.error("Admin users/[id] error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
