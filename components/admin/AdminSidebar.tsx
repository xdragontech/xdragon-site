import Link from "next/link";
import { useRouter } from "next/router";

type AdminSidebarProps = {
  active: "dashboard" | "accounts" | "library" | "leads";
};

export default function AdminSidebar({ active }: AdminSidebarProps) {
  const router = useRouter();

  const base =
    "block w-full rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-neutral-800";

  const itemClass = (key: AdminSidebarProps["active"]) =>
    base + (active === key ? " ring-2 ring-neutral-900/20" : "");

  // Sub-nav styling: matches the same button look, just slightly smaller + indented
  const subBase =
    "block w-full rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-500";

  const isOnLibraryRoute = router.pathname.startsWith("/admin/library") || router.pathname === "/admin/prompts";
  const subItemClass = (href: string, aliases: string[] = []) =>
    subBase + ((router.pathname === href || aliases.includes(router.pathname)) ? " ring-2 ring-neutral-900/20" : "");

  // Show the tree whenever you're anywhere under /admin/library
  const showLibraryTree = isOnLibraryRoute || active === "library";

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

          <Link href="/admin/leads" className={itemClass("leads")}>
            Leads
          </Link>

          <div className="space-y-2">
            <Link href="/admin/library" className={itemClass("library")}>
              Library
            </Link>

            {showLibraryTree && (
              <div className="space-y-2 pl-3">
                <Link href="/admin/library/prompts" className={subItemClass("/admin/library/prompts", ["/admin/prompts"])}>
                  Prompts
                </Link>
                <Link href="/admin/library/guides" className={subItemClass("/admin/library/guides")}>
            Guides
                </Link>
              </div>
            )}
          </div>
        </nav>
      </div>
    </aside>
  );
}
