// pages/api/guides/[slug].ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "../auth/[...nextauth]";
import { isExternalSession } from "../../../lib/authScopes";
import {
  commandPublicGetGuideBySlug,
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

    const slug = typeof req.query.slug === "string" ? req.query.slug : "";
    if (!slug) return res.status(400).json({ ok: false, error: "Missing slug" });

    const sessionToken = getCommandBffSessionToken(req);
    if (!sessionToken) {
      clearCommandBffSessionCookie(res);
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    try {
      const response = await commandPublicGetGuideBySlug(sessionToken, slug);
      return res.status(200).json({ ok: true, item: response.item });
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

  const slug = typeof req.query.slug === "string" ? req.query.slug : "";
  if (!slug) return res.status(400).json({ ok: false, error: "Missing slug" });

  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const model: any = (prisma as any).article ?? (prisma as any).guide;
    if (!model?.findUnique) return res.status(500).json({ ok: false, error: "Model not found" });

    let guide: any = null;
    try {
      guide = await model.findUnique({ where: { slug }, include: { category: true } });
    } catch {
      guide = await model.findUnique({ where: { slug } });
    }

    if (!guide || guide.status !== "PUBLISHED") return res.status(404).json({ ok: false, error: "Not found" });

    return res.status(200).json({ ok: true, item: guide });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Server error";
    return res.status(500).json({ ok: false, error: msg });
  }
}
