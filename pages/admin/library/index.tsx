// pages/admin/library/index.tsx
import type { GetServerSideProps } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../api/auth/[...nextauth]";
import AdminHeader from "../../../components/admin/AdminHeader";
import AdminSidebar from "../../../components/admin/AdminSidebar";

export const getServerSideProps: GetServerSideProps = async (ctx) => {
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

  return { props: {} };
};

export default function AdminLibraryIndex() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <AdminHeader sectionLabel="Library" />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-12">
          <AdminSidebar active="library" />

          <section className="lg:col-span-10">
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="text-sm font-semibold text-neutral-900">Library</div>
              <div className="mt-1 text-sm text-neutral-600">Choose what you want to manage.</div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Link
                  href="/admin/library/prompts"
                  className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:bg-neutral-50"
                >
                  <div className="text-sm font-semibold text-neutral-900">Prompts</div>
                  <div className="mt-1 text-sm text-neutral-600">Add, edit, delete, set status, manage categories.</div>
                </Link>

                <Link
                  href="/admin/library/articles"
                  className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:bg-neutral-50"
                >
                  <div className="text-sm font-semibold text-neutral-900">Articles</div>
                  <div className="mt-1 text-sm text-neutral-600">Add, edit, delete, set status, manage article categories.</div>
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
