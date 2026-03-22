// lib/requireUser.ts
import type { GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import { getExternalIdentityFromSession } from "./externalIdentity";
import { isExternalSession } from "./authScopes";
import {
  commandPublicGetSession,
  isCommandPublicApiEnabled,
  isUnauthorizedCommandError,
  type CommandPublicAccount,
} from "./commandPublicApi";
import { clearCommandBffSessionCookie, getCommandBffSessionToken } from "./commandBffSession";

type LegacyExternalIdentity = Awaited<ReturnType<typeof getExternalIdentityFromSession>>;
type RequireUserIdentity = LegacyExternalIdentity | CommandPublicAccount;

/**
 * A helper for Pages Router SSR that returns BOTH `session` and `user` keys
 * in all cases, so callers can safely destructure:
 *   const { session, user, redirectTo } = await requireUser(ctx)
 */
export type RequireUserResult = {
  session: Session | null;
  user: RequireUserIdentity | null;
  mode: "legacy" | "command";
  sessionToken?: string | null;
  redirectTo?: string;
};

export async function requireUser(ctx: GetServerSidePropsContext): Promise<RequireUserResult> {
  if (isCommandPublicApiEnabled()) {
    const sessionToken = getCommandBffSessionToken(ctx.req);
    if (!sessionToken) {
      return { session: null, user: null, mode: "command", sessionToken: null, redirectTo: "/auth/signin" };
    }

    try {
      const sessionState = await commandPublicGetSession(sessionToken);
      const account = sessionState.account;

      return {
        session: {
          expires: new Date(Date.now() + 60 * 1000).toISOString(),
          user: {
            email: account.email,
            name: account.name || account.email,
            image: null,
          },
        } as Session,
        user: account,
        mode: "command",
        sessionToken,
      };
    } catch (error) {
      if (isUnauthorizedCommandError(error)) {
        clearCommandBffSessionCookie(ctx.res);
      }

      return {
        session: null,
        user: null,
        mode: "command",
        sessionToken: null,
        redirectTo: "/auth/signin",
      };
    }
  }

  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  const email = session?.user?.email ? String(session.user.email).toLowerCase() : null;

  if (!email) {
    return { session: null, user: null, mode: "legacy", redirectTo: "/auth/signin" };
  }

  if (!isExternalSession(session)) {
    return { session: null, user: null, mode: "legacy", redirectTo: "/auth/signin" };
  }

  const user = await getExternalIdentityFromSession(session);

  // If user record missing or blocked, treat as not signed in
  if (!user || user.status === "BLOCKED") {
    return { session: null, user: null, mode: "legacy", redirectTo: "/auth/signin" };
  }

  return { session, user, mode: "legacy" };
}
