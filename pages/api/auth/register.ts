// pages/api/auth/register.ts
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../../../lib/prisma";

function getBaseUrl(req: NextApiRequest) {
  // Prefer explicit NEXTAUTH_URL / SITE_URL, else infer from request
  const explicit = process.env.NEXTAUTH_URL || process.env.SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host = req.headers.host;
  return `${proto}://${host}`;
}

function parseAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function notifyAdminsNewSignup(email: string, name?: string | null) {
  const to = parseAdminEmails();
  if (!to.length) return;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const from = process.env.RESEND_FROM || process.env.EMAIL_FROM || "hello@xdragon.tech";

  const subject = `New Tools Signup — ${email}`;
  const text = [
    "A new user signed up for X Dragon Tools (password signup).",
    "",
    `Email: ${email}`,
    `Name: ${name || ""}`,
    `Time: ${new Date().toISOString()}`,
  ].join("\n");

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      console.warn("Resend admin notify failed:", resp.status, body);
    }
  } catch (e) {
    console.warn("Resend admin notify error:", e);
  }
}

async function sendVerificationEmail(params: { toEmail: string; verifyUrl: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY missing; cannot send verification email.");
    return false;
  }

  const from = process.env.RESEND_FROM || process.env.EMAIL_FROM || "hello@xdragon.tech";
  const subject = "Verify your email to access X Dragon Tools";

  const text = [
    "Welcome to X Dragon Tools.",
    "",
    "Please verify your email to activate your account:",
    params.verifyUrl,
    "",
    "If you did not request this, you can ignore this email.",
  ].join("\n");

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [params.toEmail], subject, text }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    console.warn("Resend verification failed:", resp.status, body);
    return false;
  }

  return true;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const email = String(req.body?.email || "").toLowerCase().trim();
  const password = String(req.body?.password || "");
  const name = String(req.body?.name || "").trim() || null;

  // Basic validation (keep it strict but friendly)
  if (!email || !email.includes("@")) return res.status(400).json({ ok: false, error: "Please enter a valid email." });
  if (password.length < 10) return res.status(400).json({ ok: false, error: "Password must be at least 10 characters." });

  try {
    const existing = await prisma.user.findUnique({ where: { email } });

    // Do not leak whether user exists: always return ok:true
    if (existing) {
      return res.status(200).json({ ok: true });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Assumes your Prisma User model includes passwordHash + status + role + emailVerified
    await prisma.user.create({
      data: {
        email,
        name,
        // @ts-expect-error custom field in your Prisma schema
        passwordHash,
        // @ts-expect-error custom field
        status: "ACTIVE",
        // emailVerified stays null until verified
      } as any,
    });

    // Create verification token (custom model EmailVerificationToken)
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.emailVerificationToken.create({
      data: {
        identifier: email,
        token,
        expires,
      },
    });

    const baseUrl = getBaseUrl(req);
    const verifyUrl = `${baseUrl}/auth/verify?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

    await Promise.all([
      sendVerificationEmail({ toEmail: email, verifyUrl }),
      notifyAdminsNewSignup(email, name),
    ]);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("register error:", err);
    // Still avoid leaking existence details
    return res.status(200).json({ ok: true });
  }
}
