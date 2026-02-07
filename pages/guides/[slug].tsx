// pages/guides/[slug].tsx
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { requireUser } from "../../lib/requireUser";
import Link from "next/link";
import ResourcesLayout from "../../components/resources/ResourcesLayout";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { PrismaClient } from "@prisma/client";


// Prisma singleton (prevents hot-reload connection storms in dev)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

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
  const slug = String(ctx.params?.slug ?? "");
  const { session, user, redirectTo } = await requireUser(ctx);

  if (redirectTo || !session?.user || !user || user.status === "BLOCKED") {
    const callbackUrl = encodeURIComponent(`/guides/${slug}`);
    return {
      redirect: { destination: `/auth/signin?callbackUrl=${callbackUrl}`, permanent: false },
    };
  }

  // Fetch guide directly (avoid relying on NEXTAUTH_URL + internal API)
  try {
    const model: any = (prisma as any).article ?? (prisma as any).guide;
    if (!model?.findUnique) return { notFound: true };

    const item = await model.findUnique({
      where: { slug },
      include: { category: true },
    });

    if (!item || item.status !== "PUBLISHED") return { notFound: true };

    return { props: { item, email: session.user.email ?? null } };
  } catch (_err) {
    return { notFound: true };
  }
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
    <ResourcesLayout title={`${(_props as any).item?.title ?? "Guide"} — X Dragon`} sectionLabel="Tools & guides" loggedInAs={(_props as any).email ?? null} active="guides">
      <main className="mx-auto max-w-3xl px-4 py-6">
        {article ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <pre className="whitespace-pre-wrap break-words text-sm text-neutral-800">{article.content}</pre>
          </div>
        ) : null}
      </main>
    </ResourcesLayout>
  );
}
