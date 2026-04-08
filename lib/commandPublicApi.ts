import type { IncomingMessage } from "http";
import type { BrandStatus } from "@prisma/client";
import { buildOrigin, getApiRequestHost, getApiRequestProtocol } from "./requestHost";
import { getCfCountryIso2, getClientIp, getHeader, getUserAgent } from "./requestIdentity";

export type CommandPublicAccount = {
  id: string;
  brandKey: string;
  email: string;
  name: string | null;
  status: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

export type CommandPartnerPortalScope = "partners" | "sponsors";
export type CommandPartnerKind = "PARTICIPANT" | "SPONSOR";
export type CommandPartnerUserStatus = "ACTIVE" | "BLOCKED";
export type CommandPartnerParticipantType = "ENTERTAINMENT" | "FOOD_VENDOR" | "MARKET_VENDOR";
export type CommandPartnerEntertainmentType = "LIVE_BAND" | "DJ" | "COMEDY" | "MAGIC";
export type CommandPartnerFoodSetupType = "TRUCK" | "TRAILER" | "CART" | "STAND";
export type CommandPartnerMarketType =
  | "APPAREL"
  | "JEWELRY"
  | "DECOR"
  | "SKINCARE"
  | "FOOD"
  | "SERVICE"
  | "OTHER";
export type CommandPartnerSponsorType = "DIRECT" | "IN_KIND" | "MEDIA";
export type CommandPartnerApplicationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "WITHDRAWN";
export type CommandPartnerAssetKind = "PROFILE_IMAGE" | "DOCUMENT";
export type CommandPartnerAssetStorageBucket = "PUBLIC_MEDIA" | "PRIVATE_DOCUMENTS";
export type CommandParticipantRequirementType =
  | "BUSINESS_LICENSE"
  | "HEALTH_PERMIT"
  | "BUSINESS_INSURANCE"
  | "FIRE_PERMIT";
export type CommandParticipantRequirementReviewerState =
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED";
export type CommandPartnerPortalRequirementState =
  | "MISSING"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED";

export type CommandPartnerPortalAccount = {
  id: string;
  partnerProfileId: string;
  brandId: string;
  brandKey: string;
  brandName: string;
  email: string;
  kind: CommandPartnerKind;
  status: CommandPartnerUserStatus;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  passwordChangeRequired: boolean;
  displayName: string;
  slug: string;
};

export type CommandPartnerPortalEventOption = {
  id: string;
  slug: string;
  name: string;
  seasonStartsOn: string;
  seasonEndsOn: string;
};

export type CommandPartnerPortalApplication = {
  id: string;
  status: CommandPartnerApplicationStatus;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  withdrawnAt: string | null;
  event: CommandPartnerPortalEventOption;
};

export type CommandPartnerAssetSummary = {
  id: string;
  kind: CommandPartnerAssetKind;
  storageBucket: CommandPartnerAssetStorageBucket;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  imageWidth: number | null;
  imageHeight: number | null;
  publicUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CommandPartnerAssetAccess = {
  assetId: string;
  fileName: string;
  mimeType: string;
  storageBucket: CommandPartnerAssetStorageBucket;
  url: string;
  expiresAt: string | null;
};

export type CommandPartnerAssetUploadSession = {
  assetKind: CommandPartnerAssetKind;
  storageBucket: CommandPartnerAssetStorageBucket;
  objectKey: string;
  uploadMethod: "PUT";
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
  expiresAt: string;
  anticipatedPublicUrl: string | null;
};

export type CommandPartnerPortalRequirement = {
  requirementType: CommandParticipantRequirementType;
  state: CommandPartnerPortalRequirementState;
  reviewerState: CommandParticipantRequirementReviewerState | null;
  reviewerNotes: string | null;
  expiresAt: string | null;
  lastReviewedAt: string | null;
  asset: CommandPartnerAssetSummary | null;
};

export type CommandPartnerPortalRequirementsPayload = {
  ok: true;
  account: CommandPartnerPortalAccount;
  participantType: CommandPartnerParticipantType;
  requirements: CommandPartnerPortalRequirement[];
};

export type CommandParticipantPortalProfile = {
  kind: "PARTICIPANT";
  account: CommandPartnerPortalAccount;
  contactName: string;
  contactPhone: string;
  displayName: string;
  slug: string;
  summary: string | null;
  description: string | null;
  mainWebsiteUrl: string | null;
  socialLinks: Record<string, string> | null;
  profileCompletedAt: string | null;
  participantType: CommandPartnerParticipantType;
  entertainmentType: CommandPartnerEntertainmentType | null;
  entertainmentStyle: string | null;
  foodStyle: string | null;
  foodSetupType: CommandPartnerFoodSetupType | null;
  marketType: CommandPartnerMarketType | null;
  specialRequirements: string | null;
};

export type CommandSponsorPortalProfile = {
  kind: "SPONSOR";
  account: CommandPartnerPortalAccount;
  contactName: string;
  contactPhone: string;
  displayName: string;
  slug: string;
  description: string | null;
  mainWebsiteUrl: string | null;
  socialLinks: Record<string, string> | null;
  profileCompletedAt: string | null;
  productServiceType: string;
  audienceProfile: string | null;
  marketingGoals: string | null;
  onsitePlacement: string | null;
  signageInformation: string | null;
  staffed: boolean | null;
  sponsorType: CommandPartnerSponsorType | null;
  requests: string | null;
};

export type CommandPartnerPortalProfile = CommandParticipantPortalProfile | CommandSponsorPortalProfile;

export type CommandPartnerPortalApplicationsPayload = {
  ok: true;
  account: CommandPartnerPortalAccount;
  applications: CommandPartnerPortalApplication[];
  availableEvents: CommandPartnerPortalEventOption[];
};

export type CommandPublicSessionState = {
  session: {
    token: string;
    expiresAt: string;
  };
  account: CommandPublicAccount;
};

export type CommandPublicPromptItem = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  content: string;
};

export type CommandPublicGuideListItem = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  updatedAt: string;
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
  tags: string[] | null;
};

