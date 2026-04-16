import type { NextApiRequest, NextApiResponse } from "next";
import {
  commandParticipantCreateRequirementUploadSession,
  commandParticipantFinalizeRequirement,
  commandParticipantGetRequirements,
  commandPartnerCreateProfileImageUploadSession,
  commandPartnerChangePassword,
  commandPartnerFinalizeProfileImage,
  commandPartnerGetAssetAccess,
  commandPartnerGetProfileImage,
  commandPartnerGetProfile,
  commandPartnerGetSession,
  commandPartnerListApplications,
  commandPartnerLogin,
  commandPartnerLogout,
  commandPartnerRegister,
  commandPartnerSubmitApplication,
  commandPartnerUpdateProfile,
  commandPartnerVerifyEmail,
  commandPartnerGetAvailability,
  commandPartnerSetAvailability,
  isUnauthorizedCommandError,
  CommandPublicApiError,
  logCommandPublicApiError,
  type CommandParticipantRequirementType,
  type CommandPartnerPortalScope,
} from "./commandPublicApi";
import {
  clearCommandPartnerBffSessionCookie,
  getCommandPartnerBffSessionToken,
  setCommandPartnerBffSessionCookie,
} from "./commandPartnerBffSession";
import { getWebsiteAnalyticsSessionId } from "./websiteAnalytics";

function applyNoStoreHeaders(res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  res.setHeader("Vary", "Cookie");
}

function json(res: NextApiResponse, status: number, payload: any) {
  return res.status(status).json(payload);
}

function unauthorized(res: NextApiResponse) {
  clearCommandPartnerBffSessionCookie(res);
  return json(res, 401, { ok: false, error: "Unauthorized" });
}

export async function handlePartnerPortalRegister(
  req: NextApiRequest,
  res: NextApiResponse,
  scope: CommandPartnerPortalScope
) {
  applyNoStoreHeaders(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const result = await commandPartnerRegister(scope, {
      body: req.body || {},
      request: req,
      websiteSessionId: getWebsiteAnalyticsSessionId(req),
    });

    return json(res, 201, result);
  } catch (error) {
    if (error instanceof CommandPublicApiError) {
      logCommandPublicApiError(`${scope}-register`, error, {
        requestHost: req.headers.host || null,
      });
      return json(res, error.status, { ok: false, error: error.message });
    }

    console.error(`[${scope}-register] unexpected error`, error);
    return json(res, 500, { ok: false, error: "Server error" });
  }
}

export async function handlePartnerPortalVerifyEmail(
  req: NextApiRequest,
  res: NextApiResponse,
  scope: CommandPartnerPortalScope
) {
  applyNoStoreHeaders(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const result = await commandPartnerVerifyEmail(scope, {
      token: typeof req.body?.token === "string" ? req.body.token : "",
      request: req,
      websiteSessionId: getWebsiteAnalyticsSessionId(req),
    });

    return json(res, 200, result);
  } catch (error) {
    if (error instanceof CommandPublicApiError) {
      logCommandPublicApiError(`${scope}-verify-email`, error, {
        requestHost: req.headers.host || null,
      });
      return json(res, error.status, { ok: false, error: error.message });
    }

    console.error(`[${scope}-verify-email] unexpected error`, error);
    return json(res, 500, { ok: false, error: "Server error" });
  }
}

export async function handlePartnerPortalLogin(
  req: NextApiRequest,
  res: NextApiResponse,
  scope: CommandPartnerPortalScope
) {
  applyNoStoreHeaders(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const result = await commandPartnerLogin(scope, {
      email: String(req.body?.email || "").trim().toLowerCase(),
      password: String(req.body?.password || ""),
      request: req,
      websiteSessionId: getWebsiteAnalyticsSessionId(req),
    });

    setCommandPartnerBffSessionCookie(res, result.session);

    return json(res, 200, {
      ok: true,
      account: result.account,
    });
  } catch (error) {
    if (error instanceof CommandPublicApiError) {
      logCommandPublicApiError(`${scope}-login`, error, {
        requestHost: req.headers.host || null,
      });
      return json(res, error.status, { ok: false, error: error.message });
    }

    console.error(`[${scope}-login] unexpected error`, error);
    return json(res, 500, { ok: false, error: "Server error" });
  }
}

