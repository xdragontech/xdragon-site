import type { NextApiRequest, NextApiResponse } from "next";
import { handleParticipantPortalRequirementUploadSession } from "../../../../../../lib/partnerPortalBff";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return handleParticipantPortalRequirementUploadSession(req, res);
}