export type CommandPublicGuideDetail = CommandPublicGuideListItem & {
  body: string;
};

export type CommandPublicScheduleRange = {
  from: string;
  to: string;
};

export type CommandPublicScheduleParticipantType = "ENTERTAINMENT" | "FOOD_VENDOR" | "MARKET_VENDOR";

export type CommandPublicScheduleResourceType = "STAGE" | "FOOD_SPOT" | "MARKET_SPOT" | "OTHER";

export type CommandPublicScheduleItem = {
  id: string;
  kind: "TIMED_SLOT" | "FULL_DAY";
  status: string;
  allDay: boolean;
  occursOn: string;
  timezone: string;
  start: string;
  end: string;
  startsAtMinutes: number;
  endsAtMinutes: number;
  timeLabel: string;
  occurrenceWindowLabel: string;
  sequence: number | null;
  title: string;
  subtitle: string | null;
  description: string | null;
  locationLabel: string;
  url: string | null;
  eventSeries: {
    id: string;
    slug: string;
    name: string;
  };
  occurrence: {
    id: string;
    name: string | null;
    status: string;
  };
  resource: {
    id: string;
    slug: string;
    name: string;
    type: CommandPublicScheduleResourceType;
  };
  participant: {
    id: string;
    slug: string;
    displayName: string;
    type: CommandPublicScheduleParticipantType;
  };
};

export type CommandPublicScheduleResponse = {
  ok: true;
  range: CommandPublicScheduleRange;
  items: CommandPublicScheduleItem[];
};

export type CommandPublicScheduleAssignmentFeedItem = {
  source: "ASSIGNMENTS";
  occurrenceDate: string;
  resourceName: string;
  participantName: string;
  timeslot: string;
  locationId: string;
};

export type CommandPublicScheduleSponsorFeedItem = {
  source: "SPONSORS";
  sponsorName: string;
  sponsorWebsite: string | null;
  sponsorDescription: string | null;
  profileImageUrl: string | null;
  hasProfileImage: boolean;
};

export type CommandPublicScheduleFeedItem =
  | CommandPublicScheduleAssignmentFeedItem
  | CommandPublicScheduleSponsorFeedItem;

export type CommandPublicScheduleFeedResponse = {
  ok: true;
  feedId: string;
  source: "ASSIGNMENTS" | "SPONSORS";
  includeProfileImages: boolean;
  onlyProfileImages: boolean;
  items: CommandPublicScheduleFeedItem[];
};

export type CommandPublicAnalyticsConsentNotice = {
  id: string;
  version: number;
  status: "PUBLISHED";
  title: string;
  message: string;
  acceptLabel: string;
  declineLabel: string;
  publishedAt: string;
  updatedAt: string;
};

