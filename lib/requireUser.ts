// lib/requireUser.ts
import type { GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import { prisma } from "./prisma";

/**
 * A helper for Pages Router SSR that returns BOTH `session` and `user` keys
 * in all cases, so callers can safely destructure:
 *   const { session, user, redirectTo } = await requireUser(ctx)
 */
export type RequireUserResult = {
  session: Session | null;
  user: Awaited<ReturnType<typeof prisma.user.findUnique>> | null;
  redirectTo?: string;
};

export async function requireUser(ctx: GetServerSidePropsContext): Promise<RequireUserResult> {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  const email = session?.user?.email ? String(session.user.email).toLowerCase() : null;

  if (!email) {
    return { session: null, user: null, redirectTo: "/auth/signin" };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // If user record missing or blocked, treat as not signed in
  if (!user || user.status === "BLOCKED") {
    return { session: null, user: null, redirectTo: "/auth/signin" };
  }

  return { session, user };
}
