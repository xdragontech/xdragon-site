// pages/admin/library.tsx
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { signOut } from "next-auth/react";
import { useRouter } from "next/router";
import { authOptions } from "../api/auth/[...nextauth]";

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);

  // Only allow ACTIVE admin users
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

export default function AdminLibraryPage(_props: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();

  const [loggedInAs, setLoggedInAs] = useState<string>("");

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => {
        const u = s?.user;
        const email = (u?.email || "").toString();
        const name = (u?.name || "").toString();
        const username = email ? email.split("@")[0] : (name ? name.split(" ")[0] : "");
        setLoggedInAs(username);
      })
      .catch(() => {});
  }, []);

  const isDashboard = router.pathname === "/admin/users";
  const isAccounts = router.pathname === "/admin/accounts";
  const isLibrary = router.pathname === "/admin/library";

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <Head>
        <title>X Dragon Command — Library</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <Image src="/logo.png" alt="X Dragon" width={160} height={44} className="h-11 w-auto" priority />
              <div
                className="mt-1 text-sm font-semibold uppercase tracking-widest text-neutral-900"
                style={{ fontFamily: "Orbitron, ui-sans-serif" }}
              >
                Command
              </div>
            </div>
            <div className="text-sm text-neutral-600">Library</div>
          </div>

          <div className="flex flex-col items-end">
            <button
            onClick={() => void signOut({ callbackUrl: "/admin/signin" })}
            className="rounded-lg border border-neutral-900 bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Sign out
          </button>
            {loggedInAs ? (
              <div className="mt-2 text-sm text-neutral-600">Logged in as: {loggedInAs}</div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-12">
          <aside className="lg:col-span-2">
            <div className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
              <nav className="space-y-2">
                <Link
                  href="/admin/users"
                  className={
                    "block w-full rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors" +
                    (isDashboard ? " ring-2 ring-neutral-900/20" : "")
                  }
                >
                  Dashboard
                </Link>
                <Link
          href="/admin/accounts"
          className={
          "block w-full rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-neutral-800" +
          (isAccounts ? " ring-2 ring-neutral-900/20" : "")
          }
          >
          Accounts
          </Link>
          <Link
                  href="/admin/library"
                  className={
                    "block w-full rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors" +
                    (isLibrary ? " ring-2 ring-neutral-900/20" : "")
                  }
                >
                  Library
                </Link>
              </nav>
            </div>
          </aside>

          <section className="lg:col-span-10">
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h1 className="text-lg font-semibold">Prompt Library management</h1>
              <p className="mt-2 text-sm text-neutral-600">This page is ready for the Library content admin UI.</p>
              <div className="mt-6 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-6 text-sm text-neutral-700">
                Coming soon: CRUD for prompts, categories, visibility, and version history.
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
