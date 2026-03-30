import crypto from "crypto";
import type { IncomingMessage, ServerResponse } from "http";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type CommandBffSessionPayload = {
  token: string;
  expiresAt: number;
  issuedAt: number;
};

function commandBffCookieName() {
  return process.env.VERCEL_ENV === "preview"
    ? "__Secure-stg-command-bff"
    : "__Secure-command-bff";
}

function getCookieEncryptionKey(): Buffer {
  const secret = String(process.env.COMMAND_BFF_SESSION_SECRET || "").trim();
  if (!secret) {
    throw new Error("COMMAND_BFF_SESSION_SECRET is required for command BFF sessions");
  }
  return crypto.createHash("sha256").update(`command-bff:${secret}`).digest();
}

function encodePayload(payload: CommandBffSessionPayload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getCookieEncryptionKey(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${body.toString("base64url")}.${tag.toString("base64url")}`;
}

function decodePayload(value: string | null | undefined): CommandBffSessionPayload | null {
  const [ivRaw, bodyRaw, tagRaw] = String(value || "").split(".");
  if (!ivRaw || !bodyRaw || !tagRaw) return null;

  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      getCookieEncryptionKey(),
      Buffer.from(ivRaw, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(bodyRaw, "base64url")),
      decipher.final(),
    ]).toString("utf8");

    const parsed = JSON.parse(plaintext);
    if (
      !parsed ||
      typeof parsed.token !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      typeof parsed.issuedAt !== "number"
    ) {
      return null;
    }

    if (!parsed.token || parsed.expiresAt <= Date.now()) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function readCookie(
  req: Pick<IncomingMessage, "headers"> & { cookies?: Partial<Record<string, string>> },
  name: string
) {
  const direct = req.cookies?.[name];
  if (typeof direct === "string" && direct) return direct;

  const header = req.headers?.cookie;
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

function serializeCookie(name: string, value: string, options?: { maxAge?: number; expires?: Date }) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "Secure", "SameSite=Lax", "HttpOnly"];
  if (typeof options?.maxAge === "number") parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  if (options?.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  return parts.join("; ");
}

function appendSetCookie(res: Pick<ServerResponse, "getHeader" | "setHeader">, value: string) {
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

export function getCommandBffSession(
  req: Pick<IncomingMessage, "headers"> & { cookies?: Partial<Record<string, string>> }
) {
  return decodePayload(readCookie(req, commandBffCookieName()));
}

export function getCommandBffSessionToken(
  req: Pick<IncomingMessage, "headers"> & { cookies?: Partial<Record<string, string>> }
) {
  return getCommandBffSession(req)?.token || null;
}

export function setCommandBffSessionCookie(
  res: Pick<ServerResponse, "getHeader" | "setHeader">,
  session: { token: string; expiresAt: string }
) {
  const expiresAt = new Date(session.expiresAt);
  const expiresAtMs = Number.isNaN(expiresAt.getTime()) ? Date.now() + COOKIE_MAX_AGE_SECONDS * 1000 : expiresAt.getTime();
  const maxAge = Math.max(0, Math.min(COOKIE_MAX_AGE_SECONDS, Math.floor((expiresAtMs - Date.now()) / 1000)));

  appendSetCookie(
    res,
    serializeCookie(
      commandBffCookieName(),
      encodePayload({
        token: session.token,
        expiresAt: expiresAtMs,
        issuedAt: Date.now(),
      }),
      {
        maxAge,
        expires: new Date(expiresAtMs),
      }
    )
  );
}

export function clearCommandBffSessionCookie(res: Pick<ServerResponse, "getHeader" | "setHeader">) {
  appendSetCookie(
    res,
    serializeCookie(commandBffCookieName(), "", {
      maxAge: 0,
      expires: new Date(0),
    })
  );
}
