// pages/api/admin/users/[id].ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import { prisma } from "../../../../lib/prisma";

/**
 * Admin user management for a single user
 * - GET: return user details
 * - PATCH/POST: update user status (BLOCKED/ACTIVE)
 * - DELETE: delete user
 *
 * Safety:
 * - Prevent an admin from blocking/deleting themselves.
 * - Prevent blocking/deleting emails listed in ADMIN_EMAILS (protect "core admins").
 */

function parseAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function json(res: NextApiResponse, status: number, payload: any) {
  return res.status(status).json(payload);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  const role = (session as any)?.role || (session as any)?.user?.role;
  const meId = (session as any)?.user?.id;
  const meEmail = ((session as any)?.user?.email || "").toLowerCase();

  if (!session || role !== "ADMIN") {
    return json(res, 401, { ok: false, error: "Unauthorized" });
  }

  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id) return json(res, 400, { ok: false, error: "Missing id" });

  // Helper: fetch target user (needed for protections)
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, status: true, name: true, createdAt: true, lastLoginAt: true },
  });

  if (!target) return json(res, 404, { ok: false, error: "User not found" });

  const targetEmail = (target.email || "").toLowerCase();
  const protectedAdmins = parseAdminEmails();

  const isSelf = meId && target.id === meId;
  const isProtectedAdmin = targetEmail && protectedAdmins.includes(targetEmail);

  // --- GET ---
  if (req.method === "GET") {
    return json(res, 200, { ok: true, user: target });
  }

  // --- DELETE ---
  if (req.method === "DELETE") {
    if (isSelf) return json(res, 403, { ok: false, error: "You can't delete your own account." });
    if (isProtectedAdmin) return json(res, 403, { ok: false, error: "This admin account is protected." });

    await prisma.user.delete({ where: { id } });
    return json(res, 200, { ok: true });
  }

  // --- PATCH / POST (status updates) ---
  if (req.method === "PATCH" || req.method === "POST") {
    if (isSelf) {
      return json(res, 403, { ok: false, error: "You can't change your own status (lockout protection)." });
    }
    if (isProtectedAdmin) {
      return json(res, 403, { ok: false, error: "This admin account is protected." });
    }

    // Accept either { status } or { action }
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const action = (body.action as string | undefined)?.toLowerCase();
    let nextStatus: "ACTIVE" | "BLOCKED" | null = null;

    if (body.status === "ACTIVE" || body.status === "BLOCKED") nextStatus = body.status;
    else if (action === "block") nextStatus = "BLOCKED";
    else if (action === "unblock") nextStatus = "ACTIVE";

    if (!nextStatus) {
      return json(res, 400, { ok: false, error: "Provide {status:'ACTIVE'|'BLOCKED'} or {action:'block'|'unblock'}." });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { status: nextStatus },
      select: { id: true, email: true, role: true, status: true, name: true, lastLoginAt: true },
    });

    return json(res, 200, { ok: true, user: updated });
  }

  res.setHeader("Allow", "GET, PATCH, POST, DELETE");
  return json(res, 405, { ok: false, error: "Method not allowed" });
}
