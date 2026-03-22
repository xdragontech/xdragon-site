import type { NextApiRequest, NextApiResponse } from "next";
import {
  commandPublicChat,
  CommandPublicApiError,
} from "../../lib/commandPublicApi";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const result = await commandPublicChat({
      conversationId:
        typeof req.body?.conversationId === "string" ? req.body.conversationId : undefined,
      messages: Array.isArray(req.body?.messages) ? req.body.messages : [],
      lead: req.body?.lead || {},
      emailed: Boolean(req.body?.emailed),
    });

    return res.status(result.ok ? 200 : 500).json(result);
  } catch (error) {
    if (error instanceof CommandPublicApiError) {
      return res.status(error.status).json({ ok: false, error: error.message });
    }

    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