export type CommandPublicRuntimeBrandResolution = {
  source: "database";
  brandId?: string;
  brandKey: string;
  brandName: string;
  status: BrandStatus | "ACTIVE";
  environment: "production" | "preview";
  matchedHost: string;
  canonicalPublicHost: string;
  canonicalAdminHost: string;
  apexHost: string;
  isAdminHost: boolean;
};

export type CommandPublicRuntimeHostConfig = {
  requestHost: string;
  brandKey: string | null;
  runtime: CommandPublicRuntimeBrandResolution | null;
  canonicalPublicHost: string | null;
  canonicalAdminHost: string | null;
  allowedHosts: string[];
  resolvedFromBrandRegistry: boolean;
};

export type CommandPublicAnalyticsEvent = {
  eventId: string;
  eventType:
    | "SESSION_START"
    | "PAGE_VIEW"
    | "ENGAGEMENT_PING"
    | "SESSION_END"
    | "WEB_VITAL"
    | "PERFORMANCE_METRIC";
  occurredAt: string;
  path?: string | null;
  url?: string | null;
  referer?: string | null;
  engagedSeconds?: number | null;
  metricName?: string | null;
  metricValue?: number | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  msclkid?: string | null;
  ttclid?: string | null;
  raw?: unknown;
};

export type CommandPublicAnalyticsCollectResult = {
  ok: true;
  sessionId: string;
  acceptedEvents: number;
  duplicateEvents: number;
};

export type CommandPublicContactResult =
  | { ok: true; id?: string; notification?: "sent" | "deferred" }
  | { ok: false; error: string; details?: unknown };

export type CommandPublicChatRole = "user" | "assistant";

export type CommandPublicChatMessage = {
  role: CommandPublicChatRole;
  content: string;
};

export type CommandPublicChatLead = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  website?: string | null;
  preferred_contact?: "email" | "phone" | "text" | null;
};

export type CommandPublicChatResult =
  | {
      ok: true;
      reply: string;
      lead: {
        name: string | null;
        email: string | null;
        phone: string | null;
        company: string | null;
        website: string | null;
        preferred_contact: "email" | "phone" | "text" | null;
      };
      returnId?: string;
      emailed: boolean;
    }
  | { ok: false; error: string };
export class CommandPublicApiError extends Error {
  readonly status: number;
  readonly context?: {
    method: string;
    url: string;
    contentType: string | null;
    bodySnippet: string | null;
    upstreamError: string | null;
  };

  constructor(
    status: number,
    message: string,
    context?: {
      method: string;
      url: string;
      contentType: string | null;
      bodySnippet: string | null;
      upstreamError: string | null;
    }
  ) {
    super(message);
    this.name = "CommandPublicApiError";
    this.status = status;
    this.context = context;
  }
}

type CommandPublicRequestSource = Pick<IncomingMessage, "headers"> & {
  socket?: IncomingMessage["socket"];
  connection?: unknown;
};

const FORWARDED_CLIENT_IP_HEADER = "X-Command-Client-IP";
const FORWARDED_CLIENT_COUNTRY_HEADER = "X-Command-Client-Country-Iso2";
const FORWARDED_CLIENT_USER_AGENT_HEADER = "X-Command-Client-User-Agent";
const FORWARDED_CLIENT_REFERER_HEADER = "X-Command-Client-Referer";
const WEBSITE_SESSION_HEADER = "X-Command-Website-Session";

const TRACKED_PUBLIC_API_PERFORMANCE_ROUTES: Record<
  string,
  { routeKey: "LOGIN" | "SIGNUP" | "VERIFY_EMAIL" | "CONTACT" | "CHAT"; routeLabel: string }
> = {
  "/api/v1/auth/login": { routeKey: "LOGIN", routeLabel: "Login" },
  "/api/v1/auth/register": { routeKey: "SIGNUP", routeLabel: "Signup" },
  "/api/v1/auth/verify-email": { routeKey: "VERIFY_EMAIL", routeLabel: "Email Verification" },
  "/api/v1/contact": { routeKey: "CONTACT", routeLabel: "Contact" },
  "/api/v1/chat": { routeKey: "CHAT", routeLabel: "Chat" },
};

function normalizeBaseUrl(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.replace(/\/+$/, "");
}

function normalizeIntegrationKey(value: unknown) {
  return String(value || "").trim();
}

