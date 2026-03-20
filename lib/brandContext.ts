import type { NextApiRequest, NextApiResponse } from "next";
import { getBrandSiteConfig } from "./siteConfig";
import { buildOrigin, getApiRequestHost, getApiRequestProtocol, normalizeHost } from "./requestHost";

export type BrandEnvironment = "production" | "preview";
export type BrandStatus = "ACTIVE";

export type PublicBrandContext = {
  brandKey: string;
  brandName: string;
  status: BrandStatus;
  environment: BrandEnvironment;
  matchedHost: string;
  canonicalPublicHost: string;
  apexHost: string;
};

export type BackofficeBrandScope = {
  allowedBrandKeys: string[];
  lastSelectedBrandKey?: string | null;
};

function normalizeBrandKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

export function createBackofficeBrandScope(
  allowedBrandKeys: string[],
  lastSelectedBrandKey?: string | null
): BackofficeBrandScope {
  const normalizedKeys = Array.from(
    new Set(
      allowedBrandKeys
        .map((value) => normalizeBrandKey(value))
        .filter((value): value is string => Boolean(value))
    )
  );

  const selected = normalizeBrandKey(lastSelectedBrandKey);
  return {
    allowedBrandKeys: normalizedKeys,
    lastSelectedBrandKey: selected && normalizedKeys.includes(selected) ? selected : null,
  };
}

export function canAccessBrand(scope: BackofficeBrandScope, brandKey: string | null | undefined): boolean {
  const normalized = normalizeBrandKey(brandKey);
  if (!normalized) return false;
  return scope.allowedBrandKeys.includes(normalized);
}

export function resolvePublicBrandContextForHost(host: string): PublicBrandContext | null {
  const cfg = getBrandSiteConfig();
  const normalizedHost = normalizeHost(host);
  const brandKey = normalizeBrandKey(cfg.brandKey) || "xdragon";

  if (!normalizedHost) return null;

  if (normalizedHost === normalizeHost(cfg.production.publicHost)) {
    return {
      brandKey,
      brandName: cfg.brandName,
      status: "ACTIVE",
      environment: "production",
      matchedHost: normalizedHost,
      canonicalPublicHost: normalizeHost(cfg.production.publicHost),
      apexHost: normalizeHost(cfg.apexHost),
    };
  }

  if (normalizedHost === normalizeHost(cfg.preview.publicHost)) {
    return {
      brandKey,
      brandName: cfg.brandName,
      status: "ACTIVE",
      environment: "preview",
      matchedHost: normalizedHost,
      canonicalPublicHost: normalizeHost(cfg.preview.publicHost),
      apexHost: normalizeHost(cfg.apexHost),
    };
  }

  if (normalizedHost === normalizeHost(cfg.apexHost)) {
    return {
      brandKey,
      brandName: cfg.brandName,
      status: "ACTIVE",
      environment: "production",
      matchedHost: normalizedHost,
      canonicalPublicHost: normalizeHost(cfg.production.publicHost),
      apexHost: normalizeHost(cfg.apexHost),
    };
  }

  return null;
}

export function resolvePublicBrandContext(req: NextApiRequest): PublicBrandContext | null {
  return resolvePublicBrandContextForHost(getApiRequestHost(req));
}

export function getCanonicalPublicOrigin(req: NextApiRequest, brand: PublicBrandContext): string {
  return buildOrigin(getApiRequestProtocol(req), brand.canonicalPublicHost);
}

export function getRequestedBrandKey(req: NextApiRequest): string | null {
  const fromHeader = normalizeBrandKey(req.headers["x-brand-key"]);
  if (fromHeader) return fromHeader;

  const queryValue = Array.isArray(req.query?.brandKey) ? req.query.brandKey[0] : req.query?.brandKey;
  const fromQuery = normalizeBrandKey(queryValue);
  if (fromQuery) return fromQuery;

  return normalizeBrandKey((req.body || {}).brandKey);
}

export type EnsuredPublicBrandRequest = {
  brand: PublicBrandContext;
  requestedBrandKey: string | null;
};

export function ensurePublicBrandRequest(
  req: NextApiRequest,
  res: NextApiResponse<any>
): EnsuredPublicBrandRequest | null {
  const brand = resolvePublicBrandContext(req);
  if (!brand) {
    res.status(403).json({ ok: false, error: "Unknown brand host" });
    return null;
  }

  const requestedBrandKey = getRequestedBrandKey(req);
  if (requestedBrandKey && requestedBrandKey !== brand.brandKey) {
    res.status(409).json({ ok: false, error: "Brand mismatch for request host" });
    return null;
  }

  return { brand, requestedBrandKey };
}
