// pages/tools/index.tsx
import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useMemo, useState } from "react";
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

// Replace these with your real prompt library data source later.
// Keeping inline for now.
const PROMPTS: PromptItem[] = [
  {
    id: "p1",
    title: "Landing page hero rewrite",
    category: "Marketing",
    prompt:
      "Rewrite the following landing page hero section for clarity and conversion. Keep it under 40 words, emphasize outcomes, and include one strong CTA.\n\n[PASTE HERO COPY HERE]",
  },
  {
    id: "p2",
    title: "Operations SOP draft",
    category: "Operations",
    prompt:
      "Create a concise SOP for the following process. Include: Purpose, Scope, Roles, Step-by-step procedure, Checks, and Common failure modes.\n\n[PASTE PROCESS DETAILS HERE]",
  },
  {
    id: "p3",
    title: "Customer support: empathetic resolution",
    category: "Customer Support",
    prompt:
      "Draft a customer support reply that is empathetic, specific, and solution-oriented. Ask only one clarifying question at the end.\n\nCustomer message: [PASTE MESSAGE HERE]",
  },
  {
    id: "p4",
    title: "Analytics: insight summary",
    category: "Analytics",
    prompt:
      "Given the following metrics, identify: (1) the top 3 insights, (2) the most likely root causes, (3) 3 high-leverage experiments for the next 2 weeks.\n\nMetrics: [PASTE METRICS HERE]",
  },
];

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

      {/* Header styled to match admin/users */}
      <header className="border-b border-neutral-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-start gap-3">
                <img src="/logo.png" alt="X Dragon" className="h-11 w-11" />
                <div className="leading-tight">
                  <div className="text-sm font-semibold tracking-wide">X Dragon</div>
                  <div className="font-[Orbitron] text-[1.6875rem] font-bold tracking-wider text-red-600">
                    Library
                  </div>
                </div>
              </div>

              <div className="hidden sm:block border-l border-neutral-200 pl-4">
                <div className="text-sm text-neutral-600">Prompt library</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="hidden sm:inline-flex rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-neutral-50"
              >
                Main site
              </Link>

              <button
                onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-neutral-50"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <div className="text-sm text-neutral-600">Signed in as</div>
          <div className="font-semibold">{email}</div>
        </div>

        <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          {/* Category buttons (replaces dropdown) */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategory("All")}
              className={[
                "rounded-full px-4 py-2 text-sm font-semibold border transition-colors",
                category === "All"
                  ? "bg-red-600 border-red-600 text-white"
                  : "bg-white border-red-200 text-red-700 hover:bg-red-50",
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
                    ? "bg-red-600 border-red-600 text-white"
                    : "bg-white border-red-200 text-red-700 hover:bg-red-50",
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
      prompts: PROMPTS,
    },
  };
};
