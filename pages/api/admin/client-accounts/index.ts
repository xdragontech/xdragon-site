import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../lib/prisma";
import { requireAdminApi } from "../../../../lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (auth.principal.role !== "SUPERADMIN") return res.status(403).json({ ok: false, error: "Forbidden" });

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const users = await prisma.externalUser.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
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

  return res.status(200).json({
    ok: true,
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      brandKey: user.brand.brandKey,
      brandName: user.brand.name,
      status: user.status,
      emailVerifiedAt: user.emailVerified ? user.emailVerified.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      legacyLinked: Boolean(user.legacyUserId),
    })),
  });
}
