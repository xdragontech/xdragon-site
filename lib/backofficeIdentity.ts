import bcrypt from "bcryptjs";
import {
  BackofficeRole,
  BackofficeUserStatus,
  BrandStatus,
  UserRole,
  UserStatus,
  type BackofficeUser,
  type Brand,
  type Prisma,
  type User,
} from "@prisma/client";
import type { NextApiRequest } from "next";
import { prisma } from "./prisma";
import {
  BACKOFFICE_AUTH_SCOPE,
  EXTERNAL_LEGACY_AUTH_SCOPE,
  getAuthScope,
} from "./authScopes";
import {
  getCfCountryIso2,
  getClientIp,
  getUserAgent,
  iso2ToCountryName,
} from "./requestIdentity";

const XDADMIN_ID = "xdadmin";

type BrandAccessRow = {
  id: string;
  brandKey: string;
  status: BrandStatus;
};

type BackofficeUserWithAccess = Prisma.BackofficeUserGetPayload<{
  include: {
    brandAccesses: {
      include: {
        brand: {
          select: {
            id: true;
            brandKey: true;
            status: true;
          };
        };
      };
    };
  };
}>;

type LegacyAdminSeed = Pick<User, "id" | "email" | "name" | "passwordHash" | "status" | "role" | "emailVerified">;

export type BackofficeIdentityState = {
  id: string;
  email: string | null;
  username: string;
  role: BackofficeRole;
  status: BackofficeUserStatus;
  allowedBrandIds: string[];
  allowedBrandKeys: string[];
  lastSelectedBrandKey: string | null;
  displayName: string;
  isEnvSuperadmin: boolean;
};

export type BackofficeAuthUser = {
  id: string;
  email?: string;
  name: string;
  username: string;
  role: "ADMIN";
  backofficeRole: BackofficeRole;
  status: BackofficeUserStatus;
  authScope: typeof BACKOFFICE_AUTH_SCOPE;
  allowedBrandIds: string[];
  allowedBrandKeys: string[];
  lastSelectedBrandKey: string | null;
};

export type ExternalLegacyAuthUser = {
  id: string;
  email?: string;
  name?: string;
  role: UserRole;
  status: UserStatus;
  authScope: typeof EXTERNAL_LEGACY_AUTH_SCOPE;
};

function normalizeEmail(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeUsername(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function usernameSeedFromEmail(email: string): string {
  return email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 32);
}

function normalizeUsernameSeed(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 32);
}

function toDisplayName(user: { username: string; email: string | null }) {
  return user.email || user.username;
}

function getAccessibleBrands(rows: Array<{ brand: BrandAccessRow }>): BrandAccessRow[] {
  return rows
    .map((row) => row.brand)
    .filter((brand) => brand && brand.status !== BrandStatus.DISABLED);
}

function toBackofficeIdentityState(user: BackofficeUserWithAccess): BackofficeIdentityState {
  const accessibleBrands = getAccessibleBrands(user.brandAccesses);
  const allowedBrandIds = accessibleBrands.map((brand) => brand.id);
  const allowedBrandKeys = accessibleBrands.map((brand) => brand.brandKey);

  return {
    id: user.id,
    email: user.email || null,
    username: user.username,
    role: user.role,
    status: user.status,
    allowedBrandIds,
    allowedBrandKeys,
    lastSelectedBrandKey:
      user.lastSelectedBrandKey && allowedBrandKeys.includes(user.lastSelectedBrandKey)
        ? user.lastSelectedBrandKey
        : null,
    displayName: toDisplayName(user),
    isEnvSuperadmin: false,
  };
}

function toBackofficeAuthUser(state: BackofficeIdentityState): BackofficeAuthUser {
  return {
    id: state.id,
    email: state.email || undefined,
    name: state.displayName,
    username: state.username,
    role: "ADMIN",
    backofficeRole: state.role,
    status: state.status,
    authScope: BACKOFFICE_AUTH_SCOPE,
    allowedBrandIds: state.allowedBrandIds,
    allowedBrandKeys: state.allowedBrandKeys,
    lastSelectedBrandKey: state.lastSelectedBrandKey,
  };
}

