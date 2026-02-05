// pages/admin/library/index.tsx
import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../api/auth/[...nextauth]";
import AdminHeader from "../../../components/admin/AdminHeader";
import AdminSidebar from "../../../components/admin/AdminSidebar";

type LibraryIndexProps = {
  loggedInAs: string | null;
};

export const getServerSideProps: GetServerSideProps<LibraryIndexProps> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);

  const role = (session as any)?.role as string | undefined;
  const status = (session as any)?.status as string | undefined;

  if (!session?.user || role !== "ADMIN" || status === "BLOCKED") {
    const callbackUrl = encodeURIComponent("/admin/library");
    return {
      redirect: {
        destination: `/admin/signin?callbackUrl=${callbackUrl}`,
        permanent: false,
      },
    };
  }

  return {
    props: {
      loggedInAs: session.user.email ?? null,
    },
  };
};

export default function AdminLibraryIndex({ loggedInAs }: LibraryIndexProps): JSX.Element {
  return (
    <div className="min-h-screen bg-neutral-50">
      <Head>
        <title>Admin • Library</title>
      </Head>

      <AdminHeader sectionLabel="Library" loggedInAs={loggedInAs} />

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-12">
          <AdminSidebar active="library" />

          <section className="lg:col-span-10">
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h1 className="text-xl font-semibold text-neutral-900">Library</h1>
              <p className="mt-1 text-sm text-neutral-600">Choose what you want to manage.</p>

              <div className="mt-6 space-y-3">
                <Link
                  href="/admin/library/prompts"
                  className="block w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 shadow-sm transition hover:bg-neutral-50"
                >
                  Prompts
                </Link>

                <Link
                  href="/admin/library/articles"
                  className="block w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 shadow-sm transition hover:bg-neutral-50"
                >
                  Articles
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
