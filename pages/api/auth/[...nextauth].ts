// pages/api/auth/[...nextauth].ts
import type { NextApiRequest, NextApiResponse } from "next";
import NextAuth, { type NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import EmailProvider from "next-auth/providers/email";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import { prisma } from "../../../lib/prisma";

/**
 * Requirements covered:
 * - Email magic link default (SMTP)
 * - Google + GitHub sign-in (only enabled when env vars exist)
 * - New signups notify ADMIN_EMAILS (comma-separated) by email (via Resend API if RESEND_API_KEY set)
 * - Admin allowlist via ADMIN_EMAILS + ability to deactivate/block users in DB
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

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  // Explicitly set secret to avoid prod NO_SECRET ambiguity.
  secret: process.env.NEXTAUTH_SECRET,

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

    // Only register OAuth providers when configured.
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
      if (existing?.status === "BLOCKED") return false;

      // promote to ADMIN if in allowlist
      const admins = parseAdminEmails();
      if (existing && admins.includes(email) && existing.role !== "ADMIN") {
        await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
      }

      // Track last login time when record exists
      if (existing) {
        await prisma.user.update({ where: { email }, data: { lastLoginAt: new Date() } });
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
    async createUser(message) {
      const email = message.user.email?.toLowerCase();
      const admins = parseAdminEmails();

      if (email && admins.includes(email)) {
        await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
      }

      await notifyAdminsNewSignup({
        email: message.user.email,
        name: message.user.name,
        provider: "email_or_oauth",
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
