// pages/prompts/index.tsx
import type { GetServerSideProps } from "next";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PrismaClient } from "@prisma/client";
import { requireUser } from "../../lib/requireUser";
import ResourcesLayout from "../../components/resources/ResourcesLayout";

type PromptItem = {
  id: string;
  title: string;
  description?: string | null;
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

export default function PromptsIndexPage({ email, prompts }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  // Collapsed by default: IDs present in this set are expanded.
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of prompts) set.add(p.category);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [prompts]);

  function toggleOpen(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
    <ResourcesLayout title="Prompts — X Dragon" sectionLabel="Tools & guides" loggedInAs={email} active="prompts">
      <main className="mx-auto max-w-6xl px-4 py-6">
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
          {filtered.map((p) => {
          const isOpen = openIds.has(p.id);
          return (
            <div key={p.id} className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-neutral-500">{p.category}</div>
                  <h2 className="mt-2 text-lg font-semibold">{p.title}</h2>
                  {p.description ? <div className="mt-1 text-sm text-neutral-600">{p.description}</div> : null}
                </div>

                <button
                  type="button"
                  onClick={() => toggleOpen(p.id)}
                  className="shrink-0 rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                  aria-expanded={isOpen}
                >
                  {isOpen ? "Collapse" : "Expand"}
                </button>
              </div>

              {isOpen ? (
                <pre className="mt-4 whitespace-pre-wrap rounded-2xl bg-neutral-50 border border-neutral-200 p-4 text-sm text-neutral-800">
                  {p.prompt}
                </pre>
              ) : null}

              <button
                className="mt-4 rounded-2xl bg-black text-white px-4 py-2 text-sm font-semibold hover:opacity-90"
                onClick={async () => {
                  await navigator.clipboard.writeText(p.prompt);
                }}
              >
                Copy prompt
              </button>
            </div>
          );
        })}
        </div>

        {filtered.length === 0 && (
          <div className="mt-10 text-sm text-neutral-600">
            No prompts match your search. Try a different keyword or category.
          </div>
        )}
      </main>
    </ResourcesLayout>
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
    orderBy: [{ sortOrder: "desc" }, { updatedAt: "desc" }],
    include: { category: true },
  });

  const prompts: PromptItem[] = rows.map((p) => ({
    id: p.id,
    title: p.title,
    description: (p as any).description ?? null,
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