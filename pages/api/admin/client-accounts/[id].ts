import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../lib/prisma";
import { requireAdminApi } from "../../../../lib/auth";

function json(res: NextApiResponse, status: number, payload: any) {
  return res.status(status).json(payload);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAdminApi(req, res);
  if (!auth.ok) return json(res, 401, { ok: false, error: "Unauthorized" });
  if (auth.principal.role !== "SUPERADMIN") return json(res, 403, { ok: false, error: "Forbidden" });

  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id) return json(res, 400, { ok: false, error: "Missing id" });

  const target = await prisma.externalUser.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      emailVerified: true,
      createdAt: true,
      lastLoginAt: true,
      legacyUserId: true,
      brand: {
        select: {
          brandKey: true,
          name: true,
        },
      },
    },
  });

  if (!target) return json(res, 404, { ok: false, error: "Client account not found" });

  if (req.method === "GET") {
    return json(res, 200, {
      ok: true,
      user: {
        id: target.id,
        name: target.name,
        email: target.email,
        brandKey: target.brand.brandKey,
        brandName: target.brand.name,
        status: target.status,
        emailVerifiedAt: target.emailVerified ? target.emailVerified.toISOString() : null,
        createdAt: target.createdAt.toISOString(),
        lastLoginAt: target.lastLoginAt ? target.lastLoginAt.toISOString() : null,
        legacyLinked: Boolean(target.legacyUserId),
      },
    });
  }

  if (req.method === "DELETE") {
    await prisma.externalUser.delete({ where: { id } });
    return json(res, 200, { ok: true });
  }

  if (req.method === "PATCH" || req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const action = String(body.action || "").toLowerCase();

    if (action !== "block" && action !== "unblock") {
      return json(res, 400, { ok: false, error: "Unsupported action" });
    }

    const status = action === "block" ? "BLOCKED" : "ACTIVE";

    await prisma.externalUser.update({
      where: { id },
      data: { status },
    });

    return json(res, 200, { ok: true });
  }

  res.setHeader("Allow", "GET, PATCH, POST, DELETE");
  return json(res, 405, { ok: false, error: "Method not allowed" });
}
