import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApi } from "../../../../lib/auth";
import { listEditableBrands } from "../../../../lib/brandRegistry";

function json(res: NextApiResponse, status: number, payload: any) {
  return res.status(status).json(payload);
}

function retiredMessage() {
  return "Brand management has been retired from xdragon-site. Use the command backoffice for brand changes.";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAdminApi(req, res);
  if (!auth.ok) return json(res, 401, { ok: false, error: "Unauthorized" });

  try {
    if (req.method === "GET") {
      const query = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
      const brands = await listEditableBrands(String(query || ""));
      return json(res, 200, { ok: true, brands });
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
