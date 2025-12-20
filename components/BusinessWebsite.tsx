import React, { useState } from "react";

/**
 * Orbitron font note:
 * We load Orbitron via CSS @import so this component works in both Next.js and preview sandboxes
 * where `next/font/google` may be unavailable.
 */

export default function BusinessWebsite() {
  const [open, setOpen] = useState(false);

  const navItems = [
    { label: "Home", href: "#home" },
    { label: "Services", href: "#services" },
    { label: "How We Work", href: "#process" },
    { label: "Case Study", href: "#case-study" },
    { label: "About", href: "#about" },
    { label: "Testimonials", href: "#testimonials" },
    // Keep as an anchor label (CTA buttons use “Get Started”)
    { label: "Contact", href: "#contact" },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Fonts + keyframes */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700&display=swap');
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white/90 border-b border-neutral-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <a href="#home" className="flex items-center gap-2 font-semibold text-lg">
              <img src="/logo.png" alt="X Dragon Technologies logo" className="h-11 w-auto" />
            </a>

            <nav className="hidden md:flex items-center gap-8">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-sm font-medium text-neutral-700 hover:text-black transition-colors"
                >
                  {item.label}
                </a>
              ))}

              <a
                href="#contact"
                className="rounded-2xl bg-black text-white px-4 py-2 text-sm font-semibold hover:opacity-90"
              >
                Get Started
              </a>
            </nav>

            <button
              onClick={() => setOpen(!open)}
              className="md:hidden inline-flex items-center justify-center rounded-xl border border-neutral-300 p-2"
              aria-label="Toggle menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {open && (
          <div className="md:hidden border-t border-neutral-200">
            <div className="px-4 py-3 flex flex-col gap-2">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-2 text-sm font-medium hover:bg-neutral-100"
                >
                  {item.label}
                </a>
              ))}

              <a
                href="#contact"
                onClick={() => setOpen(false)}
                className="block rounded-xl bg-black text-white px-3 py-2 text-center text-sm font-semibold"
              >
                Get Started
              </a>
            </div>
          </div>
        )}
      </header>
    </div>
  );
}
