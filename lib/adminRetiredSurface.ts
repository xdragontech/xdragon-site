import type { GetServerSidePropsContext, GetServerSidePropsResult } from "next";
import { buildOrigin, getApiRequestHost, getApiRequestProtocol } from "./requestHost";
import { getRuntimeHostConfig } from "./runtimeHostConfig";

export type RetiredAdminSurfacePageProps = {
  targetUrl: string | null;
};

export async function getRetiredAdminSurfaceProps(
  ctx: GetServerSidePropsContext,
  targetPath: string
): Promise<GetServerSidePropsResult<RetiredAdminSurfacePageProps>> {
  const requestHost = getApiRequestHost(ctx.req);
  const runtimeHost = await getRuntimeHostConfig(requestHost);
  const targetHost = runtimeHost.canonicalAdminHost || null;
  const targetUrl = targetHost
    ? `${buildOrigin(getApiRequestProtocol(ctx.req), targetHost)}${targetPath}`
    : null;

  if (targetHost && targetHost !== requestHost) {
    return {
      redirect: {
        destination: targetUrl as string,
        permanent: false,
      },
    };
  }

  return {
    props: {
      targetUrl,
    },
  };
}
