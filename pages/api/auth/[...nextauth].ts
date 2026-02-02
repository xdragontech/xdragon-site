// pages/api/auth/[...nextauth].ts
import type { NextApiRequest, NextApiResponse } from "next";
import NextAuth, { type NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import bcrypt from "bcryptjs";
import { prisma } from "../../../lib/prisma";

/**
 * Features:
 * - Email magic link (SMTP) — optional
 * - Email + Password (Credentials) with email verification requirement
 * - Optional Google + GitHub (only enabled if env vars present)
 * - New signups notify ADMIN_EMAILS (comma-separated) via Resend (best-effort)
 * - Block/deactivate users via DB `status` (BLOCKED prevents login)
 */

function parseAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function notifyAdminsNewSignup(params: { email?: string | null; name?: string | null; provider?: string }) {
  const to = parseAdminEmails();
  if (!to.length) return;

  const from = process.env.RESEND_FROM || process.env.EMAIL_FROM || "hello@xdragon.tech";
  const apiKey = process.env.RESEND_API_KEY;

  // best-effort (never break auth)
  try {
    if (!apiKey) return;

    const subject = `New Tools Signup — ${params.email || "unknown email"}`;
    const text = [
      "A new user signed up for X Dragon Tools.",
      "",
      `Email: ${params.email || ""}`,
      `Name: ${params.name || ""}`,
      `Provider: ${params.provider || ""}`,
      `Time: ${new Date().toISOString()}`,
    ].join("\n");

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.warn("Resend signup notify failed:", resp.status, body);
    }
  } catch (err) {
    console.warn("Signup notify error:", err);
  }
}

function hasEmailMagicLinkEnv() {
  return Boolean(process.env.EMAIL_SERVER_HOST && process.env.EMAIL_SERVER_USER && process.env.EMAIL_SERVER_PASSWORD);
}

function hasGoogleEnv() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function hasGitHubEnv() {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  pages: { signIn: "/auth/signin" },
  providers: [
    // Email + Password
    CredentialsProvider({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials?.email || "").toLowerCase().trim();
        const password = credentials?.password || "";

        if (!email || !password) return null;

        // Note: This assumes your Prisma User model includes:
        // - passwordHash String?
        // - emailVerified DateTime?
        // - status String? (e.g. "ACTIVE" | "BLOCKED")
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        // @ts-expect-error custom field in your Prisma schema
        if (user.status === "BLOCKED") return null;

        // @ts-expect-error custom field in your Prisma schema
        const hash: string | null | undefined = user.passwordHash;
        if (!hash) return null;

        if (!user.emailVerified) {
          // must verify email before logging in
          return null;
        }

        const ok = await bcrypt.compare(password, hash);
        if (!ok) return null;

        // Update last login if you track it (optional)
        try {
          // @ts-expect-error custom field in your Prisma schema
          await prisma.user.update({ where: { email }, data: { lastLoginAt: new Date() } });
        } catch {}

        return { id: user.id, email: user.email, name: user.name };
      },
    }),

    // Email magic link (optional; requires SMTP env vars)
    ...(hasEmailMagicLinkEnv()
      ? [
          EmailProvider({
            server: {
              host: process.env.EMAIL_SERVER_HOST,
              port: Number(process.env.EMAIL_SERVER_PORT || 465),
              auth: {
                user: process.env.EMAIL_SERVER_USER,
                pass: process.env.EMAIL_SERVER_PASSWORD,
              },
            },
            from: process.env.EMAIL_FROM || "hello@xdragon.tech",
            maxAge: 24 * 60 * 60,
          }),
        ]
      : []),

    // Optional OAuth providers (only enabled if configured)
    ...(hasGoogleEnv()
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),

    ...(hasGitHubEnv()
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;

      const existing = await prisma.user.findUnique({ where: { email } });
      // @ts-expect-error custom field
      if (existing?.status === "BLOCKED") return false;

      // promote to ADMIN if in allowlist
      const admins = parseAdminEmails();
      // @ts-expect-error custom field
      if (existing && admins.includes(email) && existing.role !== "ADMIN") {
        // @ts-expect-error custom field
        await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
      }

      // Track last login time when record exists
      if (existing) {
        try {
          // @ts-expect-error custom field
          await prisma.user.update({ where: { email }, data: { lastLoginAt: new Date() } });
        } catch {}
      }

      return true;
    },

    async session({ session, user }) {
      if (session.user) {
        session.user.email = user.email;
        session.user.name = user.name;

        // Optional: expose role/status to the client if you need it
        try {
          // @ts-expect-error custom field
          session.user.role = (user as any).role;
          // @ts-expect-error custom field
          session.user.status = (user as any).status;
        } catch {}
      }
      return session;
    },
  },
  events: {
    async createUser(message) {
      const email = message.user.email?.toLowerCase();
      const admins = parseAdminEmails();

      if (email && admins.includes(email)) {
        try {
          // @ts-expect-error custom field
          await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
        } catch {}
      }

      await notifyAdminsNewSignup({
        email: message.user.email,
        name: message.user.name,
        provider: "nextauth",
      });
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
  // IMPORTANT: You must set NEXTAUTH_SECRET in production
  secret: process.env.NEXTAUTH_SECRET,
};

export default function auth(req: NextApiRequest, res: NextApiResponse) {
  return NextAuth(req, res, authOptions);
}
