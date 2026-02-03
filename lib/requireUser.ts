// lib/requireUser.ts
import type { GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import { prisma } from "./prisma";

export type RequireUserOk = {
  ok: true;
  session: Awaited<ReturnType<typeof getServerSession>>;
  user: {
    id: string;
    email: string | null;
    name: string | null;
    role?: string | null;
    status?: string | null;
  };
};

export type RequireUserErr = {
  ok: false;
  redirect: { destination: string; permanent: false };
};

export type RequireUserResult = RequireUserOk | RequireUserErr;

/**
 * Loads the NextAuth session + corresponding Prisma user.
 * Returns a redirect helper when unauthenticated.
 */
export async function requireUser(ctx: GetServerSidePropsContext): Promise<RequireUserResult> {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);

  const email = session?.user?.email ? String(session.user.email).toLowerCase() : null;
  if (!email) {
    return { ok: false, redirect: { destination: "/auth/signin", permanent: false } };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true, status: true },
  });

  if (!user) {
    return { ok: false, redirect: { destination: "/auth/signin", permanent: false } };
  }

  return { ok: true, session, user };
}
