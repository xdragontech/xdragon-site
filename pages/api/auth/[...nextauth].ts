// pages/api/auth/[...nextauth].ts
import type { NextApiRequest, NextApiResponse } from "next";
import NextAuth, { type NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import bcrypt from "bcryptjs";
import { prisma } from "../../../lib/prisma";

/**
 * X Dragon Tools Auth (Pages Router)
 *
 * Fixes:
 * - Password-based sign-in (Credentials)
 * - Optional Google/GitHub OAuth (only enabled when env vars are present)
 * - DB sessions (PrismaAdapter)
 * - User status/role checks (BLOCKED users denied, ADMIN allowlist)
 * - Canonical domain + cookie settings to avoid "signed in but session not established"
 *
 * Required env:
 * - NEXTAUTH_SECRET
 * - NEXTAUTH_URL = https://www.xdragon.tech
 * - DATABASE_URL
 *
 * Optional env:
 * - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
 * - GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
 * - ADMIN_EMAILS (comma-separated)
 */

function parseAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

function canonicalBaseUrl(fallback: string): string {
  return (process.env.NEXTAUTH_URL || fallback || "").replace(/\/+$/, "");
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  pages: { signIn: "/auth/signin" },
  secret: process.env.NEXTAUTH_SECRET,

  /**
   * IMPORTANT:
   * We set the session cookie Domain to ".xdragon.tech" so that if the user
   * ever lands on xdragon.tech and gets redirected to www.xdragon.tech, the
   * session still sticks. This avoids the "signed in but no session" loop.
   *
   * If you truly want host-only cookies, remove `domain` below AND ensure
   * every entrypoint forces a single hostname.
   */
  cookies: isProd()
    ? {
        sessionToken: {
          name: "__Secure-next-auth.session-token",
          options: {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            secure: true,
            domain: ".xdragon.tech",
          },
        },
        callbackUrl: {
          name: "__Secure-next-auth.callback-url",
          options: {
            sameSite: "lax",
            path: "/",
            secure: true,
            domain: ".xdragon.tech",
          },
        },
        // __Host cookies MUST NOT set Domain
        csrfToken: {
          name: "__Host-next-auth.csrf-token",
          options: {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            secure: true,
          },
        },
      }
    : undefined,

  providers: [
    CredentialsProvider({
      name: "Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials?.email || "").trim().toLowerCase();
        const password = (credentials?.password || "").trim();

        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        // Custom fields from your Prisma schema:
        if (user.status === "BLOCKED") return null;
        if (!user.emailVerified) return null;
        if (!user.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        // Keep last-login up-to-date
        await prisma.user.update({ where: { email }, data: { lastLoginAt: new Date() } });

        // Return minimum user object NextAuth expects
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),

    // Enable OAuth providers only when configured (avoids broken buttons in prod)
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),

    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          }),
        ]
      : []),
  ],

  callbacks: {
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (!existing) return true;

      if (existing.status === "BLOCKED") return false;

      // Promote to ADMIN if in allowlist
      const admins = parseAdminEmails();
      if (admins.includes(email) && existing.role !== "ADMIN") {
        await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
      }

      // For OAuth sign-ins, if emailVerified is empty, set it now
      if (!existing.emailVerified) {
        await prisma.user.update({ where: { email }, data: { emailVerified: new Date() } });
      }

      return true;
    },

    async session({ session, user }) {
      // Expose minimal info needed by client pages
      if (session.user) {
        session.user.email = user.email;
        session.user.name = user.name;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      const base = canonicalBaseUrl(baseUrl);

      // Always keep redirects on our canonical host
      if (url.startsWith("/")) return `${base}${url}`;
      try {
        const target = new URL(url);
        const canonical = new URL(base);
        if (target.host === canonical.host) return url;
      } catch {
        // ignore
      }
      return base;
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