export function getCommandPublicApiConfig() {
  const baseUrl = normalizeBaseUrl(process.env.COMMAND_PUBLIC_API_BASE_URL);
  const integrationKey = normalizeIntegrationKey(process.env.COMMAND_PUBLIC_INTEGRATION_KEY);

  return {
    baseUrl,
    integrationKey,
    enabled: Boolean(baseUrl && integrationKey),
  };
}

export function isCommandPublicApiEnabled() {
  return getCommandPublicApiConfig().enabled;
}

export function getCommandPublicOriginFromRequest(
  req: Pick<IncomingMessage, "headers"> & { cookies?: Partial<Record<string, string>> }
) {
  return buildOrigin(getApiRequestProtocol(req), getApiRequestHost(req));
}

function buildForwardedClientHeaders(req?: CommandPublicRequestSource) {
  if (!req) return {};

  const headers: Record<string, string> = {};
  const ip = getClientIp(req);
  const countryIso2 = getCfCountryIso2(req);
  const userAgent = getUserAgent(req);
  const referer = getHeader(req, "referer")?.trim() || "";

  if (ip && ip !== "unknown") {
    headers[FORWARDED_CLIENT_IP_HEADER] = ip;
  }

  if (countryIso2) {
    headers[FORWARDED_CLIENT_COUNTRY_HEADER] = countryIso2;
  }

  if (userAgent) {
    headers[FORWARDED_CLIENT_USER_AGENT_HEADER] = userAgent;
  }

  if (referer) {
    headers[FORWARDED_CLIENT_REFERER_HEADER] = referer;
  }

  return headers;
}

async function readResponseBodySafe(response: Response) {
  const text = await response.text();
  if (!text) {
    return {
      text: null,
      payload: null,
    };
  }

  try {
    return {
      text,
      payload: JSON.parse(text),
    };
  } catch {
    return {
      text,
      payload: null,
    };
  }
}

function buildBodySnippet(value: string | null) {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.slice(0, 240);
}

export function logCommandPublicApiError(
  scope: string,
  error: CommandPublicApiError,
  extra?: Record<string, unknown>
) {
  console.error(
    JSON.stringify({
      scope,
      type: error.name,
      status: error.status,
      message: error.message,
      context: error.context || null,
      extra: extra || null,
    })
  );
}

async function requestCommandPublicApi<T>(
  pathname: string,
  options?: {
    method?: "GET" | "POST" | "PATCH";
    sessionToken?: string | null;
    websiteSessionId?: string | null;
    trackPerformance?: boolean;
    body?: Record<string, unknown>;
    query?: Record<string, string | number | null | undefined>;
    request?: CommandPublicRequestSource;
  }
): Promise<T> {
  const config = getCommandPublicApiConfig();
  if (!config.enabled) {
    throw new CommandPublicApiError(503, "Command public API is not configured");
  }

  const url = new URL(pathname, `${config.baseUrl}/`);
  for (const [key, value] of Object.entries(options?.query || {})) {
    if (value === null || typeof value === "undefined" || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  const headers: Record<string, string> = {
    "X-Command-Integration-Key": config.integrationKey,
    ...buildForwardedClientHeaders(options?.request),
  };

  if (options?.sessionToken) {
    headers["X-Command-Session"] = options.sessionToken;
  }

  if (options?.websiteSessionId) {
    headers[WEBSITE_SESSION_HEADER] = options.websiteSessionId;
  }

  if (options?.body) {
    headers["Content-Type"] = "application/json";
  }

  const method = options?.method || "GET";
  const startedAt = performance.now();
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });
  } catch (error) {
    throw new CommandPublicApiError(502, "Command public API network request failed", {
      method,
      url: url.toString(),
      contentType: null,
      bodySnippet: null,
      upstreamError: error instanceof Error ? error.message : null,
    });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const { payload, text } = await readResponseBodySafe(response);
  const requestDurationMs = Number((performance.now() - startedAt).toFixed(4));

  if (options?.trackPerformance !== false) {
    void recordCommandPublicApiPerformanceMetric({
      pathname,
      request: options?.request,
      websiteSessionId: options?.websiteSessionId || null,
      durationMs: requestDurationMs,
      statusCode: response.status,
    });
  }

  if (!response.ok) {
    const upstreamError =
      payload && typeof payload === "object" && typeof (payload as any).error === "string"
        ? (payload as any).error
        : null;
    const message =
      upstreamError || `Command public API request failed (${response.status})`;
    throw new CommandPublicApiError(response.status, message, {
      method,
      url: url.toString(),
      contentType: response.headers.get("content-type"),
      bodySnippet: buildBodySnippet(text),
      upstreamError,
    });
  }

  return payload as T;
}

