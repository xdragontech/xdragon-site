// pages/guides/index.tsx
import type { GetServerSideProps } from "next";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PrismaClient } from "@prisma/client";
import { requireUser } from "../../lib/requireUser";
import ResourcesLayout from "../../components/resources/ResourcesLayout";

type GuideItem = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  updatedAt?: string | null;
  category?: { id: string; name: string; slug: string } | null;
  tags?: string[] | null;
};

type Props = {
  email: string;
  guides: GuideItem[];
};

// Prisma singleton (prevents hot-reload connection storms in dev)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

export default function GuidesIndexPage({ email, guides }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const g of guides) set.add(g.category?.name ?? "Uncategorized");
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [guides]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return guides.filter((g) => {
      const catName = g.category?.name ?? "Uncategorized";
      const inCat = category === "All" ? true : catName === category;

      const tags = (g.tags ?? []).join(" ").toLowerCase();
      const inQ =
        !q ||
        g.title.toLowerCase().includes(q) ||
        (g.summary ?? "").toLowerCase().includes(q) ||
        catName.toLowerCase().includes(q) ||
        tags.includes(q);

      return inCat && inQ;
    });
  }, [guides, query, category]);

  return (
    <ResourcesLayout title="Guides — X Dragon" sectionLabel="Tools & guides" loggedInAs={email} active="guides">
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
              placeholder="Search guides..."
              className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-200"
            />
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {filtered.map((g) => {
            const catName = g.category?.name ?? "Uncategorized";
            return (
              <div key={g.id} className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-neutral-500">{catName}</div>
                    <h2 className="mt-2 text-lg font-semibold">{g.title}</h2>
                    {g.summary ? <div className="mt-1 text-sm text-neutral-600">{g.summary}</div> : null}
                    <div className="mt-3 text-xs text-neutral-500">Updated: {fmtDate(g.updatedAt)}</div>
                    {g.tags && g.tags.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {g.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] font-semibold text-neutral-700"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <Link
                    href={`/guides/${encodeURIComponent(g.slug)}`}
                    className="shrink-0 rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                  >
                    Open
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="mt-10 text-sm text-neutral-600">
            No guides match your search. Try a different keyword or category.
          </div>
        )}
      </main>
    </ResourcesLayout>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  // Keep login gating exactly as-is (match prompts page behavior)
  const { session, user } = await requireUser(ctx);
  if (!session?.user?.email || !user) {
    return { redirect: { destination: "/auth/signin", permanent: false } };
  }
  if (user.status === "BLOCKED") {
    return { redirect: { destination: "/auth/signin?blocked=1", permanent: false } };
  }

  // Source of truth: DB (published guides only)
  const rows = await (prisma as any).guide.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { updatedAt: "desc" },
    include: { category: true },
  });

  const guides: GuideItem[] = rows.map((r: any) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    summary: r.summary ?? "",
    updatedAt: r.updatedAt ? String(r.updatedAt) : null,
    category: r.category
      ? { id: r.category.id, name: r.category.name, slug: r.category.slug }
      : null,
    tags: r.tags ?? null,
  }));

  return { props: { email: session.user.email, guides } };
};
