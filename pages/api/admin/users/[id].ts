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
 * Guardrails:
 * - Admins cannot delete or block themselves.
 * - Prevent deleting/blocking/demoting the LAST ACTIVE ADMIN.
 */

type AdminIdentity = { id: string; email: string };

async function requireAdmin(req: NextApiRequest): Promise<AdminIdentity | null> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  const email = typeof token?.email === "string" ? token.email.toLowerCase() : null;
  if (!email) return null;

  // Rely on DB truth for role (don't trust token blindly).
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, role: true, status: true } });
  if (!user || user.role !== "ADMIN" || user.status === "BLOCKED") return null;

  return { id: user.id, email: user.email.toLowerCase() };
}

function getId(req: NextApiRequest): string | null {
  const raw = req.query.id;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return typeof raw === "string" ? raw : null;
}

async function countActiveAdmins(): Promise<number> {
  return prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
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

    // For PATCH/DELETE we need the target user.
    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true, status: true },
    });
    if (!target) return res.status(404).json({ ok: false, error: "Not found" });

    const isSelf = target.id === admin.id || (target.email ?? "").toLowerCase() === admin.email;

    if (req.method === "PATCH") {
      if (isSelf) {
        return res.status(400).json({ ok: false, error: "You can't change your own role/status from the admin panel." });
      }

      const body = (req.body ? req.body : {}) as Record<string, unknown>;
      const nextStatus = typeof body.status === "string" ? body.status : undefined;
      const nextRole = typeof body.role === "string" ? body.role : undefined;

      if (!nextStatus && !nextRole) {
        return res.status(400).json({ ok: false, error: "No changes provided" });
      }

      // Prevent removing the last active admin.
      const wouldDisableAdmin =
        target.role === "ADMIN" &&
        target.status === "ACTIVE" &&
        ((nextRole && nextRole !== "ADMIN") || (nextStatus && nextStatus !== "ACTIVE"));

      if (wouldDisableAdmin) {
        const activeAdmins = await countActiveAdmins();
        if (activeAdmins <= 1) {
          return res.status(400).json({
            ok: false,
            error: "You can't remove or block the last active admin. Add another admin first.",
          });
        }
      }

      const data: Record<string, unknown> = {};
      if (nextStatus) data.status = nextStatus;
      if (nextRole) data.role = nextRole;

      const updated = await prisma.user.update({
        where: { id },
        data,
        select: { id: true, email: true, name: true, status: true, role: true, createdAt: true, lastLoginAt: true, emailVerified: true },
      });

      return res.status(200).json({ ok: true, user: updated });
    }

    if (req.method === "DELETE") {
      if (isSelf) {
        return res.status(400).json({ ok: false, error: "You can't delete your own account from the admin panel." });
      }

      // Prevent deleting the last active admin.
      const wouldRemoveLastAdmin = target.role === "ADMIN" && target.status === "ACTIVE";
      if (wouldRemoveLastAdmin) {
        const activeAdmins = await countActiveAdmins();
        if (activeAdmins <= 1) {
          return res.status(400).json({
            ok: false,
            error: "You can't delete the last active admin. Add another admin first.",
          });
        }
      }

      await prisma.user.delete({ where: { id } });
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET,PATCH,DELETE");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err) {
    console.error("admin users [id] error", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