export function isUnauthorizedCommandError(error: unknown) {
  return error instanceof CommandPublicApiError && error.status === 401;
}

export async function commandPublicRegister(params: {
  email: string;
  password: string;
  name?: string | null;
  request?: CommandPublicRequestSource;
  websiteSessionId?: string | null;
}) {
  return requestCommandPublicApi<{ ok: true; verificationRequired: true }>("/api/v1/auth/register", {
    method: "POST",
    request: params.request,
    websiteSessionId: params.websiteSessionId,
    body: {
      email: params.email,
      password: params.password,
      name: params.name,
    },
  });
}

export async function commandPublicVerifyEmail(params: {
  token: string;
  request?: CommandPublicRequestSource;
  websiteSessionId?: string | null;
}) {
  return requestCommandPublicApi<{ ok: true; verified: true }>("/api/v1/auth/verify-email", {
    method: "POST",
    request: params.request,
    websiteSessionId: params.websiteSessionId,
    body: { token: params.token },
  });
}

export async function commandPublicRequestPasswordReset(email: string) {
  return requestCommandPublicApi<{ ok: true }>("/api/v1/auth/password/forgot", {
    method: "POST",
    body: { email },
  });
}

export async function commandPublicResetPassword(params: { token: string; password: string }) {
  return requestCommandPublicApi<{ ok: true }>("/api/v1/auth/password/reset", {
    method: "POST",
    body: {
      token: params.token,
      password: params.password,
    },
  });
}

export async function commandPublicLogin(params: {
  email: string;
  password: string;
  request?: CommandPublicRequestSource;
  websiteSessionId?: string | null;
}) {
  return requestCommandPublicApi<{ ok: true; session: CommandPublicSessionState["session"]; account: CommandPublicAccount }>(
    "/api/v1/auth/login",
    {
      method: "POST",
      request: params.request,
      websiteSessionId: params.websiteSessionId,
      body: {
        email: params.email,
        password: params.password,
      },
    }
  );
}

export async function commandPublicGetSession(sessionToken: string) {
  return requestCommandPublicApi<{ ok: true; account: CommandPublicAccount }>("/api/v1/auth/session", {
    sessionToken,
  });
}

export async function commandPublicLogout(sessionToken: string) {
  return requestCommandPublicApi<void>("/api/v1/auth/logout", {
    method: "POST",
    sessionToken,
  });
}

function commandPartnerScopeBase(scope: CommandPartnerPortalScope) {
  return scope === "sponsors" ? "/api/v1/sponsors" : "/api/v1/partners";
}

export async function commandPartnerRegister(
  scope: CommandPartnerPortalScope,
  params: {
    body: Record<string, unknown>;
    request?: CommandPublicRequestSource;
    websiteSessionId?: string | null;
  }
) {
  return requestCommandPublicApi<{ ok: true; verificationRequired: true }>(
    `${commandPartnerScopeBase(scope)}/auth/register`,
    {
      method: "POST",
      request: params.request,
      websiteSessionId: params.websiteSessionId,
      trackPerformance: false,
      body: params.body,
    }
  );
}

export async function commandPartnerVerifyEmail(
  scope: CommandPartnerPortalScope,
  params: {
    token: string;
    request?: CommandPublicRequestSource;
    websiteSessionId?: string | null;
  }
) {
  return requestCommandPublicApi<{ ok: true; verified: true }>(
    `${commandPartnerScopeBase(scope)}/auth/verify-email`,
    {
      method: "POST",
      request: params.request,
      websiteSessionId: params.websiteSessionId,
      trackPerformance: false,
      body: { token: params.token },
    }
  );
}

export async function commandPartnerLogin(
  scope: CommandPartnerPortalScope,
  params: {
    email: string;
    password: string;
    request?: CommandPublicRequestSource;
    websiteSessionId?: string | null;
  }
) {
  return requestCommandPublicApi<{
    ok: true;
    session: {
      token: string;
      expiresAt: string;
    };
    account: CommandPartnerPortalAccount;
  }>(`${commandPartnerScopeBase(scope)}/auth/login`, {
    method: "POST",
    request: params.request,
    websiteSessionId: params.websiteSessionId,
    trackPerformance: false,
    body: {
      email: params.email,
      password: params.password,
    },
  });
}

