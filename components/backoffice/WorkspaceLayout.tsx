import Head from "next/head";
import type { ReactNode } from "react";

type WorkspaceLayoutProps = {
  title?: string;
  header: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
};

export default function WorkspaceLayout({ title, header, sidebar, children }: WorkspaceLayoutProps) {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {title ? (
        <Head>
          <title>{title}</title>
        </Head>
      ) : null}

      {header}

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-12">
          {sidebar}
          <section className="lg:col-span-10">{children}</section>
        </div>
      </main>
    </div>
  );
}
