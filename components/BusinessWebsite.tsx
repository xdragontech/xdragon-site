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

            {/* Mobile menu button (border + hamburger lines) */}
            <button
              onClick={() => setOpen(!open)}
              className="md:hidden inline-flex items-center justify-center rounded-xl border border-neutral-300 p-2"
              aria-label="Toggle menu"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 text-neutral-900"
              >
                <path d="M4 6h16" />
                <path d="M4 12h16" />
                <path d="M4 18h16" />
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

      {/* Hero */}
      <section id="home" className="relative isolate min-h-[calc(100svh-4rem)] flex items-center">
        {/* Background */}
        <div className="absolute inset-0 -z-10">
          <img
            src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2000&auto=format&fit=crop"
            alt="Hero background"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/65 to-black/80" />
        </div>

        {/* Content */}
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-white">
          <div className="mx-auto w-full max-w-3xl rounded-3xl bg-black/35 backdrop-blur-sm p-6 sm:p-10 text-center sm:text-left">
            <h1 className="text-4xl sm:text-6xl font-extrabold leading-tight [text-shadow:0_6px_24px_rgba(0,0,0,0.55)]">
              Stop firefighting.
              <span className="block">Start scaling.</span>
              <span className="block">
                Unleash the{" "}
                <span
                  style={{ fontFamily: "Orbitron, ui-sans-serif, system-ui", fontWeight: 700 }}
                  className="text-neutral-900 underline decoration-neutral-400 [text-shadow:0_6px_18px_rgba(120,120,120,0.75)]"
                >
                  Dragon
                </span>
                .
              </span>
            </h1>

            <p className="mt-5 text-lg text-white/90 [text-shadow:0_4px_16px_rgba(0,0,0,0.45)]">
              We solve the AI and infrastructure bottlenecks that weigh down high-performing businesses — so you move
              faster, deliver better, and grow with confidence.
            </p>

            <div className="mt-8 flex flex-wrap gap-3 justify-center sm:justify-start">
              <a href="#contact" className="rounded-2xl bg-white text-black px-5 py-3 text-sm font-semibold">
                Book a Consultation
              </a>
              <a href="#services" className="rounded-2xl border border-white/70 px-5 py-3 text-sm font-semibold">
                See Services
              </a>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-6 justify-center sm:justify-start text-sm text-white/80">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Amplify Your Resources
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Optimize Your Workflows
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Measure Your Results
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
                desc: "We help you identify high-impact AI use cases, map your data, and design practical roadmaps that drive revenue and operational efficiency.",
                bullets: [
                  "Maximize Returns: High-impact projects with clear payback deliver results in months.",
                  "Tailored Problem-Solving: We dive into your challenges and craft solutions to improve performance and customer satisfaction.",
                  "Quick Wins First: Early AI applications with high impact and low effort demonstrate fast ROI.",
                ],
              },
              {
                title: "Infrastructure Management",
                desc: "We keep your stack fast, stable, and secure—monitoring, patching, and optimizing so your store stays online and customers keep checking out.",
                bullets: [
                  "Downtime Protection = Profit Protection: Proactive monitoring saves thousands in lost sales.",
                  "Ready for Peak Demand: Auto-scaling ensures no crashes during high traffic.",
                  "Focus on Business, Not Servers: We manage everything behind the scenes.",
                ],
              },
              {
                title: "Automation & Data Pipelines",
                desc: "For teams that are drowning in manual tasks and fragmented tools—we build data flows and automations that free your people to focus on growth.",
                bullets: [
                  "Insight to Impact: Use real-time data to reduce waste and boost growth.",
                  "End-to-End Visibility: Eliminate data silos for a full-picture dashboard.",
                  "Scalable & Future-Proof: Add tools and sources as you grow with ease.",
                ],
              },
            ].map((svc, i) => (
              <div key={i} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="h-12 w-12 rounded-xl bg-black text-white grid place-items-center font-bold">{i + 1}</div>
                <h3 className="mt-4 text-xl font-semibold">{svc.title}</h3>
                <p className="mt-2 text-neutral-600">{svc.desc}</p>
                <ul className="mt-4 space-y-2 text-sm text-neutral-700">
                  {svc.bullets.map((b, idx) => {
                    const colon = b.indexOf(":");
                    if (colon === -1) return <li key={idx}>• {b}</li>;

                    const head = b.slice(0, colon + 1);
                    const rest = b.slice(colon + 1).trim();

                    return (
                      <li key={idx}>
                        • <span className="font-semibold text-neutral-900 underline underline-offset-2 decoration-neutral-400">{head}</span> {rest}
                      </li>
                    );
                  })}
                </ul>
                <a
                  href="#contact"
                  className="mt-6 inline-block rounded-xl bg-black text-white px-4 py-2 text-sm font-semibold"
                >
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
                <p className="mt-2 text-neutral-600">
                  Refine this description later—short explanation of what happens during this step.
                </p>
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
            <p className="mt-4 text-neutral-700">
              Placeholder case study text — you can refine this later with real client results and metrics.
            </p>
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

      {/* About */}
      <section id="about" className="py-20 bg-white border-y border-neutral-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold">About Us</h2>
            <p className="mt-4 text-neutral-700">
              X Dragon sits at the intersection of AI, cloud infrastructure, and e-commerce. We partner with operators
              who want enterprise-grade reliability and innovation—without hiring a full internal engineering team.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl bg-neutral-50 p-4 border border-neutral-200">
                <div className="text-3xl font-extrabold">10+</div>
                <div className="text-neutral-600">AI & Infra Experts</div>
              </div>
              <div className="rounded-xl bg-neutral-50 p-4 border border-neutral-200">
                <div className="text-3xl font-extrabold">500+</div>
                <div className="text-neutral-600">E-commerce Brands</div>
              </div>
            </div>
          </div>
          <div>
            <img
              src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=1600&auto=format&fit=crop"
              alt="Team at work"
              className="rounded-2xl shadow"
            />
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-bold">What Clients Say</h2>
            <p className="mt-3 text-neutral-600">
              Here’s what operators and founders say after handing us their AI and infrastructure headaches.
            </p>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                quote: "They nailed it—on time and on budget. Our results improved within weeks.",
                name: "Alex R.",
                role: "Operations Director, Nimbus",
              },
              {
                quote: "Professional, friendly, and genuinely invested in our success.",
                name: "Jamie L.",
                role: "Founder, Quartz Studio",
              },
              {
                quote: "Clear communication and excellent execution at every step.",
                name: "Priya S.",
                role: "Marketing Lead, Evergreen Co.",
              },
            ].map((t, i) => (
              <figure key={i} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <blockquote className="text-neutral-800">“{t.quote}”</blockquote>
                <figcaption className="mt-4 text-sm text-neutral-600">
                  — {t.name}, {t.role}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Engagement Models */}
      <section className="py-20 bg-white border-y border-neutral-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-bold">Engagement Models</h2>
            <p className="mt-3 text-neutral-600">
              Flexible ways to work with us—from focused advisory to ongoing, fully managed infrastructure and AI
              support.
            </p>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                name: "Advisory",
                features: ["Monthly strategy sessions", "AI & infra roadmap", "Implementation guidance"],
              },
              {
                name: "Managed",
                features: ["Ongoing infra monitoring", "Incident response & tuning", "Automation & reporting"],
              },
              {
                name: "Pro",
                features: [
                  "Custom SLAs & support",
                  "Deep integration with your team",
                  "Advanced AI, data, and infrastructure architecture",
                ],
              },
            ].map((p, i) => (
              <div key={i} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="text-sm font-semibold text-neutral-500">{p.name}</div>
                <ul className="mt-4 space-y-2 text-sm text-neutral-700">
                  {p.features.map((f, idx) => (
                    <li key={idx}>• {f}</li>
                  ))}
                </ul>
                <a
                  href="#contact"
                  className="mt-6 inline-block rounded-xl bg-black text-white px-4 py-2 text-sm font-semibold"
                >
                  Explore {p.name}
                </a>
              </div>
            ))}
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
            <a
              href="#contact"
              className="inline-flex items-center justify-center rounded-2xl bg-white text-black px-6 py-3 text-sm font-semibold"
            >
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
              Tell us how your e-commerce stack runs today and where it hurts. We’ll follow up with next steps and
              options within one business day.
            </p>
          </div>

          <div className="mt-8 grid lg:grid-cols-2 gap-8">
            <form className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                    placeholder="Jane Doe"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <input
                    type="email"
                    className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                    placeholder="you@example.com"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="text-sm font-medium">Phone (optional)</label>
                <input
                  type="tel"
                  className="mt-1 w-full rounded-xl border border-neutral-300 p-3 focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="mt-4">
                <label className="text-sm font-medium">Message</label>
                <textarea
                  className="mt-1 w-full rounded-xl border border-neutral-300 p-3 h-32 focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="What would you like to achieve?"
                />
              </div>
              <button
                type="submit"
                className="mt-6 w-full rounded-2xl bg-black text-white px-4 py-3 text-sm font-semibold"
              >
                Send Message
              </button>
              <p className="mt-3 text-xs text-neutral-500">By submitting, you agree to our friendly terms.</p>
            </form>

            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold">Visit Us</h3>
              <p className="mt-2 text-neutral-700">
                123 Sample Street, Suite 100
                <br />
                Your City, Your Province
              </p>
              <div className="mt-4 aspect-video w-full overflow-hidden rounded-xl border border-neutral-200">
                <img
                  src="https://images.unsplash.com/photo-1502920917128-1aa500764b8a?q=80&w=1600&auto=format&fit=crop"
                  alt="Map placeholder"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="mt-4 text-sm">
                <div>
                  <strong>Email:</strong> hello@xdragontech.com
                </div>
                <div>
                  <strong>Phone:</strong> (555) 987-6543
                </div>
                <div className="mt-2 flex gap-3">
                  <a className="underline" href="#">
                    Facebook
                  </a>
                  <a className="underline" href="#">
                    Instagram
                  </a>
                  <a className="underline" href="#">
                    LinkedIn
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-neutral-600">
            © {new Date().getFullYear()} X Dragon Technologies. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-sm">
            <a href="#" className="hover:underline">
              Privacy
            </a>
            <a href="#" className="hover:underline">
              Terms
            </a>
            <a href="#contact" className="rounded-xl bg-black text-white px-4 py-2 text-sm font-semibold">
              Get Started
            </a>
          </div>
        </div>
      </footer>

      {/*
        Test ideas (Jest + React Testing Library):
        - Renders hero headline and the word “Dragon”.
        - Nav renders expected anchors.
        - Mobile menu toggles open/closed.
      */}
    </div>
  );
}
