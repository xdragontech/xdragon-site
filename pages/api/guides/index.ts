// pages/api/guides/index.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "../auth/[...nextauth]";
import { isExternalSession } from "../../../lib/authScopes";
import {
  commandPublicListGuides,
  isCommandPublicApiEnabled,
  isUnauthorizedCommandError,
  CommandPublicApiError,
} from "../../../lib/commandPublicApi";
import { clearCommandBffSessionCookie, getCommandBffSessionToken } from "../../../lib/commandBffSession";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

function isUserSession(session: any) {
  return isExternalSession(session);
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (isCommandPublicApiEnabled()) {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const sessionToken = getCommandBffSessionToken(req);
    if (!sessionToken) {
      clearCommandBffSessionCookie(res);
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    try {
      const response = await commandPublicListGuides(sessionToken, {
        q: typeof req.query.q === "string" ? req.query.q.trim() : "",
        limit: 200,
      });

      return res.status(200).json({
        ok: true,
        guides: response.items,
      });
    } catch (error) {
      if (isUnauthorizedCommandError(error)) {
        clearCommandBffSessionCookie(res);
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }

      if (error instanceof CommandPublicApiError) {
        return res.status(error.status).json({ ok: false, error: error.message });
      }

      return res.status(500).json({ ok: false, error: "Server error" });
    }
  }

  const session = await getServerSession(req, res, authOptions as any);
  if (!isUserSession(session)) return res.status(401).json({ ok: false, error: "Unauthorized" });

  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const where =
      q.length > 0
        ? {
            status: "PUBLISHED",
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
              { summary: { contains: q, mode: "insensitive" } },
              { content: { contains: q, mode: "insensitive" } },
              { tags: { has: q } },
            ],
          }
        : { status: "PUBLISHED" };

    const model: any = (prisma as any).article ?? (prisma as any).guide;

    if (!model?.findMany) return res.status(500).json({ ok: false, error: "Guides model not found" });

    const guides = await model.findMany({
      where,
      include: { category: true },
      orderBy: [{ updatedAt: "desc" }],
      take: 200,
    });

    return res.status(200).json({ ok: true, guides });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Server error";
    return res.status(500).json({ ok: false, error: msg });
  }
}
