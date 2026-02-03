// pages/tools/index.tsx
import type { GetServerSideProps } from "next";
import { signOut } from "next-auth/react";
import { requireUser } from "../../lib/auth";
import { PROMPTS, type PromptItem } from "../../content/prompts";
import { useMemo, useState } from "react";

type Props = {
  email: string;
  prompts: PromptItem[];
};

export default function ToolsPage({ email, prompts }: Props) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<PromptItem["category"] | "All">("All");

  const categories = useMemo(() => {
    // Stable ordering for your primary audience; fall back to alphabetical for anything extra.
    const preferred = ["Marketing", "Operations", "Customer Support", "Analytics"] as const;
    const seen = new Set<string>();
    const out: string[] = [];

    for (const c of preferred) {
      if (prompts.some((p) => p.category === c)) {
        out.push(c);
        seen.add(c);
      }
    }

    const extras = Array.from(new Set(prompts.map((p) => p.category)))
      .filter((c) => !seen.has(c))
      .sort((a, b) => a.localeCompare(b));

    return [...out, ...extras];
  }, [prompts]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return prompts.filter((p) => {
      const matchCat = cat === "All" || p.category === cat;
      const matchQ =
        !query ||
        p.title.toLowerCase().includes(query) ||
        p.prompt.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query);
      return matchCat && matchQ;
    });
  }, [q, cat, prompts]);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;600;700&display=swap" rel="stylesheet" />
      </Head>
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-6">
            <div className="flex flex-col items-start leading-none">
              <img
                src="/logo.png"
                alt="X Dragon"
                className="h-11 w-auto"
                style={{ imageRendering: "auto" }}
              />
              <div
                className="mt-2 tracking-wider text-neutral-900"
                style={{ fontFamily: "Orbitron, system-ui, sans-serif", fontSize: "1.6875rem" }}
              >
                Library
              </div>
            </div>

            <div className="flex h-11 min-w-0 items-center">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-neutral-900">Prompt library</div>
                <div className="mt-0.5 truncate text-xs text-neutral-500">
                  {email ? `Signed in as ${email}` : "Loading session…"}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => void signOut({ callbackUrl: "/auth/signin" })}
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="max-w-2xl">
          <h1 className="text-3xl sm:text-4xl font-bold">Browse prompts</h1>
          <p className="mt-3 text-neutral-600">
            Copy-and-run prompts designed for startups to mid-market teams. Tweak to match your exact context.
          </p>
        </div>

        <div className="mt-8">
          {/* Category buttons (replaces the dropdown) */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setCat("All")}
              className={
                cat === "All"
                  ? "shrink-0 rounded-full bg-red-600 text-white px-4 py-2 text-xs font-semibold"
                  : "shrink-0 rounded-full border border-red-200 bg-white text-red-700 px-4 py-2 text-xs font-semibold hover:bg-red-50"
              }
            >
              ALL
            </button>

            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c as any)}
                className={
                  cat === c
                    ? "shrink-0 rounded-full bg-red-600 text-white px-4 py-2 text-xs font-semibold"
                    : "shrink-0 rounded-full border border-red-200 bg-white text-red-700 px-4 py-2 text-xs font-semibold hover:bg-red-50"
                }
              >
                {c}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="mt-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full sm:max-w-md rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="Search prompts…"
            />
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
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
