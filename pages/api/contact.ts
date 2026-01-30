import type { NextApiRequest, NextApiResponse } from "next";
import { Resend } from "resend";

type ContactBody = {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { name, email, phone, message } = (req.body || {}) as ContactBody;

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return res.status(400).json({ ok: false, error: "Missing required fields" });
  }

  const { RESEND_API_KEY, CONTACT_TO_EMAIL, CONTACT_FROM_EMAIL } = process.env;

  if (!RESEND_API_KEY || !CONTACT_TO_EMAIL || !CONTACT_FROM_EMAIL) {
    return res.status(500).json({
      ok: false,
      error: "Server email is not configured. Missing RESEND_API_KEY or CONTACT_* env vars.",
    });
  }

  const resend = new Resend(RESEND_API_KEY);

  const subject = `New website inquiry — ${name}`;
  const text =
    `Name: ${name}\n` +
    `Email: ${email}\n` +
    `Phone: ${phone || ""}\n\n` +
    `Message:\n${message}\n`;

  try {
    const result = await resend.emails.send({
      from: CONTACT_FROM_EMAIL.trim(),
      to: CONTACT_TO_EMAIL.trim(),
      replyTo: email.trim(),
      subject,
      text,
    });

    // Resend returns an id you can use to look up delivery details in the dashboard.
    const id = (result as any)?.id;

    return res.status(200).json({ ok: true, id });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || "Failed to send email" });
  }
}
