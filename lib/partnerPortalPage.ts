import type { GetServerSidePropsContext } from "next";
import { clearCommandPartnerBffSessionCookie, getCommandPartnerBffSessionToken } from "./commandPartnerBffSession";
import {
  commandPartnerGetSession,
  isUnauthorizedCommandError,
  type CommandPartnerPortalScope,
} from "./commandPublicApi";

export async function requirePartnerPortalPageSession(
  ctx: GetServerSidePropsContext,
  scope: CommandPartnerPortalScope
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

    throw error;
  }
}
