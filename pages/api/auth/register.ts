import type { NextApiRequest, NextApiResponse } from "next";
import { commandPublicRegister, CommandPublicApiError } from "../../../lib/commandPublicApi";

type Data =
  | { ok: true; verificationRequired?: boolean }
  | { ok: false; error: string };

function cleanEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const result = await commandPublicRegister({
      email: cleanEmail(req.body?.email),
      password: String(req.body?.password || ""),
      name: String(req.body?.name || "").trim() || null,
    });

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof CommandPublicApiError) {
      return res.status(error.status).json({ ok: false, error: error.message });
    }

    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
