import { createHash } from "crypto";
import { authCookieDomain, canonicalAdminHost, canonicalPublicHost, getAllowedHosts, getBrandSiteConfig } from "../siteConfig";

type EnvValueKind = "plain" | "secret" | "databaseUrl";

type EnvItemDescriptor = {
  key: string;
  label: string;
  description: string;
  kind: EnvValueKind;
};

export type SystemEnvItem = {
  key: string;
  label: string;
  description: string;
  kind: EnvValueKind;
  status: "present" | "missing";
  value: string;
  fingerprint?: string | null;
  meta?: Array<{ label: string; value: string }>;
};

export type SystemEnvGroup = {
  key: string;
  title: string;
  description: string;
  items: SystemEnvItem[];
};

export type RuntimeStatusItem = {
  label: string;
  value: string;
  note?: string;
};

const ENV_GROUPS: Array<{
  key: string;
  title: string;
  description: string;
  items: EnvItemDescriptor[];
}> = [
  {
    key: "runtime",
    title: "Runtime & Deployment",
    description: "Raw server-side runtime values from the current request environment.",
    items: [
      { key: "NODE_ENV", label: "Node Environment", description: "Server runtime mode.", kind: "plain" },
      { key: "VERCEL_ENV", label: "Vercel Environment", description: "Deployment scope for this runtime.", kind: "plain" },
      { key: "VERCEL_URL", label: "Vercel URL", description: "Runtime deployment hostname when set by Vercel.", kind: "plain" },
      { key: "VERCEL_REGION", label: "Vercel Region", description: "Serverless function region for this runtime.", kind: "plain" },
      {
        key: "VERCEL_GIT_COMMIT_REF",
        label: "Git Branch",
        description: "Git ref attached to this deployment, when available.",
        kind: "plain",
      },
      {
        key: "VERCEL_GIT_COMMIT_SHA",
        label: "Git Commit SHA",
        description: "Git commit attached to this deployment, when available.",
        kind: "plain",
      },
    ],
  },
  {
    key: "brand",
    title: "Brand & Host Config",
    description: "Brand and host variables expected to define routing and canonical URLs.",
    items: [
      { key: "BRAND_KEY", label: "Brand Key", description: "External-safe brand identifier.", kind: "plain" },
      { key: "NEXT_PUBLIC_BRAND_NAME", label: "Brand Name", description: "Public brand label.", kind: "plain" },
      { key: "NEXT_PUBLIC_APEX_HOST", label: "Apex Host", description: "Apex/root host for the brand.", kind: "plain" },
      {
        key: "NEXT_PUBLIC_PROD_WWW_HOST",
        label: "Production Public Host",
        description: "Canonical production public hostname.",
        kind: "plain",
      },
      {
        key: "NEXT_PUBLIC_PROD_ADMIN_HOST",
        label: "Production Admin Host",
        description: "Canonical production admin hostname.",
        kind: "plain",
      },
      {
        key: "NEXT_PUBLIC_WWW_HOST",
        label: "Preview Public Host",
        description: "Canonical preview/staging public hostname.",
        kind: "plain",
      },
      {
        key: "NEXT_PUBLIC_ADMIN_HOST",
        label: "Preview Admin Host",
        description: "Canonical preview/staging admin hostname.",
        kind: "plain",
      },
      {
        key: "AUTH_COOKIE_DOMAIN",
        label: "Auth Cookie Domain",
        description: "Cookie domain override for auth sessions.",
        kind: "plain",
      },
      {
        key: "NEXTAUTH_URL",
        label: "NextAuth URL",
        description: "Absolute auth base URL used by backoffice/public auth flows.",
        kind: "plain",
      },
      {
        key: "NEXTAUTH_SECRET",
        label: "NextAuth Secret",
        description: "Secret used to sign NextAuth cookies and tokens.",
        kind: "secret",
      },
    ],
  },
  {
    key: "admin",
    title: "Backoffice Auth & Access",
    description: "Backoffice login and admin access settings currently used by the app.",
    items: [
      {
        key: "XDADMIN_USERNAME",
        label: "Primary Admin Username",
        description: "Credential username for the bootstrap admin account.",
        kind: "plain",
      },
      {
        key: "XDADMIN_EMAIL",
        label: "Primary Admin Email",
        description: "Email for the bootstrap admin account.",
        kind: "plain",
      },
      {
        key: "XDADMIN_PASSWORD",
        label: "Primary Admin Password",
        description: "Password for the bootstrap admin account.",
        kind: "secret",
      },
      {
        key: "ADMIN_EMAILS",
        label: "Admin Emails",
        description: "Comma-separated admin allowlist used by current auth logic.",
        kind: "plain",
      },
      {
        key: "ADMIN_EMAIL_LIST",
        label: "Admin Email List",
        description: "Legacy alias for admin allowlist input.",
        kind: "plain",
      },
      {
        key: "ADMIN_USERS",
        label: "Admin Users",
        description: "Legacy alias for admin allowlist input.",
        kind: "plain",
      },
    ],
  },
  {
    key: "services",
    title: "Data & Service Integrations",
    description: "Database and external service credentials used by runtime flows.",
    items: [
      {
        key: "DATABASE_URL",
        label: "Database URL",
        description: "Primary Postgres connection string for Prisma/runtime queries.",
        kind: "databaseUrl",
      },
      {
        key: "OPENAI_API_KEY",
        label: "OpenAI API Key",
        description: "Credential used by the public chat endpoint.",
        kind: "secret",
      },
      {
        key: "RESEND_API_KEY",
        label: "Resend API Key",
        description: "Credential used for transactional email sends.",
        kind: "secret",
      },
      {
        key: "RESEND_FROM",
        label: "Resend From",
        description: "Preferred sender identity for Resend emails.",
        kind: "plain",
      },
      {
        key: "RESEND_FROM_EMAIL",
        label: "Resend From Email",
        description: "Sender email alias used by contact/chat flows.",
        kind: "plain",
      },
      {
        key: "CONTACT_FROM_EMAIL",
        label: "Contact From Email",
        description: "Fallback sender email for contact/chat flows.",
        kind: "plain",
      },
      {
        key: "EMAIL_FROM",
        label: "Email From",
        description: "Legacy sender fallback used by auth/contact flows.",
        kind: "plain",
      },
      {
        key: "RESEND_TO_EMAIL",
        label: "Resend To Email",
        description: "Preferred recipient for internal notifications.",
        kind: "plain",
      },
      {
        key: "CONTACT_TO_EMAIL",
        label: "Contact To Email",
        description: "Fallback notification recipient for contact/chat flows.",
        kind: "plain",
      },
      {
        key: "CONTACT_TO",
        label: "Contact To",
        description: "Legacy notification recipient fallback.",
        kind: "plain",
      },
      {
        key: "UPSTASH_REDIS_REST_URL",
        label: "Upstash Redis REST URL",
        description: "Optional Redis endpoint for rate limiting and event logging.",
        kind: "plain",
      },
      {
        key: "UPSTASH_REDIS_REST_TOKEN",
        label: "Upstash Redis REST Token",
        description: "Optional Redis token for rate limiting and event logging.",
        kind: "secret",
      },
    ],
  },
];

