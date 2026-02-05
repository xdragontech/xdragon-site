// pages/tools/index.tsx
import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { PrismaClient } from "@prisma/client";
import { requireUser } from "../../lib/requireUser";

type Props = {
  email: string;
};

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default function ResourcesIndex({ email }: Props) {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <Head>
        <title>Resources — X Dragon</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      {/* Header (same styling as tools prompts page) */}
      <header className="border-b border-neutral-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-start leading-none">
                <img src="/logo.png" alt="X Dragon" className="h-11 w-auto" />
                <div className="mt-1 font-[Orbitron] text-[1.6875rem] font-bold tracking-wide text-neutral-900">
                  Resources
                </div>
              </div>
              <div className="flex h-11 items-center">
                <div className="text-sm font-medium text-neutral-600">Tools & guides</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden text-sm font-medium text-neutral-600 md:block">Logged in as: {email}</div>

              <Link
                href="/"
                className="rounded-full border border-red-600 bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
              >
                Main Site
              </Link>

              <button
                onClick={() => void signOut({ callbackUrl: "/auth/signin" })}
                className="rounded-full border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-neutral-900">Choose a resource</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Select what you want to browse. Prompts are ready-to-use templates; Guides are how-to and educational articles.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Link
              href="/prompts"
              className="group rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:bg-neutral-50"
            >
              <div className="text-base font-semibold text-neutral-900">Prompts</div>
              <div className="mt-1 text-sm text-neutral-600">Search and copy ready-to-use prompts.</div>
              <div className="mt-4 text-sm font-semibold text-red-600 group-hover:text-red-700">Open →</div>
            </Link>

            <Link
              href="/guides"
              className="group rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:bg-neutral-50"
            >
              <div className="text-base font-semibold text-neutral-900">Guides</div>
              <div className="mt-1 text-sm text-neutral-600">Browse how-to and educational articles.</div>
              <div className="mt-4 text-sm font-semibold text-red-600 group-hover:text-red-700">Open →</div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  // Keep login gating exactly as-is
  const { session, user } = await requireUser(ctx);
  if (!session?.user?.email || !user) {
    return { redirect: { destination: "/auth/signin", permanent: false } };
  }
  if (user.status === "BLOCKED") {
    return { redirect: { destination: "/auth/signin?blocked=1", permanent: false } };
  }

  return {
    props: {
      email: session.user.email,
    },
  };
};
