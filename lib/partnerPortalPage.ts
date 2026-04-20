import type { GetServerSidePropsContext } from "next";
import { clearCommandPartnerBffSessionCookie, getCommandPartnerBffSessionToken } from "./commandPartnerBffSession";
import {
  commandPartnerGetSession,
  isUnauthorizedCommandError,
  type CommandPartnerPortalScope,
} from "./commandPublicApi";

export async function requirePartnerPortalPageSession(
  ctx: GetServerSidePropsContext,
  scope: CommandPartnerPortalScope,
  options?: { allowPasswordChangePage?: boolean }
): Promise<
  | {
      redirect: {
        destination: string;
        permanent: false;
      };
    }
  | {
      account: Awaited<ReturnType<typeof commandPartnerGetSession>>["account"];
    }
> {
  ctx.res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  ctx.res.setHeader("Vary", "Cookie");

  const token = getCommandPartnerBffSessionToken(ctx.req);
  if (!token) {
    return {
      redirect: {
        destination: `/${scope}/signin?callbackUrl=${encodeURIComponent(ctx.resolvedUrl || `/${scope}/profile`)}`,
        permanent: false,
      },
    } as const;
  }

  try {
    const session = await commandPartnerGetSession(scope, token);
    if (session.account.passwordChangeRequired && !options?.allowPasswordChangePage) {
      return {
        redirect: {
          destination: `/${scope}/password?callbackUrl=${encodeURIComponent(ctx.resolvedUrl || `/${scope}/profile`)}`,
          permanent: false,
        },
      } as const;
    }
    if (!session.account.passwordChangeRequired && options?.allowPasswordChangePage) {
      return {
        redirect: {
          destination: `/${scope}/profile`,
          permanent: false,
        },
      } as const;
    }
    return {
      account: session.account,
    };
  } catch (error) {
    if (isUnauthorizedCommandError(error)) {
      clearCommandPartnerBffSessionCookie(ctx.res);
      return {
        redirect: {
          destination: `/${scope}/signin?callbackUrl=${encodeURIComponent(ctx.resolvedUrl || `/${scope}/profile`)}`,
          permanent: false,
        },
      } as const;
    }

    // Hotfix: non-auth upstream failure (unconfigured key, upstream 5xx,
    // network error) would otherwise surface Next's 500 page. Redirect to the
    // scope's signin with ?unavailable=1 so the banner renders a friendly
    // "temporarily unavailable" message and the user can retry. Session cookie
    // is preserved — when upstream recovers they won't need to sign in again.
    console.error("[partnerPortalPage] upstream unavailable, degrading to signin", {
      scope,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      redirect: {
        destination: `/${scope}/signin?unavailable=1&callbackUrl=${encodeURIComponent(ctx.resolvedUrl || `/${scope}/profile`)}`,
        permanent: false,
      },
    } as const;
  }
}