function getEnvValue(key: string): string | null {
  const raw = process.env[key];
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return value ? value : null;
}

function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function summarizeSecret(value: string): Pick<SystemEnvItem, "value" | "fingerprint" | "meta"> {
  return {
    value: `Configured (${value.length} chars)`,
    fingerprint: fingerprint(value),
    meta: [{ label: "Fingerprint", value: fingerprint(value) }],
  };
}

export type DatabaseUrlSummary = {
  maskedValue: string;
  fingerprint: string;
  host?: string | null;
  database?: string | null;
  port?: string | null;
  protocol?: string | null;
  parseError?: string | null;
};

export function summarizeDatabaseUrl(value: string | null): DatabaseUrlSummary | null {
  if (!value) return null;

  const urlFingerprint = fingerprint(value);

  try {
    const parsed = new URL(value);
    const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, "")) || null;
    const port = parsed.port || null;

    return {
      maskedValue: `${parsed.protocol}//***@${parsed.hostname}${port ? `:${port}` : ""}${database ? `/${database}` : ""}`,
      fingerprint: urlFingerprint,
      host: parsed.hostname || null,
      database,
      port,
      protocol: parsed.protocol.replace(/:$/, "") || null,
      parseError: null,
    };
  } catch (error) {
    return {
      maskedValue: "Configured (unparseable URL)",
      fingerprint: urlFingerprint,
      parseError: error instanceof Error ? error.message : "Unknown parse error",
    };
  }
}

