// pages/api/auth/[...nextauth].ts
import type { NextApiRequest, NextApiResponse } from "next";
import NextAuth, { type NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import { prisma } from "../../../lib/prisma";
import bcrypt from "bcryptjs";

/**
 * FIX: Credentials provider requires JWT session strategy in NextAuth.
 * We still use PrismaAdapter for Users/Accounts, but sessions are JWT-based.
 *
 * Also:
 * - Only enable Google/GitHub when env vars exist
 * - Block BLOCKED users
 * - Require email verification for password users (emailVerified must be set)
 */

function envBool(v: string | undefined) {
  return !!v && v.trim().length > 0;
}

function parseAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

const hasGoogle = envBool(process.env.GOOGLE_CLIENT_ID) && envBool(process.env.GOOGLE_CLIENT_SECRET);
const hasGitHub = envBool(process.env.GITHUB_CLIENT_ID) && envBool(process.env.GITHUB_CLIENT_SECRET);

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  // IMPORTANT: Credentials provider requires JWT sessions (database sessions are not supported).
  session: { strategy: "jwt" },
  jwt: {
    // Keep default; NEXTAUTH_SECRET must be set in production.
  },
  pages: { signIn: "/auth/signin" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
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

        // If you have status/role enums in schema
        // @ts-ignore - Prisma types may not include these fields depending on generation
        if (user.status === "BLOCKED") return null;

        // Password users must be verified before login
        if (!user.emailVerified) return null;

        const hash = (user as any).passwordHash as string | null | undefined;
        if (!hash) return null;

        const ok = await bcrypt.compare(password, hash);
        if (!ok) return null;

        // Update last login best-effort
        try {
          await prisma.user.update({ where: { email }, data: { lastLoginAt: new Date() } });
        } catch {}

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),

    ...(hasGoogle
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),

    ...(hasGitHub
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
          }),
        ]
      : []),
  ],
  callbacks: {
    /**
     * Enforce BLOCKED user check for OAuth sign-ins too
     */
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (!existing) return true;

      // @ts-ignore
      if (existing.status === "BLOCKED") return false;

      // Promote to ADMIN if allowlisted
      const admins = parseAdminEmails();
      // @ts-ignore
      if (admins.includes(email) && existing.role !== "ADMIN") {
        await prisma.user.update({ where: { email }, data: { role: "ADMIN" as any } });
      }

      // Track last login
      try {
        await prisma.user.update({ where: { email }, data: { lastLoginAt: new Date() } });
      } catch {}

      return true;
    },

    /**
     * Put role/status/id into the JWT so SSR pages can authorize without DB sessions.
     */
    async jwt({ token, user }) {
      // On initial sign-in, user is defined
      if (user?.email) {
        token.email = user.email;
        token.name = user.name;
        token.sub = (user as any).id ?? token.sub;

        const dbUser = await prisma.user.findUnique({ where: { email: user.email.toLowerCase() } });
        if (dbUser) {
          (token as any).role = (dbUser as any).role;
          (token as any).status = (dbUser as any).status;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.email = (token.email as string) || session.user.email;
        session.user.name = (token.name as string) || session.user.name;
        (session.user as any).id = token.sub;
        (session as any).role = (token as any).role;
        (session as any).status = (token as any).status;
      }
      return session;
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
