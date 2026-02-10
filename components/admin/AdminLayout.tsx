import Head from "next/head";
import type { ReactNode } from "react";
import AdminHeader from "./AdminHeader";
import AdminSidebar from "./AdminSidebar";

type AdminLayoutProps = {
  title?: string;
  sectionLabel: string;
  loggedInAs?: string | null;
  active: "dashboard" | "accounts" | "library" | "leads";
  children: ReactNode;
};

export default function AdminLayout({ title, sectionLabel, loggedInAs, active, children }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {title ? (
        <Head>
          <title>{title}</title>
        </Head>
      ) : null}

      <AdminHeader sectionLabel={sectionLabel} loggedInAs={loggedInAs} />

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-12">
          <AdminSidebar active={active} />
          <section className="lg:col-span-10">{children}</section>
        </div>
      </main>
    </div>
  );
}
