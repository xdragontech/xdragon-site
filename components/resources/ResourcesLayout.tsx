import Head from "next/head";
import type { ReactNode } from "react";
import ResourcesHeader from "./ResourcesHeader";
import ResourcesSidebar from "./ResourcesSidebar";

type ResourcesLayoutProps = {
  title: string;
  sectionLabel: string;
  loggedInAs: string | null;
  active?: "resources" | "prompts" | "guides";
  children: ReactNode;
};

export default function ResourcesLayout({ title, sectionLabel, loggedInAs, active, children }: ResourcesLayoutProps) {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <Head>
        <title>{title}</title>
      </Head>

      <ResourcesHeader sectionLabel={sectionLabel} loggedInAs={loggedInAs} />

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-12">
          <ResourcesSidebar active={active} />
          <section className="lg:col-span-10">{children}</section>
        </div>
      </main>
    </div>
  );
}