function toExternalLegacyAuthUser(user: Pick<User, "id" | "email" | "name" | "role" | "status">): ExternalLegacyAuthUser {
  return {
    id: user.id,
    email: user.email || undefined,
    name: user.name || undefined,
    role: user.role,
    status: user.status,
    authScope: EXTERNAL_LEGACY_AUTH_SCOPE,
  };
}

export function getXdAdminIdentity() {
  const username = normalizeUsername(process.env.XDADMIN_USERNAME || "xdadmin");
  const email = normalizeEmail(process.env.XDADMIN_EMAIL || "xdadmin@xdragon.tech");
  const password = process.env.XDADMIN_PASSWORD || "";
  return { id: XDADMIN_ID, username, email, password };
}

export function isEnvAdminEmail(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  const raw = process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL_LIST || process.env.ADMIN_USERS || "";
  const allowed = new Set(
    raw
      .split(/[,\s]+/)
      .map((entry) => normalizeEmail(entry))
      .filter(Boolean)
  );

  return allowed.has(normalized);
}

export function isProtectedBackofficeIdentity(email: string | null | undefined, username: string | null | undefined): boolean {
  const normalizedEmail = normalizeEmail(email);
  const normalizedUsername = normalizeUsername(username);
  const xd = getXdAdminIdentity();

  return Boolean(
    (normalizedEmail && (normalizedEmail === xd.email || isEnvAdminEmail(normalizedEmail))) ||
    (normalizedUsername && normalizedUsername === xd.username)
  );
}

async function listActiveBrandAccessRows(
  tx: Pick<typeof prisma, "brand"> = prisma
): Promise<Array<{ id: string; brandKey: string }>> {
  return tx.brand.findMany({
    where: { status: { not: BrandStatus.DISABLED } },
    orderBy: [{ createdAt: "asc" }],
    select: { id: true, brandKey: true },
  });
}

