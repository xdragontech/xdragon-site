// pages/api/auth/[...nextauth].ts
import type { NextApiRequest, NextApiResponse } from "next";
import NextAuth, { type NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import EmailProvider from "next-auth/providers/email";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "../../../lib/prisma";
import bcrypt from "bcryptjs";

/**
 * X Dragon Tools Auth (Pages Router)
 * - Email magic link (SMTP)
 * - Password login (credentials)
 * - Optional Google/GitHub (if client IDs are set)
 * - Admin allowlist via ADMIN_EMAILS (comma-separated)
 * - Block/deactivate users via User.status in DB
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
  // database sessions are fine with credentials as long as authorize returns {id, email}
  session: { strategy: "database" },
  pages: { signIn: "/auth/signin" },

  providers: [
    // Email magic link (SMTP). Works with Resend SMTP or any SMTP provider.
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

    // Password login (credentials)
    CredentialsProvider({
      name: "Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        const email = (creds?.email || "").trim().toLowerCase();
        const password = (creds?.password || "").trim();
        if (!email || !password) return null;

        // Pull ALL fields we need for checks and compare
        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            emailVerified: true,
            status: true,
          },
        });

        if (!user) return null;
        if (user.status === "BLOCKED") return null;

        // Only allow password login when an email has been verified
        if (!user.emailVerified) return null;

        // Must have a password set
        if (!user.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        // NextAuth requires at least {id, email}
        return { id: user.id, email: user.email!, name: user.name || undefined };
      },
    }),

    // OAuth providers are optional; they can be shown on the UI only if configured
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
    /**
     * IMPORTANT: Always check status + verification using the DB record,
     * not the `user` object (which varies by provider and may omit fields).
     */
    async signIn({ user, account }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;

      const dbUser = await prisma.user.findUnique({
        where: { email },
        select: { status: true, role: true, emailVerified: true },
      });
      if (!dbUser) return false;
      if (dbUser.status === "BLOCKED") return false;

      // Enforce verification for password logins only
      if (account?.provider === "credentials" && !dbUser.emailVerified) {
        // Returning false redirects back to /auth/signin?error=AccessDenied
        return false;
      }

      // Promote to ADMIN if in allowlist
      const admins = parseAdminEmails();
      if (admins.includes(email) && dbUser.role !== "ADMIN") {
        await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
      }

      // Update last login time (best effort)
      await prisma.user.update({ where: { email }, data: { lastLoginAt: new Date() } }).catch(() => undefined);

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
