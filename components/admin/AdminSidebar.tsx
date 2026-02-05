import Link from "next/link";

type AdminSidebarProps = {
  active: "dashboard" | "accounts" | "library";
};

export default function AdminSidebar({ active }: AdminSidebarProps) {
  const base =
    "block w-full rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-neutral-800";

  const itemClass = (key: AdminSidebarProps["active"]) =>
    base + (active === key ? " ring-2 ring-neutral-900/20" : "");

  return (
    <aside className="lg:col-span-2">
      <div className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
        <nav className="space-y-2">
          <Link href="/admin/dashboard" className={itemClass("dashboard")}>
            Dashboard
          </Link>
          <Link href="/admin/accounts" className={itemClass("accounts")}>
            Accounts
          </Link>
          <Link href="/admin/library" className={itemClass("library")}>
            Library
          </Link>
        </nav>
      </div>
    </aside>
  );
}
