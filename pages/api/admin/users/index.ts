import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApi } from "../../../../lib/auth";
import {
  createManagedBackofficeInvite,
  createManagedBackofficePasswordLink,
  createManagedBackofficeUser,
  listManagedBackofficeUsers,
} from "../../../../lib/backofficeAdminUsers";
import { buildOrigin, getApiRequestHost, getApiRequestProtocol } from "../../../../lib/requestHost";
import { canonicalAdminHost } from "../../../../lib/siteConfig";

function json(res: NextApiResponse, status: number, payload: any) {
  return res.status(status).json(payload);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAdminApi(req, res);
  if (!auth.ok) return json(res, 401, { ok: false, error: "Unauthorized" });
  if (auth.principal.role !== "SUPERADMIN") return json(res, 403, { ok: false, error: "Forbidden" });

  try {
    if (req.method === "GET") {
      const users = await listManagedBackofficeUsers();
      return json(res, 200, { ok: true, users });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const action = String(body.action || "").toLowerCase();

      if (action === "createinvite") {
        const user = await createManagedBackofficeInvite(body);
        const origin = buildOrigin(getApiRequestProtocol(req), canonicalAdminHost(getApiRequestHost(req)));
        const invite = await createManagedBackofficePasswordLink(user.id, "invite", origin);
        return json(res, 200, { ok: true, user, invite });
      }

      const user = await createManagedBackofficeUser(body);
      return json(res, 200, { ok: true, user });
    }

    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { ok: false, error: "Method not allowed" });
  } catch (error: any) {
    const message = typeof error?.message === "string" ? error.message : "Server error";
    return json(res, 400, { ok: false, error: message });
  }
}
