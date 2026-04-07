import type { NextApiRequest, NextApiResponse } from "next";
import { handlePartnerPortalProfileImageFinalize } from "../../../../../../lib/partnerPortalBff";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return handlePartnerPortalProfileImageFinalize(req, res, "sponsors");
}
