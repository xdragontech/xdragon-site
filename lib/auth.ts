// lib/auth.ts
import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import { requireBackofficeApi, requireBackofficePage } from "./backofficeAuth";
import { getExternalIdentityFromSession } from "./externalIdentity";
import { isExternalSession } from "./authScopes";

export async function getSessionServer(ctx: GetServerSidePropsContext) {
  return getServerSession(ctx.req, ctx.res, authOptions);
}

export async function requireUser(ctx: GetServerSidePropsContext) {
  const session = await getSessionServer(ctx);
  if (!session?.user?.email) return { session: null, user: null };

  if (!isExternalSession(session)) return { session: null, user: null };

  const user = await getExternalIdentityFromSession(session);
  return { session, user };
}

export async function requireAdmin(ctx: GetServerSidePropsContext) {
  const auth = await requireBackofficePage(ctx);
  if (!auth.ok) return { session: null, user: null, isAdmin: false };
  return { session: auth.session, user: auth.principal, isAdmin: true };
}

export async function requireAdminApi(req: NextApiRequest, res: NextApiResponse) {
  return requireBackofficeApi(req, res);
}
