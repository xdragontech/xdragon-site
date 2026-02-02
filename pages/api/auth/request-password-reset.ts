import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { prisma } from "../../../lib/prisma";

/**
 * POST /api/auth/request-password-reset
 * Body: { email: string }
 *
 * - Always returns { ok: true } so we don't leak whether an email exists.
 * - Stores a HASHED token (sha256) in DB; only raw token is emailed.
 */
function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function getBaseUrl(req: NextApiRequest) {
  const envUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (envUrl) return envUrl.replace(/\/$/, "");

  const proto = (req.headers["x-forwarded-proto"] as string) || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

async function sendResendEmail(params: { to: string; subject: string; text: string; html?: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[password-reset] RESEND_API_KEY missing; cannot send reset email");
    return;
  }

  const from =
    process.env.RESEND_FROM ||
    process.env.CONTACT_FROM_EMAIL ||
    process.env.EMAIL_FROM ||
    "hello@xdragon.tech";

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      text: params.text,
      html: params.html,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    console.error("[password-reset] Resend send failed", resp.status, body);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const emailRaw = (req.body?.email || "").toString().trim();
  const email = emailRaw.toLowerCase();

  // Always respond ok=true to avoid user enumeration
  if (!email || !email.includes("@")) return res.status(200).json({ ok: true });

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.status === "BLOCKED") return res.status(200).json({ ok: true });

    // Raw token for the link; store a SHA-256 hash in DB
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256(rawToken);

    // 30-minute expiry (tune as desired)
    const expires = new Date(Date.now() + 30 * 60 * 1000);

    // Clean up any older reset tokens for this email
    await prisma.passwordResetToken.deleteMany({ where: { identifier: email } });

    await prisma.passwordResetToken.create({
      data: { identifier: email, token: tokenHash, expires },
    });

    const baseUrl = getBaseUrl(req);
    const link = `${baseUrl}/auth/reset-password?email=${encodeURIComponent(email)}&token=${rawToken}`;

    const subject = "Reset your X Dragon Tools password";
    const text = [
      "We received a request to reset your password for X Dragon Tools.",
      "",
      "Use the link below to set a new password:",
      link,
      "",
      "If you didn’t request this, you can ignore this email.",
      "",
      `This link expires at: ${expires.toISOString()}`,
    ].join("\n");

    const html = `
      <div style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5">
        <h2 style="margin:0 0 12px">Reset your password</h2>
        <p>We received a request to reset your password for <strong>X Dragon Tools</strong>.</p>
        <p><a href="${link}" style="display:inline-block;padding:10px 14px;background:#111;color:#fff;border-radius:12px;text-decoration:none">Reset Password</a></p>
        <p style="color:#444">If the button doesn’t work, copy and paste this URL into your browser:</p>
        <p><a href="${link}">${link}</a></p>
        <p style="color:#666;font-size:12px">This link expires at ${expires.toISOString()}</p>
      </div>
    `;

    await sendResendEmail({ to: email, subject, text, html });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[password-reset] request handler error", err);
    // Still return ok=true to avoid leaking
    return res.status(200).json({ ok: true });
  }
}