async function buildUniqueUsername(
  tx: Pick<typeof prisma, "backofficeUser">,
  preferred: string
): Promise<string> {
  const base = normalizeUsernameSeed(preferred) || "staff";
  let candidate = base;

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const existing = await tx.backofficeUser.findUnique({
      where: { username: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${base}-${suffix}`;
  }

  throw new Error("Unable to allocate a unique backoffice username");
}

async function fetchBackofficeUserByIdentifier(identifier: string): Promise<BackofficeUserWithAccess | null> {
  return prisma.backofficeUser.findFirst({
    where: {
      OR: [{ username: identifier }, { email: identifier }],
    },
    include: {
      brandAccesses: {
        include: {
          brand: {
            select: {
              id: true,
              brandKey: true,
              status: true,
            },
          },
        },
      },
    },
  });
}

async function fetchBackofficeUserById(id: string): Promise<BackofficeUserWithAccess | null> {
  return prisma.backofficeUser.findUnique({
    where: { id },
    include: {
      brandAccesses: {
        include: {
          brand: {
            select: {
              id: true,
              brandKey: true,
              status: true,
            },
          },
        },
      },
    },
  });
}

async function fetchEligibleLegacyAdmin(email: string): Promise<LegacyAdminSeed | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      status: true,
      role: true,
      emailVerified: true,
    },
  });

  if (!user?.email || !user.passwordHash) return null;
  if (user.status === UserStatus.BLOCKED) return null;
  if (!user.emailVerified) return null;
  if (user.role !== UserRole.ADMIN && !isEnvAdminEmail(user.email)) return null;

  return user;
}

async function ensureBackofficeUserFromLegacy(legacy: LegacyAdminSeed): Promise<BackofficeUserWithAccess> {
  const email = normalizeEmail(legacy.email);
  const passwordHash = legacy.passwordHash;
  if (!email || !passwordHash) {
    throw new Error("Legacy admin is missing required credentials");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.backofficeUser.findUnique({
      where: { email },
      include: {
        brandAccesses: {
          include: {
            brand: {
              select: {
                id: true,
                brandKey: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (existing) return existing;

    const role = isEnvAdminEmail(email) ? BackofficeRole.SUPERADMIN : BackofficeRole.STAFF;
    const username = await buildUniqueUsername(
      tx,
      usernameSeedFromEmail(email) || normalizeUsernameSeed(String(legacy.name || "")) || "staff"
    );

    const created = await tx.backofficeUser.create({
      data: {
        username,
        email,
        passwordHash,
        role,
        status: legacy.status === UserStatus.BLOCKED ? BackofficeUserStatus.BLOCKED : BackofficeUserStatus.ACTIVE,
        lastLoginAt: null,
      },
    });

    const brands = await listActiveBrandAccessRows(tx);
    if (brands.length > 0) {
      await tx.backofficeUserBrandAccess.createMany({
        data: brands.map((brand) => ({
          userId: created.id,
          brandId: brand.id,
        })),
        skipDuplicates: true,
      });
    }

    const reloaded = await tx.backofficeUser.findUnique({
      where: { id: created.id },
      include: {
        brandAccesses: {
          include: {
            brand: {
              select: {
                id: true,
                brandKey: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!reloaded) throw new Error("Failed to load bootstrapped backoffice user");
    return reloaded;
  });
}

export async function syncLegacyAdminsToBackoffice(): Promise<{ created: number }> {
  const envAdminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL_LIST || process.env.ADMIN_USERS || "")
    .split(/[,\s]+/)
    .map((entry) => normalizeEmail(entry))
    .filter(Boolean);

  const whereClauses: Prisma.UserWhereInput[] = [{ role: UserRole.ADMIN }];
  if (envAdminEmails.length > 0) {
    whereClauses.push({ email: { in: envAdminEmails } });
  }

  const users = await prisma.user.findMany({
    where: {
      AND: [
        { email: { not: null } },
        { passwordHash: { not: null } },
        { emailVerified: { not: null } },
        { OR: whereClauses },
      ],
    },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      status: true,
      role: true,
      emailVerified: true,
    },
    orderBy: [{ createdAt: "asc" }],
  });

  let created = 0;
  for (const user of users) {
    const email = normalizeEmail(user.email);
    if (!email) continue;

    const existing = await prisma.backofficeUser.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) continue;

    await ensureBackofficeUserFromLegacy(user);
    created += 1;
  }

  return { created };
}

export async function authorizeBackofficeCredentials(
  credentials: Record<string, unknown> | undefined
): Promise<BackofficeAuthUser | null> {
  const identifierRaw = String(credentials?.email || credentials?.username || "").trim();
  const identifier = normalizeUsername(identifierRaw);
  const password = String(credentials?.password || "");

  if (!identifier || !password) return null;

  const xd = getXdAdminIdentity();
  if (identifier === xd.username || identifier === xd.email) {
    if (!xd.password || password !== xd.password) return null;
    const brands = await listActiveBrandAccessRows();
    return toBackofficeAuthUser({
      id: XDADMIN_ID,
      email: xd.email,
      username: xd.username,
      role: BackofficeRole.SUPERADMIN,
      status: BackofficeUserStatus.ACTIVE,
      allowedBrandIds: brands.map((brand) => brand.id),
      allowedBrandKeys: brands.map((brand) => brand.brandKey),
      lastSelectedBrandKey: brands[0]?.brandKey || null,
      displayName: xd.email,
      isEnvSuperadmin: true,
    });
  }

  let user = await fetchBackofficeUserByIdentifier(identifier);

  if (!user && identifier.includes("@")) {
    const legacy = await fetchEligibleLegacyAdmin(identifier);
    if (legacy?.passwordHash && (await bcrypt.compare(password, legacy.passwordHash))) {
      user = await ensureBackofficeUserFromLegacy(legacy);
    }
  }

  if (!user) return null;
  if (user.status === BackofficeUserStatus.BLOCKED) return null;
  if (!(await bcrypt.compare(password, user.passwordHash))) return null;

  await prisma.backofficeUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const state = toBackofficeIdentityState(user);
  if (state.role !== BackofficeRole.SUPERADMIN && state.allowedBrandIds.length === 0) {
    return null;
  }

  return toBackofficeAuthUser(state);
}

export async function authorizeLegacyExternalCredentials(
  credentials: Record<string, unknown> | undefined,
  req: Pick<NextApiRequest, "headers">
): Promise<ExternalLegacyAuthUser | null> {
  const email = normalizeEmail(credentials?.email);
  const password = String(credentials?.password || "");

  if (!email || !password) return null;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;
  if (user.status === UserStatus.BLOCKED) return null;
  if (!user.emailVerified) return null;
  if (!user.passwordHash) return null;
  if (!(await bcrypt.compare(password, user.passwordHash))) return null;

  try {
    const ip = getClientIp(req);
    const countryIso2 = getCfCountryIso2(req);
    const countryName = iso2ToCountryName(countryIso2);
    const userAgent = getUserAgent(req);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
      prisma.loginEvent.create({ data: { userId: user.id, ip, userAgent, countryIso2, countryName } }),
    ]);
  } catch (error) {
    console.warn("Legacy user LoginEvent write failed:", error);
  }

  return toExternalLegacyAuthUser(user);
}

export async function refreshBackofficeIdentity(sessionLike: { sub?: string | null; email?: string | null }): Promise<BackofficeAuthUser | null> {
  const xd = getXdAdminIdentity();
  const tokenEmail = normalizeEmail(sessionLike.email);
  const tokenId = String(sessionLike.sub || "");

  if (tokenId === XDADMIN_ID || tokenEmail === xd.email) {
    const brands = await listActiveBrandAccessRows();
    return toBackofficeAuthUser({
      id: XDADMIN_ID,
      email: xd.email,
      username: xd.username,
      role: BackofficeRole.SUPERADMIN,
      status: BackofficeUserStatus.ACTIVE,
      allowedBrandIds: brands.map((brand) => brand.id),
      allowedBrandKeys: brands.map((brand) => brand.brandKey),
      lastSelectedBrandKey: brands[0]?.brandKey || null,
      displayName: xd.email,
      isEnvSuperadmin: true,
    });
  }

  if (!tokenId) return null;

  const user = await fetchBackofficeUserById(tokenId);
  if (!user) return null;

  const state = toBackofficeIdentityState(user);
  if (state.role !== BackofficeRole.SUPERADMIN && state.allowedBrandIds.length === 0) {
    return null;
  }

  return toBackofficeAuthUser(state);
}

export async function refreshLegacyExternalIdentity(sessionLike: { email?: string | null }): Promise<ExternalLegacyAuthUser | null> {
  const email = normalizeEmail(sessionLike.email);
  if (!email) return null;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true, status: true },
  });

  if (!user) return null;

  return toExternalLegacyAuthUser(user);
}

export async function getBackofficeIdentityFromSession(session: any): Promise<BackofficeIdentityState | null> {
  if (getAuthScope(session) !== BACKOFFICE_AUTH_SCOPE) return null;

  const hydrated = await refreshBackofficeIdentity({
    sub: session?.user?.id || session?.id || session?.sub || null,
    email: session?.user?.email || session?.email || null,
  });

  if (!hydrated) return null;

  return {
    id: hydrated.id,
    email: hydrated.email || null,
    username: hydrated.username,
    role: hydrated.backofficeRole,
    status: hydrated.status,
    allowedBrandIds: hydrated.allowedBrandIds,
    allowedBrandKeys: hydrated.allowedBrandKeys,
    lastSelectedBrandKey: hydrated.lastSelectedBrandKey,
    displayName: hydrated.name,
    isEnvSuperadmin: hydrated.id === XDADMIN_ID,
  };
}
