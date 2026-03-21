import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from "next";
import { BackofficeRole, type Brand } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import {
  getBackofficeIdentityFromSession,
  type BackofficeIdentityState,
} from "./backofficeIdentity";
import {
  getBackofficeRole,
  getSessionEmail,
  getSessionUsername,
  isBackofficeSession,
  requiresBackofficeMfaChallenge,
} from "./authScopes";
import { hasSatisfiedBackofficeMfaChallenge } from "./backofficeMfaChallenge";
import { prisma } from "./prisma";

type RequireBackofficeOptions = {
  callbackUrl?: string;
  superadminOnly?: boolean;
  allowPendingMfa?: boolean;
};

type BrandSelectionInput =
  | {
      brandId?: unknown;
      brandKey?: unknown;
    }
  | null
  | undefined;

function normalizeRecordId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeBrandKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function buildAdminRedirect(callbackUrl?: string) {
  const target = callbackUrl || "/admin/library";
  return {
    redirect: {
      destination: `/admin/signin?callbackUrl=${encodeURIComponent(target)}`,
      permanent: false,
    },
  } as const;
}

function buildAdminMfaRedirect(callbackUrl?: string) {
  const target = callbackUrl || "/admin/library";
  return {
    redirect: {
      destination: `/admin/mfa?callbackUrl=${encodeURIComponent(target)}`,
      permanent: false,
    },
  } as const;
}

async function loadResolvedPrincipal(
  session: any,
  options?: RequireBackofficeOptions
): Promise<BackofficeIdentityState | null> {
  if (!isBackofficeSession(session)) return null;

  const principal = await getBackofficeIdentityFromSession(session);
  if (!principal) return null;
  if (options?.superadminOnly && principal.role !== BackofficeRole.SUPERADMIN) return null;

  return principal;
}

export function hasVerifiedBackofficeMfaForRequest(
  req: Pick<NextApiRequest, "cookies" | "headers"> | Pick<GetServerSidePropsContext["req"], "cookies" | "headers">,
  session: any
) {
  return hasSatisfiedBackofficeMfaChallenge(req as any, session);
}

export function requiresPendingBackofficeMfa(session: any, req: Pick<NextApiRequest, "cookies" | "headers"> | Pick<GetServerSidePropsContext["req"], "cookies" | "headers">) {
  return requiresBackofficeMfaChallenge(session) && !hasVerifiedBackofficeMfaForRequest(req, session);
}

export function resolveBackofficePostAuthDestination(session: any): string {
  return getBackofficeRole(session) === BackofficeRole.SUPERADMIN ? "/admin/dashboard" : "/admin/library";
}

export async function requireBackofficeApi(
  req: NextApiRequest,
  res: NextApiResponse,
  options?: RequireBackofficeOptions
) {
  const session = await getServerSession(req, res, authOptions as any);
  const principal = await loadResolvedPrincipal(session, options);

  if (!principal) {
    return { ok: false as const, session, principal: null, reason: "UNAUTHORIZED" as const };
  }

  if (!options?.allowPendingMfa && requiresPendingBackofficeMfa(session, req)) {
    return { ok: false as const, session, principal, reason: "MFA_REQUIRED" as const };
  }

  return { ok: true as const, session, principal, reason: null };
}

export async function requireBackofficePage(
  ctx: GetServerSidePropsContext,
  options?: RequireBackofficeOptions
) {
  const session = await getServerSession(ctx.req, ctx.res, authOptions as any);
  const principal = await loadResolvedPrincipal(session, options);

  if (!principal) {
    return {
      ok: false as const,
      session,
      principal: null,
      reason: "UNAUTHORIZED" as const,
      response: buildAdminRedirect(options?.callbackUrl || ctx.resolvedUrl || "/admin/library"),
    };
  }

  if (!options?.allowPendingMfa && requiresPendingBackofficeMfa(session, ctx.req)) {
    return {
      ok: false as const,
      session,
      principal,
      reason: "MFA_REQUIRED" as const,
      response: buildAdminMfaRedirect(options?.callbackUrl || ctx.resolvedUrl || resolveBackofficePostAuthDestination(session)),
    };
  }

  return {
    ok: true as const,
      session,
      principal,
      reason: null,
      response: null,
      loggedInAs: getSessionEmail(session) || getSessionUsername(session) || principal.displayName,
    };
}

async function resolveRequestedBrand(raw: BrandSelectionInput): Promise<Pick<Brand, "id" | "brandKey"> | null> {
  const brandId = normalizeRecordId(raw?.brandId);
  if (brandId) {
    return prisma.brand.findUnique({
      where: { id: brandId },
      select: { id: true, brandKey: true },
    });
  }

  const brandKey = normalizeBrandKey(raw?.brandKey);
  if (brandKey) {
    return prisma.brand.findUnique({
      where: { brandKey },
      select: { id: true, brandKey: true },
    });
  }

  return null;
}

export function canBackofficeAccessBrand(principal: BackofficeIdentityState, brandId: string | null | undefined): boolean {
  if (!brandId) return principal.role === BackofficeRole.SUPERADMIN;
  return principal.role === BackofficeRole.SUPERADMIN || principal.allowedBrandIds.includes(brandId);
}

export function assertBackofficeBrandAccess(principal: BackofficeIdentityState, brandId: string | null | undefined) {
  if (!canBackofficeAccessBrand(principal, brandId)) {
    throw new Error("You do not have access to that brand");
  }
}

export async function resolveBackofficeReadFilter(
  principal: BackofficeIdentityState,
  raw?: BrandSelectionInput,
  field = "brandId"
): Promise<Record<string, any>> {
  const selected = await resolveRequestedBrand(raw);
  if (selected) {
    assertBackofficeBrandAccess(principal, selected.id);
    return { [field]: selected.id };
  }

  if (principal.role === BackofficeRole.SUPERADMIN) {
    return {};
  }

  return {
    [field]: {
      in: principal.allowedBrandIds,
    },
  };
}

export async function resolveBackofficeWriteBrandId(
  principal: BackofficeIdentityState,
  raw?: BrandSelectionInput,
  options?: {
    allowSingleBrandFallback?: boolean;
  }
): Promise<string> {
  const selected = await resolveRequestedBrand(raw);
  if (selected) {
    assertBackofficeBrandAccess(principal, selected.id);
    return selected.id;
  }

  if (!options?.allowSingleBrandFallback) {
    throw new Error("Brand selection is required");
  }

  if (principal.role === BackofficeRole.SUPERADMIN) {
    const brands = await prisma.brand.findMany({
      select: { id: true },
      orderBy: [{ createdAt: "asc" }],
      take: 2,
    });

    if (brands.length === 0) {
      throw new Error("No brand is configured. Run the brand sync before creating brand-scoped records.");
    }

    if (brands.length > 1) {
      throw new Error("Brand selection is required once multiple brands exist.");
    }

    return brands[0].id;
  }

  if (principal.allowedBrandIds.length === 0) {
    throw new Error("No brand access is assigned to this staff account");
  }

  if (principal.allowedBrandIds.length > 1) {
    throw new Error("Brand selection is required once multiple brands are assigned.");
  }

  return principal.allowedBrandIds[0];
}
