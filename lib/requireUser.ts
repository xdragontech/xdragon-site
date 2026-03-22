import type { GetServerSidePropsContext } from "next";
import type { Session } from "next-auth";
import {
  commandPublicGetSession,
  isUnauthorizedCommandError,
  CommandPublicApiError,
  logCommandPublicApiError,
  type CommandPublicAccount,
} from "./commandPublicApi";
import { clearCommandBffSessionCookie, getCommandBffSessionToken } from "./commandBffSession";

export type RequireUserResult = {
  session: Session | null;
  user: CommandPublicAccount | null;
  mode: "command";
  sessionToken: string | null;
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
  ctx.res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  ctx.res.setHeader("Vary", "Cookie");

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
