// pages/api/auth/[...nextauth].ts
import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getRuntimeAllowedHosts } from "../../../lib/brandRegistry";
import { authCookieDomain } from "../../../lib/siteConfig";
import {
  BACKOFFICE_AUTH_SCOPE,
  BACKOFFICE_CREDENTIALS_PROVIDER_ID,
  EXTERNAL_AUTH_SCOPE,
  EXTERNAL_CREDENTIALS_PROVIDER_ID,
  EXTERNAL_LEGACY_AUTH_SCOPE,
} from "../../../lib/authScopes";
import {
  authorizeBackofficeCredentials,
  refreshBackofficeIdentity,
} from "../../../lib/backofficeIdentity";
import { authorizeExternalCredentials, refreshExternalIdentity } from "../../../lib/externalIdentity";

const IS_PREVIEW = process.env.VERCEL_ENV === "preview";

function cookieName(kind: "session-token" | "callback-url"): string {
  return IS_PREVIEW ? `__Secure-stg-next-auth.${kind}` : `__Secure-next-auth.${kind}`;
}

function csrfCookieName(): string {
  return IS_PREVIEW ? "stg-next-auth.csrf-token" : "next-auth.csrf-token";
}

function cookieDomain(): string | undefined {
  return authCookieDomain();
}

function cookieOptions({ httpOnly = true }: { httpOnly?: boolean } = {}) {
  return {
    httpOnly,
    sameSite: "lax" as const,
    path: "/",
    secure: true,
    ...(cookieDomain() ? { domain: cookieDomain() } : {}),
  };
}

