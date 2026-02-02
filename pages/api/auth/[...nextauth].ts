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
 * X Dragon Tools Auth (Pages Router)
 * - Email magic link (SMTP) + optional Google/GitHub
 * - Optional email+password (Credentials)
 * - Blocks users with status === "BLOCKED"
 * - Requires NEXTAUTH_SECRET in production
 * - Notifies ADMIN_EMAILS on new signups (best-effort, never breaks auth)
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

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const from = process.env.RESEND_FROM || process.env.EMAIL_FROM || "hello@xdragon.tech";

  try {
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
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
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

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  // Required in production
  secret: process.env.NEXTAUTH_SECRET,

  // Keep sessions in DB (works well with Prisma adapter)
  session: { strategy: "database" },

  pages: { signIn: "/auth/signin" },

  providers: [
    // Email magic link (SMTP). Works well with Resend SMTP.
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

    // Optional OAuth providers (safe even if env vars are empty; we gate below)
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    }),

    // Email + Password (credentials)
    CredentialsProvider({
      name: "Email + Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials?.email || "").toLowerCase().trim();
        const password = credentials?.password || "";

        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        // These fields exist in your Prisma schema; do NOT use @ts-expect-error here
        if (user.status === "BLOCKED") return null;

        // Require verified email for password logins (magic link verification sets this)
        // If you used a different field name in schema, adjust here.
        if (!user.emailVerified) return null;

        // If you store hashed passwords in `passwordHash`, adjust as needed.
        const hash = (user as any).passwordHash as string | undefined;
        if (!hash) return null;

        const ok = await bcrypt.compare(password, hash);
        if (!ok) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],

  callbacks: {
    // Block BLOCKED users across all providers
    async signIn({ user, account }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing?.status === "BLOCKED") return false;

      // Promote to ADMIN if in allowlist
      const admins = parseAdminEmails();
      if (existing && admins.includes(email) && existing.role !== "ADMIN") {
        await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
      }

      // Track last login time when record exists
      if (existing) {
        await prisma.user.update({ where: { email }, data: { lastLoginAt: new Date() } });
      }

      // If OAuth env is missing, prevent dead buttons from “working” in prod
      if (account?.provider === "google" && (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)) {
        return false;
      }
      if (account?.provider === "github" && (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET)) {
        return false;
      }

      return true;
    },

    async session({ session, user }) {
      if (session.user) {
        session.user.email = user.email;
        session.user.name = user.name;
      }
      return session;
    },
  },

  events: {
    // Fires when a new user row is created
    async createUser(message) {
      const email = message.user.email?.toLowerCase();
      const admins = parseAdminEmails();

      if (email && admins.includes(email)) {
        await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
      }

      await notifyAdminsNewSignup({
        email: message.user.email,
        name: message.user.name,
        provider: "email_or_oauth_or_password",
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
};

export default function auth(req: NextApiRequest, res: NextApiResponse) {
  return NextAuth(req, res, authOptions);
}
