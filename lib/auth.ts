// lib/auth.ts
import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import { prisma } from "./prisma";

export async function getSessionServer(ctx: GetServerSidePropsContext) {
  return getServerSession(ctx.req, ctx.res, authOptions);
}

export async function requireUser(ctx: GetServerSidePropsContext) {
  const session = await getSessionServer(ctx);
  if (!session?.user?.email) return { session: null, user: null };

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  return { session, user };
}

export async function requireAdmin(ctx: GetServerSidePropsContext) {
  const { session, user } = await requireUser(ctx);
  if (!session?.user?.email || !user) return { session: null, user: null, isAdmin: false };

  const adminEmails =
    process.env.ADMIN_EMAILS?.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) || [];
  const isAdmin = user.role === "ADMIN" || adminEmails.includes(session.user.email.toLowerCase());
  return { session, user, isAdmin };
}

export async function requireAdminApi(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email) return { ok: false as const, session: null };

  const adminEmails =
    process.env.ADMIN_EMAILS?.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) || [];
  if (!adminEmails.includes(email)) return { ok: false as const, session };

  return { ok: true as const, session };
}
