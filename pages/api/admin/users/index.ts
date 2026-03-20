// pages/api/admin/users/index.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../lib/prisma";
import { requireAdminApi } from "../../../../lib/auth";
import { syncLegacyAdminsToBackoffice } from "../../../../lib/backofficeIdentity";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (auth.principal.role !== "SUPERADMIN") return res.status(403).json({ ok: false, error: "Forbidden" });

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  await syncLegacyAdminsToBackoffice();

  const users = await prisma.backofficeUser.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      username: true,
      email: true,
      status: true,
      role: true,
      createdAt: true,
      lastLoginAt: true,
      brandAccesses: {
        include: {
          brand: {
            select: {
              brandKey: true,
            },
          },
        },
      },
    },
  });

  return res.status(200).json({
    ok: true,
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.username,
      email: u.email,
      role: u.role,
      status: u.status,
      brandAccessCount: u.brandAccesses.length,
      brandKeys: u.brandAccesses.map((access) => access.brand.brandKey),
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    })),
  });
}
