import type { NextApiRequest, NextApiResponse } from "next";
import { commandPublicResetPassword, CommandPublicApiError } from "../../../lib/commandPublicApi";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const result = await commandPublicResetPassword({
      token: String(req.body?.token || ""),
      password: String(req.body?.password || ""),
    });

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof CommandPublicApiError) {
      return res.status(error.status).json({ ok: false, error: error.message });
    }

    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
