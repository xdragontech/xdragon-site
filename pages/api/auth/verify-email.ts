import type { NextApiRequest, NextApiResponse } from "next";
import { commandPublicVerifyEmail, CommandPublicApiError } from "../../../lib/commandPublicApi";
import { getWebsiteAnalyticsSessionId } from "../../../lib/websiteAnalytics";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const result = await commandPublicVerifyEmail({
      token: typeof req.body?.token === "string" ? req.body.token : "",
      request: req,
      websiteSessionId: getWebsiteAnalyticsSessionId(req),
    });
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof CommandPublicApiError) {
      return res.status(error.status).json({ ok: false, error: error.message });
    }

    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
