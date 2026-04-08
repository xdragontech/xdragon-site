import { useState } from "react";

type PublicSiteHeaderProps = {
  isHome?: boolean;
};

const navItems = [
  { label: "Home", href: "#home" },
  { label: "Services", href: "#services" },
  { label: "How We Work", href: "#process" },
  { label: "Case Study", href: "#case-study" },
  { label: "About", href: "#about" },
  { label: "Schedule", href: "/schedule" },
  { label: "Partners", href: "/partners" },
  { label: "Contact", href: "#contact" },
] as const;

function resolveHref(href: string, isHome: boolean) {
  if (href.startsWith("#")) {
    return isHome ? href : `/${href}`;
  }

  return href;
}

export default function PublicSiteHeader({ isHome = false }: PublicSiteHeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <a href={resolveHref("#home", isHome)} className="flex items-center gap-2 font-semibold text-lg">
            <img src="/logo.png" alt="X Dragon Technologies logo" className="h-11 w-auto" />
          </a>

          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={resolveHref(item.href, isHome)}
                className="text-sm font-medium text-neutral-700 transition-colors hover:text-black"
              >
                {item.label}
              </a>
            ))}

            <a
              href="/tools"
              className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Resources
            </a>

            <a
              href={resolveHref("#contact", isHome)}
              className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Get Started
            </a>
          </nav>

          <button
            onClick={() => setOpen((current) => !current)}
            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-300 bg-white p-2 hover:bg-neutral-50"
            aria-label="Toggle menu"
          >
            <span className="flex flex-col gap-1.5" aria-hidden="true">
              <span className="block h-1.5 w-6 rounded bg-neutral-900" />
              <span className="block h-1.5 w-6 rounded bg-neutral-900" />
              <span className="block h-1.5 w-6 rounded bg-neutral-900" />
            </span>
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-neutral-200 md:hidden">
          <div className="flex flex-col gap-2 px-4 py-3">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={resolveHref(item.href, isHome)}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-2 text-sm font-medium hover:bg-neutral-100"
              >
                {item.label}
              </a>
            ))}

            <a
              href="/tools"
              onClick={() => setOpen(false)}
              className="block rounded-xl bg-red-600 px-3 py-2 text-center text-sm font-semibold text-white"
            >
              Resources
            </a>

            <a
              href={resolveHref("#contact", isHome)}
              onClick={() => setOpen(false)}
              className="block rounded-xl bg-black px-3 py-2 text-center text-sm font-semibold text-white"
            >
              Get Started
            </a>
          </div>
        </div>
      ) : null}
    </header>
  );
}
