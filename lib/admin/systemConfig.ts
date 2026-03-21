import { createHash } from "crypto";
import { BackofficeRole, BackofficeUserStatus } from "@prisma/client";
import { getBackofficeMfaIssuer, isBackofficeMfaEncryptionReady } from "../backofficeMfa";
import {
  getBackofficeBootstrapPasswordEnvKey,
  getProtectedBackofficeEmail,
} from "../backofficeBootstrap";
import { authCookieDomain } from "../siteConfig";
import { getRuntimeHostConfig } from "../runtimeHostConfig";
import { prisma } from "../prisma";

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

type BootstrapDiagnostics = {
  user: null | {
    username: string;
    role: BackofficeRole;
    status: BackofficeUserStatus;
    mfaMethod: string | null;
    mfaEnabledAt: Date | null;
    lastLoginAt: Date | null;
    brandAccesses: Array<{ brandId: string }>;
  };
  configuredBrandCount: number;
  error: string | null;
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
    title: "Brand Bootstrap Inputs",
    description: "Legacy seed inputs used by brand bootstrap/sync tooling. Live host routing now resolves from Brand and BrandHost rows in the database.",
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
    ],
  },
  {
    key: "auth",
    title: "Auth Runtime Config",
    description: "Shared authentication settings used by backoffice and public auth flows.",
    items: [
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
      {
        key: "BACKOFFICE_MFA_ISSUER",
        label: "Backoffice MFA Issuer",
        description: "Issuer label used for authenticator-app enrollment.",
        kind: "plain",
      },
      {
        key: "BACKOFFICE_MFA_ENCRYPTION_KEY",
        label: "Backoffice MFA Encryption Key",
        description: "Encryption key required before authenticator-app secrets and recovery codes can be stored safely.",
        kind: "secret",
      },
      {
        key: getBackofficeBootstrapPasswordEnvKey(),
        label: "Bootstrap Superadmin Password",
        description: "Password source used only by explicit bootstrap ensure/recovery tooling for the protected bootstrap account.",
        kind: "secret",
      },
    ],
  },
  {
    key: "services",
    title: "Data & Service Integrations",
    description: "Database and external service credentials used by runtime flows.",
    items: [
      {
        key: "XD_POSTGRES",
        label: "Database URL (Primary)",
        description: "Primary Postgres connection string now used by Prisma and runtime database checks.",
        kind: "databaseUrl",
      },
      {
        key: "DATABASE_URL",
        label: "Database URL (Legacy / Integration)",
        description: "Observed for drift detection only. The app no longer treats this as the source of truth.",
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
        description: "Default Resend credential env var. Brand email configs can reference this key through providerSecretRef.",
        kind: "secret",
      },
      {
        key: "BRAND_EMAIL_PROVIDER_SECRET_REF",
        label: "Brand Email Provider Secret Ref",
        description: "Optional bootstrap override for the env key name used by the brand email sync workflow.",
        kind: "plain",
      },
      {
        key: "RESEND_FROM",
        label: "Resend From",
        description: "Bootstrap sender identity used by the brand email sync workflow.",
        kind: "plain",
      },
      {
        key: "RESEND_FROM_EMAIL",
        label: "Resend From Email",
        description: "Bootstrap sender email used by the brand email sync workflow.",
        kind: "plain",
      },
      {
        key: "CONTACT_FROM_EMAIL",
        label: "Contact From Email",
        description: "Legacy bootstrap sender email used by the brand email sync workflow.",
        kind: "plain",
      },
      {
        key: "EMAIL_FROM",
        label: "Email From",
        description: "Legacy bootstrap sender fallback used by the brand email sync workflow.",
        kind: "plain",
      },
      {
        key: "RESEND_TO_EMAIL",
        label: "Resend To Email",
        description: "Bootstrap internal notification recipient used by the brand email sync workflow.",
        kind: "plain",
      },
      {
        key: "CONTACT_TO_EMAIL",
        label: "Contact To Email",
        description: "Legacy bootstrap notification recipient used by the brand email sync workflow.",
        kind: "plain",
      },
      {
        key: "CONTACT_TO",
        label: "Contact To",
        description: "Legacy bootstrap notification recipient fallback used by the brand email sync workflow.",
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

export async function collectRuntimeStatus(requestHost?: string | null): Promise<RuntimeStatusItem[]> {
  const runtimeHost = await getRuntimeHostConfig(requestHost);
  const host = runtimeHost.requestHost || "unknown";
  const bootstrapPasswordKey = getBackofficeBootstrapPasswordEnvKey();
  const bootstrapPasswordPresent = Boolean(getEnvValue(bootstrapPasswordKey));
  const protectedBootstrapEmail = getProtectedBackofficeEmail();
  let bootstrapDiagnostics: BootstrapDiagnostics = {
    user: null,
    configuredBrandCount: 0,
    error: null,
  };

  try {
    const [bootstrapUser, configuredBrandCount] = await Promise.all([
      prisma.backofficeUser.findFirst({
        where: { email: protectedBootstrapEmail },
        select: {
          username: true,
          role: true,
          status: true,
          mfaMethod: true,
          mfaEnabledAt: true,
          lastLoginAt: true,
          brandAccesses: {
            select: {
              brandId: true,
            },
          },
        },
      }),
      prisma.brand.count(),
    ]);

    bootstrapDiagnostics = {
      user: bootstrapUser,
      configuredBrandCount,
      error: null,
    };
  } catch (error) {
    bootstrapDiagnostics = {
      user: null,
      configuredBrandCount: 0,
      error: error instanceof Error ? error.message : "Unknown database error",
    };
  }

  const bootstrapStatusValue = (() => {
    if (bootstrapDiagnostics.error) return "Unavailable";
    if (!bootstrapDiagnostics.user) return "Missing";
    if (bootstrapDiagnostics.user.role !== BackofficeRole.SUPERADMIN) return "Misconfigured role";
    if (bootstrapDiagnostics.user.status !== BackofficeUserStatus.ACTIVE) return "Inactive";
    return "Present";
  })();

  const bootstrapStatusNote = (() => {
    if (bootstrapDiagnostics.error) {
      return `Bootstrap account lookup failed: ${bootstrapDiagnostics.error}`;
    }

    if (!bootstrapDiagnostics.user) {
      return "Run the explicit bootstrap superadmin ensure command if this account is missing.";
    }

    const details = [
      `Username ${bootstrapDiagnostics.user.username}`,
      `Role ${bootstrapDiagnostics.user.role}`,
      `Status ${bootstrapDiagnostics.user.status}`,
      `MFA ${
        bootstrapDiagnostics.user.mfaEnabledAt
          ? "enabled"
          : bootstrapDiagnostics.user.mfaMethod
            ? "pending"
            : "not enabled"
      }`,
      `Explicit brand access ${bootstrapDiagnostics.user.brandAccesses.length}/${bootstrapDiagnostics.configuredBrandCount}`,
    ];

    if (bootstrapDiagnostics.user.lastLoginAt) {
      details.push(`Last login ${bootstrapDiagnostics.user.lastLoginAt.toISOString()}`);
    }

    return details.join(". ");
  })();

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
      label: "Brand Registry Resolution",
      value: runtimeHost.brandKey ? `Matched ${runtimeHost.brandKey}` : "No matching BrandHost",
      note: runtimeHost.brandKey
        ? "The current request host resolved through the database brand registry."
        : "The current request host is not mapped in BrandHost. Runtime host routing will not normalize it.",
    },
    {
      label: "Canonical Admin Host",
      value: runtimeHost.canonicalAdminHost || "Unresolved",
      note: runtimeHost.brandKey
        ? "Resolved from BrandHost rows for the current environment."
        : "Unresolved because there is no matching BrandHost row for this request host.",
    },
    {
      label: "Canonical Public Host",
      value: runtimeHost.canonicalPublicHost || "Unresolved",
      note: runtimeHost.brandKey
        ? "Resolved from BrandHost rows for the current environment."
        : "Unresolved because there is no matching BrandHost row for this request host.",
    },
    {
      label: "Allowed Hosts",
      value: runtimeHost.allowedHosts.length ? runtimeHost.allowedHosts.join(", ") : "None configured",
      note: "Loaded from BrandHost rows. The current request host is included so this diagnostics page can still reason about unmapped hosts.",
    },
    {
      label: "Auth Cookie Domain",
      value: authCookieDomain() || "Host-only",
      note: "Auth cookies are intentionally host-only so public and backoffice sessions do not depend on a shared subdomain cookie.",
    },
    {
      label: "Backoffice MFA Issuer",
      value: getBackofficeMfaIssuer(),
      note: "Authenticator-app issuer label that will be used for staff MFA enrollment.",
    },
    {
      label: "Backoffice MFA Encryption",
      value: isBackofficeMfaEncryptionReady() ? "Ready" : "Missing key",
      note: "A dedicated encryption key is required before authenticator secrets and recovery codes can be activated.",
    },
    {
      label: "Bootstrap Superadmin Identity",
      value: protectedBootstrapEmail,
      note: "Protected bootstrap backoffice identity for this installation.",
    },
    {
      label: "Bootstrap Password Source",
      value: bootstrapPasswordPresent ? `${bootstrapPasswordKey} present` : `${bootstrapPasswordKey} missing`,
      note: "Used only by explicit bootstrap ensure/recovery tooling. Deploy startup does not consume it.",
    },
    {
      label: "Bootstrap Superadmin Status",
      value: bootstrapStatusValue,
      note: bootstrapStatusNote,
    },
  ];
}
