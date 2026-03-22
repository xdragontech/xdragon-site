import type { NextApiRequest, NextApiResponse } from "next";
import {
  commandPublicLogin,
  isCommandPublicApiEnabled,
  CommandPublicApiError,
} from "../../../../lib/commandPublicApi";
import { setCommandBffSessionCookie } from "../../../../lib/commandBffSession";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!isCommandPublicApiEnabled()) {
    return res.status(503).json({ ok: false, error: "Command public API is not configured" });
  }

  try {
    const result = await commandPublicLogin({
      email: String(req.body?.email || ""),
      password: String(req.body?.password || ""),
    });

    setCommandBffSessionCookie(res, result.session);

    return res.status(200).json({
      ok: true,
      account: result.account,
    });
  } catch (error) {
    if (error instanceof CommandPublicApiError) {
      return res.status(error.status).json({ ok: false, error: error.message });
    }

    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
