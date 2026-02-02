import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../../../lib/prisma";

/**
 * POST /api/auth/reset-password
 * Body: { email: string, token: string, password: string }
 */
function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function isStrongEnough(pw: string) {
  return pw.length >= 8;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const emailRaw = (req.body?.email || "").toString().trim();
  const tokenRaw = (req.body?.token || "").toString().trim();
  const password = (req.body?.password || "").toString();

  const email = emailRaw.toLowerCase();

  if (!email || !email.includes("@") || !tokenRaw) {
    return res.status(400).json({ ok: false, error: "Missing email or token" });
  }
  if (!isStrongEnough(password)) {
    return res.status(400).json({ ok: false, error: "Password must be at least 8 characters" });
  }

  try {
    const tokenHash = sha256(tokenRaw);

    const rec = await prisma.passwordResetToken.findFirst({
      where: { identifier: email, token: tokenHash },
    });

    if (!rec) return res.status(400).json({ ok: false, error: "Invalid or expired token" });
    if (rec.expires.getTime() < Date.now()) {
      await prisma.passwordResetToken.deleteMany({ where: { identifier: email } });
      return res.status(400).json({ ok: false, error: "Invalid or expired token" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ ok: false, error: "Invalid or expired token" });
    if (user.status === "BLOCKED") return res.status(403).json({ ok: false, error: "Account blocked" });

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { email },
      data: { passwordHash },
    });

    await prisma.passwordResetToken.deleteMany({ where: { identifier: email } });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[password-reset] reset handler error", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