export async function handlePartnerPortalSession(
  req: NextApiRequest,
  res: NextApiResponse,
  scope: CommandPartnerPortalScope
) {
  applyNoStoreHeaders(res);

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  const sessionToken = getCommandPartnerBffSessionToken(req);
  if (!sessionToken) {
    return unauthorized(res);
  }

  try {
    const result = await commandPartnerGetSession(scope, sessionToken);
    return json(res, 200, result);
  } catch (error) {
    if (isUnauthorizedCommandError(error)) {
      return unauthorized(res);
    }
    if (error instanceof CommandPublicApiError) {
      logCommandPublicApiError(`${scope}-session`, error, {
        requestHost: req.headers.host || null,
        hasSessionCookie: true,
      });
      return json(res, error.status, { ok: false, error: error.message });
    }

    console.error(`[${scope}-session] unexpected error`, error);
    return json(res, 500, { ok: false, error: "Server error" });
  }
}

export async function handlePartnerPortalChangePassword(
  req: NextApiRequest,
  res: NextApiResponse,
  scope: CommandPartnerPortalScope
) {
  applyNoStoreHeaders(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  const sessionToken = getCommandPartnerBffSessionToken(req);
  if (!sessionToken) {
    return unauthorized(res);
  }

  try {
    const result = await commandPartnerChangePassword(scope, {
      sessionToken,
      password: String(req.body?.password || ""),
    });
    return json(res, 200, result);
  } catch (error) {
    if (isUnauthorizedCommandError(error)) {
      return unauthorized(res);
    }
    if (error instanceof CommandPublicApiError) {
      logCommandPublicApiError(`${scope}-change-password`, error, {
        requestHost: req.headers.host || null,
        hasSessionCookie: true,
      });
      return json(res, error.status, { ok: false, error: error.message });
    }

    console.error(`[${scope}-change-password] unexpected error`, error);
    return json(res, 500, { ok: false, error: "Server error" });
  }
}

export async function handlePartnerPortalLogout(
  req: NextApiRequest,
  res: NextApiResponse,
  scope: CommandPartnerPortalScope
) {
  applyNoStoreHeaders(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  const sessionToken = getCommandPartnerBffSessionToken(req);

  try {
    if (sessionToken) {
      await commandPartnerLogout(scope, sessionToken);
    }
  } catch (error) {
    console.warn(`[${scope}-logout] upstream logout failed`, error);
  } finally {
    clearCommandPartnerBffSessionCookie(res);
  }

  return json(res, 200, { ok: true });
}

export async function handlePartnerPortalProfile(
  req: NextApiRequest,
  res: NextApiResponse,
  scope: CommandPartnerPortalScope
) {
  applyNoStoreHeaders(res);

  const sessionToken = getCommandPartnerBffSessionToken(req);
  if (!sessionToken) {
    return unauthorized(res);
  }

  try {
    if (req.method === "GET") {
      const result = await commandPartnerGetProfile(scope, sessionToken);
      return json(res, 200, result);
    }

    if (req.method === "PATCH") {
      const result = await commandPartnerUpdateProfile(scope, {
        sessionToken,
        body: req.body || {},
      });
      return json(res, 200, result);
    }

    res.setHeader("Allow", "GET, PATCH");
    return json(res, 405, { ok: false, error: "Method not allowed" });
  } catch (error) {
    if (isUnauthorizedCommandError(error)) {
      return unauthorized(res);
    }
    if (error instanceof CommandPublicApiError) {
      logCommandPublicApiError(`${scope}-profile`, error, {
        requestHost: req.headers.host || null,
        hasSessionCookie: true,
      });
      return json(res, error.status, { ok: false, error: error.message });
    }

    console.error(`[${scope}-profile] unexpected error`, error);
    return json(res, 500, { ok: false, error: "Server error" });
  }
}

export async function handlePartnerPortalApplications(
  req: NextApiRequest,
  res: NextApiResponse,
  scope: CommandPartnerPortalScope
) {
  applyNoStoreHeaders(res);

  const sessionToken = getCommandPartnerBffSessionToken(req);
  if (!sessionToken) {
    return unauthorized(res);
  }

  try {
    if (req.method === "GET") {
      const result = await commandPartnerListApplications(scope, sessionToken);
      return json(res, 200, result);
    }

    if (req.method === "POST") {
      const result = await commandPartnerSubmitApplication(scope, {
        sessionToken,
        scheduleEventSeriesId: String(req.body?.scheduleEventSeriesId || ""),
        applicationPayload: req.body?.applicationPayload,
      });
      return json(res, 201, result);
    }

    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { ok: false, error: "Method not allowed" });
  } catch (error) {
    if (isUnauthorizedCommandError(error)) {
      return unauthorized(res);
    }
    if (error instanceof CommandPublicApiError) {
      logCommandPublicApiError(`${scope}-applications`, error, {
        requestHost: req.headers.host || null,
        hasSessionCookie: true,
      });
      return json(res, error.status, { ok: false, error: error.message });
    }

    console.error(`[${scope}-applications] unexpected error`, error);
    return json(res, 500, { ok: false, error: "Server error" });
  }
}

export async function handlePartnerPortalProfileImage(
  req: NextApiRequest,
  res: NextApiResponse,
  scope: CommandPartnerPortalScope
) {
  applyNoStoreHeaders(res);

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  const sessionToken = getCommandPartnerBffSessionToken(req);
  if (!sessionToken) {
    return unauthorized(res);
  }

  try {
    const result = await commandPartnerGetProfileImage(scope, sessionToken);
    return json(res, 200, result);
  } catch (error) {
    if (isUnauthorizedCommandError(error)) {
      return unauthorized(res);
    }
    if (error instanceof CommandPublicApiError) {
      logCommandPublicApiError(`${scope}-profile-image`, error, {
        requestHost: req.headers.host || null,
        hasSessionCookie: true,
      });
      return json(res, error.status, { ok: false, error: error.message });
    }

    console.error(`[${scope}-profile-image] unexpected error`, error);
    return json(res, 500, { ok: false, error: "Server error" });
  }
}

export async function handlePartnerPortalProfileImageUploadSession(
  req: NextApiRequest,
  res: NextApiResponse,
  scope: CommandPartnerPortalScope
) {
  applyNoStoreHeaders(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  const sessionToken = getCommandPartnerBffSessionToken(req);
  if (!sessionToken) {
    return unauthorized(res);
  }

  try {
    const result = await commandPartnerCreateProfileImageUploadSession(scope, {
      sessionToken,
      fileName: String(req.body?.fileName || ""),
      mimeType: String(req.body?.mimeType || ""),
      sizeBytes: Number(req.body?.sizeBytes || 0),
    });
    return json(res, 200, result);
  } catch (error) {
    if (isUnauthorizedCommandError(error)) {
      return unauthorized(res);
    }
    if (error instanceof CommandPublicApiError) {
      logCommandPublicApiError(`${scope}-profile-image-upload-session`, error, {
        requestHost: req.headers.host || null,
        hasSessionCookie: true,
      });
      return json(res, error.status, { ok: false, error: error.message });
    }

    console.error(`[${scope}-profile-image-upload-session] unexpected error`, error);
    return json(res, 500, { ok: false, error: "Server error" });
  }
}

export async function handlePartnerPortalProfileImageFinalize(
  req: NextApiRequest,
  res: NextApiResponse,
  scope: CommandPartnerPortalScope
) {
  applyNoStoreHeaders(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  const sessionToken = getCommandPartnerBffSessionToken(req);
  if (!sessionToken) {
    return unauthorized(res);
  }

  try {
    const result = await commandPartnerFinalizeProfileImage(scope, {
      sessionToken,
      objectKey: String(req.body?.objectKey || ""),
      fileName: String(req.body?.fileName || ""),
      mimeType: String(req.body?.mimeType || ""),
      sizeBytes: Number(req.body?.sizeBytes || 0),
      checksumSha256: typeof req.body?.checksumSha256 === "string" ? req.body.checksumSha256 : null,
      imageWidth: typeof req.body?.imageWidth === "number" ? req.body.imageWidth : null,
      imageHeight: typeof req.body?.imageHeight === "number" ? req.body.imageHeight : null,
    });
    return json(res, 200, result);
  } catch (error) {
    if (isUnauthorizedCommandError(error)) {
      return unauthorized(res);
    }
    if (error instanceof CommandPublicApiError) {
      logCommandPublicApiError(`${scope}-profile-image-finalize`, error, {
        requestHost: req.headers.host || null,
        hasSessionCookie: true,
      });
      return json(res, error.status, { ok: false, error: error.message });
    }

    console.error(`[${scope}-profile-image-finalize] unexpected error`, error);
    return json(res, 500, { ok: false, error: "Server error" });
  }
}

export async function handlePartnerPortalAssetAccess(
  req: NextApiRequest,
  res: NextApiResponse,
  scope: CommandPartnerPortalScope
) {
  applyNoStoreHeaders(res);

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  const sessionToken = getCommandPartnerBffSessionToken(req);
  if (!sessionToken) {
    return unauthorized(res);
  }

  try {
    const assetId = Array.isArray(req.query.assetId) ? req.query.assetId[0] : req.query.assetId;
    const result = await commandPartnerGetAssetAccess(scope, {
      sessionToken,
      assetId: String(assetId || ""),
    });
    return json(res, 200, result);
  } catch (error) {
    if (isUnauthorizedCommandError(error)) {
      return unauthorized(res);
    }
    if (error instanceof CommandPublicApiError) {
      logCommandPublicApiError(`${scope}-asset-access`, error, {
        requestHost: req.headers.host || null,
        hasSessionCookie: true,
      });
      return json(res, error.status, { ok: false, error: error.message });
    }

    console.error(`[${scope}-asset-access] unexpected error`, error);
    return json(res, 500, { ok: false, error: "Server error" });
  }
}

export async function handleParticipantPortalRequirements(
  req: NextApiRequest,
  res: NextApiResponse
) {
  applyNoStoreHeaders(res);

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  const sessionToken = getCommandPartnerBffSessionToken(req);
  if (!sessionToken) {
    return unauthorized(res);
  }

  try {
    const result = await commandParticipantGetRequirements(sessionToken);
    return json(res, 200, result);
  } catch (error) {
    if (isUnauthorizedCommandError(error)) {
      return unauthorized(res);
    }
    if (error instanceof CommandPublicApiError) {
      logCommandPublicApiError("partners-requirements", error, {
        requestHost: req.headers.host || null,
        hasSessionCookie: true,
      });
      return json(res, error.status, { ok: false, error: error.message });
    }

    console.error("[partners-requirements] unexpected error", error);
    return json(res, 500, { ok: false, error: "Server error" });
  }
}

export async function handleParticipantPortalRequirementUploadSession(
  req: NextApiRequest,
  res: NextApiResponse
) {
  applyNoStoreHeaders(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  const sessionToken = getCommandPartnerBffSessionToken(req);
  if (!sessionToken) {
    return unauthorized(res);
  }

  try {
    const requirementType = Array.isArray(req.query.requirementType) ? req.query.requirementType[0] : req.query.requirementType;
    const result = await commandParticipantCreateRequirementUploadSession({
      sessionToken,
      requirementType: String(requirementType || "") as CommandParticipantRequirementType,
      fileName: String(req.body?.fileName || ""),
      mimeType: String(req.body?.mimeType || ""),
      sizeBytes: Number(req.body?.sizeBytes || 0),
    });
    return json(res, 200, result);
  } catch (error) {
    if (isUnauthorizedCommandError(error)) {
      return unauthorized(res);
    }
    if (error instanceof CommandPublicApiError) {
      logCommandPublicApiError("partners-requirement-upload-session", error, {
        requestHost: req.headers.host || null,
        hasSessionCookie: true,
      });
      return json(res, error.status, { ok: false, error: error.message });
    }

    console.error("[partners-requirement-upload-session] unexpected error", error);
    return json(res, 500, { ok: false, error: "Server error" });
  }
}

export async function handleParticipantPortalRequirementFinalize(
  req: NextApiRequest,
  res: NextApiResponse
) {
  applyNoStoreHeaders(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  const sessionToken = getCommandPartnerBffSessionToken(req);
  if (!sessionToken) {
    return unauthorized(res);
  }

  try {
    const requirementType = Array.isArray(req.query.requirementType) ? req.query.requirementType[0] : req.query.requirementType;
    const result = await commandParticipantFinalizeRequirement({
      sessionToken,
      requirementType: String(requirementType || "") as CommandParticipantRequirementType,
      objectKey: String(req.body?.objectKey || ""),
      fileName: String(req.body?.fileName || ""),
      mimeType: String(req.body?.mimeType || ""),
      sizeBytes: Number(req.body?.sizeBytes || 0),
      checksumSha256: typeof req.body?.checksumSha256 === "string" ? req.body.checksumSha256 : null,
      expiresAt: String(req.body?.expiresAt || ""),
    });
    return json(res, 200, result);
  } catch (error) {
    if (isUnauthorizedCommandError(error)) {
      return unauthorized(res);
    }
    if (error instanceof CommandPublicApiError) {
      logCommandPublicApiError("partners-requirement-finalize", error, {
        requestHost: req.headers.host || null,
        hasSessionCookie: true,
      });
      return json(res, error.status, { ok: false, error: error.message });
    }

    console.error("[partners-requirement-finalize] unexpected error", error);
    return json(res, 500, { ok: false, error: "Server error" });
  }
}

// HUMAN-REVIEW: Wave 12 — partner availability calendar BFF handler
export async function handlePartnerPortalAvailability(
  req: NextApiRequest,
  res: NextApiResponse,
  scope: CommandPartnerPortalScope
) {
  applyNoStoreHeaders(res);

  const sessionToken = getCommandPartnerBffSessionToken(req);
  if (!sessionToken) {
    return unauthorized(res);
  }

  try {
    if (req.method === "GET") {
      const eventSeriesId = String(req.query.eventSeriesId || "").trim();
      if (!eventSeriesId) {
        return json(res, 400, { ok: false, error: "eventSeriesId query parameter is required" });
      }
      const result = await commandPartnerGetAvailability(scope, {
        sessionToken,
        eventSeriesId,
      });
      return json(res, 200, result);
    }

    if (req.method === "POST") {
      const result = await commandPartnerSetAvailability(scope, {
        sessionToken,
        eventSeriesId: String(req.body?.eventSeriesId || ""),
        dates: Array.isArray(req.body?.dates) ? req.body.dates : [],
        action: String(req.body?.action || "") as "set" | "remove",
      });
      return json(res, 200, result);
    }

    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { ok: false, error: "Method not allowed" });
  } catch (error) {
    if (isUnauthorizedCommandError(error)) {
      return unauthorized(res);
    }
    if (error instanceof CommandPublicApiError) {
      logCommandPublicApiError(`${scope}-availability`, error, {
        requestHost: req.headers.host || null,
        hasSessionCookie: true,
      });
      return json(res, error.status, { ok: false, error: error.message });
    }

    console.error(`[${scope}-availability] unexpected error`, error);
    return json(res, 500, { ok: false, error: "Server error" });
  }
}