export async function commandPartnerGetSession(
  scope: CommandPartnerPortalScope,
  sessionToken: string
) {
  return requestCommandPublicApi<{ ok: true; account: CommandPartnerPortalAccount }>(
    `${commandPartnerScopeBase(scope)}/auth/session`,
    {
      sessionToken,
      trackPerformance: false,
    }
  );
}

export async function commandPartnerChangePassword(
  scope: CommandPartnerPortalScope,
  params: {
    sessionToken: string;
    password: string;
  }
) {
  return requestCommandPublicApi<{ ok: true; account: CommandPartnerPortalAccount }>(
    `${commandPartnerScopeBase(scope)}/auth/change-password`,
    {
      method: "POST",
      sessionToken: params.sessionToken,
      trackPerformance: false,
      body: {
        password: params.password,
      },
    }
  );
}

export async function commandPartnerLogout(
  scope: CommandPartnerPortalScope,
  sessionToken: string
) {
  return requestCommandPublicApi<void>(`${commandPartnerScopeBase(scope)}/auth/logout`, {
    method: "POST",
    sessionToken,
    trackPerformance: false,
  });
}

export async function commandPartnerGetProfile(
  scope: CommandPartnerPortalScope,
  sessionToken: string
) {
  return requestCommandPublicApi<{ ok: true; profile: CommandPartnerPortalProfile }>(
    `${commandPartnerScopeBase(scope)}/profile`,
    {
      sessionToken,
      trackPerformance: false,
    }
  );
}

export async function commandPartnerUpdateProfile(
  scope: CommandPartnerPortalScope,
  params: {
    sessionToken: string;
    body: Record<string, unknown>;
  }
) {
  return requestCommandPublicApi<{ ok: true; profile: CommandPartnerPortalProfile }>(
    `${commandPartnerScopeBase(scope)}/profile`,
    {
      method: "PATCH",
      sessionToken: params.sessionToken,
      trackPerformance: false,
      body: params.body,
    }
  );
}

export async function commandPartnerListApplications(
  scope: CommandPartnerPortalScope,
  sessionToken: string
) {
  return requestCommandPublicApi<CommandPartnerPortalApplicationsPayload>(
    `${commandPartnerScopeBase(scope)}/applications`,
    {
      sessionToken,
      trackPerformance: false,
    }
  );
}

export async function commandPartnerSubmitApplication(
  scope: CommandPartnerPortalScope,
  params: {
    sessionToken: string;
    scheduleEventSeriesId: string;
  }
) {
  return requestCommandPublicApi<{ ok: true; application: CommandPartnerPortalApplication }>(
    `${commandPartnerScopeBase(scope)}/applications`,
    {
      method: "POST",
      sessionToken: params.sessionToken,
      trackPerformance: false,
      body: {
        scheduleEventSeriesId: params.scheduleEventSeriesId,
      },
    }
  );
}

export async function commandPartnerGetProfileImage(
  scope: CommandPartnerPortalScope,
  sessionToken: string
) {
  return requestCommandPublicApi<{ ok: true; asset: CommandPartnerAssetSummary | null }>(
    `${commandPartnerScopeBase(scope)}/profile/image`,
    {
      sessionToken,
      trackPerformance: false,
    }
  );
}

export async function commandPartnerCreateProfileImageUploadSession(
  scope: CommandPartnerPortalScope,
  params: {
    sessionToken: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  }
) {
  return requestCommandPublicApi<{ ok: true; upload: CommandPartnerAssetUploadSession }>(
    `${commandPartnerScopeBase(scope)}/profile/image/upload-session`,
    {
      method: "POST",
      sessionToken: params.sessionToken,
      trackPerformance: false,
      body: {
        fileName: params.fileName,
        mimeType: params.mimeType,
        sizeBytes: params.sizeBytes,
      },
    }
  );
}

export async function commandPartnerFinalizeProfileImage(
  scope: CommandPartnerPortalScope,
  params: {
    sessionToken: string;
    objectKey: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    checksumSha256?: string | null;
    imageWidth?: number | null;
    imageHeight?: number | null;
  }
) {
  return requestCommandPublicApi<{ ok: true; asset: CommandPartnerAssetSummary }>(
    `${commandPartnerScopeBase(scope)}/profile/image/finalize`,
    {
      method: "POST",
      sessionToken: params.sessionToken,
      trackPerformance: false,
      body: {
        objectKey: params.objectKey,
        fileName: params.fileName,
        mimeType: params.mimeType,
        sizeBytes: params.sizeBytes,
        checksumSha256: params.checksumSha256 || undefined,
        imageWidth: params.imageWidth ?? undefined,
        imageHeight: params.imageHeight ?? undefined,
      },
    }
  );
}

