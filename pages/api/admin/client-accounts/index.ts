import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApi } from "../../../../lib/auth";

function json(res: NextApiResponse, status: number, payload: any) {
  return res.status(status).json(payload);
}

function retiredMessage() {
  return "Client account management has been retired from xdragon-site. Use the command backoffice for client account changes.";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAdminApi(req, res);
  if (!auth.ok) return json(res, 401, { ok: false, error: "Unauthorized" });

  try {
    if (req.method === "GET") {
      return json(res, 410, { ok: false, error: retiredMessage() });
    }

    if (req.method === "POST") {
      return json(res, 410, { ok: false, error: retiredMessage() });
    }

    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { ok: false, error: "Method not allowed" });
  } catch (error: any) {
    const message = typeof error?.message === "string" ? error.message : "Server error";
    return json(res, 400, { ok: false, error: message });
  }
}