function summarizeDatabaseEnv(value: string): Pick<SystemEnvItem, "value" | "fingerprint" | "meta"> {
  const summary = summarizeDatabaseUrl(value);
  if (!summary) return { value: "Not set" };

  const meta: Array<{ label: string; value: string }> = [{ label: "Fingerprint", value: summary.fingerprint }];
  if (summary.protocol) meta.push({ label: "Protocol", value: summary.protocol });
  if (summary.host) meta.push({ label: "Host", value: summary.host });
  if (summary.port) meta.push({ label: "Port", value: summary.port });
  if (summary.database) meta.push({ label: "Database", value: summary.database });
  if (summary.parseError) meta.push({ label: "Parse Error", value: summary.parseError });

  return {
    value: summary.maskedValue,
    fingerprint: summary.fingerprint,
    meta,
  };
}

function summarizeEnvItem(descriptor: EnvItemDescriptor): SystemEnvItem {
  const value = getEnvValue(descriptor.key);
  if (!value) {
    return {
      key: descriptor.key,
      label: descriptor.label,
      description: descriptor.description,
      kind: descriptor.kind,
      status: "missing",
      value: "Not set",
    };
  }

  if (descriptor.kind === "secret") {
    const secretSummary = summarizeSecret(value);
    return {
      key: descriptor.key,
      label: descriptor.label,
      description: descriptor.description,
      kind: descriptor.kind,
      status: "present",
      value: secretSummary.value,
      fingerprint: secretSummary.fingerprint,
      meta: secretSummary.meta,
    };
  }

  if (descriptor.kind === "databaseUrl") {
    const dbSummary = summarizeDatabaseEnv(value);
    return {
      key: descriptor.key,
      label: descriptor.label,
      description: descriptor.description,
      kind: descriptor.kind,
      status: "present",
      value: dbSummary.value,
      fingerprint: dbSummary.fingerprint,
      meta: dbSummary.meta,
    };
  }

  return {
    key: descriptor.key,
    label: descriptor.label,
    description: descriptor.description,
    kind: descriptor.kind,
    status: "present",
    value,
  };
}

export function collectSystemEnvGroups(): SystemEnvGroup[] {
  return ENV_GROUPS.map((group) => ({
    key: group.key,
    title: group.title,
    description: group.description,
    items: group.items.map(summarizeEnvItem),
  }));
}

export function collectRuntimeStatus(requestHost?: string | null): RuntimeStatusItem[] {
  const host = requestHost || "unknown";
  return [
    {
      label: "Request Host",
      value: host,
      note: "Host observed for this page request.",
    },
    {
      label: "Request Timestamp",
      value: new Date().toISOString(),
      note: "Generated on the server during this request.",
    },
    {
      label: "Canonical Admin Host",
      value: canonicalAdminHost(requestHost || undefined),
      note: "Derived from current host plus runtime host config.",
    },
    {
      label: "Canonical Public Host",
      value: canonicalPublicHost(requestHost || undefined),
      note: "Derived from current host plus runtime host config.",
    },
  ];
}

export function collectDerivedRuntimeConfig(): RuntimeStatusItem[] {
  const cfg = getBrandSiteConfig();
  return [
    {
      label: "Resolved Brand Key",
      value: cfg.brandKey,
      note: "This is the runtime-resolved value the app will use, including code defaults.",
    },
    {
      label: "Resolved Brand Name",
      value: cfg.brandName,
      note: "This is the runtime-resolved value the app will use, including code defaults.",
    },
    {
      label: "Resolved Apex Host",
      value: cfg.apexHost,
      note: "This is the runtime-resolved value the app will use, including code defaults.",
    },
    {
      label: "Allowed Hosts",
      value: Array.from(getAllowedHosts()).join(", "),
      note: "Requests outside this set are not expected to resolve cleanly.",
    },
    {
      label: "Auth Cookie Domain",
      value: authCookieDomain() || "Unset",
      note: "Production-only by current runtime logic.",
    },
  ];
}