export const authOptions: NextAuthOptions = {
  // Credentials sign-in requires JWT strategy in NextAuth v4.
  session: { strategy: "jwt" },

  secret: process.env.NEXTAUTH_SECRET,
  useSecureCookies: true,

  // Keep the default user sign-in page. Admin routes should redirect to /admin/signin via middleware.
  pages: { signIn: "/auth/signin" },

  cookies: {
    sessionToken: {
      name: cookieName("session-token"),
      options: cookieOptions({ httpOnly: true }),
    },
    callbackUrl: {
      name: cookieName("callback-url"),
      options: cookieOptions({ httpOnly: true }),
    },
    csrfToken: {
      // Use a non-__Host cookie so we can share across subdomains in production when desired.
      name: csrfCookieName(),
      options: cookieOptions({ httpOnly: true }),
    },
  },

  providers: [
    CredentialsProvider({
      id: EXTERNAL_CREDENTIALS_PROVIDER_ID,
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        return authorizeExternalCredentials(credentials, req as NextApiRequest);
      },
    }),
    CredentialsProvider({
      id: BACKOFFICE_CREDENTIALS_PROVIDER_ID,
      name: "Backoffice Credentials",
      credentials: {
        email: { label: "Username or email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        return authorizeBackofficeCredentials(credentials);
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const backofficeMfaState = (user as any).authScope === BACKOFFICE_AUTH_SCOPE ? (user as any).mfaState || "DISABLED" : "DISABLED";
        token.sub = user.id;
        token.email = user.email;
        token.name = user.name;
        (token as any).role = (user as any).role;
        (token as any).status = (user as any).status;
        (token as any).authScope = (user as any).authScope;
        (token as any).backofficeRole = (user as any).backofficeRole || null;
        (token as any).mfaMethod = (user as any).mfaMethod || null;
        (token as any).mfaState = (user as any).mfaState || "DISABLED";
        (token as any).mfaEnabledAt = (user as any).mfaEnabledAt || null;
        (token as any).brandKey = (user as any).brandKey || null;
        (token as any).username = (user as any).username || null;
        (token as any).allowedBrandKeys = (user as any).allowedBrandKeys || [];
        (token as any).allowedBrandIds = (user as any).allowedBrandIds || [];
        (token as any).lastSelectedBrandKey = (user as any).lastSelectedBrandKey || null;
        (token as any).backofficeMfaChallenge =
          backofficeMfaState === "ENABLED" ? crypto.randomUUID() : null;
      }

      const authScope = (token as any).authScope;

      if (authScope === BACKOFFICE_AUTH_SCOPE) {
        const refreshed = await refreshBackofficeIdentity({
          sub: typeof token.sub === "string" ? token.sub : null,
          email: typeof token.email === "string" ? token.email : null,
        });

        if (!refreshed) {
          (token as any).status = "BLOCKED";
          (token as any).mfaMethod = null;
          (token as any).mfaState = "DISABLED";
          (token as any).mfaEnabledAt = null;
          (token as any).allowedBrandKeys = [];
          (token as any).allowedBrandIds = [];
          (token as any).backofficeMfaChallenge = null;
          return token;
        }

        token.sub = refreshed.id;
        token.email = refreshed.email;
        token.name = refreshed.name;
        (token as any).role = refreshed.role;
        (token as any).status = refreshed.status;
        (token as any).authScope = refreshed.authScope;
        (token as any).backofficeRole = refreshed.backofficeRole;
        (token as any).mfaMethod = refreshed.mfaMethod;
        (token as any).mfaState = refreshed.mfaState;
        (token as any).mfaEnabledAt = refreshed.mfaEnabledAt;
        (token as any).brandKey = null;
        (token as any).username = refreshed.username;
        (token as any).allowedBrandKeys = refreshed.allowedBrandKeys;
        (token as any).allowedBrandIds = refreshed.allowedBrandIds;
        (token as any).lastSelectedBrandKey = refreshed.lastSelectedBrandKey;
        (token as any).backofficeMfaChallenge =
          refreshed.mfaState === "ENABLED"
            ? (typeof (token as any).backofficeMfaChallenge === "string" && (token as any).backofficeMfaChallenge
                ? (token as any).backofficeMfaChallenge
                : crypto.randomUUID())
            : null;
        return token;
      }

      if (authScope === EXTERNAL_AUTH_SCOPE || authScope === EXTERNAL_LEGACY_AUTH_SCOPE) {
        const refreshed = await refreshExternalIdentity({
          sub: typeof token.sub === "string" ? token.sub : null,
          email: typeof token.email === "string" ? token.email : null,
          brandKey: typeof (token as any).brandKey === "string" ? (token as any).brandKey : null,
        });

        if (!refreshed) {
          (token as any).status = "BLOCKED";
          return token;
        }

        token.sub = refreshed.id;
        token.email = refreshed.email;
        token.name = refreshed.name;
        (token as any).role = refreshed.role;
        (token as any).status = refreshed.status;
        (token as any).authScope = refreshed.authScope;
        (token as any).brandKey = refreshed.brandKey;
      }

      return token;
    },

    async session({ session, token }) {
      const sessionUser =
        session.user ??
        ((session as any).user = {
          name: null,
          email: null,
          image: null,
        });

      sessionUser.email = typeof token.email === "string" ? token.email : sessionUser.email;
      sessionUser.name = typeof token.name === "string" ? token.name : sessionUser.name;
      (sessionUser as any).id = typeof token.sub === "string" ? token.sub : undefined;
      (sessionUser as any).role = (token as any).role || "USER";
      (sessionUser as any).status = (token as any).status || "ACTIVE";
      (sessionUser as any).authScope = (token as any).authScope || null;
      (sessionUser as any).backofficeRole = (token as any).backofficeRole || null;
      (sessionUser as any).mfaMethod = (token as any).mfaMethod || null;
      (sessionUser as any).mfaState = (token as any).mfaState || "DISABLED";
      (sessionUser as any).mfaEnabledAt = (token as any).mfaEnabledAt || null;
      (sessionUser as any).backofficeMfaRequired =
        (token as any).authScope === BACKOFFICE_AUTH_SCOPE && (token as any).mfaState === "ENABLED";
      (sessionUser as any).backofficeMfaChallenge = (token as any).backofficeMfaChallenge || null;
      (sessionUser as any).brandKey = (token as any).brandKey || null;
      (sessionUser as any).username = (token as any).username || null;
      (sessionUser as any).allowedBrandKeys = Array.isArray((token as any).allowedBrandKeys)
        ? (token as any).allowedBrandKeys
        : [];
      (sessionUser as any).lastSelectedBrandKey = (token as any).lastSelectedBrandKey || null;

      (session as any).role = (token as any).role || "USER";
      (session as any).status = (token as any).status || "ACTIVE";
      (session as any).authScope = (token as any).authScope || null;
      (session as any).backofficeRole = (token as any).backofficeRole || null;
      (session as any).mfaMethod = (token as any).mfaMethod || null;
      (session as any).mfaState = (token as any).mfaState || "DISABLED";
      (session as any).mfaEnabledAt = (token as any).mfaEnabledAt || null;
      (session as any).backofficeMfaRequired =
        (token as any).authScope === BACKOFFICE_AUTH_SCOPE && (token as any).mfaState === "ENABLED";
      (session as any).backofficeMfaChallenge = (token as any).backofficeMfaChallenge || null;
      (session as any).brandKey = (token as any).brandKey || null;
      (session as any).allowedBrandKeys = Array.isArray((token as any).allowedBrandKeys)
        ? (token as any).allowedBrandKeys
        : [];
      (session as any).lastSelectedBrandKey = (token as any).lastSelectedBrandKey || null;
      return session;
    },

    async redirect({ url, baseUrl }) {
      // Prevent redirects to unexpected hosts while still allowing the configured public/admin hosts.
      try {
        if (url.startsWith("/")) return `${baseUrl}${url}`;

        const target = new URL(url);
        const host = target.hostname.toLowerCase();
        const baseHost = new URL(baseUrl).hostname.toLowerCase();

        const allowedHosts = await getRuntimeAllowedHosts([baseHost]);

        if (allowedHosts.has(host)) return url;
      } catch {
        // fall through
      }
      return baseUrl;
    },
  },

  logger: {
    error(code, metadata) {
      console.error("NextAuth error", code, metadata);
    },
    warn(code) {
      console.warn("NextAuth warn", code);
    },
  },
};

export default function auth(req: NextApiRequest, res: NextApiResponse) {
  return NextAuth(req, res, authOptions);
}