export async function commandPartnerGetAssetAccess(
  scope: CommandPartnerPortalScope,
  params: {
    sessionToken: string;
    assetId: string;
  }
) {
  return requestCommandPublicApi<{ ok: true; access: CommandPartnerAssetAccess }>(
    `${commandPartnerScopeBase(scope)}/assets/${encodeURIComponent(params.assetId)}/access`,
    {
      sessionToken: params.sessionToken,
      trackPerformance: false,
    }
  );
}

export async function commandParticipantGetRequirements(sessionToken: string) {
  return requestCommandPublicApi<CommandPartnerPortalRequirementsPayload>("/api/v1/partners/requirements", {
    sessionToken,
    trackPerformance: false,
  });
}

export async function commandParticipantCreateRequirementUploadSession(params: {
  sessionToken: string;
  requirementType: CommandParticipantRequirementType;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  return requestCommandPublicApi<{ ok: true; upload: CommandPartnerAssetUploadSession }>(
    `/api/v1/partners/requirements/${encodeURIComponent(params.requirementType)}/upload-session`,
    {
      method: "POST",
      sessionToken: params.sessionToken,
      trackPerformance: false,
      body: {
        fileName: params.fileName,
        mimeType: params.mimeType,
        sizeBytes: params.sizeBytes,
      },
    }
  );
}

export async function commandParticipantFinalizeRequirement(params: {
  sessionToken: string;
  requirementType: CommandParticipantRequirementType;
  objectKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256?: string | null;
  expiresAt: string;
}) {
  return requestCommandPublicApi<{ ok: true; requirement: CommandPartnerPortalRequirement }>(
    `/api/v1/partners/requirements/${encodeURIComponent(params.requirementType)}/finalize`,
    {
      method: "POST",
      sessionToken: params.sessionToken,
      trackPerformance: false,
      body: {
        objectKey: params.objectKey,
        fileName: params.fileName,
        mimeType: params.mimeType,
        sizeBytes: params.sizeBytes,
        checksumSha256: params.checksumSha256 || undefined,
        expiresAt: params.expiresAt,
      },
    }
  );
}

export async function commandPublicListPrompts(sessionToken: string, params?: { q?: string; category?: string; limit?: number }) {
  return requestCommandPublicApi<{ ok: true; items: CommandPublicPromptItem[] }>("/api/v1/resources/prompts", {
    sessionToken,
    query: {
      q: params?.q,
      category: params?.category,
      limit: params?.limit,
    },
  });
}

export async function commandPublicListGuides(sessionToken: string, params?: { q?: string; category?: string; limit?: number }) {
  return requestCommandPublicApi<{ ok: true; items: CommandPublicGuideListItem[] }>("/api/v1/resources/guides", {
    sessionToken,
    query: {
      q: params?.q,
      category: params?.category,
      limit: params?.limit,
    },
  });
}

export async function commandPublicContact(params: {
  name: string;
  email: string;
  phone?: string | null;
  message: string;
  request?: CommandPublicRequestSource;
  websiteSessionId?: string | null;
}) {
  return requestCommandPublicApi<CommandPublicContactResult>("/api/v1/contact", {
    method: "POST",
    request: params.request,
    websiteSessionId: params.websiteSessionId,
    body: {
      name: params.name,
      email: params.email,
      phone: params.phone,
      message: params.message,
    },
  });
}

export async function commandPublicChat(params: {
  conversationId?: string;
  messages: CommandPublicChatMessage[];
  lead?: CommandPublicChatLead | null;
  emailed?: boolean;
  request?: CommandPublicRequestSource;
  websiteSessionId?: string | null;
}) {
  return requestCommandPublicApi<CommandPublicChatResult>("/api/v1/chat", {
    method: "POST",
    request: params.request,
    websiteSessionId: params.websiteSessionId,
    body: {
      conversationId: params.conversationId,
      messages: params.messages,
      lead: params.lead || {},
      emailed: params.emailed,
    },
  });
}

export async function commandPublicGetGuideBySlug(sessionToken: string, slug: string) {
  return requestCommandPublicApi<{ ok: true; item: CommandPublicGuideDetail }>(
    `/api/v1/resources/guides/${encodeURIComponent(slug)}`,
    {
      sessionToken,
    }
  );
}

type CommandPublicScheduleQuery = {
  from?: string;
  to?: string;
  date?: string;
  occurrenceDate?: string;
  eventSeries?: string;
  participantType?: CommandPublicScheduleParticipantType | string;
  resource?: string;
  location?: string;
  resourceType?: CommandPublicScheduleResourceType | string;
  q?: string;
  sequence?: number | string;
  limit?: number;
};

export async function commandPublicListScheduleCalendar(params?: CommandPublicScheduleQuery) {
  return requestCommandPublicApi<CommandPublicScheduleResponse>("/api/v1/schedule/calendar", {
    query: {
      from: params?.from,
      to: params?.to,
      occurrenceDate: params?.occurrenceDate,
      eventSeries: params?.eventSeries,
      participantType: params?.participantType,
      resource: params?.resource,
      location: params?.location,
      resourceType: params?.resourceType,
      q: params?.q,
      sequence: params?.sequence ?? undefined,
      limit: params?.limit,
    },
  });
}

export async function commandPublicListScheduleList(params?: CommandPublicScheduleQuery) {
  return requestCommandPublicApi<CommandPublicScheduleResponse>("/api/v1/schedule/list", {
    query: {
      date: params?.date,
      from: params?.from,
      to: params?.to,
      occurrenceDate: params?.occurrenceDate,
      eventSeries: params?.eventSeries,
      participantType: params?.participantType,
      resource: params?.resource,
      location: params?.location,
      resourceType: params?.resourceType,
      q: params?.q,
      sequence: params?.sequence ?? undefined,
      limit: params?.limit,
    },
  });
}

export async function commandPublicGetScheduleFeed(params: {
  feedId: string;
  request?: CommandPublicRequestSource;
}) {
  return requestCommandPublicApi<CommandPublicScheduleFeedResponse>(
    `/api/v1/schedule/feeds/${encodeURIComponent(params.feedId)}`,
    {
      request: params.request,
      trackPerformance: false,
    }
  );
}

export async function commandPublicGetAnalyticsConsentNotice(params?: {
  request?: CommandPublicRequestSource;
}) {
  return requestCommandPublicApi<{ ok: true; notice: CommandPublicAnalyticsConsentNotice }>(
    "/api/v1/analytics/consent-notice",
    {
      request: params?.request,
    }
  );
}

export async function commandPublicGetRuntimeHostConfig(params: {
  host: string;
  request?: CommandPublicRequestSource;
}) {
  const payload = await requestCommandPublicApi<{
    ok: true;
    config: CommandPublicRuntimeHostConfig;
  }>("/api/v1/runtime/host", {
    query: {
      host: params.host,
    },
    request: params.request,
    trackPerformance: false,
  });

  return payload.config;
}

export async function commandPublicCollectAnalytics(params: {
  events: CommandPublicAnalyticsEvent[];
  websiteSessionId: string;
  request?: CommandPublicRequestSource;
}) {
  return requestCommandPublicApi<CommandPublicAnalyticsCollectResult>("/api/v1/analytics/collect", {
    method: "POST",
    request: params.request,
    websiteSessionId: params.websiteSessionId,
    trackPerformance: false,
    body: {
      events: params.events,
    },
  });
}

async function recordCommandPublicApiPerformanceMetric(params: {
  pathname: string;
  request?: CommandPublicRequestSource;
  websiteSessionId: string | null;
  durationMs: number;
  statusCode: number;
}) {
  const route = TRACKED_PUBLIC_API_PERFORMANCE_ROUTES[params.pathname];
  if (!route || !params.request || !params.websiteSessionId) return;

  try {
    await commandPublicCollectAnalytics({
      request: params.request,
      websiteSessionId: params.websiteSessionId,
      events: [
        {
          eventId: `perf_${route.routeKey.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          eventType: "PERFORMANCE_METRIC",
          occurredAt: new Date().toISOString(),
          metricName: "REQUEST_MS",
          metricValue: params.durationMs,
          url: getHeader(params.request, "referer")?.trim() || null,
          raw: {
            source: "PUBLIC_API",
            routeKey: route.routeKey,
            routeLabel: route.routeLabel,
            statusCode: params.statusCode,
          },
        },
      ],
    });
  } catch (error) {
    console.error("[command-public-api] failed to record performance metric", {
      pathname: params.pathname,
      statusCode: params.statusCode,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
