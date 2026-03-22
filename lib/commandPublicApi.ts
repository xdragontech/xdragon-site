import type { IncomingMessage } from "http";
import { buildOrigin, getApiRequestHost, getApiRequestProtocol } from "./requestHost";

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

export class CommandPublicApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "CommandPublicApiError";
    this.status = status;
  }
}

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

async function parseJsonSafe(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function requestCommandPublicApi<T>(
  pathname: string,
  options?: {
    method?: "GET" | "POST" | "PATCH";
    sessionToken?: string | null;
    body?: Record<string, unknown>;
    query?: Record<string, string | number | null | undefined>;
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
  };

  if (options?.sessionToken) {
    headers["X-Command-Session"] = options.sessionToken;
  }

  if (options?.body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url.toString(), {
    method: options?.method || "GET",
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && typeof (payload as any).error === "string"
        ? (payload as any).error
        : `Command public API request failed (${response.status})`;
    throw new CommandPublicApiError(response.status, message);
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
}) {
  return requestCommandPublicApi<{ ok: true; verificationRequired: true }>("/api/v1/auth/register", {
    method: "POST",
    body: {
      email: params.email,
      password: params.password,
      name: params.name,
    },
  });
}

export async function commandPublicVerifyEmail(token: string) {
  return requestCommandPublicApi<{ ok: true; verified: true }>("/api/v1/auth/verify-email", {
    method: "POST",
    body: { token },
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

export async function commandPublicLogin(params: { email: string; password: string }) {
  return requestCommandPublicApi<{ ok: true; session: CommandPublicSessionState["session"]; account: CommandPublicAccount }>(
    "/api/v1/auth/login",
    {
      method: "POST",
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

export async function commandPublicGetGuideBySlug(sessionToken: string, slug: string) {
  return requestCommandPublicApi<{ ok: true; item: CommandPublicGuideDetail }>(
    `/api/v1/resources/guides/${encodeURIComponent(slug)}`,
    {
      sessionToken,
    }
  );
}
