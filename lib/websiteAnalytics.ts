import crypto from "crypto";
import type { IncomingMessage, ServerResponse } from "http";

const CONSENT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 30;

export type WebsiteAnalyticsConsentStatus = "unknown" | "accepted" | "declined";

export type WebsiteAnalyticsConsentState = {
  status: WebsiteAnalyticsConsentStatus;
  version: number | null;
  decidedAt: number | null;
};

export type WebsiteAnalyticsSessionState = {
  sessionId: string;
  consentVersion: number;
  startedAt: number;
};

type CookieRequest = Pick<IncomingMessage, "headers"> & {
  cookies?: Partial<Record<string, string>>;
};

type CookieResponse = Pick<ServerResponse, "getHeader" | "setHeader">;

function cookiePrefix() {
  if (process.env.VERCEL_ENV === "preview") return "__Secure-stg-";
  if (process.env.NODE_ENV === "production") return "__Secure-";
  return "";
}

function consentCookieName() {
  return `${cookiePrefix()}cmd-web-consent`;
}

function sessionCookieName() {
  return `${cookiePrefix()}cmd-web-sid`;
}

function serializeCookie(name: string, value: string, options?: { maxAge?: number; expires?: Date }) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "Secure", "SameSite=Lax"];
  if (typeof options?.maxAge === "number") parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  if (options?.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  return parts.join("; ");
}

function appendSetCookie(res: CookieResponse, value: string) {
  const current = res.getHeader("Set-Cookie");
  if (!current) {
    res.setHeader("Set-Cookie", value);
    return;
  }

  if (Array.isArray(current)) {
    res.setHeader("Set-Cookie", [...current.map(String), value]);
    return;
  }

  res.setHeader("Set-Cookie", [String(current), value]);
}

function readCookie(req: CookieRequest, name: string) {
  const direct = req.cookies?.[name];
  if (typeof direct === "string" && direct) return direct;

  const header = req.headers.cookie;
  if (!header) return null;

  for (const chunk of header.split(";")) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 0) continue;
    const key = trimmed.slice(0, separator).trim();
    if (key !== name) continue;
    return decodeURIComponent(trimmed.slice(separator + 1));
  }

  return null;
}

function encodePayload(payload: unknown) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload<T>(value: string | null | undefined): T | null {
  if (!value) return null;

  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function normalizeConsentState(raw: any): WebsiteAnalyticsConsentState {
  const status =
    raw?.status === "accepted" || raw?.status === "declined" ? raw.status : "unknown";
  const version = Number.isInteger(raw?.version) && raw.version > 0 ? raw.version : null;
  const decidedAt = Number.isInteger(raw?.decidedAt) && raw.decidedAt > 0 ? raw.decidedAt : null;

  if (status === "unknown") {
    return {
      status: "unknown",
      version: null,
      decidedAt: null,
    };
  }

  return {
    status,
    version,
    decidedAt,
  };
}

function normalizeSessionState(raw: any): WebsiteAnalyticsSessionState | null {
  const sessionId = typeof raw?.sessionId === "string" ? raw.sessionId.trim() : "";
  const consentVersion = Number.isInteger(raw?.consentVersion) && raw.consentVersion > 0 ? raw.consentVersion : null;
  const startedAt = Number.isInteger(raw?.startedAt) && raw.startedAt > 0 ? raw.startedAt : null;

  if (!sessionId || !consentVersion || !startedAt) return null;

  return {
    sessionId,
    consentVersion,
    startedAt,
  };
}

export function getWebsiteAnalyticsConsent(req: CookieRequest): WebsiteAnalyticsConsentState {
  return normalizeConsentState(decodePayload(readCookie(req, consentCookieName())));
}

export function setWebsiteAnalyticsConsent(
  res: CookieResponse,
  payload: {
    status: Exclude<WebsiteAnalyticsConsentStatus, "unknown">;
    version: number;
    decidedAt?: number;
  }
) {
  appendSetCookie(
    res,
    serializeCookie(
      consentCookieName(),
      encodePayload({
        status: payload.status,
        version: payload.version,
        decidedAt: payload.decidedAt || Date.now(),
      }),
      {
        maxAge: CONSENT_COOKIE_MAX_AGE_SECONDS,
        expires: new Date(Date.now() + CONSENT_COOKIE_MAX_AGE_SECONDS * 1000),
      }
    )
  );
}

export function clearWebsiteAnalyticsConsent(res: CookieResponse) {
  appendSetCookie(
    res,
    serializeCookie(consentCookieName(), "", {
      maxAge: 0,
      expires: new Date(0),
    })
  );
}

export function getWebsiteAnalyticsSession(req: CookieRequest): WebsiteAnalyticsSessionState | null {
  return normalizeSessionState(decodePayload(readCookie(req, sessionCookieName())));
}

export function getWebsiteAnalyticsSessionId(req: CookieRequest) {
  return getWebsiteAnalyticsSession(req)?.sessionId || null;
}

export function setWebsiteAnalyticsSession(
  res: CookieResponse,
  payload: WebsiteAnalyticsSessionState
) {
  appendSetCookie(
    res,
    serializeCookie(sessionCookieName(), encodePayload(payload), {
      maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
      expires: new Date(Date.now() + SESSION_COOKIE_MAX_AGE_SECONDS * 1000),
    })
  );
}

export function clearWebsiteAnalyticsSession(res: CookieResponse) {
  appendSetCookie(
    res,
    serializeCookie(sessionCookieName(), "", {
      maxAge: 0,
      expires: new Date(0),
    })
  );
}

export function invalidateWebsiteAnalyticsIfVersionChanged(
  req: CookieRequest,
  res: CookieResponse,
  currentVersion: number
): WebsiteAnalyticsConsentState {
  const consent = getWebsiteAnalyticsConsent(req);
  if (consent.status === "unknown") return consent;
  if (consent.version === currentVersion) return consent;

  clearWebsiteAnalyticsConsent(res);
  clearWebsiteAnalyticsSession(res);

  return {
    status: "unknown",
    version: null,
    decidedAt: null,
  };
}

export function ensureWebsiteAnalyticsSession(
  req: CookieRequest,
  res: CookieResponse,
  consentVersion: number
) {
  const existing = getWebsiteAnalyticsSession(req);
  if (existing && existing.consentVersion === consentVersion) {
    setWebsiteAnalyticsSession(res, existing);
    return {
      sessionId: existing.sessionId,
      isNewSession: false,
    };
  }

  const nextSession: WebsiteAnalyticsSessionState = {
    sessionId: crypto.randomUUID(),
    consentVersion,
    startedAt: Date.now(),
  };

  setWebsiteAnalyticsSession(res, nextSession);

  return {
    sessionId: nextSession.sessionId,
    isNewSession: true,
  };
}
