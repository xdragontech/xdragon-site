// pages/guides/[slug].tsx
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import Link from "next/link";
import { PrismaClient } from "@prisma/client";

import ResourcesLayout from "../../components/resources/ResourcesLayout";
import { requireUser } from "../../lib/requireUser";

// Prisma singleton (prevents hot-reload connection storms in dev)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

type GuideItem = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  updatedAt: string | null;
  category: { id: string; name: string; slug: string } | null;
  tags: string[] | null;
};

type Props = {
  email: string;
  guide: GuideItem;
};

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const slug = String(ctx.params?.slug ?? "");
  const { session, user, redirectTo } = await requireUser(ctx);

  if (redirectTo || !session?.user || !user || user.status === "BLOCKED") {
    const callbackUrl = encodeURIComponent(`/guides/${slug}`);
    return {
      redirect: { destination: `/auth/signin?callbackUrl=${callbackUrl}`, permanent: false },
    };
  }

  try {
    const model: any = (prisma as any).article ?? (prisma as any).guide;
    if (!model?.findUnique) return { notFound: true };

    let row: any = null;
    try {
      row = await model.findUnique({ where: { slug }, include: { category: true } });
    } catch {
      row = await model.findUnique({ where: { slug } });
    }

    if (!row || row.status !== "PUBLISHED") return { notFound: true };

    const guide: GuideItem = {
      id: row.id,
      title: row.title,
      slug: row.slug,
      summary: row.summary ?? "",
      content: row.content ?? "",
      updatedAt: row.updatedAt ? String(row.updatedAt) : null,
      category: row.category ? { id: row.category.id, name: row.category.name, slug: row.category.slug } : null,
      tags: row.tags ?? null,
    };

    return { props: { email: session.user.email ?? "", guide } };
  } catch {
    return { notFound: true };
  }
};

export default function GuidePage(props: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { guide, email } = props as any as Props;

  return (
    <ResourcesLayout title={`${guide.title} — X Dragon`} sectionLabel="Tools & guides" loggedInAs={email} active="guides">
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-4">
          <Link href="/guides" className="text-sm font-semibold text-neutral-700 hover:text-neutral-900">
            ← Back to Guides
          </Link>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-neutral-900">{guide.title}</h1>
              {guide.summary ? <p className="mt-2 text-sm text-neutral-600">{guide.summary}</p> : null}
            </div>
            <div className="text-right text-xs text-neutral-500">
              {guide.category ? <div className="font-semibold text-neutral-700">{guide.category.name}</div> : null}
              {guide.updatedAt ? <div>Updated: {guide.updatedAt}</div> : null}
            </div>
          </div>

          <div className="mt-6 whitespace-pre-wrap break-words text-sm text-neutral-800">{guide.content}</div>

          {guide.tags && guide.tags.length > 0 ? (
            <div className="mt-6 flex flex-wrap gap-2">
              {guide.tags.map((t) => (
                <span key={t} className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-700">
                  {t}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </main>
    </ResourcesLayout>
  );
}
