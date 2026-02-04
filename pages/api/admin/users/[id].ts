// pages/api/admin/users/[id].ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../lib/prisma";
import { requireAdminApi } from "../../../../lib/auth";

/**
 * Admin user management for a single user
 * - GET: return user details
 * - PATCH/POST: update user status (BLOCKED/ACTIVE)
 * - DELETE: delete user
 *
 * Hardening:
 * - Prevent an admin from blocking/deleting themselves.
 * - Prevent blocking/deleting protected admins (ADMIN_EMAILS env + built-in xdadmin).
 */

function parseList(envValue: string | undefined): string[] {
  return (envValue || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isXdAdminEmail(emailLower: string) {
  const xdEmail = (process.env.XDADMIN_EMAIL || "xdadmin@xdragon.tech").toLowerCase();
  const xdUser = (process.env.XDADMIN_USERNAME || "xdadmin").toLowerCase();

  if (!emailLower) return false;
  if (emailLower === xdEmail) return true;

  const local = emailLower.split("@")[0] || "";
  return local === xdUser;
}

function json(res: NextApiResponse, status: number, payload: any) {
  return res.status(status).json(payload);
}

function serializeUser(u: any) {
  return {
    ...u,
    createdAt: u?.createdAt instanceof Date ? u.createdAt.toISOString() : u?.createdAt,
    lastLoginAt: u?.lastLoginAt instanceof Date ? u.lastLoginAt.toISOString() : u?.lastLoginAt,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAdminApi(req, res);
  if (!auth.ok) return json(res, 401, { ok: false, error: "Unauthorized" });

  const session = (auth as any).session;
  const meId = (session as any)?.user?.id;
  const meEmail = (((session as any)?.user?.email || "") as string).toLowerCase();

  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id) return json(res, 400, { ok: false, error: "Missing id" });

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, status: true, name: true, createdAt: true, lastLoginAt: true },
  });

  if (!target) return json(res, 404, { ok: false, error: "User not found" });

  const targetEmail = (target.email || "").toLowerCase();
  const protectedAdmins = parseList(process.env.ADMIN_EMAILS);
  const isSelf = meId && target.id === meId;

  const isProtectedAdmin =
    (!!targetEmail && protectedAdmins.includes(targetEmail)) || isXdAdminEmail(targetEmail);

  // --- GET ---
  if (req.method === "GET") {
    return json(res, 200, { ok: true, user: serializeUser(target) });
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

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const action = (body.action as string | undefined)?.toLowerCase();
    let nextStatus: "ACTIVE" | "BLOCKED" | null = null;

    if (body.status === "ACTIVE" || body.status === "BLOCKED") nextStatus = body.status;
    else if (action === "block") nextStatus = "BLOCKED";
    else if (action === "unblock") nextStatus = "ACTIVE";

    if (!nextStatus) {
      return json(res, 400, {
        ok: false,
        error: "Provide {status:'ACTIVE'|'BLOCKED'} or {action:'block'|'unblock'}.",
      });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { status: nextStatus },
      select: { id: true, email: true, role: true, status: true, name: true, createdAt: true, lastLoginAt: true },
    });

    return json(res, 200, { ok: true, user: serializeUser(updated) });
  }

  res.setHeader("Allow", "GET, PATCH, POST, DELETE");
  return json(res, 405, { ok: false, error: "Method not allowed" });
}
