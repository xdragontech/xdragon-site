import bcrypt from "bcryptjs";
import {
  BrandStatus,
  ExternalUserStatus,
  type Prisma,
} from "@prisma/client";
import type { NextApiRequest } from "next";
import { prisma } from "./prisma";
import { type PublicBrandContext, resolvePublicBrandContext } from "./brandContext";
import {
  EXTERNAL_AUTH_SCOPE,
  getSessionBrandKey,
  isExternalSession,
} from "./authScopes";
import { getCfCountryIso2, getClientIp, getUserAgent, iso2ToCountryName } from "./requestIdentity";

type ExternalUserWithBrand = Prisma.ExternalUserGetPayload<{
  include: {
    brand: {
      select: {
        id: true;
        brandKey: true;
        name: true;
        status: true;
      };
    };
  };
}>;

export type ExternalIdentityState = {
  id: string;
  email: string | null;
  name: string | null;
  brandId: string;
  brandKey: string;
  brandName: string;
  status: ExternalUserStatus;
};

export type ExternalAuthUser = {
  id: string;
  email?: string;
  name: string;
  role: "USER";
  status: ExternalUserStatus;
  authScope: typeof EXTERNAL_AUTH_SCOPE;
  brandKey: string;
};

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function normalizeBrandKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function requireBrandId(brand: Pick<PublicBrandContext, "brandId" | "brandKey">): string {
  if (!brand.brandId) {
    throw new Error(`Brand ${brand.brandKey} is missing a persisted brand record`);
  }
  return brand.brandId;
}

function toExternalIdentityState(user: ExternalUserWithBrand): ExternalIdentityState {
  return {
    id: user.id,
    email: user.email || null,
    name: user.name || null,
    brandId: user.brandId,
    brandKey: user.brand.brandKey,
    brandName: user.brand.name,
    status: user.status,
  };
}

function isExternalUserAccessible(user: ExternalUserWithBrand | null | undefined): user is ExternalUserWithBrand {
  return Boolean(
    user &&
      user.brand.status === BrandStatus.ACTIVE &&
      user.status === ExternalUserStatus.ACTIVE &&
      user.emailVerified
  );
}

function toExternalAuthUser(user: ExternalUserWithBrand): ExternalAuthUser {
  const state = toExternalIdentityState(user);
  return {
    id: state.id,
    email: state.email || undefined,
    name: state.name || state.email || state.brandName,
    role: "USER",
    status: state.status,
    authScope: EXTERNAL_AUTH_SCOPE,
    brandKey: state.brandKey,
  };
}

async function fetchExternalUserById(id: string): Promise<ExternalUserWithBrand | null> {
  if (!id) return null;
  return prisma.externalUser.findUnique({
    where: { id },
    include: {
      brand: {
        select: {
          id: true,
          brandKey: true,
          name: true,
          status: true,
        },
      },
    },
  });
}

async function fetchExternalUserByBrandAndEmail(brandId: string, email: string): Promise<ExternalUserWithBrand | null> {
  return prisma.externalUser.findFirst({
    where: {
      brandId,
      email,
    },
    include: {
      brand: {
        select: {
          id: true,
          brandKey: true,
          name: true,
          status: true,
        },
      },
    },
  });
}

async function fetchExternalUserByBrandKeyAndEmail(brandKey: string, email: string): Promise<ExternalUserWithBrand | null> {
  return prisma.externalUser.findFirst({
    where: {
      email,
      brand: {
        brandKey,
      },
    },
    include: {
      brand: {
        select: {
          id: true,
          brandKey: true,
          name: true,
          status: true,
        },
      },
    },
  });
}

async function recordExternalLogin(user: ExternalUserWithBrand, req: Pick<NextApiRequest, "headers">): Promise<void> {
  try {
    const ip = getClientIp(req);
    const countryIso2 = getCfCountryIso2(req);
    const countryName = iso2ToCountryName(countryIso2);
    const userAgent = getUserAgent(req);

    await prisma.$transaction([
      prisma.externalUser.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
      prisma.externalLoginEvent.create({
        data: {
          externalUserId: user.id,
          brandId: user.brandId,
          ip,
          userAgent,
          countryIso2,
          countryName,
        },
      }),
    ]);
  } catch (error) {
    console.warn("External user login telemetry write failed:", error);
  }
}

export async function findExternalUserByEmail(
  brand: Pick<PublicBrandContext, "brandId" | "brandKey" | "brandName">,
  email: string
): Promise<ExternalUserWithBrand | null> {
  const brandId = requireBrandId(brand);
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  return fetchExternalUserByBrandAndEmail(brandId, normalizedEmail);
}

export async function authorizeExternalCredentials(
  credentials: Record<string, unknown> | undefined,
  req: Pick<NextApiRequest, "headers">
): Promise<ExternalAuthUser | null> {
  const brand = await resolvePublicBrandContext(req as NextApiRequest);
  if (!brand || brand.status !== BrandStatus.ACTIVE) return null;

  const email = normalizeEmail(credentials?.email);
  const password = String(credentials?.password || "");
  if (!email || !password) return null;

  const user = await findExternalUserByEmail(brand, email);
  if (!user) return null;
  if (user.status === ExternalUserStatus.BLOCKED) return null;
  if (!user.emailVerified) return null;
  if (!user.passwordHash) return null;
  if (!(await bcrypt.compare(password, user.passwordHash))) return null;

  await recordExternalLogin(user, req);
  return toExternalAuthUser(user);
}

export async function refreshExternalIdentity(sessionLike: {
  sub?: string | null;
  email?: string | null;
  brandKey?: string | null;
}): Promise<ExternalAuthUser | null> {
  const tokenId = typeof sessionLike.sub === "string" ? sessionLike.sub : "";
  if (tokenId) {
    const user = await fetchExternalUserById(tokenId);
    if (isExternalUserAccessible(user)) return toExternalAuthUser(user);
    if (user) return null;
  }

  const email = normalizeEmail(sessionLike.email);
  if (!email) return null;

  const brandKey = normalizeBrandKey(sessionLike.brandKey);
  if (brandKey) {
    const user = await fetchExternalUserByBrandKeyAndEmail(brandKey, email);
    if (isExternalUserAccessible(user)) return toExternalAuthUser(user);
    if (user) return null;
  }

  const matches = await prisma.externalUser.findMany({
    where: { email },
    take: 2,
    include: {
      brand: {
        select: {
          id: true,
          brandKey: true,
          name: true,
          status: true,
        },
      },
    },
  });

  if (matches.length === 1 && isExternalUserAccessible(matches[0])) {
    return toExternalAuthUser(matches[0]);
  }

  return null;
}

export async function getExternalIdentityFromSession(session: any): Promise<ExternalIdentityState | null> {
  if (!isExternalSession(session)) return null;

  const hydrated = await refreshExternalIdentity({
    sub: session?.user?.id || session?.id || session?.sub || null,
    email: session?.user?.email || session?.email || null,
    brandKey: getSessionBrandKey(session),
  });

  if (!hydrated) return null;

  const user = await fetchExternalUserById(hydrated.id);
  return isExternalUserAccessible(user) ? toExternalIdentityState(user) : null;
}
