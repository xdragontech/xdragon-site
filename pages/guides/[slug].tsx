// pages/guides/[slug].tsx
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import Head from "next/head";
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { authOptions } from "../api/auth/[...nextauth]";

type Article = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  updatedAt?: string | null;
  category?: { id: string; name: string; slug: string } | null;
  tags?: string[] | null;
};

type ApiOk = { ok: true; article: Article };
type ApiErr = { ok: false; error: string };

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  const status = (session as any)?.status as string | undefined;

  if (!session?.user || status === "BLOCKED") {
    const callbackUrl = encodeURIComponent(`/guides/${ctx.params?.slug || ""}`);
    return { redirect: { destination: `/signin?callbackUrl=${callbackUrl}`, permanent: false } };
  }

  return { props: {} };
};

export default function GuidePage(_props: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const slug = typeof router.query.slug === "string" ? router.query.slug : "";

  const [article, setArticle] = useState<Article | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setErr(null);
    setArticle(null);
    fetch(`/api/guides/${encodeURIComponent(slug)}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok || !j.ok) throw new Error((j as ApiErr).error || "Not found");
        setArticle((j as ApiOk).article);
      })
      .catch((e) => setErr(e?.message || "Failed to load"));
  }, [slug]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <Head>
        <title>{article?.title ? `${article.title} • Guides` : "Guide • X Dragon"}</title>
      </Head>

      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-5">
          <Link href="/guides" className="text-sm font-semibold text-neutral-800 hover:underline">
            ← Back to Guides
          </Link>

          {err ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div> : null}

          {article ? (
            <>
              <div className="mt-3 text-xl font-semibold text-neutral-900">{article.title}</div>
              <div className="mt-2 text-sm text-neutral-600">{article.summary}</div>
            </>
          ) : !err ? (
            <div className="mt-4 text-sm text-neutral-600">Loading…</div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {article ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <pre className="whitespace-pre-wrap break-words text-sm text-neutral-800">{article.content}</pre>
          </div>
        ) : null}
      </main>
    </div>
  );
}
