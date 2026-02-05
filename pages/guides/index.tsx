// pages/guides/index.tsx
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import Head from "next/head";
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { useEffect, useMemo, useState } from "react";
import { authOptions } from "../api/auth/[...nextauth]";
import ResourcesHeader from "../../components/resources/ResourcesHeader";

type Article = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  updatedAt?: string | null;
  category?: { id: string; name: string; slug: string } | null;
  tags?: string[] | null;
};

type ApiOk = { ok: true; articles: Article[] };
type ApiErr = { ok: false; error: string };

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  const status = (session as any)?.status as string | undefined;

  if (!session?.user || status === "BLOCKED") {
    const callbackUrl = encodeURIComponent("/guides");
    return {
      redirect: { destination: `/signin?callbackUrl=${callbackUrl}`, permanent: false },
    };
  }
  return { props: {} };
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

export default function GuidesIndexPage(_props: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const url = q.trim() ? `/api/guides?q=${encodeURIComponent(q.trim())}` : `/api/guides`;
      const res = await fetch(url);
      const data = (await res.json()) as ApiOk | ApiErr;
      if (!res.ok || !data.ok) throw new Error((data as ApiErr).error || "Request failed");
      setArticles((data as ApiOk).articles);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load guides");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return articles;
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(s) ||
        a.slug.toLowerCase().includes(s) ||
        a.summary.toLowerCase().includes(s) ||
        (a.category?.name || "").toLowerCase().includes(s) ||
        (a.tags || []).join(" ").toLowerCase().includes(s)
    );
  }, [articles, q]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <Head>
        <title>Guides • X Dragon</title>
      </Head>

      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold text-neutral-900">Guides</div>
              <div className="mt-1 text-sm text-neutral-600">Search how-to and educational articles.</div>
            </div>
            <Link
              href="/"
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              Home
            </Link>
          </div>

          <div className="mt-4 flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search guides…"
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
            />
            <button
              onClick={() => void load()}
              className="rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              Search
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {err ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
        ) : null}

        {loading ? (
          <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">No guides found.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((a) => (
              <Link
                key={a.id}
                href={`/guides/${a.slug}`}
                className="block rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:bg-neutral-50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-neutral-900">{a.title}</div>
                    <div className="mt-1 line-clamp-2 text-sm text-neutral-600">{a.summary}</div>
                    <div className="mt-2 text-xs text-neutral-500">
                      {a.category?.name ? <span>{a.category.name} • </span> : null}
                      Updated {fmtDate(a.updatedAt || null)}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs text-neutral-500">{a.tags?.length ? `${a.tags.length} tags` : ""}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}