import type { NextApiRequest, NextApiResponse } from "next";
import {
  commandPublicContact,
  CommandPublicApiError,
} from "../../lib/commandPublicApi";

type Data =
  | { ok: true; id?: string; notification?: "sent" | "deferred" }
  | { ok: false; error: string; details?: unknown };

function cleanString(value: unknown, max = 2000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const result = await commandPublicContact({
      name: cleanString(req.body?.name, 200),
      email: cleanString(req.body?.email, 320),
      phone: cleanString(req.body?.phone, 80) || null,
      message: cleanString(req.body?.message, 4000),
    });

    const status = result.ok && result.notification === "deferred" ? 202 : 200;
    return res.status(status).json(result);
  } catch (error) {
    if (error instanceof CommandPublicApiError) {
      return res.status(error.status).json({ ok: false, error: error.message });
    }

    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
