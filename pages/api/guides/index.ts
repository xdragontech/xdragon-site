import type { NextApiRequest, NextApiResponse } from "next";
import {
  commandPublicListGuides,
  isUnauthorizedCommandError,
  CommandPublicApiError,
} from "../../../lib/commandPublicApi";
import { clearCommandBffSessionCookie, getCommandBffSessionToken } from "../../../lib/commandBffSession";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const sessionToken = getCommandBffSessionToken(req);
  if (!sessionToken) {
    clearCommandBffSessionCookie(res);
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  try {
    const response = await commandPublicListGuides(sessionToken, {
      q: typeof req.query.q === "string" ? req.query.q.trim() : "",
      limit: 200,
    });

    return res.status(200).json({
      ok: true,
      guides: response.items,
    });
  } catch (error) {
    if (isUnauthorizedCommandError(error)) {
      clearCommandBffSessionCookie(res);
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    if (error instanceof CommandPublicApiError) {
      return res.status(error.status).json({ ok: false, error: error.message });
    }

    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
