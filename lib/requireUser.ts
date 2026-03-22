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
  CommandPublicApiError,
  logCommandPublicApiError,
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

function buildSignInRedirect(ctx: GetServerSidePropsContext, errorCode?: string) {
  const params = new URLSearchParams();
  const callbackUrl =
    typeof ctx.resolvedUrl === "string" && ctx.resolvedUrl.startsWith("/")
      ? ctx.resolvedUrl
      : typeof ctx.req.url === "string" && ctx.req.url.startsWith("/")
        ? ctx.req.url
        : "";

  if (callbackUrl && callbackUrl !== "/auth/signin") {
    params.set("callbackUrl", callbackUrl);
  }

  if (errorCode) {
    params.set("error", errorCode);
  }

  const query = params.toString();
  return query ? `/auth/signin?${query}` : "/auth/signin";
}

export async function requireUser(ctx: GetServerSidePropsContext): Promise<RequireUserResult> {
  if (isCommandPublicApiEnabled()) {
    const sessionToken = getCommandBffSessionToken(ctx.req);
    if (!sessionToken) {
      return {
        session: null,
        user: null,
        mode: "command",
        sessionToken: null,
        redirectTo: buildSignInRedirect(ctx),
      };
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
      if (error instanceof CommandPublicApiError) {
        logCommandPublicApiError("require-user-command-session", error, {
          requestHost: ctx.req.headers.host || null,
          resolvedUrl: ctx.resolvedUrl || null,
          hasSessionCookie: true,
        });
      } else {
        console.error("[require-user-command-session] unexpected error", error);
      }

      if (isUnauthorizedCommandError(error)) {
        clearCommandBffSessionCookie(ctx.res);
      }

      return {
        session: null,
        user: null,
        mode: "command",
        sessionToken: null,
        redirectTo: buildSignInRedirect(
          ctx,
          isUnauthorizedCommandError(error) ? "CommandSessionExpired" : "CommandSession"
        ),
      };
    }
  }

  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  const email = session?.user?.email ? String(session.user.email).toLowerCase() : null;

  if (!email) {
    return { session: null, user: null, mode: "legacy", redirectTo: buildSignInRedirect(ctx) };
  }

  if (!isExternalSession(session)) {
    return { session: null, user: null, mode: "legacy", redirectTo: buildSignInRedirect(ctx) };
  }

  const user = await getExternalIdentityFromSession(session);

  // If user record missing or blocked, treat as not signed in
  if (!user || user.status === "BLOCKED") {
    return { session: null, user: null, mode: "legacy", redirectTo: buildSignInRedirect(ctx) };
  }

  return { session, user, mode: "legacy" };
}
