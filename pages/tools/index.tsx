// pages/tools/index.tsx
import type { GetServerSideProps } from "next";
import Link from "next/link";
import { PrismaClient } from "@prisma/client";
import ResourcesLayout from "../../components/resources/ResourcesLayout";
import { requireUser } from "../../lib/requireUser";

type Props = {
  email: string;
};

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default function ResourcesIndex({ email }: Props) {
  return (
    <ResourcesLayout title="Resources — X Dragon" sectionLabel="Tools & guides" loggedInAs={email} active="resources">
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

  return {
    props: {
      email: session.user.email,
    },
  };
};
