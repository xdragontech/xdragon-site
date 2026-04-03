import BrandHead from "../../components/BrandHead";
import PublicSiteHeader from "../../components/PublicSiteHeader";
import PublicSiteShell from "../../components/app/PublicSiteShell";

const participantLinks = [
  {
    href: "/partners/signup",
    label: "Participant Partner Signup",
    description: "Create a new participant partner account for entertainment, food, or market partners.",
  },
  {
    href: "/partners/signin",
    label: "Participant Partner Sign In",
    description: "Sign in to the participant partner portal.",
  },
  {
    href: "/partners/profile",
    label: "Participant Partner Profile",
    description: "Open the participant partner profile page after signing in.",
  },
  {
    href: "/partners/applications",
    label: "Participant Applications",
    description: "Open the participant partner application page after signing in.",
  },
] as const;

const sponsorLinks = [
  {
    href: "/sponsors/signup",
    label: "Sponsor Signup",
    description: "Create a new sponsor account for the current brand.",
  },
  {
    href: "/sponsors/signin",
    label: "Sponsor Sign In",
    description: "Sign in to the sponsor portal.",
  },
  {
    href: "/sponsors/profile",
    label: "Sponsor Profile",
    description: "Open the sponsor profile page after signing in.",
  },
  {
    href: "/sponsors/applications",
    label: "Sponsor Applications",
    description: "Open the sponsor application page after signing in.",
  },
] as const;

function PortalLinkSection(props: {
  title: string;
  subtitle: string;
  links: ReadonlyArray<{
    href: string;
    label: string;
    description: string;
  }>;
}) {
  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="grid gap-3">
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">{props.title}</h2>
        <p className="max-w-2xl text-sm leading-6 text-neutral-600">{props.subtitle}</p>
      </div>
      <div className="mt-6 grid gap-4">
        {props.links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="rounded-2xl border border-neutral-200 bg-neutral-50 px-5 py-4 transition hover:border-neutral-300 hover:bg-white"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="grid gap-1">
                <span className="text-sm font-semibold text-neutral-950">{link.label}</span>
                <span className="text-sm leading-6 text-neutral-600">{link.description}</span>
              </div>
              <span className="text-sm font-medium text-red-600">Open</span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

export default function PartnersHubPage() {
  return (
    <PublicSiteShell>
      <BrandHead
        title="X Dragon Technologies — Partner Portals"
        description="Partner and sponsor portal entry points for signup, sign in, profile, and application testing."
      />

      <div className="min-h-screen bg-neutral-100 text-neutral-950">
        <PublicSiteHeader />

        <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <section className="rounded-[2rem] border border-neutral-200 bg-white px-6 py-8 shadow-sm sm:px-8 sm:py-10">
            <div className="grid gap-4">
              <span className="text-sm font-semibold uppercase tracking-[0.22em] text-red-600">Partner Access</span>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-neutral-950 sm:text-5xl">
                Partner and sponsor portal links in one place.
              </h1>
              <p className="max-w-3xl text-base leading-7 text-neutral-600">
                This page exists so testing does not depend on remembering raw routes. Use it to open partner and sponsor
                signup, sign-in, profile, and application surfaces directly.
              </p>
            </div>
          </section>

          <PortalLinkSection
            title="Participant Partners"
            subtitle="Entertainment, food, and market partners register here and then manage profile and application flows through the participant portal."
            links={participantLinks}
          />

          <PortalLinkSection
            title="Sponsors"
            subtitle="Sponsors use a separate portal with their own signup and sign-in path, plus profile and application pages."
            links={sponsorLinks}
          />
        </main>
      </div>
    </PublicSiteShell>
  );
}
