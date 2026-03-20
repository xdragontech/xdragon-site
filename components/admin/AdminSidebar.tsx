import Link from "next/link";
import { useRouter } from "next/router";

type AdminSidebarProps = {
  active: "dashboard" | "accounts" | "library" | "leads" | "analytics" | "settings";
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
  const disabledSubBase =
    "block w-full rounded-xl bg-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-700 opacity-70 cursor-not-allowed";

  const isOnAccountsRoute = router.pathname === "/admin/accounts" || router.pathname.startsWith("/admin/accounts/");
  const isOnLibraryRoute = router.pathname.startsWith("/admin/library") || router.pathname === "/admin/prompts";
  const isOnSettingsRoute = router.pathname === "/admin/settings" || router.pathname.startsWith("/admin/settings/");
  const subItemClass = (href: string, aliases: string[] = []) =>
    subBase + ((router.pathname === href || aliases.includes(router.pathname)) ? " ring-2 ring-neutral-900/20" : "");

  // Show the tree whenever you're anywhere under /admin/library
  const showAccountsTree = isOnAccountsRoute || active === "accounts";
  const showLibraryTree = isOnLibraryRoute || active === "library";
  const showSettingsTree = isOnSettingsRoute || active === "settings";

  return (
    <aside className="lg:col-span-2">
      <div className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
        <nav className="space-y-2">
          <Link href="/admin/dashboard" className={itemClass("dashboard")}>
            Dashboard
          </Link>

          <div className="space-y-2">
            <Link href="/admin/accounts" className={itemClass("accounts")}>
              Accounts
            </Link>

            {showAccountsTree && (
              <div className="space-y-2 pl-3">
                <Link href="/admin/accounts/staff" className={subItemClass("/admin/accounts/staff", ["/admin/accounts"])}>
                  Staff Accts
                </Link>
                <Link href="/admin/accounts/clients" className={subItemClass("/admin/accounts/clients")}>
                  Client Accts
                </Link>
                <span className={disabledSubBase} aria-disabled="true">
                  Partner Accts
                </span>
              </div>
            )}
          </div>

          <Link href="/admin/leads" className={itemClass("leads")}>
            Leads
          </Link>

          <Link href="/admin/analytics" className={itemClass("analytics")}>
            Analytics
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

          <div className="space-y-2">
            <Link href="/admin/settings" className={itemClass("settings")}>
              Settings
            </Link>

            {showSettingsTree && (
              <div className="space-y-2 pl-3">
                <Link href="/admin/settings/brands" className={subItemClass("/admin/settings/brands")}>
                  Brands
                </Link>
                <Link
                  href="/admin/settings/configs"
                  className={subItemClass("/admin/settings/configs", ["/admin/settings"])}
                >
                  Configs
                </Link>
              </div>
            )}
          </div>
        </nav>
      </div>
    </aside>
  );
}
