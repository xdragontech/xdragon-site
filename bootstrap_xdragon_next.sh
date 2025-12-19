#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${HOME}/Projects/xdragon-site"

echo "🚀 Building X Dragon Next.js project at: ${PROJECT_DIR}"
mkdir -p "${PROJECT_DIR}"
cd "${PROJECT_DIR}"

# --- Create folders ---
mkdir -p pages components styles public assets

# --- package.json ---
cat > package.json <<'JSON'
{
  "name": "xdragon-site",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "18.3.1",
    "react-dom": "18.3.1"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "autoprefixer": "^10.4.0",
    "eslint": "^8.0.0",
    "eslint-config-next": "14.2.5",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.0.0"
  }
}
JSON

# --- next.config.mjs ---
cat > next.config.mjs <<'JS'
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true
};

export default nextConfig;
JS

# --- tsconfig.json ---
cat > tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
JSON

# --- next-env.d.ts ---
cat > next-env.d.ts <<'TS'
/// <reference types="next" />
/// <reference types="next/image-types/global" />
TS

# --- postcss.config.mjs ---
cat > postcss.config.mjs <<'JS'
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};
JS

# --- tailwind.config.ts ---
cat > tailwind.config.ts <<'TS'
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {}
  },
  plugins: []
};

export default config;
TS

# --- styles/globals.css ---
cat > styles/globals.css <<'CSS'
@tailwind base;
@tailwind components;
@tailwind utilities;

html,
body {
  padding: 0;
  margin: 0;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background-color: #fafafa;
}
CSS

# --- pages/_app.tsx ---
cat > pages/_app.tsx <<'TSX'
import type { AppProps } from "next/app";
import "@/styles/globals.css";

export default function MyApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
TSX

# --- pages/index.tsx (Head replaces Helmet) ---
cat > pages/index.tsx <<'TSX'
import Head from "next/head";
import BusinessWebsite from "@/components/BusinessWebsite";

export default function Home() {
  return (
    <>
      <Head>
        <title>X Dragon Technologies</title>
        <meta
          name="description"
          content="X Dragon provides leading AI consulting as well as Infrastructure Management for E-commerce operators."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        {/* Favicons / icons (place files in /public) */}
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/android-chrome-192x192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/android-chrome-512x512.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#000000" />
        <link rel="icon" type="image/png" href="/favicon_symbol.png" />
        <link
          rel="icon"
          type="image/png"
          href="/favicon_symbol-dark.png"
          media="(prefers-color-scheme: dark)"
        />
        <meta name="theme-color" content="#000000" />
      </Head>

      <BusinessWebsite />
    </>
  );
}
TSX

# --- components/BusinessWebsite.tsx (from your current canvas, Helmet removed) ---
cat > components/BusinessWebsite.tsx <<'TSX'
import React, { useState } from "react";

