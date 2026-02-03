// pages/tools/index.tsx
import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useMemo, useState } from "react";
import { PrismaClient } from "@prisma/client";
import { requireUser } from "../../lib/requireUser";

type PromptItem = {
  id: string;
  title: string;
  category: string;
  prompt: string;
};

type Props = {
  email: string;
  prompts: PromptItem[];
};

// Prisma singleton (prevents hot-reload connection storms in dev)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default function ToolsPage({ email, prompts }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of prompts) set.add(p.category);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [prompts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return prompts.filter((p) => {
      const inCat = category === "All" ? true : p.category === category;
      const inQ =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.prompt.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      return inCat && inQ;
    });
  }, [prompts, query, category]);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <Head>
        <title>Prompt Library — X Dragon</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      {/* Header */}
      <header className="border-b border-neutral-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-start leading-none">
                <img src="/logo.png" alt="X Dragon" className="h-11 w-auto" />
                <div className="mt-1 font-[Orbitron] text-[1.6875rem] font-bold tracking-wide text-neutral-900">
                  Library
                </div>
              </div>
              <div className="flex h-11 items-center">
                <div className="text-sm font-medium text-neutral-600">Prompt library</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
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
            <div className="mt-2 text-right">
              <div className="text-sm font-medium text-neutral-600">Signed in as</div>
              <div className="text-sm font-medium text-neutral-600">{email}</div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          {/* Category buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategory("All")}
              className={[
                "rounded-full px-4 py-2 text-sm font-semibold border transition-colors",
                category === "All"
                  ? "bg-neutral-900 border-neutral-900 text-white"
                  : "bg-white border-neutral-300 text-neutral-800 hover:bg-neutral-50",
              ].join(" ")}
            >
              ALL
            </button>

            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={[
                  "rounded-full px-4 py-2 text-sm font-semibold border transition-colors",
                  category === c
                    ? "bg-neutral-900 border-neutral-900 text-white"
                    : "bg-white border-neutral-300 text-neutral-800 hover:bg-neutral-50",
                ].join(" ")}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="mt-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search prompts..."
              className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-200"
            />
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {filtered.map((p) => (
            <div key={p.id} className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="text-xs font-semibold text-neutral-500">{p.category}</div>
              <h2 className="mt-2 text-lg font-semibold">{p.title}</h2>

              <pre className="mt-4 whitespace-pre-wrap rounded-2xl bg-neutral-50 border border-neutral-200 p-4 text-sm text-neutral-800">
                {p.prompt}
              </pre>

              <button
                className="mt-4 rounded-2xl bg-black text-white px-4 py-2 text-sm font-semibold hover:opacity-90"
                onClick={async () => {
                  await navigator.clipboard.writeText(p.prompt);
                }}
              >
                Copy prompt
              </button>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="mt-10 text-sm text-neutral-600">
            No prompts match your search. Try a different keyword or category.
          </div>
        )}
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

  // Source of truth: DB (published prompts only)
  const rows = await prisma.prompt.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ updatedAt: "desc" }],
    include: { category: true },
  });

  const prompts: PromptItem[] = rows.map((p) => ({
    id: p.id,
    title: p.title,
    category: p.category?.name || "Uncategorized",
    prompt: p.content,
  }));

  return {
    props: {
      email: session.user.email,
      prompts,
    },
  };
};
