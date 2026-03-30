import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { buildOrigin, getApiRequestHost, getApiRequestProtocol } from "../../../lib/requestHost";
import { getRuntimeHostConfig } from "../../../lib/runtimeHostConfig";

type BrandsRetiredPageProps = {
  targetUrl: string | null;
};

export const getServerSideProps: GetServerSideProps<BrandsRetiredPageProps> = async (ctx) => {
  const requestHost = getApiRequestHost(ctx.req);
  const runtimeHost = await getRuntimeHostConfig(requestHost);
  const targetHost = runtimeHost.canonicalAdminHost || null;
  const targetUrl = targetHost
    ? `${buildOrigin(getApiRequestProtocol(ctx.req), targetHost)}/admin/settings/brands`
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
};

export default function BrandsRetiredPage({
  targetUrl,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-16 text-neutral-900">
      <div className="mx-auto max-w-xl rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold">Brand management moved</h1>
        <p className="mt-3 text-sm text-neutral-600">
          Brand management is no longer owned by <code>xdragon-site</code>. Use the Command backoffice for brand and
          host registry changes.
        </p>
        {targetUrl ? (
          <a
            href={targetUrl}
            className="mt-6 inline-flex rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Open Command Brands
          </a>
        ) : (
          <p className="mt-6 text-sm text-neutral-700">
            The command admin host could not be resolved from runtime config on this request. Use the Command admin
            installation directly.
          </p>
        )}
      </div>
    </main>
  );
}