export default function BusinessWebsite() {
  const [open, setOpen] = useState(false);

  const navItems = [
    { label: "Home", href: "#home" },
    { label: "Services", href: "#services" },
    { label: "About", href: "#about" },
    { label: "Testimonials", href: "#testimonials" },
    { label: "Contact", href: "#contact" }
  ];

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white/90 border-b border-neutral-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <a href="#home" className="flex items-center gap-2 font-semibold text-lg">
              <img src="/logo.png" alt="X Dragon Technologies logo" className="h-10 w-auto" />
              <span>X Dragon Technologies</span>
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
                Get a Quote
              </a>
            </nav>

            <button
              onClick={() => setOpen(!open)}
              className="md:hidden inline-flex items-center justify-center rounded-xl border border-neutral-300 p-2"
            >
              <span className="sr-only">Toggle menu</span>
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
                Get a Quote
              </a>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section id="home" className="relative">
        <div className="absolute inset-0 -z-10">
          <img
            src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2000&auto=format&fit=crop"
            alt="Hero background"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/50" />
        </div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-28 sm:py-36 text-white">
          <div className="max-w-3xl">
            <p className="mb-4 inline-block rounded-full bg-white/10 px-3 py-1 text-xs backdrop-blur">
              Locally owned • Est. 2025
            </p>
            <h1 className="text-4xl sm:text-6xl font-extrabold leading-tight">
              We help <span className="underline decoration-white/50">e-commerce brands</span> achieve amazing results.
            </h1>
            <p className="mt-5 text-lg text-white/90">
              X Dragon provides leading AI consulting as well as Infrastructure Management for E-commerce operators.
              We help bridge the gaps between organizations who want to focus on marketing and business development
              and don’t want to carry the technical expertise to manage those parts of the business.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#contact" className="rounded-2xl bg-white text-black px-5 py-3 text-sm font-semibold">
                Book a Consultation
              </a>
              <a href="#services" className="rounded-2xl border border-white/70 px-5 py-3 text-sm font-semibold">
                See Services
              </a>
            </div>
            <div className="mt-8 flex items-center gap-6 text-sm text-white/80">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Fast turnaround
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Transparent delivery
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Operator-first support
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Logos / Social proof */}
      <section className="bg-white py-10 border-y border-neutral-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm font-medium text-neutral-600">Trusted by teams like</p>
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-6 opacity-70">
            {["Acme", "Nimbus", "NorthPeak", "Evergreen", "Quartz", "Bluebird"].map((brand) => (
              <div key={brand} className="h-10 rounded-xl bg-neutral-100 grid place-items-center text-xs font-semibold">
                {brand}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-bold">Services</h2>
            <p className="mt-3 text-neutral-600">
              Done-for-you AI, infrastructure, and automation services built specifically for e-commerce teams that
              want reliability, speed, and scale.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "AI Strategy & Consulting",
                desc: "Identify high-impact AI use cases, map your data, and build roadmaps that drive revenue and efficiency."
              },
              {
                title: "Infrastructure Management",
                desc: "Keep your stack fast, stable, and secure—monitoring, patching, and optimizing so your store stays online."
              },
              {
                title: "Automation & Data Pipelines",
                desc: "Replace manual work with reliable automations and data flows so your team can focus on growth."
              }
            ].map((svc, i) => (
              <div key={i} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="h-12 w-12 rounded-xl bg-black text-white grid place-items-center font-bold">{i + 1}</div>
                <h3 className="mt-4 text-xl font-semibold">{svc.title}</h3>
                <p className="mt-2 text-neutral-600">{svc.desc}</p>
                <a href="#contact" className="mt-6 inline-block rounded-xl bg-black text-white px-4 py-2 text-sm font-semibold">
                  Get Started
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How We Work */}
      <section id="process" className="py-20 bg-neutral-50 border-y border-neutral-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold">How We Work</h2>
            <p className="mt-3 text-neutral-600">A simple, transparent approach that keeps your business moving fast.</p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {["Discovery", "Audit", "Implementation", "Ongoing Support"].map((phase, i) => (
              <div key={i} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="h-12 w-12 rounded-xl bg-black text-white grid place-items-center font-bold">{i + 1}</div>
                <h3 className="mt-4 text-xl font-semibold">{phase}</h3>
                <p className="mt-2 text-neutral-600">Placeholder text — refine later.</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Case Study */}
      <section id="case-study" className="py-20 bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold">Case Study</h2>
            <p className="mt-4 text-neutral-700">Placeholder — you’ll refine with real client results later.</p>
            <ul className="mt-6 space-y-2 text-neutral-700 text-sm">
              <li>• Key challenge here</li>
              <li>• What X Dragon delivered</li>
              <li>• The before → after impact</li>
            </ul>
          </div>
          <div>
            <img
              src="https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=1600&auto=format&fit=crop"
              alt="Case study placeholder"
              className="rounded-2xl shadow"
            />
          </div>
        </div>
      </section>

      {/* Metrics Strip */}
      <section className="bg-black text-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-3 text-center">
            <div>
              <div className="text-3xl sm:text-4xl font-extrabold">99.9%</div>
              <div className="mt-2 text-sm text-white/80">Infra uptime across managed stacks</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-extrabold">30%+</div>
              <div className="mt-2 text-sm text-white/80">Average reduction in manual ops work</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-extrabold">24/7</div>
              <div className="mt-2 text-sm text-white/80">Monitoring & support options</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-black text-white px-8 py-10 sm:px-10 sm:py-12 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold">Let’s solve your toughest problems.</h2>
              <p className="mt-3 text-sm sm:text-base text-white/80">
                Bring us your gnarliest AI, infra, or automation issues and we’ll help you chart a clear path forward.
              </p>
            </div>
            <a href="#contact" className="inline-flex items-center justify-center rounded-2xl bg-white text-black px-6 py-3 text-sm font-semibold">
              Talk to X Dragon
            </a>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-bold">Contact Us</h2>
            <p className="mt-3 text-neutral-600">
              Tell us how your e-commerce stack runs today and where it hurts. We’ll follow up with next steps within one business day.
            </p>
          </div>

          <div className="mt-8 grid lg:grid-cols-2 gap-8">
            <form className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <input type="text" className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black" placeholder="Jane Doe" />
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <input type="email" className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black" placeholder="you@example.com" />
                </div>
              </div>

              <div className="mt-4">
                <label className="text-sm font-medium">Message</label>
                <textarea className="mt-1 w-full rounded-xl border border-neutral-300 p-3 h-32 focus:outline-none focus:ring-2 focus:ring-black" placeholder="What would you like to achieve?" />
              </div>

              <button type="submit" className="mt-6 w-full rounded-2xl bg-black text-white px-4 py-3 text-sm font-semibold">
                Send Message
              </button>
            </form>

            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold">Email us</h3>
              <p className="mt-2 text-neutral-700"><strong>hello@xdragontech.com</strong></p>
              <p className="mt-4 text-sm text-neutral-600">
                Replace address/phone/social links any time — this is placeholder content.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-neutral-600">© {new Date().getFullYear()} X Dragon Technologies. All rights reserved.</p>
          <div className="flex items-center gap-6 text-sm">
            <a href="#" className="hover:underline">Privacy</a>
            <a href="#" className="hover:underline">Terms</a>
            <a href="#contact" className="rounded-xl bg-black text-white px-4 py-2 text-sm font-semibold">Get a Quote</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
TSX

# --- Setup script (optional helper) ---
cat > setup_macos.sh <<'SH'
#!/usr/bin/env bash
set -e

echo "🔧 X Dragon – macOS setup"

if [ ! -f "package.json" ]; then
  echo "❌ Run this from the project root (where package.json is)."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "🟢 Node.js not found. Install Node (recommended via Homebrew):"
  echo "   brew install node"
  exit 1
fi

echo "📦 Installing dependencies..."
npm install

echo "🚀 Starting dev server at http://localhost:3000"
npm run dev
SH
chmod +x setup_macos.sh

# --- Copy assets into /public if you place them in ./assets ---
# Put these files into: ~/Projects/xdragon-site/assets/
#  - logo.png
#  - favicon_symbol.png, favicon_symbol-dark.png, favicon-32x32.png, etc.
if [ -f "assets/logo.png" ]; then
  cp -f assets/logo.png public/logo.png
  echo "✅ Copied assets/logo.png -> public/logo.png"
else
  echo "⚠️  No assets/logo.png found yet. Add it later to show your logo."
fi

for f in favicon_symbol.png favicon_symbol-dark.png favicon-32x32.png android-chrome-192x192.png android-chrome-512x512.png apple-touch-icon.png safari-pinned-tab.svg; do
  if [ -f "assets/$f" ]; then
    cp -f "assets/$f" "public/$f"
    echo "✅ Copied assets/$f -> public/$f"
  fi
done

echo ""
echo "✅ Project created."
echo "Next:"
echo "  cd ${PROJECT_DIR}"
echo "  npm install"
echo "  npm run dev"
echo "Open: http://localhost:3000"

