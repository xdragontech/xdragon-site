import type { NextApiRequest, NextApiResponse } from "next";
import { handlePartnerPortalAssetAccess } from "../../../../../../lib/partnerPortalBff";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return handlePartnerPortalAssetAccess(req, res, "partners");
}
