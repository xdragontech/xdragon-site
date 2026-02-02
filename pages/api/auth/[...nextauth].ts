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
 * NextAuth (Pages Router) — password + OAuth only (NO magic link / email provider)
 *
 * - Password login via Credentials provider (uses User.passwordHash)
 * - Password accounts must be "verified"
 *   Verified if:
 *     (a) user.emailVerified is set OR
 *     (b) user has an Account (OAuth or legacy email provider) — indicates verified sign-in happened
 * - Admin allowlist: ADMIN_EMAILS (comma-separated) promoted to ADMIN
 * - Block users: User.status === "BLOCKED"
 */

function parseAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function isVerifiedUser(userId: string, emailVerified: Date | null | undefined) {
  if (emailVerified) return true;

  // If the user has any linked Account, they have proven ownership at least once.
  const acct = await prisma.account.findFirst({ where: { userId }, select: { id: true } });
  return !!acct;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  // If you use database sessions (recommended for admin controls), keep this:
  session: { strategy: "database" },
  secret: process.env.NEXTAUTH_SECRET,

  pages: {
    signIn: "/auth/signin",
  },

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

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            status: true,
            role: true,
            emailVerified: true,
          },
        });

        if (!user) return null;
        if (user.status === "BLOCKED") return null;
        if (!user.passwordHash) return null; // password login not enabled for this user

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        const verified = await isVerifiedUser(user.id, user.emailVerified);
        if (!verified) return null;

        // You can return any object with at least an id
        return { id: user.id, email: user.email ?? undefined, name: user.name ?? undefined };
      },
    }),

    // OAuth providers (optional — only "active" if env vars set)
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    }),
  ],

  callbacks: {
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;

      const existing = await prisma.user.findUnique({
        where: { email },
        select: { status: true, role: true },
      });
      if (existing?.status === "BLOCKED") return false;

      // Promote allowlisted admins
      const admins = parseAdminEmails();
      if (admins.includes(email)) {
        await prisma.user.update({
          where: { email },
          data: { role: "ADMIN" },
        }).catch(() => {});
      }

      // Track last login time (best effort)
      await prisma.user
        .update({
          where: { email },
          data: { lastLoginAt: new Date() },
        })
        .catch(() => {});

      return true;
    },

    async session({ session, user }) {
      if (session.user) {
        session.user.email = user.email;
        session.user.name = user.name;
        // If you want role on the client, uncomment this once your types are extended:
        // (session.user as any).role = (user as any).role;
      }
      return session;
    },
  },

  events: {
    async createUser(message) {
      // Promote allowlisted admins on first creation
      const email = message.user.email?.toLowerCase();
      const admins = parseAdminEmails();
      if (email && admins.includes(email)) {
        await prisma.user.update({ where: { email }, data: { role: "ADMIN" } }).catch(() => {});
      }
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
