import type { CommandPartnerPortalScope } from "../../lib/commandPublicApi";

export type PortalConfig = {
  scope: CommandPartnerPortalScope;
  title: string;
  subtitle: string;
  signupHeading: string;
  signupDescription: string;
  signinHeading: string;
  signinDescription: string;
  verifyHeading: string;
  verifyRedirectPath: string;
  profileHeading: string;
  applicationsHeading: string;
  signupLinkLabel: string;
  signinLinkLabel: string;
  brandNameLabel: string;
  applicationCtaLabel: string;
};

export const PORTAL_CONFIG: Record<CommandPartnerPortalScope, PortalConfig> = {
  partners: {
    scope: "partners",
    title: "Participant Partner Portal",
    subtitle: "Participant partners can manage their profile and submit event applications.",
    signupHeading: "Create participant partner account",
    signupDescription: "Register as entertainment, food, or market partner for the current brand.",
    signinHeading: "Participant partner sign in",
    signinDescription: "Sign in to manage your profile and submit event applications.",
    verifyHeading: "Participant partner email verification",
    verifyRedirectPath: "/partners/signin",
    profileHeading: "Participant Partner Profile",
    applicationsHeading: "Participant Event Applications",
    signupLinkLabel: "Create partner account",
    signinLinkLabel: "Participant sign in",
    brandNameLabel: "Display name",
    applicationCtaLabel: "Submit participant application",
  },
  sponsors: {
    scope: "sponsors",
    title: "Sponsor Portal",
    subtitle: "Sponsors can manage their profile and submit event applications.",
    signupHeading: "Create sponsor account",
    signupDescription: "Register a sponsor account for the current brand and submit per-event applications.",
    signinHeading: "Sponsor sign in",
    signinDescription: "Sign in to manage sponsor profile details and event applications.",
    verifyHeading: "Sponsor email verification",
    verifyRedirectPath: "/sponsors/signin",
    profileHeading: "Sponsor Profile",
    applicationsHeading: "Sponsor Event Applications",
    signupLinkLabel: "Create sponsor account",
    signinLinkLabel: "Sponsor sign in",
    brandNameLabel: "Brand name",
    applicationCtaLabel: "Submit sponsor application",
  },
};

export const SOCIAL_LINK_FIELDS = [
  "instagram",
  "youtube",
  "soundcloud",
  "spotify",
  "facebook",
  "linkedin",
  "x",
  "tiktok",
] as const;
