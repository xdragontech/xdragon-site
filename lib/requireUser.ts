// lib/requireUser.ts
import type { GetServerSideProps, GetServerSidePropsContext, GetServerSidePropsResult } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../pages/api/auth/[...nextauth]";

type Session = Awaited<ReturnType<typeof getServerSession>>;

function absoluteUrl(ctx: GetServerSidePropsContext, pathOrUrl: string) {
  try {
    // If already absolute, keep as-is
    const u = new URL(pathOrUrl);
    return u.toString();
  } catch {
    const host = (ctx.req.headers["x-forwarded-host"] as string) || ctx.req.headers.host || "localhost:3000";
    const proto = (ctx.req.headers["x-forwarded-proto"] as string) || "https";
    return `${proto}://${host}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
  }
}

export function requireUser<P extends Record<string, any> = Record<string, any>>(
  handler?: (ctx: GetServerSidePropsContext, session: NonNullable<Session>) => Promise<GetServerSidePropsResult<P>> | GetServerSidePropsResult<P>,
  opts?: { signInPath?: string }
): GetServerSideProps<P> {
  const signInPath = opts?.signInPath || "/auth/signin";

  return async (ctx) => {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);

    if (!session || !session.user) {
      // Preserve intended destination
      const callbackUrl = absoluteUrl(ctx, ctx.resolvedUrl || "/");
      const dest = `${signInPath}?callbackUrl=${encodeURIComponent(callbackUrl)}`;

      return {
        redirect: { destination: dest, permanent: false },
      } as GetServerSidePropsResult<P>;
    }

    if (handler) return await handler(ctx, session as NonNullable<Session>);

    return { props: {} as P };
  };
}
