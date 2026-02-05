import Link from "next/link";
import { useRouter } from "next/router";

type ResourcesSidebarProps = {
  active?: "resources" | "prompts" | "guides";
};

export default function ResourcesSidebar({ active }: ResourcesSidebarProps) {
  const router = useRouter();

  const pathname = router.pathname;

  const detected: ResourcesSidebarProps["active"] =
    pathname.startsWith("/prompts") ? "prompts" : pathname.startsWith("/guides") ? "guides" : "resources";

  const current = active ?? detected;

  const base =
    "block w-full rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-neutral-800";

  const itemClass = (key: ResourcesSidebarProps["active"]) =>
    base + (current === key ? " ring-2 ring-neutral-900/20" : "");

  const subBase =
    "block w-full rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-500";

  const subItemClass = (key: ResourcesSidebarProps["active"]) =>
    subBase + (current === key ? " ring-2 ring-red-600/30" : "");

  const showTree = pathname === "/tools" || pathname.startsWith("/prompts") || pathname.startsWith("/guides");

  return (
    <aside className="lg:col-span-2">
      <div className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
        <nav className="space-y-2">
          <Link href="/tools" className={itemClass("resources")}>
            Resources
          </Link>

          {showTree ? (
            <div className="space-y-2 pl-3">
              <Link href="/prompts" className={subItemClass("prompts")}>
                Prompts
              </Link>
              <Link href="/guides" className={subItemClass("guides")}>
                Guides
              </Link>
            </div>
          ) : null}
        </nav>
      </div>
    </aside>
  );
}
