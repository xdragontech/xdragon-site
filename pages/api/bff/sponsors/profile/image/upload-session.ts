import type { NextApiRequest, NextApiResponse } from "next";
import { handlePartnerPortalProfileImageUploadSession } from "../../../../../../lib/partnerPortalBff";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return handlePartnerPortalProfileImageUploadSession(req, res, "sponsors");
}
